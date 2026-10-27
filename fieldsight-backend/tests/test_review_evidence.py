"""Evidence-aware decisions through real sync, validation and reporting APIs."""

from unittest.mock import patch
from uuid import UUID

import pytest
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.core.indicator_results import calculate
from app.core.review_evidence import evidence_fingerprint
from app.core.survey import aggregate
from app.models.operations import IndicatorMapping, Submission, SubmissionReviewEvent
from app.schemas.analysis import AnalysisQuery, SurveyField


def stored_review(engine, identifier):
    """Inspect retained eligibility/audit persistence without a Data Quality endpoint."""
    with Session(engine) as db:
        row = db.get(Submission, identifier)
        events = db.exec(select(SubmissionReviewEvent).where(SubmissionReviewEvent.submission_id == identifier)).all()
        return {"submission": {"review_status": row.review_status,
                               "evidence_fingerprint": evidence_fingerprint(row.raw_answers)},
                "events": [{"action": event.action, "note": event.note,
                            "actor": "System" if event.actor_id is None else "Administrator",
                            "source": event.source, "previous_status": event.previous_status, "status": event.status}
                           for event in events]}


def sync(client, project, headers, payloads):
    with patch("app.routes.collection.decrypt_kobo_token", return_value="synthetic"), patch(
        "app.routes.collection.list_kobo_submissions", return_value=payloads,
    ):
        return client.post(f"/projects/{project}/sync", headers=headers)


def payload(answer=2, **metadata):
    return {"_id": 1, "_submission_time": "2026-10-01T12:00:00Z", "answer": answer, **metadata}


@pytest.mark.parametrize("decision", ["ready", "invalid", "needs_review"])
def test_decision_survives_unchanged_and_metadata_only_sync(sync_client, decision):
    client, engine, project, headers = sync_client
    assert sync(client, project, headers, [payload()]).status_code == 200
    with Session(engine) as db:
        identifier = db.exec(select(Submission)).one().id
    path = f"/submissions/{identifier}"
    reviewed = stored_review(engine, identifier)["submission"]["evidence_fingerprint"]
    response = client.patch(path + "/review-status", headers=headers,
                            json={"status": decision, "note": "Reviewed evidence", "evidence_fingerprint": reviewed})
    assert response.status_code == 200
    for answers in [payload(), payload(_tags=["provider-tag"], _validation_status={"uid": "approved"})]:
        assert sync(client, project, headers, [answers]).status_code == 200
        detail = stored_review(engine, identifier)
        assert detail["submission"]["review_status"] == decision
        assert len(detail["events"]) == 1
    assert sync(client, project, headers, [answers]).json()["updated"] == 0


@pytest.mark.parametrize("decision", ["ready", "invalid"])
def test_changed_evidence_reopens_and_remains_held_after_repeat_sync(sync_client, decision):
    client, engine, project, headers = sync_client
    sync(client, project, headers, [payload()])
    with Session(engine) as db:
        identifier = db.exec(select(Submission)).one().id
    path = f"/submissions/{identifier}"
    old = stored_review(engine, identifier)["submission"]["evidence_fingerprint"]
    client.patch(path + "/review-status", headers=headers, json={"status": decision, "note": "Previous note"})
    assert sync(client, project, headers, [payload(3)]).status_code == 200
    assert sync(client, project, headers, [payload(3)]).json()["updated"] == 0
    detail = stored_review(engine, identifier)
    assert detail["submission"]["review_status"] == "needs_review"
    events = detail["events"]
    assert len(events) == 2 and any(event["note"] == "Previous note" for event in events)
    automatic = next(event for event in events if event["action"] == "evidence_changed")
    assert automatic["actor"] == "System" and automatic["source"] == "kobo_sync"
    assert automatic["previous_status"] == decision and automatic["status"] == "needs_review"
    # A stale browser cannot approve new evidence using the old fingerprint.
    assert client.patch(path + "/review-status", headers=headers,
                        json={"status": "ready", "evidence_fingerprint": old}).status_code == 409
    with Session(engine) as db:
        submission = db.get(Submission, identifier)
        mapping = IndicatorMapping(source_field="answer", calculation="sum")
        field = SurveyField(source_field="answer", label="Answer", type="number")
        assert calculate(mapping, [submission], field).eligible_records == 0
        query = AnalysisQuery(project_id=UUID(project), source_field="answer", filters={"review_status": "all"})
        assert aggregate(query, [submission], [field]).eligible_records == 0
    client.patch(path + "/review-status", headers=headers, json={"status": "ready"})
    with Session(engine) as db:
        assert calculate(mapping, [db.get(Submission, identifier)], field).value == 3


def test_failed_import_rolls_back_answers_decision_and_history(sync_client):
    client, engine, project, headers = sync_client
    sync(client, project, headers, [payload()])
    with Session(engine) as db:
        identifier = db.exec(select(Submission)).one().id
    client.patch(f"/submissions/{identifier}/review-status", headers=headers, json={"status": "ready"})
    assert sync(client, project, headers, [payload(9), {"answer": "missing ID"}]).status_code == 422
    with Session(engine) as db:
        item = db.get(Submission, identifier)
        assert item.raw_answers == payload() and item.review_status == "ready" and not item.review_required
        assert item.decision_fingerprint == item.evidence_fingerprint
        assert len(db.exec(select(SubmissionReviewEvent)).all()) == 1


def test_zero_to_false_is_an_evidence_change_despite_python_equality(sync_client):
    client, engine, project, headers = sync_client
    sync(client, project, headers, [payload(0)])
    with Session(engine) as db:
        identifier = db.exec(select(Submission)).one().id
    client.patch(f"/submissions/{identifier}/review-status", headers=headers, json={"status": "ready"})
    assert sync(client, project, headers, [payload(False)]).json()["updated"] == 1
    with Session(engine) as db:
        record = db.get(Submission, identifier)
        assert record.raw_answers["answer"] is False and record.review_status == "needs_review"


def test_fingerprint_policy_is_typed_nested_and_conservative():
    assert evidence_fingerprint({"group": {"a": 0, "b": False}}) == evidence_fingerprint(
        {"group": {"b": False, "a": 0}, "_tags": ["new"]},
    )
    for other in [None, "", 0, False, [], {}, {"nested": 1}]:
        assert evidence_fingerprint({"value": other}) != evidence_fingerprint({})
    assert evidence_fingerprint({"value": 0}) != evidence_fingerprint({"value": False})
    assert evidence_fingerprint({"_unknown": 1}) != evidence_fingerprint({"_unknown": 2})
    assert evidence_fingerprint({"_duration": 60}) != evidence_fingerprint({"_duration": 10})


def test_indicator_dashboard_report_and_intelligence_drop_changed_evidence(sync_client):
    import io

    from pypdf import PdfReader
    from test_saved_dashboards import create, endpoint, widget
    from test_workspace import indicator

    client, engine, project, headers = sync_client
    sync(client, project, headers, [payload()])
    with Session(engine) as db:
        identifier = db.exec(select(Submission)).one().id
    client.patch(f"/submissions/{identifier}/review-status", headers=headers, json={"status": "ready"})
    item = indicator(client, project, headers, unit="number")
    response = client.put(f"/indicators/{item['id']}/mapping", headers=headers,
                          json={"source_field": "answer", "source_form_id": "form-1", "calculation": "sum"})
    assert response.status_code == 200, response.text
    saved = client.post("/analysis/saved", headers=headers, json={"title": "Diagnostic all", "chart": "table",
        "query": {"project_id": project, "source_field": "answer", "measure": "sum",
                  "filters": {"review_status": "all"}}}).json()
    dashboard = create(sync_client, [widget("indicator", item["id"]), widget("analysis", saved["id"])])
    for expected in [1, 0, 1]:
        current = client.get(f"/indicators/{item['id']}", headers=headers).json()
        assert current["eligible_records"] == expected
        assert client.get(endpoint(dashboard), headers=headers).json()["indicator"]["eligible_records"] == expected
        analysis = client.get(endpoint(dashboard, 1), headers=headers).json()["analysis"]
        assert analysis["eligible_records"] == expected and analysis["filters"]["review_status"] == "ready"
        report = client.get(f"/projects/{project}/report.pdf", headers=headers)
        assert report.status_code == 200
        text = " ".join(page.extract_text() for page in PdfReader(io.BytesIO(report.content)).pages)
        assert f"{expected} eligible ready records" in text
        if expected and current["current_value"] == 2:
            sync(client, project, headers, [payload(3)])
        elif not expected:
            client.patch(f"/submissions/{identifier}/review-status", headers=headers, json={"status": "ready"})


def test_legacy_migration_reopens_without_claiming_evidence_and_preserves_notes(sync_client, monkeypatch):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import text

    from alembic import command
    from app.core.config import get_settings

    client, engine, project, headers = sync_client
    sync(client, project, headers, [payload()])
    with Session(engine) as db:
        identifier = db.exec(select(Submission)).one().id
    client.patch(f"/submissions/{identifier}/review-status", headers=headers,
                 json={"status": "ready", "note": "Historical approval"})
    # Recreate the actual pre-0027 columns; do not rely on current create_all metadata.
    with engine.begin() as connection:
        for name in ("evidence_fingerprint", "decision_fingerprint", "decision_status", "validation_status",
                     "review_required"):
            connection.execute(text(f"ALTER TABLE submissions DROP COLUMN {name}"))
        for name in ("source", "evidence_fingerprint", "previous_evidence_fingerprint"):
            connection.execute(text(f"ALTER TABLE submission_review_events DROP COLUMN {name}"))
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{Path(engine.url.database).as_posix()}")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "0026_quality_review")
        command.upgrade(config, "head")
        command.upgrade(config, "head")
        with Session(engine) as db:
            row = db.get(Submission, identifier)
            assert row.review_status == "needs_review" and row.review_required
            assert row.evidence_fingerprint is None and row.decision_fingerprint is None
            assert row.raw_answers == payload()
            history = db.exec(select(SubmissionReviewEvent)).all()
            assert len(history) == 2 and any(event.note == "Historical approval" for event in history)
            migrated = next(event for event in history if event.source == "migration")
            assert migrated.actor_id is None and migrated.previous_status == "ready"
    finally:
        get_settings.cache_clear()
