"""Durable queue, recovery, retries and authorization regression tests."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlmodel import Session, select
from test_kobo_sync import page
from test_review_evidence import review_tokens

from app.core.sync_worker import process_one, schedule_due
from app.models.identity import Organization, OrganizationMembership, Role
from app.models.operations import Submission, SyncJob, SyncRun, SyncSettingsChange

pytest_plugins = ["test_kobo_sync"]


def test_settings_default_enable_disable_and_audit(sync_client):
    client, engine, project, headers = sync_client
    url = f"/projects/{project}/sync-settings"
    assert client.get(url, headers=headers).json()["mode"] == "manual"
    assert client.put(url, headers=headers, json={"mode": "scheduled", "interval_minutes": 0}).status_code == 422
    assert client.put(url, headers=headers, json={"mode": "scheduled", "interval_minutes": 5}).status_code == 200
    with Session(engine) as db:
        schedule_due(db)
        schedule_due(db)
        assert len(db.exec(select(SyncJob)).all()) == 1
    assert client.put(url, headers=headers, json={"mode": "manual", "interval_minutes": 5}).status_code == 200
    with Session(engine) as db:
        assert not db.exec(select(SyncJob)).all()
        assert len(db.exec(select(SyncSettingsChange)).all()) == 2


def test_queue_deduplicates_and_imports_idempotently(sync_client):
    client, engine, project, headers = sync_client
    for _ in range(2):
        assert client.post(f"/projects/{project}/sync-jobs", headers=headers).status_code == 202
    with Session(engine) as db, patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1}], count=1)):
        assert len(db.exec(select(SyncJob)).all()) == 1
        assert process_one(db)
        assert not process_one(db)
    client.post(f"/projects/{project}/sync-jobs", headers=headers)
    with Session(engine) as db, patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1}], count=1)):
        process_one(db)
        assert len(db.exec(select(Submission)).all()) == 1
        assert {r.status for r in db.exec(select(SyncRun)).all()} == {"completed", "unchanged"}
    assert client.get(f"/projects/{project}/sync-settings", headers=headers).json()["last_successful_sync"]


def test_pending_status_exposes_queue_time_and_retry_attempt(sync_client):
    client, engine, project, headers = sync_client
    url = f"/projects/{project}/sync-settings"
    idle = client.get(url, headers=headers).json()
    assert idle["queued_at"] is None and idle["next_attempt_at"] is None
    assert idle["attempts"] == 0
    client.post(f"/projects/{project}/sync-jobs", headers=headers)
    with Session(engine) as db:
        job = db.get(SyncJob, UUID(project))
        job.attempts = 1
        job.due_at = datetime.now(UTC) + timedelta(minutes=1)
        db.add(job)
        db.commit()
    pending = client.get(url, headers=headers).json()
    assert pending["pending"] and pending["attempts"] == 1
    assert pending["queued_at"].endswith("Z")
    assert pending["next_attempt_at"].endswith("Z")


def test_second_intervals_are_preserved_and_scheduled(sync_client):
    from app.models.operations import SyncSchedule

    client, engine, project, headers = sync_client
    url = f"/projects/{project}/sync-settings"
    assert client.put(url, headers=headers, json={"mode": "scheduled", "interval_seconds": 1.5}).status_code == 422
    result = client.put(url, headers=headers, json={"mode": "scheduled", "interval_seconds": 1.6})
    assert result.status_code == 200, result.text
    assert result.json()["interval_seconds"] == 1.6
    with Session(engine) as db:
        before = datetime.now(UTC)
        schedule_due(db)
        schedule = db.get(SyncSchedule, UUID(project))
        due = schedule.next_due_at.replace(tzinfo=UTC)
        assert 1.5 < (due - before).total_seconds() < 2.0
        assert len(db.exec(select(SyncJob)).all()) == 1
    assert client.get(url, headers=headers).json()["interval_seconds"] == 1.6


def test_retry_exhaustion_and_failure_history(sync_client):
    client, engine, project, headers = sync_client
    client.post(f"/projects/{project}/sync-jobs", headers=headers)
    with (
        Session(engine) as db,
        patch(
            "app.routes.collection.list_kobo_submissions", side_effect=ValueError("Kobo is unavailable. Retry later.")
        ),
    ):
        for attempt in range(1, 4):
            assert process_one(db)
            job = db.get(SyncJob, UUID(project))
            if attempt < 3:
                assert job.attempts == attempt
                assert not process_one(db)
                job.due_at = datetime.now(UTC) - timedelta(seconds=1)
                db.add(job)
                db.commit()
            else:
                assert job is None
        runs = db.exec(select(SyncRun).order_by(SyncRun.attempt)).all()
        assert [r.attempt for r in runs] == [1, 2, 3]
        assert all(r.status == "failed" for r in runs)
        assert not db.exec(select(Submission)).all()


def test_worker_crash_releases_claim(sync_client):
    client, engine, project, headers = sync_client
    client.post(f"/projects/{project}/sync-jobs", headers=headers)
    with (
        pytest.raises(KeyboardInterrupt),
        Session(engine) as db,
        patch(
            "app.routes.collection.list_kobo_submissions",
            side_effect=KeyboardInterrupt,
        ),
    ):
        process_one(db)
    with Session(engine) as db, patch("app.core.kobo.httpx.get", return_value=page([], count=0)):
        assert process_one(db)
        assert db.get(SyncJob, UUID(project)) is None
        assert len(db.exec(select(SyncRun)).all()) == 1


def test_two_workers_only_import_once(sync_client):
    client, engine, project, headers = sync_client
    client.post(f"/projects/{project}/sync-jobs", headers=headers)

    def work():
        with Session(engine) as db:
            return process_one(db)

    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1}], count=1)), ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: work(), range(2)))
    assert sum(results) == 1
    with Session(engine) as db:
        assert len(db.exec(select(SyncRun)).all()) == 1


def test_settings_and_queue_preserve_admin_permissions(sync_client):
    client, engine, project, headers = sync_client
    assert client.post(f"/projects/{project}/sync-jobs").status_code == 401
    with Session(engine) as db:
        member = db.exec(select(OrganizationMembership)).one()
        member.role = Role.ENUMERATOR
        db.add(member)
        db.commit()
    assert client.get(f"/projects/{project}/sync-settings", headers=headers).status_code == 403
    assert client.post(f"/projects/{project}/sync-jobs", headers=headers).status_code == 403


def test_queue_and_settings_hide_other_tenants(sync_client):
    from app.models.operations import Project

    client, engine, project, headers = sync_client
    with Session(engine) as db:
        other = Organization(name="Other", slug="other")
        db.add(other)
        db.flush()
        record = db.get(Project, UUID(project))
        record.organization_id = other.id
        db.add(record)
        db.commit()
    assert client.get(f"/projects/{project}/sync-settings", headers=headers).status_code == 404
    assert (
        client.put(
            f"/projects/{project}/sync-settings", headers=headers, json={"mode": "scheduled", "interval_minutes": 5}
        ).status_code
        == 404
    )
    assert client.post(f"/projects/{project}/sync-jobs", headers=headers).status_code == 404


def test_indicator_engine_reads_latest_successfully_stored_answers(sync_client):
    from app.core.indicator_results import calculate
    from app.models.operations import IndicatorMapping
    from app.schemas.analysis import SurveyField

    client, engine, project, headers = sync_client
    mapping = IndicatorMapping(source_field="score", calculation="sum")
    field = SurveyField(source_field="score", label="Score", type="number")
    for score in (5, 12):
        client.post(f"/projects/{project}/sync-jobs", headers=headers)
        with (
            Session(engine) as db,
            patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1, "score": score}], count=1)),
        ):
            process_one(db)
        with Session(engine) as db:
            records = list(db.exec(select(Submission)).all())
            if score == 12:
                assert records[0].review_status == "needs_review"
                assert calculate(mapping, records, field).value is None
            identifier = records[0].id
        # Changed worker imports become eligible only after an explicit new review.
        client.patch(
            f"/submissions/{identifier}/review-status",
            headers=headers,
            json={"status": "ready", **review_tokens(client, identifier, headers)},
        )
        with Session(engine) as db:
            assert calculate(mapping, list(db.exec(select(Submission)).all()), field).value == score
    client.post(f"/projects/{project}/sync-jobs", headers=headers)
    # One changed record followed by an invalid record must roll back the whole attempt.
    with (
        Session(engine) as db,
        patch("app.routes.collection.list_kobo_submissions", return_value=[{"_id": 1, "score": 999}, {"score": 100}]),
    ):
        process_one(db)
    with Session(engine) as db:
        assert calculate(mapping, list(db.exec(select(Submission)).all()), field).value == 12
        failure = db.exec(select(SyncRun).where(SyncRun.status == "failed")).one()
        assert failure.failed_count == 2
        assert failure.created_count == failure.updated_count == failure.received_count == 0


def test_project_deletion_cleans_up_scheduling(sync_client):
    from app.models.operations import Project, SyncSchedule

    client, engine, project, headers = sync_client
    client.put(f"/projects/{project}/sync-settings", headers=headers, json={"mode": "scheduled", "interval_minutes": 5})
    client.post(f"/projects/{project}/sync-jobs", headers=headers)
    with Session(engine) as db:
        record = db.get(Project, UUID(project))
        org = record.organization_id
        record.kobo_form_id = None
        db.add(record)
        db.commit()
    response = client.delete(f"/organizations/{org}/projects/{project}", headers=headers)
    assert response.status_code == 204, response.text
    with Session(engine) as db:
        assert db.get(SyncJob, UUID(project)) is None
        assert db.get(SyncSchedule, UUID(project)) is None
        assert not db.exec(select(SyncSettingsChange)).all()
