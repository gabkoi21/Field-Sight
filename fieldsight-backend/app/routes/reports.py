"""Project report exports use the same results as dashboards and indicators."""

from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.project_report import project_report
from app.core.sync_telemetry import utc
from app.db.session import get_session
from app.models.identity import User
from app.models.operations import Submission, SyncRun
from app.routes.auth import get_current_user
from app.routes.indicators import list_indicators
from app.routes.intelligence import _project

router = APIRouter(tags=["Reports"])


@router.get("/projects/{project_id}/report.pdf")
def report_pdf(
    project_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_session)],
    date_from: date | None = None,
    date_to: date | None = None,
) -> Response:
    project = _project(project_id, user, db)
    indicators = list_indicators(project_id, user, db, date_from, date_to)
    statement = select(Submission.review_status, func.count()).where(
        Submission.project_id == project.id,
        Submission.organization_id == project.organization_id,
    )
    if date_from:
        statement = statement.where(
            col(Submission.submitted_at) >= datetime.combine(date_from, datetime.min.time(), UTC)
        )
    if date_to and date_to != date.max:
        stop = datetime.combine(date_to, datetime.min.time(), UTC) + timedelta(days=1)
        statement = statement.where(col(Submission.submitted_at) < stop)
    counts = dict(db.exec(statement.group_by(Submission.review_status)).all())
    latest = db.exec(
        select(SyncRun)
        .where(
            SyncRun.project_id == project.id,
            SyncRun.organization_id == project.organization_id,
            col(SyncRun.status).in_(["completed", "unchanged"]),
        )
        .order_by(col(SyncRun.completed_at).desc())
    ).first()
    last_sync = utc(latest.completed_at) if latest and latest.completed_at else None
    data = project_report(project, indicators, counts, date_from, date_to, last_sync)
    return Response(
        data,
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="fieldsight-project-report.pdf"',
        },
    )
