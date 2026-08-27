"""Kobo submission import and organization-scoped collection APIs."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.kobo import decrypt_kobo_token, list_kobo_submissions
from app.db.session import get_session
from app.models.identity import User
from app.models.phase3 import KoboConnection, Project, Submission, SyncRun
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
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except ValueError:
        return None


def _external_id(payload: dict[str, object]) -> str | None:
    for key in ("_id", "_uuid", "instanceID"):
        value = payload.get(key)
        if value is not None:
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
    }


@router.post("/projects/{project_id}/sync", tags=["Kobo synchronization"])
def sync_project_kobo_form(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    organization_id = _organization_admin_id(user, db)
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Project was not found.")
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
        status="running",
    )
    db.add(run)
    db.commit()
    try:
        token = decrypt_kobo_token(connection.token_encrypted, settings)
        payloads = list_kobo_submissions(connection.server_url, token, project.kobo_form_id)
        created = 0
        updated = 0
        for payload in payloads:
            external_id = _external_id(payload)
            if external_id is None:
                continue
            existing = db.exec(
                select(Submission).where(Submission.project_id == project.id, Submission.external_id == external_id)
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
                    )
                )
                created += 1
            else:
                if existing.raw_answers == payload:
                    continue
                existing.raw_answers = payload
                existing.submitted_at = _submission_time(payload.get("_submission_time")) or existing.submitted_at
                existing.enumerator = (
                    str(payload.get("_submitted_by")) if payload.get("_submitted_by") else None
                )
                existing.location = str(payload.get("location")) if payload.get("location") else None
                existing.updated_at = datetime.now(UTC)
                db.add(existing)
                updated += 1
        if created == 0 and updated == 0:
            db.delete(run)
            db.commit()
            return {
                "sync_run_id": None,
                "status": "unchanged",
                "received": len(payloads),
                "created": 0,
                "updated": 0,
            }
        run.status = "completed"
        run.received_count = len(payloads)
        run.created_count = created
        run.updated_count = updated
        run.completed_at = datetime.now(UTC)
        db.add(run)
        db.commit()
    except ValueError as exc:
        db.rollback()
        run.status = "failed"
        run.error_message = str(exc)
        run.completed_at = datetime.now(UTC)
        db.add(run)
        db.commit()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"sync_run_id": str(run.id), "status": run.status, "received": run.received_count, "created": run.created_count, "updated": run.updated_count}


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
    submissions = db.exec(statement.order_by(Submission.submitted_at.desc())).all()
    projects = {submission.project_id: db.get(Project, submission.project_id) for submission in submissions}
    return [_read_submission(submission, projects[submission.project_id]) for submission in submissions if projects[submission.project_id]]


@router.get("/sync-runs", tags=["Kobo synchronization"])
def list_sync_runs(user: CurrentUser, db: Database) -> list[dict[str, object]]:
    organization_id = _organization_admin_id(user, db)
    runs = db.exec(select(SyncRun).where(SyncRun.organization_id == organization_id).order_by(SyncRun.started_at.desc())).all()
    return [{"id": str(run.id), "project_id": str(run.project_id), "status": run.status, "received": run.received_count, "created": run.created_count, "updated": run.updated_count, "error_message": run.error_message, "started_at": run.started_at, "completed_at": run.completed_at} for run in runs]
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

    all_submissions = db.exec(
        select(Submission)
        .where(Submission.organization_id == organization_id)
        .order_by(Submission.submitted_at.asc())
    ).all()
    available_locations = sorted({item.location for item in all_submissions if item.location})

    scoped = [item for item in all_submissions if not project_id or item.project_id == project_id]
    if location:
        scoped = [item for item in scoped if item.location == location]
    current = [item for item in scoped if item.submitted_at and as_utc(item.submitted_at) >= cutoff]
    previous = [
        item for item in scoped
        if item.submitted_at and previous_cutoff <= as_utc(item.submitted_at) < cutoff
    ]

    projects = db.exec(select(Project).where(Project.organization_id == organization_id)).all()
    project_scope = [project for project in projects if not project_id or project.id == project_id]
    by_day: dict[str, dict[str, int]] = defaultdict(lambda: {"submissions": 0, "approved": 0})
    by_project: dict[UUID, int] = defaultdict(int)
    for submission in current:
        by_project[submission.project_id] += 1
        day = as_utc(submission.submitted_at).strftime("%b %d") if submission.submitted_at else "Unknown"
        by_day[day]["submissions"] += 1
        if submission.review_status == "ready":
            by_day[day]["approved"] += 1

    total = len(current)
    ready = sum(item.review_status == "ready" for item in current)
    needs_review = sum(item.review_status == "needs_review" for item in current)
    invalid = sum(item.review_status == "invalid" for item in current)
    previous_total = len(previous)
    change_percent = round(((total - previous_total) / previous_total) * 100, 1) if previous_total else None

    runs = db.exec(
        select(SyncRun)
        .where(SyncRun.organization_id == organization_id)
        .order_by(SyncRun.started_at.desc())
    ).all()
    scoped_runs = [run for run in runs if not project_id or run.project_id == project_id]
    latest_run = scoped_runs[0] if scoped_runs else None
    latest_by_project: dict[UUID, SyncRun] = {}
    for run in scoped_runs:
        latest_by_project.setdefault(run.project_id, run)
    connected_projects = [project for project in project_scope if project.kobo_form_id]
    delayed_projects = [
        project for project in connected_projects
        if project.id not in latest_by_project
        or latest_by_project[project.id].status != "completed"
        or (latest_by_project[project.id].completed_at and as_utc(latest_by_project[project.id].completed_at) < now - timedelta(hours=12))
    ]
    healthy_sources = max(0, len(connected_projects) - len(delayed_projects))

    recent = sorted(
        [item for item in scoped if item.submitted_at],
        key=lambda item: as_utc(item.submitted_at) if item.submitted_at else datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )[:5]
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
        alerts.append({"kind": "review", "title": f"{needs_review} record{'s' if needs_review != 1 else ''} need review", "text": "Quality review is required before reporting", "path": "/quality"})
    if invalid:
        alerts.append({"kind": "invalid", "title": f"{invalid} invalid record{'s' if invalid != 1 else ''}", "text": "These records are blocked from export", "path": "/quality"})
    if delayed_projects:
        alerts.append({"kind": "sync", "title": f"{len(delayed_projects)} source{'s' if len(delayed_projects) != 1 else ''} need attention", "text": "A connected Kobo form has not synced recently", "path": "/sync"})

    return {
        "total_submissions": total,
        "ready_records": ready,
        "ready_this_week": sum(item.review_status == "ready" and item.submitted_at and as_utc(item.submitted_at) >= now - timedelta(days=7) for item in scoped),
        "needs_review": needs_review,
        "invalid_records": invalid,
        "blocked_records": needs_review + invalid,
        "submission_change_percent": change_percent,
        "active_projects": sum(project.status.value == "active" for project in project_scope),
        "last_synced_at": latest_run.completed_at if latest_run else None,
        "available_locations": available_locations,
        "trend": [{"day": day, **counts} for day, counts in by_day.items()],
        "projects": [
            {"id": str(project.id), "name": project.name, "actual": by_project[project.id], "target": project.target_sample_size or 0}
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
