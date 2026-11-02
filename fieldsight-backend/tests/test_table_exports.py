"""Period boundaries, actual answers, complete exports and durable scheduled reports."""

import csv
import io
import json
from datetime import UTC, date, datetime
from uuid import UUID, uuid4
from zipfile import ZipFile

import pytest
from alembic.config import Config
from pypdf import PdfReader
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from alembic import command
from app.core.config import get_settings
from app.core.table_export_worker import run_due
from app.core.table_exports import bounds, previous_bounds
from app.models.operations import Project, Submission, SurveySchema
from app.models.table_exports import TableExportArtifact, TableExportSchedule
from app.schemas.table_exports import TableExportInput


def seed(fixture):
    client, engine, project_id, headers = fixture
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        db.add(
            SurveySchema(
                organization_id=project.organization_id,
                project_id=project.id,
                form_id="form-1",
                fields_json=[
                    {"source_field": "name", "label": "Participant", "type": "text", "choices": []},
                    {"source_field": "amount", "label": "Participants", "type": "number", "choices": []},
                    {"source_field": "event_date", "label": "Visit date", "type": "date", "choices": []},
                ],
            )
        )
        for i in range(65):
            db.add(
                Submission(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    kobo_connection_id=project.kobo_connection_id,
                    kobo_form_id="form-1",
                    external_id=str(i),
                    submitted_at=datetime(2026, 10 if i < 60 else 9, 15, 12, tzinfo=UTC),
                    enumerator="alice",
                    location="North",
                    review_status="ready" if i % 2 == 0 else "needs_review",
                    raw_answers={
                        "name": '=HYPERLINK("example")' if i == 0 else f"Name {i}",
                        "amount": 2,
                        "event_date": "2026-09-30" if i == 0 else "2026-10-05",
                    },
                )
            )
        db.add(
            Submission(
                organization_id=project.organization_id,
                project_id=project.id,
                kobo_connection_id=project.kobo_connection_id,
                kobo_form_id="other",
                external_id="secret",
                raw_answers={"name": "PRIVATE OTHER TABLE"},
            )
        )
        db.commit()
    return client, engine, project_id, headers


def options(**values):
    return {"anchor": "2026-10-15", "period": "monthly", **values}


def test_boundaries():
    for week_start, expected in [(0, "2026-10-12"), (6, "2026-10-11")]:
        value = TableExportInput(**options(period="weekly", week_start=week_start))
        assert bounds(value)[0].isoformat() == expected
    value = TableExportInput(**options(period="fortnightly", anchor="2026-10-29"))
    assert bounds(value) == (date(2026, 10, 29), date(2026, 11, 11))
    value = TableExportInput(**options(anchor="2024-03-20"))
    assert previous_bounds(value, *bounds(value)) == (date(2024, 2, 1), date(2024, 2, 29))


def test_export_migration_from_empty_database(tmp_path, monkeypatch):
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{(tmp_path / 'migration.db').as_posix()}")
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.upgrade(config, "head")
        command.downgrade(config, "0033_project_url_slugs")
        command.upgrade(config, "head")
    finally:
        get_settings.cache_clear()


def test_full_json_report_and_filters(sync_client):
    client, engine, project, headers = seed(sync_client)
    path = f"/projects/{project}/tables/form-1/export"
    response = client.post(path, headers=headers, json=options(format="json", metric_field="amount", columns=["name"]))
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["summary"]["submissions"] == 60
    assert len(report["records"]) == 60
    assert report["summary"]["result"] == 120
    assert report["breakdown"][0]["result"] == 120
    assert report["comparison"]["submissions"] == 5
    assert report["comparison"]["submission_change_percent"] == 1100
    assert set(report["records"][0]["answers"]) == {"name"}
    assert "PRIVATE OTHER TABLE" not in response.text
    filtered = client.post(
        path, headers=headers, json=options(format="json", review_status="ready", date_field="event_date")
    )
    assert filtered.json()["summary"]["submissions"] == 32
    assert client.post(path, headers=headers, json=options(columns=["foreign"])).status_code == 422
    assert client.post(path, headers=headers, json=options(timezone="Nonsense")).status_code == 422
    assert client.post(path, headers=headers, json=options(period="custom", end="2026-01-01")).status_code == 422
    assert client.post(f"/projects/{uuid4()}/tables/form-1/export", headers=headers, json=options()).status_code == 404
    assert client.post(path, json=options()).status_code == 401


@pytest.mark.parametrize("format", ["csv", "xlsx", "pdf"])
def test_file_formats(sync_client, format):
    client, engine, project, headers = seed(sync_client)
    response = client.post(
        f"/projects/{project}/tables/form-1/export",
        headers=headers,
        json=options(format=format, content="records" if format == "csv" else "both"),
    )
    assert response.status_code == 200, response.text[:500]
    assert f"monthly.{format}" in response.headers["content-disposition"]
    assert response.headers["cache-control"] == "no-store"
    if format == "csv":
        rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
        assert len(rows) == 60
        formula = next(row for row in rows if row["external_id"] == "0")
        assert formula["Participant [name]"].startswith("'=HYPERLINK")
    elif format == "xlsx":
        with ZipFile(io.BytesIO(response.content)) as book:
            assert "Summary" in book.read("xl/workbook.xml").decode()
            assert "Field definitions" in book.read("xl/workbook.xml").decode()
            assert "<f>" not in book.read("xl/worksheets/sheet3.xml").decode()
    else:
        pages = PdfReader(io.BytesIO(response.content)).pages
        content = " ".join(page.extract_text() for page in pages)
        assert "Total submissions" in content and "Name 59" in content


def test_schedules_generate_once_and_pause(sync_client):
    client, engine, project, headers = seed(sync_client)
    path = f"/projects/{project}/tables/form-1"
    response = client.post(path + "/export-schedules", headers=headers, json={"options": options(format="json")})
    assert response.status_code == 201, response.text
    schedule_id = response.json()["id"]
    with Session(engine) as db:
        assert run_due(db, datetime(2026, 10, 31, 23, 59, tzinfo=UTC)) == 0
        assert run_due(db, datetime(2026, 11, 1, tzinfo=UTC)) == 1
        assert run_due(db, datetime(2026, 11, 1, tzinfo=UTC)) == 0
        assert len(db.exec(select(TableExportArtifact)).all()) == 1
        assert db.get(TableExportSchedule, UUID(schedule_id)).options["anchor"] == "2026-11-01"
    listed = client.get(path + "/export-schedules", headers=headers).json()
    artifact_id = listed[0]["reports"][0]["id"]
    report = client.get(path + f"/export-reports/{artifact_id}", headers=headers)
    assert json.loads(report.content)["summary"]["submissions"] == 60
    assert (
        client.get(f"/projects/{project}/tables/other/export-reports/{artifact_id}", headers=headers).status_code == 404
    )
    assert client.patch(path + f"/export-schedules/{schedule_id}?active=false", headers=headers).status_code == 200
    with Session(engine) as db:
        assert run_due(db, datetime(2026, 12, 1, tzinfo=UTC)) == 0
    assert (
        client.post(path + "/export-schedules", headers=headers, json={"options": options(period="all")}).status_code
        == 422
    )


def test_timezone_and_undated_records(sync_client):
    client, engine, project, headers = seed(sync_client)
    with Session(engine) as db:
        item = db.exec(select(Submission).where(Submission.external_id == "0")).one()
        item.submitted_at = datetime(2026, 10, 1, 0, 30, tzinfo=UTC)
        other = db.exec(select(Submission).where(Submission.external_id == "1")).one()
        other.submitted_at = None
        db.add_all([item, other])
        db.commit()
    path = f"/projects/{project}/tables/form-1/export"
    report = client.post(path, headers=headers, json=options(format="json", timezone="America/New_York")).json()
    assert report["summary"]["submissions"] == 58
    assert report["comparison"]["submissions"] == 6
    assert report["undated_excluded"] == 1
    all_dates = client.post(path, headers=headers, json=options(format="json", period="all")).json()
    assert all_dates["summary"]["submissions"] == 65


def test_county_exports_include_all_dates_and_resolve_choice_labels(sync_client):
    client, engine, project, headers = seed(sync_client)
    with Session(engine) as db:
        schema = db.exec(select(SurveySchema).where(SurveySchema.form_id == "form-1")).one()
        schema.fields_json = [
            *schema.fields_json,
            {
                "source_field": "county",
                "label": "County",
                "type": "select_one",
                "choices": [{"value": "mo", "label": "Montserrado"}, {"value": "rc", "label": "River Cess"}],
            },
        ]
        db.add(schema)
        for row in db.exec(select(Submission).where(Submission.kobo_form_id == "form-1")):
            row.raw_answers = {**row.raw_answers, "county": "mo" if int(row.external_id) < 60 else "rc"}
            db.add(row)
        row.submitted_at = None
        row.raw_answers = {**row.raw_answers, "county": None}
        db.add(row)
        db.commit()
    path = f"/projects/{project}/tables/form-1/export"
    request = options(format="json", period="all", content="records", group_by="county")
    all_counties = client.post(path, headers=headers, json=request)
    assert all_counties.status_code == 200, all_counties.text
    assert len(all_counties.json()["records"]) == 65
    assert any(row["county"] == "Unknown" for row in all_counties.json()["records"])
    selected = client.post(path, headers=headers, json={**request, "county": "Montserrado"})
    assert len(selected.json()["records"]) == 60
    assert all(row["answers"]["county"] == "mo" for row in selected.json()["records"])
    river = client.post(path, headers=headers, json={**request, "county": "Rivercess County"})
    assert len(river.json()["records"]) == 4
    assert "Rivercess_County.json" in river.headers["content-disposition"]
