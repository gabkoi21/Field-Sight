"""Advisory worker evidence, independent of the locked import transaction.

Never used to claim, release, or retry queue jobs. API and workers must share
this directory. SQLite defaults to a directory beside its database file.
"""

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event, Lock, Thread
from uuid import UUID, uuid4

from sqlalchemy.engine import make_url

from app.core.config import Settings

HEARTBEAT_SECONDS = 5
STALE_SECONDS = 20


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def directory(settings: Settings) -> Path | None:
    if settings.sync_telemetry_directory:
        return Path(settings.sync_telemetry_directory).resolve()
    url = make_url(settings.database_url)
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        database = Path(url.database).resolve()
        return database.parent / (database.name + ".sync-workers")
    return None


class WorkerTelemetry:
    def __init__(self, settings: Settings) -> None:
        self.directory = directory(settings)
        self.worker_id = str(uuid4())
        self.active: dict[str, str] | None = None
        self.lock = Lock()
        self.stop = Event()
        self.thread = Thread(target=self._pulse, name="sync-heartbeat", daemon=True)

    def start(self) -> None:
        self.publish()
        self.thread.start()

    def _pulse(self) -> None:
        while not self.stop.wait(HEARTBEAT_SECONDS):
            self.publish()

    def publish(self) -> None:
        if self.directory is None:
            return
        try:
            with self.lock:
                self.directory.mkdir(parents=True, exist_ok=True)
                path = self.directory / f"{self.worker_id}.json"
                temporary = path.with_suffix(".tmp")
                temporary.write_text(json.dumps({
                    "heartbeat_at": datetime.now(UTC).isoformat(), "active": self.active,
                }), encoding="utf-8")
                os.replace(temporary, path)
        except OSError:
            logging.warning("Worker heartbeat could not be published; queue processing is unaffected.")

    def start_job(self, project_id: UUID, queued_at: datetime) -> None:
        # Called only after the conditional queue claim owns the transaction.
        with self.lock:
            self.active = {"project_id": str(project_id), "queued_at": utc(queued_at).isoformat(),
                           "started_at": datetime.now(UTC).isoformat()}
        self.publish()

    def clear_job(self) -> None:
        with self.lock:
            self.active = None
        self.publish()

    def close(self) -> None:
        self.stop.set()
        self.thread.join(timeout=HEARTBEAT_SECONDS + 1)
        if self.directory:
            try:
                (self.directory / f"{self.worker_id}.json").unlink(missing_ok=True)
            except OSError:
                pass


def evidence(settings: Settings, project_id: UUID, queued_at: datetime | None) -> dict[str, object]:
    root = directory(settings)
    result: dict[str, object] = {"worker_available": None if root is None else False,
                               "worker_heartbeat_at": None, "execution_state": None, "execution_started_at": None}
    if root is None:
        return result
    now = datetime.now(UTC)
    newest: datetime | None = None
    try:
        for path in root.glob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                timestamp = utc(datetime.fromisoformat(payload["heartbeat_at"]))
                # Ignore future timestamps as well as malformed or partially written files.
                if timestamp > now + timedelta(seconds=5):
                    continue
                newest = max(newest, timestamp) if newest else timestamp
                fresh = timestamp >= now - timedelta(seconds=STALE_SECONDS)
                if fresh:
                    result["worker_available"] = True
                active = payload.get("active")
                if (queued_at is not None and isinstance(active, dict)
                        and active.get("project_id") == str(project_id)
                        and active.get("queued_at") == utc(queued_at).isoformat()):
                    state = "running" if fresh else "unconfirmed"
                    if result["execution_state"] != "running":
                        result["execution_state"] = state
                        result["execution_started_at"] = active.get("started_at")
            except (OSError, ValueError, KeyError, TypeError):
                continue
    except OSError:
        result["worker_available"] = None
    result["worker_heartbeat_at"] = newest
    return result
