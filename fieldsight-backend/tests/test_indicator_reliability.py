"""Reliability boundaries exercised with synthetic tenant-scoped databases."""

from uuid import UUID

import pytest
from sqlmodel import Session
from test_analysis import analysis_client as analysis_client
from test_kobo_sync import sync_client as sync_client

from app.models.operations import Indicator


def create(client, project, headers, **changes):
    response = client.post(
        f"/projects/{project}/indicators", headers=headers, json={"name": "Reliability", "code": "REL", **changes}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_draft_requires_method_and_server_rejects_percentage_sum(analysis_client):
    client, _, project, headers = analysis_client
    indicator = create(client, project, headers)
    path = f"/indicators/{indicator}"
    assert (
        client.post(
            path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 0}
        ).status_code
        == 422
    )
    assert client.patch(path, headers=headers, json={"is_active": True}).status_code == 422
    bad = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={
            "name": "Bad percentage",
            "code": "BAD",
            "unit": "percentage",
            "mapping": {"source_field": "score", "calculation": "sum", "source_form_id": "form-1"},
        },
    )
    assert bad.status_code == 422
    assert client.patch(path, headers=headers, json={"manual_aggregation": "sum"}).status_code == 200
    assert (
        client.post(
            path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 0}
        ).status_code
        == 201
    )
    assert client.get(path, headers=headers).json()["current_value"] == 0


@pytest.mark.parametrize(("method", "expected"), [("sum", 100), ("unweighted_mean", 50), ("latest", 80)])
def test_manual_benchmarks_and_change_review(sync_client, method, expected):
    client, _, project, headers = sync_client
    indicator = create(client, project, headers, manual_aggregation=method)
    path = f"/indicators/{indicator}"
    for value in [20, 80]:
        assert (
            client.post(
                path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": value}
            ).status_code
            == 201
        )
    assert client.get(path, headers=headers).json()["current_value"] == expected
    assert client.patch(path, headers=headers, json={"target_value": 200}).status_code == 409
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200})
    assert preview.status_code == 200, preview.text
    assert preview.json()["affected_periods"] == ["2026-10"]
    changed = client.patch(
        path,
        headers=headers,
        json={
            "target_value": 200,
            "confirm_change": True,
            "change_reason": "Revised target after review",
            "expected_version": preview.json()["expected_version"],
            "preview_token": preview.json()["preview_token"],
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["current_value"] == expected
    versions = client.get(path + "/versions", headers=headers).json()
    assert versions[0]["previous_definition"]["target_value"] is None
    assert versions[0]["new_definition"]["target_value"] == 200
    page = client.get(path + "/evidence?limit=1", headers=headers).json()
    assert page["total"] == 2 and len(page["items"]) == 1


def test_legacy_mean_is_retained_without_inventing_approval(sync_client):
    client, engine, project, headers = sync_client
    indicator = create(client, project, headers, unit="percentage")
    with Session(engine) as db:
        row = db.get(Indicator, UUID(indicator))
        row.reliability_policy = 0
        db.add(row)
        db.commit()
    path = f"/indicators/{indicator}"
    for value in [0, 80]:
        assert (
            client.post(
                path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": value}
            ).status_code
            == 201
        )
    result = client.get(path, headers=headers).json()
    assert result["current_value"] == 40
    assert result["legacy_definition"] and not result["manual_mean_confirmed"]
    assert client.get(path + "/versions", headers=headers).json() == []


def test_evidence_reconciles_linked_exclusions(analysis_client):
    client, _, project, headers = analysis_client
    indicator = create(
        client,
        project,
        headers,
        unit="percentage",
        mapping={
            "source_field": "services",
            "source_form_id": "form-1",
            "calculation": "percentage_matching",
            "match_value": "a",
        },
    )
    path = f"/indicators/{indicator}"
    result = client.get(path, headers=headers).json()
    evidence = client.get(path + "/evidence", headers=headers).json()
    assert sum(item["included"] for item in evidence["items"]) == result["mapped_records"]
    assert sum(item["reason"] == "quality_excluded" for item in evidence["items"]) == result["quality_excluded_records"]
    assert sum(item["reason"] == "missing_answer" for item in evidence["items"]) == result["missing_records"]

def controls(preview):
    return {"confirm_change": True, "change_reason": "Reviewed updated evidence",
            "expected_version": preview["expected_version"], "preview_token": preview["preview_token"]}


def test_latest_scope_pagination_and_ties(sync_client):
    from datetime import datetime
    from sqlmodel import select
    from app.models.workspace import CollectedResult

    client, engine, project, headers = sync_client
    indicator = create(client, project, headers, manual_aggregation="latest")
    path = f"/indicators/{indicator}"
    for day, value, location in [("2026-09-01", 20, "West"), ("2026-10-01", 80, "East"),
                                 ("2026-10-01", 90, "East")]:
        assert client.post(path + "/collected-results", headers=headers,
                           json={"result_date": day, "value": value, "location": location}).status_code == 201
    with Session(engine) as db:
        rows = db.exec(select(CollectedResult).where(CollectedResult.indicator_id == UUID(indicator))).all()
        for row in rows:
            row.created_at = datetime(2026, 10, 2)
            db.add(row)
        db.commit()
        chosen = max((row for row in rows if row.value != 20), key=lambda row: str(row.id))
        chosen_id, chosen_value = str(chosen.id), chosen.value
    pages = [client.get(path + f"/evidence?limit=1&offset={i}", headers=headers).json() for i in range(3)]
    assert all(page["contributing_count"] == 1 and page["superseded_count"] == 2 for page in pages)
    items = [page["items"][0] for page in pages]
    assert [item["id"] for item in items if item["included"]] == [chosen_id]
    assert sum(item["reason"] == "superseded" for item in items) == 2
    assert pages[0]["actual"] == chosen_value
    result = client.get(path, headers=headers).json()
    assert result["current_value"] == chosen_value and result["denominator"] == result["mapped_records"] == 1
    for query in ["period=2026-09", "location=West", "date_to=2026-09-30"]:
        evidence = client.get(path + "/evidence?" + query, headers=headers).json()
        assert evidence["actual"] == 20 and evidence["items"][0]["included"]
    assert client.get(path + "/evidence?period=2025-01", headers=headers).json()["actual"] is None


def test_pooled_missing_invalid_and_zero(sync_client):
    from sqlmodel import select
    from app.models.workspace import CollectedResult

    client, engine, project, headers = sync_client
    indicator = create(client, project, headers, unit="percentage", manual_aggregation="pooled")
    path = f"/indicators/{indicator}"
    assert client.get(path, headers=headers).json()["current_value"] is None
    for _ in range(3):
        assert client.post(path + "/collected-results", headers=headers,
                           json={"result_date": "2026-10-01", "numerator": 0, "denominator": 10}).status_code == 201
    # Representative legacy malformed rows retained for inspection.
    with Session(engine) as db:
        rows = db.exec(select(CollectedResult).where(CollectedResult.indicator_id == UUID(indicator))).all()
        rows[0].numerator = None
        rows[1].denominator = 0
        db.add_all(rows)
        db.commit()
    evidence = client.get(path + "/evidence", headers=headers).json()
    assert evidence["actual"] == 0 and evidence["denominator"] == 10 and evidence["contributing_count"] == 1
    assert {row["reason"] for row in evidence["items"]} == {None, "missing_components", "invalid_components"}
    result = client.get(path, headers=headers).json()
    assert result["missing_records"] == result["invalid_answers"] == result["mapped_records"] == 1


@pytest.mark.parametrize("change", ["answer", "review", "insert", "delete", "manual_insert", "manual_update", "manual_delete", "definition", "forged", "proposal"])
def test_stale_confirmation_is_atomic(analysis_client, change):
    from sqlmodel import select
    from app.models.operations import Submission
    from app.models.workspace import CollectedResult

    client, engine, project, headers = analysis_client
    indicator = create(client, project, headers, manual_aggregation="sum", mapping={
        "source_field": "score", "source_form_id": "form-1", "calculation": "sum"})
    path = f"/indicators/{indicator}"
    # Manual rows are retained even while linked evidence is selected.
    with Session(engine) as db:
        row = db.get(Indicator, UUID(indicator))
        manual = CollectedResult(indicator_id=row.id, project_id=row.project_id,
                                 organization_id=row.organization_id, created_by_id=row.created_by_id,
                                 result_date=__import__('datetime').date(2026, 10, 1), value=20)
        db.add(manual)
        db.commit()
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200}).json()
    version = preview["expected_version"]
    with Session(engine) as db:
        row = db.exec(select(Submission).where(Submission.project_id == UUID(project))).first()
        if change == "answer":
            row.raw_answers = {**row.raw_answers, "score": 99}
        elif change == "review":
            row.review_required = not row.review_required
        elif change == "insert":
            clone = row.model_dump(exclude={"id"})
            clone["external_id"] = "new-preview-evidence"
            db.add(Submission(**clone))
        elif change == "delete":
            db.delete(row)
        elif change.startswith("manual"):
            manual = db.exec(select(CollectedResult).where(CollectedResult.indicator_id == UUID(indicator))).one()
            if change == "manual_insert":
                db.add(CollectedResult(**manual.model_dump(exclude={"id"})))
            elif change == "manual_update":
                manual.value = 30
                db.add(manual)
            else:
                db.delete(manual)
        elif change == "definition":
            definition = db.get(Indicator, UUID(indicator))
            definition.definition_version += 1
            db.add(definition)
        if change in {"answer", "review"}:
            db.add(row)
        db.commit()
    if change == "forged":
        preview["preview_token"] = "0" * 64
    payload = {"target_value": 300 if change == "proposal" else 200, **controls(preview)}
    response = client.patch(path, headers=headers, json=payload)
    assert response.status_code == 409, response.text
    stored = client.get(path, headers=headers).json()
    assert stored["target_value"] is None
    assert stored["definition_version"] == version + (change == "definition")
    assert client.get(path + "/versions", headers=headers).json() == []
    fresh = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200}).json()
    saved = client.patch(path, headers=headers, json={"target_value": 200, **controls(fresh)})
    assert saved.status_code == 200, saved.text
    history = client.get(path + "/versions", headers=headers).json()
    assert len(history) == 1 and history[0]["preview"]["state_digest"] == fresh["state_digest"]


def test_provider_metadata_does_not_invalidate_preview(analysis_client):
    from sqlmodel import select
    from app.models.operations import Submission

    client, engine, project, headers = analysis_client
    indicator = create(client, project, headers, mapping={
        "source_field": "score", "source_form_id": "form-1", "calculation": "sum"})
    path = f"/indicators/{indicator}"
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200}).json()
    with Session(engine) as db:
        row = db.exec(select(Submission).where(Submission.project_id == UUID(project))).first()
        row.raw_answers = {**row.raw_answers, "_tags": ["transport-only"], "_notes": ["ignored"]}
        db.add(row)
        db.commit()
    saved = client.patch(path, headers=headers, json={"target_value": 200, **controls(preview)})
    assert saved.status_code == 200, saved.text


def test_count_records_includes_unanswered_question(analysis_client):
    client, _, project, headers = analysis_client
    indicator = create(client, project, headers, mapping={
        "source_field": "score", "source_form_id": "form-1", "calculation": "count_records"})
    path = f"/indicators/{indicator}"
    result = client.get(path, headers=headers).json()
    evidence = client.get(path + "/evidence", headers=headers).json()
    assert sum(row["included"] for row in evidence["items"]) == result["denominator"] == result["mapped_records"]
    assert all(row["included"] or row["reason"] == "quality_excluded" for row in evidence["items"])

def test_concurrent_confirmations_cannot_bypass_validation(sync_client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    client, _, project, headers = sync_client
    indicator = create(client, project, headers, manual_aggregation="sum")
    path = f"/indicators/{indicator}"
    client.post(path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 20})
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200}).json()
    barrier = Barrier(2)

    def save():
        barrier.wait(timeout=10)
        return client.patch(path, headers=headers, json={"target_value": 200, **controls(preview)}).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(save) for _ in range(2)]
        statuses = [future.result(timeout=20) for future in futures]
    assert sorted(statuses) == [200, 409]
    versions = client.get(path + "/versions", headers=headers).json()
    assert len(versions) == 1


def test_integrity_failure_rolls_back_definition_and_history(sync_client):
    client, _, project, headers = sync_client
    create(client, project, headers, manual_aggregation="sum", code="EXISTING")
    indicator = create(client, project, headers, manual_aggregation="sum")
    path = f"/indicators/{indicator}"
    client.post(path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 20})
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200}).json()
    failed = client.patch(path, headers=headers, json={"target_value": 200, "code": "EXISTING", **controls(preview)})
    assert failed.status_code == 409
    result = client.get(path, headers=headers).json()
    assert result["target_value"] is None and result["definition_version"] == 0 and result["code"] == "REL"
    assert client.get(path + "/versions", headers=headers).json() == []


def test_cross_organization_preview_evidence_and_confirmation_are_denied(sync_client):
    from datetime import UTC, datetime, timedelta
    from app.core.config import Settings
    from app.core.security import create_access_token
    from app.models.identity import Organization, OrganizationMembership, RefreshSession, Role, User

    client, engine, project, headers = sync_client
    indicator = create(client, project, headers, manual_aggregation="sum")
    path = f"/indicators/{indicator}"
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200}).json()
    with Session(engine) as db:
        user = User(email="other-preview@example.com", password_hash="unused")
        org = Organization(name="Other tenant", slug="other-preview-tenant")
        db.add_all([user, org])
        db.flush()
        db.add(OrganizationMembership(organization_id=org.id, user_id=user.id, role=Role.ORGANIZATION_ADMIN))
        refresh = RefreshSession(user_id=user.id, token_hash="other-preview-refresh",
                                 expires_at=datetime.now(UTC) + timedelta(days=1))
        db.add(refresh)
        db.commit()
        other = {"Authorization": "Bearer " + create_access_token(user.id, refresh.id, Settings(environment="test"))}
    for route in ["", "/evidence", "/versions"]:
        assert client.get(path + route, headers=other).status_code == 404
    assert client.post(path + "/definition-preview", headers=other, json={"target_value": 200}).status_code == 404
    assert client.patch(path, headers=other, json={"target_value": 200, **controls(preview)}).status_code == 404

def test_mapping_and_targets_previews_bind_proposal_and_evidence(analysis_client):
    from sqlmodel import select
    from app.models.operations import Submission

    client, engine, project, headers = analysis_client
    indicator = create(client, project, headers, mapping={
        "source_field": "score", "source_form_id": "form-1", "calculation": "sum"})
    path = f"/indicators/{indicator}"
    proposal = {"source_field": "score", "source_form_id": "form-1", "calculation": "average"}
    preview = client.post(path + "/mapping-preview", headers=headers, json=proposal).json()
    with Session(engine) as db:
        row = db.exec(select(Submission).where(Submission.project_id == UUID(project))).first()
        row.review_required = not row.review_required
        db.add(row)
        db.commit()
    assert client.put(path + "/mapping", headers=headers, json={**proposal, **controls(preview)}).status_code == 409
    fresh = client.post(path + "/mapping-preview", headers=headers, json=proposal).json()
    saved = client.put(path + "/mapping", headers=headers, json={**proposal, **controls(fresh)})
    assert saved.status_code == 200, saved.text
    assert client.get(path, headers=headers).json()["mapping"]["calculation"] == "average"
    targets = [{"period": "2026-10", "target_value": 40}]
    preview = client.post(path + "/period-targets-preview", headers=headers, json=targets).json()
    bad = client.put(path + "/period-targets", headers=headers, params=controls(preview),
                     json=[{"period": "2026-10", "target_value": 60}])
    assert bad.status_code == 409
    assert client.get(path + "/period-targets", headers=headers).json() == []
    saved = client.put(path + "/period-targets", headers=headers, params=controls(preview), json=targets)
    assert saved.status_code == 200, saved.text
    preview = client.post(path + "/mapping-delete-preview", headers=headers).json()
    assert client.delete(path + "/mapping", headers=headers).status_code == 409
    saved = client.delete(path + "/mapping", headers=headers, params=controls(preview))
    assert saved.status_code == 204, saved.text
    assert client.get(path, headers=headers).json()["mapping"] is None

def test_schema_display_metadata_does_not_invalidate_preview(analysis_client):
    from sqlmodel import select
    from app.models.operations import SurveySchema
    client, engine, project, headers = analysis_client
    indicator = create(client, project, headers, mapping={
        "source_field": "score", "source_form_id": "form-1", "calculation": "sum"})
    path = f"/indicators/{indicator}"
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200}).json()
    with Session(engine) as db:
        schema = db.exec(select(SurveySchema).where(SurveySchema.project_id == UUID(project))).one()
        schema.version = "provider-metadata-only"
        schema.fields_json = [{**field, "label": "New display label"} for field in schema.fields_json]
        db.add(schema)
        db.commit()
    saved = client.patch(path, headers=headers, json={"target_value": 200, **controls(preview)})
    assert saved.status_code == 200, saved.text

def test_broken_mapping_retains_excluded_evidence(analysis_client):
    from sqlmodel import select
    from app.models.operations import SurveySchema
    client, engine, project, headers = analysis_client
    indicator = create(client, project, headers, mapping={
        "source_field": "score", "source_form_id": "form-1", "calculation": "sum"})
    path = f"/indicators/{indicator}"
    with Session(engine) as db:
        schema = db.exec(select(SurveySchema).where(SurveySchema.project_id == UUID(project))).one()
        schema.fields_json = [{**field, "type": "text"} if field["source_field"] == "score" else field
                              for field in schema.fields_json]
        db.add(schema)
        db.commit()
    evidence = client.get(path + "/evidence", headers=headers).json()
    assert evidence["total"] > 0 and evidence["actual"] is None and evidence["contributing_count"] == 0
    assert all(row["reason"] in {"broken_mapping", "quality_excluded"} for row in evidence["items"])
