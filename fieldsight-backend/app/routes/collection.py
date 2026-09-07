"""Kobo submission import and organization-scoped collection APIs."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlmodel import Session, col, select

from app.core.config import Settings, get_settings
from app.core.kobo import decrypt_kobo_token, list_kobo_submissions
from app.db.session import get_session
from app.models.identity import User
from app.models.operations import KoboConnection, Project, Submission, SyncRun
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
                existing.enumerator = str(payload.get("_submitted_by")) if payload.get("_submitted_by") else None
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
    return {
        "sync_run_id": str(run.id),
        "status": run.status,
        "received": run.received_count,
        "created": run.created_count,
        "updated": run.updated_count,
    }


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
    return [
        _read_submission(submission, projects[submission.project_id])
        for submission in submissions
        if projects[submission.project_id]
    ]


@router.get("/sync-runs", tags=["Kobo synchronization"])
def list_sync_runs(user: CurrentUser, db: Database) -> list[dict[str, object]]:
    organization_id = _organization_admin_id(user, db)
    runs = db.exec(
        select(SyncRun).where(SyncRun.organization_id == organization_id).order_by(SyncRun.started_at.desc())
    ).all()
    return [
        {
            "id": str(run.id),
            "project_id": str(run.project_id),
            "status": run.status,
            "received": run.received_count,
            "created": run.created_count,
            "updated": run.updated_count,
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
            Project.kobo_connection_id.is_not(None),
            Project.kobo_form_id.is_not(None),
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
        imported_ids = set(db.exec(select(Submission.external_id).where(Submission.project_id == project.id)).all())
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
    scoped_runs = db.exec(select(SyncRun).where(*run_conditions).order_by(SyncRun.started_at.desc())).all()
    latest_run = scoped_runs[0] if scoped_runs else None
    latest_by_project: dict[UUID, SyncRun] = {}
    for run in scoped_runs:
        latest_by_project.setdefault(run.project_id, run)
    connected_projects = [project for project in project_scope if project.kobo_form_id]
    delayed_projects = [
        project
        for project in connected_projects
        if project.id not in latest_by_project
        or latest_by_project[project.id].status != "completed"
        or (
            latest_by_project[project.id].completed_at
            and as_utc(latest_by_project[project.id].completed_at) < now - timedelta(hours=12)
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
                "path": "/quality",
            }
        )
    if invalid:
        alerts.append(
            {
                "kind": "invalid",
                "title": f"{invalid} invalid record{'s' if invalid != 1 else ''}",
                "text": "These records are blocked from export",
                "path": "/quality",
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
        "last_synced_at": latest_run.completed_at if latest_run else None,
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


def _quality_findings(submissions: list[Submission], projects: dict[UUID, Project]) -> list[dict[str, object]]:
    """Apply form-agnostic checks to dynamic Kobo answer payloads."""
    findings: list[dict[str, object]] = []
    fingerprints: dict[tuple[UUID, str], list[Submission]] = defaultdict(list)
    ignored_keys = {
        "_id",
        "_uuid",
        "_submission_time",
        "_submitted_by",
        "_attachments",
        "_geolocation",
        "_status",
        "_tags",
        "_notes",
        "_validation_status",
        "meta",
    }

    def add(submission: Submission, code: str, severity: str, rule: str, detail: str, field: str | None = None) -> None:
        project = projects.get(submission.project_id)
        findings.append(
            {
                "id": f"{submission.id}:{code}",
                "submission_id": str(submission.id),
                "external_id": submission.external_id,
                "project_id": str(submission.project_id),
                "project_name": project.name if project else "Unknown project",
                "enumerator": submission.enumerator,
                "location": submission.location,
                "submitted_at": submission.submitted_at,
                "severity": severity,
                "rule": rule,
                "detail": detail,
                "field": field,
                "state": "Open",
            }
        )

    now = datetime.now(UTC)
    for submission in submissions:
        payload = submission.raw_answers or {}
        if submission.submitted_at is None:
            add(
                submission,
                "missing-time",
                "Blocking",
                "Missing submission time",
                "Kobo did not provide a valid submission timestamp.",
                "_submission_time",
            )
        else:
            submitted_at = (
                submission.submitted_at.replace(tzinfo=UTC)
                if submission.submitted_at.tzinfo is None
                else submission.submitted_at.astimezone(UTC)
            )
            if submitted_at > now + timedelta(minutes=5):
                add(
                    submission,
                    "future-time",
                    "Blocking",
                    "Submission time is in the future",
                    "The recorded submission time is later than the server time.",
                    "_submission_time",
                )

        duration = payload.get("_duration", payload.get("duration"))
        try:
            duration_seconds = float(duration) if duration is not None and duration != "" else None
        except (TypeError, ValueError):
            duration_seconds = None
        if duration_seconds is not None and duration_seconds < 60:
            add(
                submission,
                "short-duration",
                "High",
                "Interview duration is unusually short",
                f"The interview duration is {round(duration_seconds)} seconds; review records below 60 seconds.",
                "_duration",
            )

        for key, value in payload.items():
            normalized = key.lower()
            if value is None or value == "" or not ("gps" in normalized or "geopoint" in normalized):
                continue
            parts = str(value).replace(",", " ").split()
            try:
                valid = len(parts) >= 2 and -90 <= float(parts[0]) <= 90 and -180 <= float(parts[1]) <= 180
            except (TypeError, ValueError):
                valid = False
            if not valid:
                add(
                    submission,
                    f"gps-{key}",
                    "High",
                    "GPS value is invalid",
                    f"The value in {key} is not a valid latitude/longitude pair.",
                    key,
                )

        answers = {key: value for key, value in payload.items() if key not in ignored_keys and not key.startswith("_")}
        fingerprint = repr(sorted((key, repr(value)) for key, value in answers.items()))
        if answers:
            fingerprints[(submission.project_id, fingerprint)].append(submission)

    for duplicates in fingerprints.values():
        if len(duplicates) < 2:
            continue
        original = min(duplicates, key=lambda item: item.created_at)
        for duplicate in duplicates:
            if duplicate.id == original.id:
                continue
            add(
                duplicate,
                "duplicate",
                "High",
                "Possible duplicate submission",
                f"The answer set exactly matches submission {original.external_id} in the same project.",
            )
    return findings


@router.get("/quality/issues", tags=["Data quality"])
def list_quality_issues(user: CurrentUser, db: Database, project_id: UUID | None = None) -> list[dict[str, object]]:
    organization_id = _organization_admin_id(user, db)
    statement = select(Submission).where(Submission.organization_id == organization_id)
    if project_id:
        statement = statement.where(Submission.project_id == project_id)
    submissions = list(db.exec(statement).all())
    projects = {item.project_id: db.get(Project, item.project_id) for item in submissions}
    findings = _quality_findings(submissions, {key: value for key, value in projects.items() if value})
    queued_ids = {str(item.id) for item in submissions if item.review_status != "ready"}
    return [finding for finding in findings if str(finding["submission_id"]) in queued_ids]


@router.post("/quality/run", tags=["Data quality"])
def run_quality_validation(user: CurrentUser, db: Database, project_id: UUID | None = None) -> dict[str, object]:
    organization_id = _organization_admin_id(user, db)
    statement = select(Submission).where(Submission.organization_id == organization_id)
    if project_id:
        statement = statement.where(Submission.project_id == project_id)
    submissions = list(db.exec(statement).all())
    projects = {item.project_id: db.get(Project, item.project_id) for item in submissions}
    findings = _quality_findings(submissions, {key: value for key, value in projects.items() if value})
    by_submission: dict[str, list[dict[str, object]]] = defaultdict(list)
    for finding in findings:
        by_submission[str(finding["submission_id"])].append(finding)
    for submission in submissions:
        issues = by_submission.get(str(submission.id), [])
        if any(issue["severity"] == "Blocking" for issue in issues):
            submission.review_status = "invalid"
        elif issues:
            submission.review_status = "needs_review"
        else:
            submission.review_status = "ready"
        db.add(submission)
    db.commit()
    return {
        "checked": len(submissions),
        "ready": sum(not by_submission.get(str(item.id)) for item in submissions),
        "needs_review": sum(
            bool(by_submission.get(str(item.id)))
            and not any(issue["severity"] == "Blocking" for issue in by_submission[str(item.id)])
            for item in submissions
        ),
        "invalid": sum(
            any(issue["severity"] == "Blocking" for issue in by_submission.get(str(item.id), []))
            for item in submissions
        ),
        "issues": findings,
    }


@router.patch("/submissions/{submission_id}/review-status", tags=["Data quality"])
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
    submission.review_status = payload.status
    submission.updated_at = datetime.now(UTC)
    db.add(submission)
    db.commit()
    return {"id": str(submission.id), "review_status": submission.review_status}
