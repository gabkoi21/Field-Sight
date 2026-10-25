"""Administrator protection and evidence regressions; no live provider calls."""

from datetime import UTC, date, datetime
from unittest.mock import patch
from uuid import UUID

from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.core.collected_results import manual_result
from app.core.sync_worker import process_one, schedule_due
from app.models.operations import Indicator, OrganizationAdminEvent, Project, Submission, SyncJob, SyncWorkerHeartbeat
from app.models.workspace import CollectedResult


def test_archival_retains_records_stops_sync_and_restores_manually(sync_client):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        org = project.organization_id
    path = f"/organizations/{org}/projects/{project_id}"
    assert client.put(f"/projects/{project_id}/sync-settings", headers=headers,
                      json={"mode": "scheduled"}).status_code == 200
    assert client.post(f"/projects/{project_id}/sync-jobs", headers=headers).status_code == 202
    with patch("app.routes.organizations.delete_kobo_form") as provider:
        assert client.patch(path, headers=headers, json={"status": "archived"}).status_code == 200
        provider.assert_not_called()
    with Session(engine) as db:
        schedule_due(db)
        assert db.get(SyncJob, UUID(project_id)) is None
        # Even an old or externally inserted queue entry cannot sync an archive.
        db.add(SyncJob(project_id=UUID(project_id)))
        db.commit()
        with patch("app.core.sync_worker.execute_project_sync") as execute:
            assert process_one(db)
            execute.assert_not_called()
        assert db.get(Project, UUID(project_id)).kobo_form_id == "form-1"
        assert db.exec(select(OrganizationAdminEvent)).one().action == "project_status:archived"
    assert client.post(f"/projects/{project_id}/sync-jobs", headers=headers).status_code == 409
    assert client.post(f"/projects/{project_id}/sync", headers=headers).status_code == 409
    assert client.patch(path, headers=headers, json={"status": "active"}).status_code == 200
    assert client.get(f"/projects/{project_id}/sync-settings", headers=headers).json()["mode"] == "manual"


def test_heartbeat_is_evidence_not_a_claim_that_queued_job_is_running(sync_client):
    client, engine, project_id, headers = sync_client
    path = f"/projects/{project_id}/sync-settings"
    assert client.get(path, headers=headers).json()["worker_last_seen_at"] is None
    with Session(engine) as db:
        db.add(SyncWorkerHeartbeat(worker_id="test-worker", last_seen_at=datetime.now(UTC)))
        db.commit()
    client.post(f"/projects/{project_id}/sync-jobs", headers=headers)
    result = client.get(path, headers=headers).json()
    assert result["pending"] and result["worker_last_seen_at"].endswith("Z")
    assert result["latest_status"] is None


def test_provider_delete_requires_archive_and_exact_confirmation(sync_client):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        org = db.get(Project, UUID(project_id)).organization_id
    path = f"/organizations/{org}/projects/{project_id}"
    with patch("app.routes.organizations.delete_kobo_form") as provider:
        assert client.post(path + "/delete-kobo-form?confirmation=DELETE%20KOBO%20form-1",
                           headers=headers).status_code == 409
        client.patch(path, headers=headers, json={"status": "archived"})
        assert client.post(path + "/delete-kobo-form?confirmation=wrong", headers=headers).status_code == 422
        provider.assert_not_called()


def test_explicit_manual_mean_preserves_legacy_values_and_zero(sync_client):
    _, engine, project_id, _ = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        indicator = Indicator(project_id=project.id, organization_id=project.organization_id,
                              created_by_id=project.created_by_id, name="Coverage", code="COV", unit="percentage")
        rows = [CollectedResult(indicator_id=indicator.id, organization_id=project.organization_id,
                                created_by_id=project.created_by_id, result_date=date(2026, 10, 1), value=value)
                for value in [0, 100]]
        legacy = manual_result(indicator, rows, {}, None, None)
        assert legacy.current_value == 50 and "Legacy behavior retained" in legacy.calculation_note
        indicator.manual_mean_confirmed = True
        explicit = manual_result(indicator, rows, {}, None, None)
        assert explicit.current_value == 50 and "Explicitly selected" in explicit.calculation_note
        assert manual_result(indicator, rows[:1], {}, None, None).current_value == 0
        assert manual_result(indicator, [], {}, None, None).current_value is None


def test_submission_page_filters_and_tenant_scope(sync_client):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        for index in range(23):
            db.add(Submission(project_id=project.id, organization_id=project.organization_id,
                              kobo_connection_id=project.kobo_connection_id, kobo_form_id="form-1",
                              external_id=f"row-{index:02}", enumerator="Collector",
                              review_status="ready" if index % 2 else "needs_review"))
        db.commit()
    path = f"/submissions/page?project_id={project_id}"
    first = client.get(path, headers=headers).json()
    second = client.get(path + "&offset=10", headers=headers).json()
    assert first["total"] == 23 and len(first["items"]) == 10
    assert not {item["id"] for item in first["items"]} & {item["id"] for item in second["items"]}
    ready = client.get(path + "&review_status=ready&search=Collector", headers=headers).json()
    assert ready["total"] == 11 and ready["counts"]["needs_review"] == 12
    assert all(item["review_status"] == "ready" for item in ready["items"])
    assert client.get(path + "&limit=1000", headers=headers).status_code == 422
    from uuid import uuid4
    assert client.get(f"/submissions/page?project_id={uuid4()}", headers=headers).json()["total"] == 0
    assert client.get(path).status_code == 401
