"""Independent execution evidence while SQLite owns the import write lock."""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Event
from unittest.mock import patch
from uuid import UUID, uuid4

from sqlmodel import Session
from test_kobo_sync import page
from test_kobo_sync import sync_client as sync_client

from app.core.config import get_settings
from app.core.sync_telemetry import WorkerTelemetry, evidence
from app.core.sync_worker import process_one
from app.models.operations import SyncJob


def test_running_is_visible_during_locked_import_and_cleared_after_commit(sync_client, tmp_path):
    client, engine, project, headers = sync_client
    settings = client.app.dependency_overrides[get_settings]().model_copy(
        update={"sync_telemetry_directory": str(tmp_path / "telemetry")},
    )
    client.app.dependency_overrides[get_settings] = lambda: settings
    client.post(f"/projects/{project}/sync-jobs", headers=headers)
    entered, release = Event(), Event()
    telemetry = WorkerTelemetry(settings)
    telemetry.start()

    def provider(*args, **kwargs):
        entered.set()
        assert release.wait(10), "Test did not release the simulated provider"
        return page([{"_id": 1}], count=1)

    def work():
        with Session(engine) as db:
            return process_one(db, telemetry)

    try:
        with patch("app.core.kobo.httpx.get", side_effect=provider), ThreadPoolExecutor(1) as pool:
            future = pool.submit(work)
            try:
                assert entered.wait(5)
                telemetry.publish()
                response = client.get(f"/projects/{project}/sync-settings", headers=headers)
                assert response.status_code == 200
                status = response.json()
                assert status["pending"] and status["execution_state"] == "running"
                assert status["worker_available"] is True and status["execution_started_at"]
                assert client.get(f"/projects/{uuid4()}/sync-settings", headers=headers).status_code == 404
            finally:
                release.set()
            assert future.result(timeout=5)
        status = client.get(f"/projects/{project}/sync-settings", headers=headers).json()
        assert not status["pending"] and status["execution_state"] is None
        assert status["latest_status"] == "completed"
    finally:
        release.set()
        telemetry.close()


def test_stale_job_evidence_is_unconfirmed_and_never_applies_to_a_new_job(sync_client, tmp_path):
    client, engine, project, headers = sync_client
    settings = client.app.dependency_overrides[get_settings]().model_copy(
        update={"sync_telemetry_directory": str(tmp_path)},
    )
    now = datetime.now(UTC)
    telemetry = WorkerTelemetry(settings)
    telemetry.start_job(UUID(project), now)
    assert evidence(settings, UUID(project), now)["execution_state"] == "running"
    assert evidence(settings, UUID(project), now + timedelta(seconds=1))["execution_state"] is None
    path = tmp_path / f"{telemetry.worker_id}.json"
    data = json.loads(path.read_text())
    data["heartbeat_at"] = (now - timedelta(seconds=60)).isoformat()
    path.write_text(json.dumps(data))
    status = evidence(settings, UUID(project), now)
    assert status["worker_available"] is False and status["execution_state"] == "unconfirmed"
    # Uncommitted queue ownership remains authoritative, never this advisory file.
    assert evidence(settings, uuid4(), now)["execution_state"] is None
    with Session(engine) as db:
        assert db.get(SyncJob, UUID(project)) is None


def test_malformed_telemetry_is_ignored_without_breaking_sync_status(sync_client, tmp_path):
    client, _, project, _ = sync_client
    settings = client.app.dependency_overrides[get_settings]().model_copy(
        update={"sync_telemetry_directory": str(tmp_path)},
    )
    (tmp_path / "broken.json").write_text("not-json")
    assert evidence(settings, UUID(project), None)["worker_available"] is False
