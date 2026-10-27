"""Kobo submission import and organization-scoped collection APIs."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from math import ceil
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import case, func, update
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, col, select
from sqlmodel.sql.expression import Select

from app.core.config import Settings, get_settings
from app.core.kobo import decrypt_kobo_token, list_kobo_submissions
from app.core.review_evidence import canonical_json, evidence_fingerprint
from app.core.sync_telemetry import evidence
from app.db.session import get_session
from app.models.identity import User
from app.models.operations import (
    KoboConnection,
    OrganizationAdminEvent,
    Project,
    ProjectStatus,
    QualityFinding,
    Submission,
    SubmissionReviewEvent,
    SyncJob,
    SyncRun,
    SyncSchedule,
    SyncSettingsChange,
    SyncWorkerHeartbeat,
)
from app.routes.auth import get_current_user
from app.routes.kobo import _organization_admin_id

router = APIRouter()
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _submission_time(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except ValueError:
        return None


def _external_id(payload: dict[str, object]) -> str | None:
    for key in ("_id", "_uuid", "instanceID"):
        value = payload.get(key)
        if value is not None and str(value).strip():
            return str(value)
    meta = payload.get("meta")
    if isinstance(meta, dict) and meta.get("instanceID"):
        return str(meta["instanceID"])
    return None


def _read_submission(submission: Submission, project: Project) -> dict[str, object]:
    return {
        "id": str(submission.id),
        "external_id": submission.external_id,
        "project_id": str(project.id),
        "project_name": project.name,
        "form_name": project.kobo_form_name,
        "submitted_at": submission.submitted_at,
        "enumerator": submission.enumerator,
        "location": submission.location,
        "review_status": submission.review_status,
        "raw_answers": submission.raw_answers,
        "evidence_fingerprint": evidence_fingerprint(submission.raw_answers),
        "validation_status": submission.validation_status,
        "review_required": submission.review_required,
    }


@router.post("/projects/{project_id}/sync", tags=["Kobo synchronization"])
def sync_project_kobo_form(
    project_id: UUID, user: CurrentUser, db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    return execute_project_sync(project_id, user, db, settings)


def execute_project_sync(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
    worker_organization_id: UUID | None = None,
    trigger: str = "manual", attempt: int = 1,
) -> dict[str, object]:
    organization_id = worker_organization_id or _organization_admin_id(user, db)
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Project was not found.")
    if project.status == ProjectStatus.ARCHIVED:
        raise HTTPException(409, "Restore this archived project before synchronizing.")
    if not project.kobo_connection_id or not project.kobo_form_id:
        raise HTTPException(status_code=422, detail="Assign a Kobo form to this project before syncing.")
    connection = db.get(KoboConnection, project.kobo_connection_id)
    if connection is None or connection.organization_id != organization_id or not connection.is_verified:
        raise HTTPException(status_code=422, detail="The assigned Kobo connection is not available.")

    run = SyncRun(
        organization_id=organization_id,
        project_id=project.id,
        kobo_connection_id=connection.id,
        kobo_form_id=project.kobo_form_id,
        status="running", trigger=trigger, attempt=attempt,
    )
    # Hold the project write lock until submissions and history commit together.
    db.execute(update(Project).where(col(Project.id) == project.id).values(updated_at=Project.updated_at))
    db.refresh(project)
    if project.status == ProjectStatus.ARCHIVED:
        raise HTTPException(409, "Restore this archived project before synchronizing.")
    run.requested_by_id = user.id if trigger == "manual" else None
    db.add(run)
    if worker_organization_id is None:
        db.commit()
    else:
        db.flush()
    db.execute(update(Project).where(col(Project.id) == project.id).values(updated_at=Project.updated_at))
    storage = db.begin_nested() if worker_organization_id is not None else None
    try:
        db.refresh(project)
        if project.kobo_form_id != run.kobo_form_id or project.kobo_connection_id != run.kobo_connection_id:
            raise ValueError("The assigned Kobo form changed. Retry synchronization.")
        token = decrypt_kobo_token(connection.token_encrypted, settings)
        payloads = list_kobo_submissions(connection.server_url, token, project.kobo_form_id)
        created = 0
        updated = 0
        for payload in payloads:
            external_id = _external_id(payload)
            if external_id is None:
                raise ValueError("Kobo returned a submission without an external ID. Import was not completed.")
            existing = db.exec(
                select(Submission).where(
                    Submission.project_id == project.id,
                    Submission.kobo_form_id == project.kobo_form_id,
                    Submission.external_id == external_id,
                )
            ).first()
            if existing is None:
                db.add(
                    Submission(
                        organization_id=organization_id,
                        project_id=project.id,
                        kobo_connection_id=connection.id,
                        kobo_form_id=project.kobo_form_id,
                        external_id=external_id,
                        submitted_at=_submission_time(payload.get("_submission_time")),
                        enumerator=str(payload.get("_submitted_by")) if payload.get("_submitted_by") else None,
                        location=str(payload.get("location")) if payload.get("location") else None,
                        raw_answers=payload,
                        evidence_fingerprint=evidence_fingerprint(payload),
                    )
                )
                created += 1
            else:
                if canonical_json(existing.raw_answers) == canonical_json(payload):
                    continue
                old_fingerprint = existing.evidence_fingerprint or evidence_fingerprint(existing.raw_answers)
                new_fingerprint = evidence_fingerprint(payload)
                if old_fingerprint != new_fingerprint:
                    previous = existing.review_status
                    existing.review_status = "needs_review"
                    existing.review_required = True
                    existing.validation_status = None
                    db.add(SubmissionReviewEvent(
                        submission_id=existing.id, organization_id=organization_id,
                        action="evidence_changed", source="kobo_sync", previous_status=previous,
                        status="needs_review", previous_evidence_fingerprint=old_fingerprint,
                        evidence_fingerprint=new_fingerprint,
                        note="Quality-relevant evidence changed; review the new evidence before reporting.",
                    ))
                existing.evidence_fingerprint = new_fingerprint
                existing.raw_answers = payload
                # SQLAlchemy's JSON equality also considers 0 == False; persist
                # the typed change already established by canonical comparison.
                flag_modified(existing, "raw_answers")
                existing.submitted_at = _submission_time(payload.get("_submission_time"))
                existing.enumerator = str(payload.get("_submitted_by")) if payload.get("_submitted_by") else None
                existing.location = str(payload.get("location")) if payload.get("location") else None
                existing.updated_at = datetime.now(UTC)
                db.add(existing)
                updated += 1
        run.status = "unchanged" if created == 0 and updated == 0 else "completed"
        run.received_count = len(payloads)
        run.created_count = created
        run.updated_count = updated
        run.completed_at = datetime.now(UTC)
        db.add(run)
        db.commit() if worker_organization_id is None else db.flush()
        if storage is not None:
            storage.commit()
    except Exception as exc:
        if storage is not None:
            storage.rollback()
        else:
            db.rollback()
        run.received_count = run.created_count = run.updated_count = 0
        run.failed_count = len(payloads) if "payloads" in locals() else 0
        run.status = "failed"
        message = str(exc) if isinstance(exc, ValueError) else "Submission storage failed. Retry the full import."
        run.error_message = message
        run.completed_at = datetime.now(UTC)
        db.add(run)
        db.commit() if worker_organization_id is None else db.flush()
        raise HTTPException(status_code=422, detail=message) from exc
    return {
        "sync_run_id": str(run.id),
        "status": run.status,
        "received": run.received_count,
        "created": run.created_count,
        "updated": run.updated_count,
        "skipped": run.received_count - run.created_count - run.updated_count,
    }


class SyncSettingsUpdate(BaseModel):
    mode: str = Field(pattern="^(manual|scheduled)$")
    interval_minutes: int = Field(default=60, ge=1, le=10080)
    interval_seconds: float | None = Field(default=None, ge=1.6, le=604800, allow_inf_nan=False)


def _sync_project(project_id: UUID, user: User, db: Session) -> Project:
    organization_id = _organization_admin_id(user, db)
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(404, "Project was not found.")
    return project


@router.get("/projects/{project_id}/sync-settings", tags=["Kobo synchronization"])
def get_sync_settings(
    project_id: UUID, user: CurrentUser, db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    _sync_project(project_id, user, db)
    schedule = db.get(SyncSchedule, project_id)
    success = db.exec(select(SyncRun).where(
        SyncRun.project_id == project_id, col(SyncRun.status).in_(["completed", "unchanged"]),
    ).order_by(col(SyncRun.completed_at).desc())).first()
    job = db.get(SyncJob, project_id)
    heartbeat = db.exec(select(SyncWorkerHeartbeat).order_by(col(SyncWorkerHeartbeat.last_seen_at).desc())).first()
    latest = db.exec(
        select(SyncRun).where(SyncRun.project_id == project_id).order_by(col(SyncRun.started_at).desc())
    ).first()

    def utc_timestamp(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    return {
        "mode": schedule.mode if schedule else "manual",
        **evidence(settings, project_id, job.created_at if job else None),
        "interval_minutes": schedule.interval_minutes if schedule else 60,
        "interval_seconds": (schedule.interval_seconds or schedule.interval_minutes * 60) if schedule else 3600,
        "last_successful_sync": utc_timestamp(success.completed_at) if success else None,
        "pending": job is not None,
        "worker_last_seen_at": utc_timestamp(heartbeat.last_seen_at) if heartbeat else None,
        "latest_status": latest.status if latest else None,
        "latest_error": latest.error_message if latest else None,
        "received": latest.received_count if latest else 0,
        "created": latest.created_count if latest else 0,
        "updated": latest.updated_count if latest else 0,
        "queued_at": utc_timestamp(job.created_at) if job else None,
        "attempts": job.attempts if job else 0,
        "next_attempt_at": utc_timestamp(job.due_at) if job else None,
    }


@router.put("/projects/{project_id}/sync-settings", tags=["Kobo synchronization"])
def update_sync_settings(
    project_id: UUID, body: SyncSettingsUpdate, user: CurrentUser, db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    project = _sync_project(project_id, user, db)
    if project.status == ProjectStatus.ARCHIVED and body.mode == "scheduled":
        raise HTTPException(409, "Restore this archived project before enabling synchronization.")
    if body.mode == "scheduled":
        connection = db.get(KoboConnection, project.kobo_connection_id) if project.kobo_connection_id else None
        if (not project.kobo_form_id or connection is None
                or connection.organization_id != project.organization_id or not connection.is_verified):
            raise HTTPException(422, "Assign a form from a verified Kobo connection before enabling automatic sync.")
    db.execute(update(Project).where(col(Project.id) == project_id).values(updated_at=Project.updated_at))
    db.refresh(project)
    if project.status == ProjectStatus.ARCHIVED and body.mode == "scheduled":
        raise HTTPException(409, "Restore this archived project before enabling synchronization.")
    schedule = db.get(SyncSchedule, project_id) or SyncSchedule(project_id=project_id)
    schedule.mode = body.mode
    schedule.interval_minutes = (
        ceil(body.interval_seconds / 60) if body.interval_seconds is not None else body.interval_minutes
    )
    schedule.interval_seconds = (
        body.interval_seconds if body.interval_seconds is not None else body.interval_minutes * 60
    )
    schedule.next_due_at = datetime.now(UTC)
    schedule.updated_by_id = user.id
    schedule.updated_at = datetime.now(UTC)
    db.add(schedule)
    db.add(SyncSettingsChange(project_id=project_id, changed_by_id=user.id,
                             mode=body.mode, interval_minutes=schedule.interval_minutes,
                             interval_seconds=schedule.interval_seconds))
    if body.mode == "manual":
        job = db.get(SyncJob, project_id)
        if job and job.trigger == "scheduled":
            db.delete(job)
    db.commit()
    return get_sync_settings(project_id, user, db, settings)


@router.post("/projects/{project_id}/sync-jobs", status_code=202, tags=["Kobo synchronization"])
def enqueue_sync(project_id: UUID, user: CurrentUser, db: Database) -> dict[str, object]:
    project = _sync_project(project_id, user, db)
    if project.status == ProjectStatus.ARCHIVED:
        raise HTTPException(409, "Restore this archived project before synchronizing.")
    if not project.kobo_form_id or not project.kobo_connection_id:
        raise HTTPException(422, "Assign a Kobo form before syncing.")
    db.execute(update(Project).where(col(Project.id) == project_id).values(updated_at=Project.updated_at))
    db.refresh(project)
    if project.status == ProjectStatus.ARCHIVED:
        raise HTTPException(409, "Restore this archived project before synchronizing.")
    if db.get(SyncJob, project_id) is None:
        db.add(SyncJob(project_id=project_id, requested_by_id=user.id))
    db.commit()
    return {"status": "queued", "project_id": str(project_id)}


@router.get("/submissions", tags=["Submissions"])
def list_submissions(
    user: CurrentUser,
    db: Database,
    project_id: UUID | None = None,
) -> list[dict[str, object]]:
    organization_id = _organization_admin_id(user, db)
    statement = select(Submission).where(Submission.organization_id == organization_id)
    if project_id:
        statement = statement.where(Submission.project_id == project_id)
    submissions = db.exec(statement.order_by(col(Submission.submitted_at).desc())).all()
    projects = {submission.project_id: db.get(Project, submission.project_id) for submission in submissions}
    return [
        _read_submission(submission, cast(Project, projects[submission.project_id]))
        for submission in submissions
        if projects[submission.project_id]
    ]


def _submission_statement(
    organization_id: UUID, project_id: UUID | None, review_status: str | None, search: str,
) -> Select[Submission, Project]:
    conditions = [col(Submission.organization_id) == organization_id]
    if project_id:
        conditions.append(col(Submission.project_id) == project_id)
    statement = select(Submission, Project).join(Project, col(Project.id) == col(Submission.project_id))
    if review_status:
        conditions.append(col(Submission.review_status) == review_status)
    if search:
        from sqlalchemy import or_
        conditions.append(or_(
            col(Submission.external_id).icontains(search, autoescape=True),
            col(Submission.enumerator).icontains(search, autoescape=True),
            col(Submission.location).icontains(search, autoescape=True),
            col(Project.kobo_form_name).icontains(search, autoescape=True),
        ))
    statement = statement.where(*conditions, Project.organization_id == organization_id)
    return statement


@router.get("/submissions/page", tags=["Submissions"])
def submission_page(
    user: CurrentUser, db: Database, project_id: UUID | None = None,
    review_status: str | None = Query(default=None, pattern="^(ready|needs_review|invalid)$"),
    search: str = Query(default="", max_length=200),
    offset: int = Query(default=0, ge=0), limit: int = Query(default=10, ge=1, le=100),
) -> dict[str, object]:
    organization_id = _organization_admin_id(user, db)
    conditions = [col(Submission.organization_id) == organization_id]
    if project_id:
        conditions.append(col(Submission.project_id) == project_id)
    counts = dict(db.exec(select(Submission.review_status, func.count()).where(*conditions)
                         .group_by(Submission.review_status)).all())
    statement = _submission_statement(organization_id, project_id, review_status, search)
    total = db.exec(select(func.count()).select_from(statement.subquery())).one()
    records = db.exec(statement.order_by(col(Submission.submitted_at).desc(), col(Submission.id).desc())
                      .offset(offset).limit(limit)).all()
    return {"items": [_read_submission(record, project) for record, project in records],
            "total": total, "counts": counts, "offset": offset}


@router.get("/submissions/export.csv", tags=["Submissions"])
def export_submissions(
    user: CurrentUser, db: Database, project_id: UUID | None = None,
    review_status: str | None = Query(default=None, pattern="^(ready|needs_review|invalid)$"),
    search: str = Query(default="", max_length=200),
    date_from: datetime | None = None, date_to: datetime | None = None,
) -> StreamingResponse:
    from app.core.sync_telemetry import utc
    organization_id = _organization_admin_id(user, db)
    if date_from and date_to and utc(date_from) > utc(date_to):
        raise HTTPException(422, "Start date must be on or before end date.")
    statement = _submission_statement(organization_id, project_id, review_status, search)
    if date_from:
        statement = statement.where(col(Submission.submitted_at) >= utc(date_from))
    if date_to:
        statement = statement.where(col(Submission.submitted_at) <= utc(date_to))
    statement = statement.order_by(col(Submission.submitted_at).desc(), col(Submission.id).desc())
    db.add(OrganizationAdminEvent(organization_id=organization_id, actor_id=user.id,
                                 action="submissions_export", resource_id=str(project_id or organization_id)))
    db.commit()

    def rows() -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "project", "form", "submission_id", "enumerator", "location", "submitted_at_utc", "review_status",
        ])
        yield "\ufeff" + buffer.getvalue()
        for item, project in db.exec(statement.execution_options(yield_per=500)):
            buffer.seek(0)
            buffer.truncate(0)
            values = [project.name, project.kobo_form_name, item.external_id, item.enumerator, item.location,
                      utc(item.submitted_at).isoformat() if item.submitted_at else None, item.review_status]
            text = [str(value) if value is not None else "" for value in values]
            writer.writerow([
                "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value for value in text
            ])
            yield buffer.getvalue()
    return StreamingResponse(rows(), media_type="text/csv", headers={
        "Content-Disposition": 'attachment; filename="fieldsight-submissions.csv"', "Cache-Control": "no-store",
    })


@router.get("/sync-runs", tags=["Kobo synchronization"])
def list_sync_runs(user: CurrentUser, db: Database) -> list[dict[str, object]]:
    organization_id = _organization_admin_id(user, db)
    runs = db.exec(
        select(SyncRun).where(SyncRun.organization_id == organization_id).order_by(col(SyncRun.started_at).desc())
    ).all()
    return [
        {
            "id": str(run.id),
            "project_id": str(run.project_id),
            "status": run.status,
            "received": run.received_count,
            "created": run.created_count,
            "updated": run.updated_count,
            "skipped": run.received_count - run.created_count - run.updated_count,
            "failed": run.failed_count,
            "trigger": run.trigger,
            "attempt": run.attempt,
            "requested_by_id": str(run.requested_by_id) if run.requested_by_id else None,
            "error_message": run.error_message,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
        }
        for run in runs
    ]


@router.get("/sync/pending", tags=["Kobo synchronization"])
def pending_kobo_submissions(
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    """Count provider submissions that have not been imported into FieldSight."""
    organization_id = _organization_admin_id(user, db)
    projects = db.exec(
        select(Project).where(
            Project.organization_id == organization_id,
            col(Project.kobo_connection_id).is_not(None),
            col(Project.kobo_form_id).is_not(None),
        )
    ).all()
    sources: list[dict[str, object]] = []
    pending_count = 0
    connections: dict[UUID, KoboConnection] = {}
    for project in projects:
        if project.kobo_connection_id is None or project.kobo_form_id is None:
            continue
        connection = connections.get(project.kobo_connection_id)
        if connection is None:
            connection = db.get(KoboConnection, project.kobo_connection_id)
            if connection is not None:
                connections[project.kobo_connection_id] = connection
        if connection is None or connection.organization_id != organization_id or not connection.is_verified:
            continue
        try:
            token = decrypt_kobo_token(connection.token_encrypted, settings)
            remote_ids = {
                external_id
                for payload in list_kobo_submissions(connection.server_url, token, project.kobo_form_id)
                if (external_id := _external_id(payload)) is not None
            }
        except ValueError:
            sources.append(
                {
                    "project_id": str(project.id),
                    "project_name": project.name,
                    "form_name": project.kobo_form_name or "Kobo form",
                    "pending_count": 0,
                    "status": "unavailable",
                }
            )
            continue
        imported_ids = set(db.exec(select(Submission.external_id).where(
            Submission.project_id == project.id, Submission.kobo_form_id == project.kobo_form_id,
        )).all())
        outstanding = len(remote_ids - imported_ids)
        pending_count += outstanding
        sources.append(
            {
                "project_id": str(project.id),
                "project_name": project.name,
                "form_name": project.kobo_form_name or "Kobo form",
                "pending_count": outstanding,
                "status": "available",
            }
        )
    return {"pending_count": pending_count, "sources": sources, "checked_at": datetime.now(UTC)}


@router.get("/dashboard/overview", tags=["Dashboard"])
def dashboard_overview(
    user: CurrentUser,
    db: Database,
    project_id: UUID | None = None,
    location: str | None = None,
    period: str = "7d",
) -> dict[str, object]:
    """Return locally stored dashboard metrics without waiting for KoboToolbox."""
    overview = analytics_overview(user, db, project_id=project_id, location=location, period=period)
    collection_health = cast(dict[str, int], overview["collection_health"])
    return {
        **overview,
        "pending_sync_count": None,
        "sync_status": {
            "pending_count": None,
            "sources": [],
            "healthy_sources": collection_health["healthy_sources"],
            "delayed_sources": collection_health["delayed_sources"],
            "connected_sources": collection_health["connected_sources"],
        },
    }


@router.get("/analytics/overview", tags=["Analytics"])
def analytics_overview(
    user: CurrentUser,
    db: Database,
    project_id: UUID | None = None,
    location: str | None = None,
    period: str = "7d",
) -> dict[str, object]:
    """Return tenant-scoped dashboard data derived from imported Kobo records."""
    organization_id = _organization_admin_id(user, db)
    now = datetime.now(UTC)
    period_days = {"today": 1, "7d": 7, "30d": 30}.get(period, 7)
    cutoff = now - timedelta(days=period_days)
    previous_cutoff = cutoff - timedelta(days=period_days)

    def as_utc(value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    organization_column = col(Submission.organization_id)
    project_column = col(Submission.project_id)
    submitted_at_column = col(Submission.submitted_at)
    location_column = col(Submission.location)
    review_status_column = col(Submission.review_status)
    scope_conditions = [organization_column == organization_id]
    if project_id:
        scope_conditions.append(project_column == project_id)
    if location:
        scope_conditions.append(location_column == location)

    available_locations = list(
        db.exec(
            select(location_column)
            .where(organization_column == organization_id, location_column.is_not(None))
            .distinct()
            .order_by(location_column)
        ).all()
    )

    current_conditions = [*scope_conditions, submitted_at_column >= cutoff]
    total, ready, needs_review, invalid = db.exec(
        select(
            func.count(),
            func.coalesce(func.sum(case((review_status_column == "ready", 1), else_=0)), 0),
            func.coalesce(func.sum(case((review_status_column == "needs_review", 1), else_=0)), 0),
            func.coalesce(func.sum(case((review_status_column == "invalid", 1), else_=0)), 0),
        ).where(*current_conditions)
    ).one()
    previous_total = db.exec(
        select(func.count()).select_from(Submission).where(
            *scope_conditions,
            submitted_at_column >= previous_cutoff,
            submitted_at_column < cutoff,
        )
    ).one()
    ready_this_week = db.exec(
        select(func.count()).select_from(Submission).where(
            *scope_conditions,
            review_status_column == "ready",
            submitted_at_column >= now - timedelta(days=7),
        )
    ).one()

    projects = db.exec(select(Project).where(Project.organization_id == organization_id)).all()
    project_scope = [project for project in projects if not project_id or project.id == project_id]
    submission_day = func.date(submitted_at_column)
    daily_rows = db.exec(
        select(
            submission_day.label("submission_day"),
            func.count(),
            func.coalesce(func.sum(case((review_status_column == "ready", 1), else_=0)), 0),
        )
        .where(*current_conditions)
        .group_by(submission_day)
        .order_by(submission_day)
    ).all()
    project_counts = dict(
        db.exec(
            select(project_column, func.count())
            .where(*current_conditions)
            .group_by(project_column)
        ).all()
    )

    total = int(total)
    ready = int(ready)
    needs_review = int(needs_review)
    invalid = int(invalid)
    previous_total = int(previous_total)
    change_percent = round(((total - previous_total) / previous_total) * 100, 1) if previous_total else None

    run_conditions = [SyncRun.organization_id == organization_id]
    if project_id:
        run_conditions.append(SyncRun.project_id == project_id)
    scoped_runs = db.exec(select(SyncRun).where(*run_conditions).order_by(col(SyncRun.started_at).desc())).all()
    latest_by_project: dict[UUID, SyncRun] = {}
    for run in scoped_runs:
        latest_by_project.setdefault(run.project_id, run)
    connected_projects = [project for project in project_scope if project.kobo_form_id]
    delayed_projects = [
        project
        for project in connected_projects
        if project.id not in latest_by_project
        or latest_by_project[project.id].status not in {"completed", "unchanged"}
        or (
            latest_by_project[project.id].completed_at
            and as_utc(cast(datetime, latest_by_project[project.id].completed_at)) < now - timedelta(hours=12)
        )
    ]
    healthy_sources = max(0, len(connected_projects) - len(delayed_projects))

    recent = db.exec(
        select(Submission)
        .where(*scope_conditions, submitted_at_column.is_not(None))
        .order_by(submitted_at_column.desc())
        .limit(5)
    ).all()
    project_names = {project.id: project.name for project in projects}
    activity = [
        {
            "id": str(item.id),
            "name": item.enumerator or "Kobo submission",
            "detail": f"submitted {item.external_id} to {project_names.get(item.project_id, 'a project')}",
            "location": item.location,
            "occurred_at": item.submitted_at,
        }
        for item in recent
    ]

    alerts: list[dict[str, object]] = []
    if needs_review:
        alerts.append(
            {
                "kind": "review",
                "title": f"{needs_review} record{'s' if needs_review != 1 else ''} need review",
                "text": "Quality review is required before reporting",
                "path": "/submissions",
            }
        )
    if invalid:
        alerts.append(
            {
                "kind": "invalid",
                "title": f"{invalid} invalid record{'s' if invalid != 1 else ''}",
                "text": "These records are blocked from export",
                "path": "/submissions",
            }
        )
    if delayed_projects:
        alerts.append(
            {
                "kind": "sync",
                "title": f"{len(delayed_projects)} source{'s' if len(delayed_projects) != 1 else ''} need attention",
                "text": "A connected Kobo form has not synced recently",
                "path": "/sync",
            }
        )

    return {
        "total_submissions": total,
        "ready_records": ready,
        "ready_this_week": int(ready_this_week),
        "needs_review": needs_review,
        "invalid_records": invalid,
        "blocked_records": needs_review + invalid,
        "submission_change_percent": change_percent,
        "active_projects": sum(project.status.value == "active" for project in project_scope),
        "last_synced_at": next(
            (run.completed_at for run in scoped_runs if run.status in {"completed", "unchanged"}), None
        ),
        "available_locations": available_locations,
        "trend": [
            {
                "day": datetime.fromisoformat(str(day)).strftime("%b %d") if day is not None else "Unknown",
                "submissions": int(submissions),
                "approved": int(approved),
            }
            for day, submissions, approved in daily_rows
        ],
        "projects": [
            {
                "id": str(project.id),
                "name": project.name,
                "actual": int(project_counts.get(project.id, 0)),
                "target": project.target_sample_size or 0,
            }
            for project in project_scope
        ],
        "collection_health": {
            "healthy_sources": healthy_sources,
            "delayed_sources": len(delayed_projects),
            "connected_sources": len(connected_projects),
            "ready_records": ready,
        },
        "activity": activity,
        "alerts": alerts,
    }


class ReviewStatusUpdate(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=2000)
    evidence_fingerprint: str
    expected_review_token: str


def _review_token(submission: Submission, db: Session) -> str:
    latest = db.exec(select(SubmissionReviewEvent).where(
        SubmissionReviewEvent.submission_id == submission.id,
    ).order_by(col(SubmissionReviewEvent.occurred_at).desc(), col(SubmissionReviewEvent.id).desc())).first()
    return str(latest.id) if latest else "unreviewed"


@router.get("/submissions/{submission_id}", tags=["Submissions"])
def submission_detail(
    submission_id: UUID, user: CurrentUser, db: Database,
    history_offset: int = Query(default=0, ge=0),
) -> dict[str, object]:
    organization_id = _organization_admin_id(user, db)
    submission = db.get(Submission, submission_id)
    if submission is None or submission.organization_id != organization_id:
        raise HTTPException(404, "Submission was not found.")
    project = _sync_project(submission.project_id, user, db)
    events = select(SubmissionReviewEvent).where(
        SubmissionReviewEvent.submission_id == submission.id,
        SubmissionReviewEvent.organization_id == organization_id,
    )
    total = db.exec(select(func.count()).select_from(events.subquery())).one()
    history = db.exec(events.order_by(col(SubmissionReviewEvent.occurred_at).desc(),
                                     col(SubmissionReviewEvent.id).desc()).offset(history_offset).limit(50)).all()
    findings = db.exec(select(QualityFinding).where(
        QualityFinding.submission_id == submission.id, QualityFinding.organization_id == organization_id,
    ).limit(100)).all()
    return {**_read_submission(submission, project), "review_token": _review_token(submission, db),
            "history_total": total, "history": [event.model_dump(mode="json") for event in history],
            "findings": [finding.model_dump(mode="json") for finding in findings]}


@router.patch("/submissions/{submission_id}/review-status", tags=["Submissions"])
def update_submission_review_status(
    submission_id: UUID,
    payload: ReviewStatusUpdate,
    user: CurrentUser,
    db: Database,
) -> dict[str, object]:
    organization_id = _organization_admin_id(user, db)
    if payload.status not in {"ready", "needs_review", "invalid"}:
        raise HTTPException(status_code=422, detail="Review status must be ready, needs_review, or invalid.")
    submission = db.get(Submission, submission_id)
    if submission is None or submission.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Submission was not found.")
    db.execute(update(Project).where(col(Project.id) == submission.project_id).values(updated_at=Project.updated_at))
    db.refresh(submission)
    fingerprint = evidence_fingerprint(submission.raw_answers)
    if payload.evidence_fingerprint != fingerprint:
        raise HTTPException(409, "Submission evidence changed. Reload the record before reviewing.")
    if payload.expected_review_token is not None and payload.expected_review_token != _review_token(submission, db):
        raise HTTPException(409, "Another review was recorded. Reload before deciding.")
    if payload.status in {"invalid", "needs_review"} and not (payload.note or "").strip():
        raise HTTPException(422, "A reason is required for invalid or reopened decisions.")
    db.add(SubmissionReviewEvent(submission_id=submission.id, organization_id=organization_id,
        evidence_fingerprint=fingerprint, actor_id=user.id, action="status", previous_status=submission.review_status,
        status=payload.status, note=payload.note))
    submission.evidence_fingerprint = fingerprint
    submission.decision_fingerprint = fingerprint
    submission.decision_status = payload.status
    submission.review_required = False
    submission.review_status = payload.status
    submission.updated_at = datetime.now(UTC)
    db.add(submission)
    db.add(OrganizationAdminEvent(organization_id=organization_id, actor_id=user.id,
                                 action=f"submission_review:{payload.status}", resource_id=str(submission.id)))
    db.commit()
    return {"id": str(submission.id), "review_status": submission.review_status}
