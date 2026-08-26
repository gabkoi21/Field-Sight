"""Kobo submission import and organization-scoped collection APIs."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
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
                existing.raw_answers = payload
                existing.submitted_at = _submission_time(payload.get("_submission_time")) or existing.submitted_at
                existing.updated_at = datetime.now(UTC)
                db.add(existing)
                updated += 1
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
def analytics_overview(user: CurrentUser, db: Database) -> dict[str, object]:
    """Return tenant-scoped metrics derived from imported Kobo submissions."""
    organization_id = _organization_admin_id(user, db)
    submissions = db.exec(
        select(Submission).where(Submission.organization_id == organization_id).order_by(Submission.submitted_at.asc())
    ).all()
    projects = db.exec(select(Project).where(Project.organization_id == organization_id)).all()
    by_day: dict[str, dict[str, int]] = defaultdict(lambda: {"submissions": 0, "approved": 0})
    by_project: dict[UUID, int] = defaultdict(int)
    for submission in submissions:
        by_project[submission.project_id] += 1
        if submission.submitted_at:
            day = submission.submitted_at.astimezone(UTC).strftime("%b %d")
            by_day[day]["submissions"] += 1
            if submission.review_status == "ready":
                by_day[day]["approved"] += 1
    total = len(submissions)
    ready = sum(submission.review_status == "ready" for submission in submissions)
    needs_review = sum(submission.review_status == "needs_review" for submission in submissions)
    invalid = sum(submission.review_status == "invalid" for submission in submissions)
    return {
        "total_submissions": total,
        "ready_records": ready,
        "needs_review": needs_review,
        "invalid_records": invalid,
        "active_projects": sum(project.status.value == "active" for project in projects),
        "trend": [{"day": day, **counts} for day, counts in by_day.items()][-30:],
        "projects": [
            {
                "id": str(project.id),
                "name": project.name,
                "actual": by_project[project.id],
                "target": project.target_sample_size or 0,
            }
            for project in projects
        ],
    }