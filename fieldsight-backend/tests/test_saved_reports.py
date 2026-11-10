"""Lifecycle, snapshot integrity, authorization, and durable exports on disposable data."""

import io
import re
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from pypdf import PdfReader
from sqlmodel import Session, select
from test_analysis import analysis_client as analysis_client
from test_kobo_sync import sync_client as sync_client

from app.models.identity import Organization, OrganizationMembership, Role
from app.models.operations import Indicator
from app.models.reporting import Report, ReportSnapshot


def report_body(**changes):
    return {
        "template_key": "monthly",
        "title": "October monitoring report",
        "reporting_period_start": "2026-10-01",
        "reporting_period_end": "2026-10-31",
        "sections": {"executive_summary": "Evidence <script>alert(1)</script> & findings"},
        "indicator_ids": [],
        **changes,
    }


def create(client, project, headers, **changes):
    response = client.post(f"/projects/{project}/reports", headers=headers, json=report_body(**changes))
    assert response.status_code == 201, response.text
    return response.json()


def preview(client, report, headers):
    response = client.get(f"/reports/{report['id']}/preview", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def publish(client, report, headers, captured=None):
    captured = captured or preview(client, report, headers)
    return client.post(
        f"/reports/{report['id']}/publish",
        headers=headers,
        json={"expected_revision": report["revision_number"], "preview_hash": captured["content_hash"]},
    )


def test_templates_crud_validation_and_optimistic_edits(sync_client):
    client, _, project, headers = sync_client
    templates = client.get("/report-templates", headers=headers).json()
    assert {t["key"] for t in templates} == {"monthly", "quarterly", "donor"}
    for changes in (
        {"template_key": "unknown"},
        {"reporting_period_end": "2026-09-01"},
        {"sections": {"unknown": "text"}},
        {"indicator_ids": [str(uuid4())]},
        {"title": "  "},
        {"sections": {"challenges": "x" * 30001}},
    ):
        response = client.post(f"/projects/{project}/reports", headers=headers, json=report_body(**changes))
        assert response.status_code == 422, response.text
    report = create(client, project, headers)
    assert report["sections"]["recommendations"] == ""
    assert report["updated_by_id"] == report["created_by_id"]
    assert client.get(f"/projects/{project}/reports?limit=1", headers=headers).json()["total"] == 1
    assert client.get(f"/projects/{project}/reports?limit=0", headers=headers).status_code == 422
    body = {**report_body(title="Revised report"), "expected_revision": 1}
    response = client.patch(f"/reports/{report['id']}", headers=headers, json=body)
    assert response.status_code == 200, response.text
    assert response.json()["revision_number"] == 2
    assert client.patch(f"/reports/{report['id']}", headers=headers, json=body).status_code == 409
    assert client.delete(f"/reports/{report['id']}?expected_revision=1", headers=headers).status_code == 409
    copy = client.post(f"/reports/{report['id']}/duplicate", headers=headers)
    assert copy.status_code == 201 and copy.json()["status"] == "draft"
    assert client.delete(f"/reports/{report['id']}?expected_revision=2", headers=headers).status_code == 204


def test_publication_freezes_results_targets_and_pdf_and_is_idempotent(sync_client):
    client, engine, project, headers = sync_client
    indicator = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={
            "name": "Days to respond",
            "code": "DAYS",
            "unit": "days",
            "direction": "decrease",
            "manual_aggregation": "latest",
            "baseline_value": 20,
            "target_value": 5,
        },
    ).json()
    added = client.post(
        f"/indicators/{indicator['id']}/collected-results",
        headers=headers,
        json={"result_date": "2026-10-02", "value": 4},
    )
    assert added.status_code == 201, added.text
    report = create(client, project, headers, indicator_ids=[indicator["id"]])
    captured = preview(client, report, headers)
    authoritative = client.get(
        f"/projects/{project}/indicators?date_from=2026-10-01&date_to=2026-10-31", headers=headers
    ).json()
    assert captured["data"]["indicators"] == authoritative
    response = publish(client, report, headers, captured)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "published"
    snapshot = client.get(f"/reports/{report['id']}/snapshot", headers=headers).json()
    pdf = client.get(f"/reports/{report['id']}/export.pdf", headers=headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    text = "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf.content)).pages)
    assert "October monitoring report" in text and "Sync Org" in text and "2026-10-31" in text
    assert "<script>alert(1)</script>" in text  # plain escaped text, never evaluated
    with Session(engine) as db:
        source = db.get(Indicator, UUID(indicator["id"]))
        source.target_value = 100
        source.name = "Renamed after publication"
        db.add(source)
        db.commit()
    added = client.post(
        f"/indicators/{indicator['id']}/collected-results",
        headers=headers,
        json={"result_date": "2026-10-03", "value": 99},
    )
    assert added.status_code == 201
    assert client.get(f"/reports/{report['id']}/snapshot", headers=headers).json() == snapshot
    assert client.get(f"/reports/{report['id']}/export.pdf", headers=headers).content == pdf.content
    assert publish(client, report, headers, captured).status_code == 200
    with Session(engine) as db:
        assert len(db.exec(select(ReportSnapshot)).all()) == 1
    assert (
        client.patch(
            f"/reports/{report['id']}", headers=headers, json={**report_body(), "expected_revision": 2}
        ).status_code
        == 409
    )
    assert client.delete(f"/reports/{report['id']}?expected_revision=2", headers=headers).status_code == 409
    copy = client.post(f"/reports/{report['id']}/duplicate", headers=headers).json()
    assert copy["status"] == "draft" and copy["id"] != report["id"]


def test_source_or_draft_changes_require_fresh_preview_and_pdf_failure_rolls_back(sync_client):
    client, engine, project, headers = sync_client
    report = create(client, project, headers)
    captured = preview(client, report, headers)
    with Session(engine) as db:
        original = db.get(Report, UUID(report["id"]))
        original.title = "Changed concurrently"
        db.add(original)
        db.commit()
    assert publish(client, report, headers, captured).status_code == 409
    captured = preview(client, report, headers)
    with patch("app.routes.reports.saved_report_pdf", side_effect=RuntimeError("renderer failed")):
        with pytest.raises(RuntimeError):
            publish(client, report, headers, captured)
    with Session(engine) as db:
        assert db.get(Report, UUID(report["id"])).status == "draft"
        assert db.exec(select(ReportSnapshot)).first() is None
    assert publish(client, report, headers, captured).status_code == 200


def test_tenant_roles_and_missing_resources_are_enforced_for_all_routes(sync_client):
    client, engine, project, headers = sync_client
    report = create(client, project, headers)
    publish(client, report, headers)
    paths = [
        f"/reports/{report['id']}",
        f"/reports/{report['id']}/preview",
        f"/reports/{report['id']}/snapshot",
        f"/reports/{report['id']}/export.pdf",
        f"/projects/{project}/reports",
        "/report-templates",
    ]
    for path in paths:
        assert client.get(path).status_code == 401
    assert client.get(f"/reports/{uuid4()}", headers=headers).status_code == 404
    with Session(engine) as db:
        membership = db.exec(select(OrganizationMembership)).one()
        membership.role = Role.ENUMERATOR
        db.add(membership)
        db.commit()
    for path in paths:
        assert client.get(path, headers=headers).status_code == 403
    with Session(engine) as db:
        membership = db.exec(select(OrganizationMembership)).one()
        other = Organization(name="Other NGO", slug="other-ngo")
        db.add(other)
        db.flush()
        membership.organization_id = other.id
        membership.role = Role.ORGANIZATION_ADMIN
        db.add(membership)
        db.commit()
    for path in paths[:-1]:
        assert client.get(path, headers=headers).status_code == 404
    assert client.post(f"/projects/{project}/reports", headers=headers, json=report_body()).status_code == 404
    assert (
        client.patch(
            f"/reports/{report['id']}", headers=headers, json={**report_body(), "expected_revision": 1}
        ).status_code
        == 404
    )
    assert client.delete(f"/reports/{report['id']}?expected_revision=1", headers=headers).status_code == 404
    assert client.post(f"/reports/{report['id']}/duplicate", headers=headers).status_code == 404
    assert (
        client.post(
            f"/reports/{report['id']}/publish", headers=headers, json={"expected_revision": 1, "preview_hash": "a" * 64}
        ).status_code
        == 404
    )


@pytest.mark.parametrize("existing", [False, True])
def test_reporting_migration_clean_and_existing_data(tmp_path, monkeypatch, existing):
    from alembic.config import Config
    from sqlalchemy import inspect
    from sqlmodel import SQLModel, create_engine

    from alembic import command
    from app.core.config import get_settings
    from app.models.identity import User

    database = tmp_path / "migration.db"
    engine = create_engine(f"sqlite:///{database.as_posix()}")
    if existing:
        SQLModel.metadata.create_all(engine)
        # Simulate the verified pre-reporting schema without touching application data.
        ReportSnapshot.__table__.drop(engine)
        Report.__table__.drop(engine)
        with Session(engine) as db:
            db.add(User(email="preserve@example.com", password_hash="unused"))
            db.commit()
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{database.as_posix()}")
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        if existing:
            command.stamp(config, "0036_username_only_enumerators")
        command.upgrade(config, "head")
        tables = inspect(engine).get_table_names()
        assert "reports" in tables and "report_snapshots" in tables
        if existing:
            with Session(engine) as db:
                assert db.exec(select(User)).one().email == "preserve@example.com"
    finally:
        get_settings.cache_clear()
        engine.dispose()


def test_saved_report_period_targets_missing_targets_and_source_conflicts(sync_client):
    from app.models.operations import IndicatorPeriodTarget

    client, engine, project, headers = sync_client
    identifiers = []
    for code, target in [("COUNT", 100), ("MISSING", None)]:
        response = client.post(
            f"/projects/{project}/indicators",
            headers=headers,
            json={
                "name": code + " indicator",
                "code": code,
                "unit": "number",
                "manual_aggregation": "sum",
                "target_value": target,
            },
        )
        assert response.status_code == 201, response.text
        identifier = response.json()["id"]
        identifiers.append(identifier)
        assert (
            client.post(
                f"/indicators/{identifier}/collected-results",
                headers=headers,
                json={"result_date": "2026-10-15", "value": 12},
            ).status_code
            == 201
        )
    with Session(engine) as db:
        db.add(IndicatorPeriodTarget(indicator_id=UUID(identifiers[0]), period="2026-10", target_value=10))
        db.commit()
    report = create(client, project, headers, indicator_ids=identifiers)
    captured = preview(client, report, headers)
    by_code = {item["code"]: item for item in captured["data"]["indicators"]}
    assert by_code["COUNT"]["target_value"] == 100  # never prorated
    assert by_code["COUNT"]["history"][0]["target_value"] == 10
    assert by_code["COUNT"]["history"][0]["target_achieved"] is True
    assert by_code["MISSING"]["target_value"] is None
    assert by_code["MISSING"]["progress_percent"] is None
    client.post(
        f"/indicators/{identifiers[0]}/collected-results",
        headers=headers,
        json={"result_date": "2026-10-16", "value": 3},
    )
    assert publish(client, report, headers, captured).status_code == 409
    assert (
        client.get(
            f"/reports/{report['id']}/export.pdf?preview_hash={captured['content_hash']}", headers=headers
        ).status_code
        == 409
    )
    assert publish(client, report, headers).status_code == 200


def test_saved_pdf_long_narratives_and_tables_paginate(sync_client):
    import os
    from pathlib import Path

    from app.core.project_report import saved_report_pdf

    client, _, project, headers = sync_client
    response = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={"name": "People reached", "code": "REACH", "manual_aggregation": "sum"},
    )
    identifier = response.json()["id"]
    report = create(
        client,
        project,
        headers,
        indicator_ids=[identifier],
        sections={
            "executive_summary": ("Verified field observations & community feedback. " * 220) + "END-OF-NARRATIVE",
            "recommendations": "Follow up on the documented findings.",
        },
    )
    data = preview(client, report, headers)["data"]
    data["indicators"][0]["history"] = [
        {
            "period": f"2020-{index:03}",
            "value": index - 10,
            "target_value": None if index % 3 else 50,
            "target_achieved": None if index % 3 else index >= 50,
        }
        for index in range(80)
    ]
    pdf = saved_report_pdf(data)
    reader = PdfReader(io.BytesIO(pdf))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) >= 6
    assert "END-OF-NARRATIVE" in text and "2020-079" in text
    table_pages = [
        page.extract_text() for page in reader.pages if re.search(r"2020-\d{3}\n-?\d+\n", page.extract_text())
    ]
    assert len(table_pages) >= 3
    assert all("UTC period" in text for text in table_pages)
    assert all(f"Page {index + 1}" in page.extract_text() for index, page in enumerate(reader.pages))
    if path := os.environ.get("FIELDSIGHT_SAVED_REPORT_QA_PDF"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_bytes(pdf)


def test_report_reuses_linked_review_eligibility_and_rejects_foreign_project_indicators(analysis_client):
    from app.models.operations import Project

    client, engine, project_id, headers = analysis_client
    response = client.post(
        f"/projects/{project_id}/indicators",
        headers=headers,
        json={
            "name": "Verified scores",
            "code": "SCORES",
            "unit": "number",
            "mapping": {"source_form_id": "form-1", "source_field": "score", "calculation": "sum"},
        },
    )
    assert response.status_code == 201, response.text
    identifier = response.json()["id"]
    report = create(client, project_id, headers, indicator_ids=[identifier])
    captured = preview(client, report, headers)["data"]
    assert captured["indicators"][0]["current_value"] == 10
    assert captured["indicators"][0]["quality_excluded_records"] == 2
    assert captured["review_counts"]["invalid"] == 1
    assert captured["review_counts"]["needs_review"] == 1
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        other = Project(
            organization_id=project.organization_id,
            organization_sector_id=project.organization_sector_id,
            name="Separate project",
            created_by_id=project.created_by_id,
        )
        db.add(other)
        db.commit()
        other_id = str(other.id)
        org_id = str(project.organization_id)
    invalid = client.post(
        f"/projects/{other_id}/reports", headers=headers, json=report_body(indicator_ids=[identifier])
    )
    assert invalid.status_code == 422
    # Saved reports retain history by requiring project archiving instead of deletion.
    response = client.delete(f"/organizations/{org_id}/projects/{project_id}", headers=headers)
    assert response.status_code == 409 and "saved reports" in response.text


def test_reporting_downgrade_refuses_saved_history(sync_client, monkeypatch):
    from alembic.config import Config

    from alembic import command
    from app.core.config import get_settings

    client, engine, project, headers = sync_client
    report = create(client, project, headers)
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", str(engine.url))
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "0037_saved_reports")
        with pytest.raises(RuntimeError, match="Downgrade refused"):
            command.downgrade(config, "0036_username_only_enumerators")
        assert client.get(f"/reports/{report['id']}", headers=headers).status_code == 200
    finally:
        get_settings.cache_clear()
