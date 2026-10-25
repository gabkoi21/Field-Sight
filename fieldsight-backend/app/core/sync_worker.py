"""Durable database queue. Run with python -m app.core.sync_worker."""

import logging
import time
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import Session, col, select

from app.core.config import get_settings
from app.core.sync_telemetry import WorkerTelemetry
from app.db.session import get_engine
from app.models.identity import User
from app.models.operations import Project, ProjectStatus, SyncJob, SyncRun, SyncSchedule, SyncWorkerHeartbeat
from app.routes.collection import execute_project_sync


def schedule_due(db: Session) -> None:
    now = datetime.now(UTC)
    ids = db.exec(
        select(SyncSchedule.project_id).where(
            col(SyncSchedule.mode) == "scheduled",
            col(SyncSchedule.next_due_at) <= now,
            col(SyncSchedule.project_id).in_(select(Project.id).where(Project.status != ProjectStatus.ARCHIVED)),
        )
    ).all()
    db.rollback()
    for project_id in ids:
        try:
            claimed = db.execute(
                update(SyncSchedule)
                .where(
                    col(SyncSchedule.project_id) == project_id,
                    col(SyncSchedule.mode) == "scheduled",
                    col(SyncSchedule.next_due_at) <= now,
                )
                .values(next_due_at=now + timedelta(days=1))
            )
            if cast(CursorResult, claimed).rowcount:
                schedule = db.get(SyncSchedule, project_id)
                assert schedule is not None
                schedule.next_due_at = now + timedelta(
                    seconds=schedule.interval_seconds or schedule.interval_minutes * 60
                )
                if db.get(SyncJob, project_id) is None:
                    db.add(SyncJob(project_id=project_id, trigger="scheduled"))
            db.commit()
        except IntegrityError:
            db.rollback()


def process_one(db: Session, telemetry: WorkerTelemetry | None = None) -> bool:
    try:
        return _process_one(db, telemetry)
    finally:
        # Clearing advisory evidence never commits or releases the queue claim.
        if telemetry:
            telemetry.clear_job()


def _process_one(db: Session, telemetry: WorkerTelemetry | None) -> bool:
    now = datetime.now(UTC)
    project_id = db.exec(
        select(SyncJob.project_id).where(col(SyncJob.due_at) <= now).order_by(col(SyncJob.due_at)).limit(1)
    ).first()
    db.rollback()
    if project_id is None:
        return False
    db.execute(update(Project).where(col(Project.id) == project_id).values(updated_at=Project.updated_at))
    # Conditional write owns the job until commit; process death rolls it back.
    claimed = db.execute(
        update(SyncJob)
        .where(
            col(SyncJob.project_id) == project_id,
            col(SyncJob.due_at) <= now,
        )
        .values(due_at=now + timedelta(days=365))
    )
    if not cast(CursorResult, claimed).rowcount:
        db.rollback()
        return False
    job = db.get(SyncJob, project_id)
    assert job is not None
    attempt = job.attempts + 1
    trigger = job.trigger
    project = db.get(Project, project_id)
    if project is None or project.status == ProjectStatus.ARCHIVED:
        db.delete(job)
        db.commit()
        return True
    user = db.get(User, job.requested_by_id or project.created_by_id)
    assert user is not None
    if telemetry:
        telemetry.start_job(project_id, job.created_at)
    try:
        execute_project_sync(project_id, user, db, get_settings(), project.organization_id, trigger, attempt)
    except HTTPException as exc:
        if (
            db.exec(
                select(SyncRun).where(
                    SyncRun.project_id == project_id,
                    SyncRun.started_at >= now,
                )
            ).first()
            is None
            and project.kobo_connection_id
            and project.kobo_form_id
        ):
            db.add(
                SyncRun(
                    organization_id=project.organization_id,
                    project_id=project_id,
                    kobo_connection_id=project.kobo_connection_id,
                    kobo_form_id=project.kobo_form_id,
                    status="failed",
                    trigger=trigger,
                    attempt=attempt,
                    requested_by_id=job.requested_by_id,
                    error_message=str(exc.detail),
                    completed_at=datetime.now(UTC),
                )
            )
        # Import failure rolls back submissions before recording safe failure history.
        job = db.get(SyncJob, project_id)
        assert job is not None
        job.attempts = attempt
        if attempt >= get_settings().sync_max_attempts:
            db.delete(job)
        else:
            job.due_at = datetime.now(UTC) + timedelta(seconds=get_settings().sync_retry_seconds * 2 ** (attempt - 1))
        db.commit()
        return True
    db.delete(job)
    db.commit()
    return True


def run(telemetry: WorkerTelemetry) -> None:
    worker_id = str(uuid4())
    next_heartbeat = 0.0
    while True:
        try:
            with Session(get_engine()) as db:
                if time.monotonic() >= next_heartbeat:
                    heartbeat = db.get(SyncWorkerHeartbeat, worker_id) or SyncWorkerHeartbeat(worker_id=worker_id)
                    heartbeat.last_seen_at = datetime.now(UTC)
                    db.add(heartbeat)
                    db.commit()
                    next_heartbeat = time.monotonic() + 5
                schedule_due(db)
                if process_one(db, telemetry):
                    continue
        except SQLAlchemyError:
            # Never log SQL parameters, tokens, or submission payloads.
            logging.error("Synchronization database operation failed; worker will retry.")
        time.sleep(get_settings().sync_poll_seconds)


def main() -> None:
    telemetry = WorkerTelemetry(get_settings())
    telemetry.start()
    try:
        run(telemetry)
    finally:
        telemetry.close()


if __name__ == "__main__":
    main()
