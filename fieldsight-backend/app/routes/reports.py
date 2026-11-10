"""Project report exports use the same results as dashboards and indicators."""

# Saved reports intentionally retain the established organization-admin policy.
import json
import re
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, update
from sqlalchemy.engine import CursorResult, Engine
from sqlalchemy.exc import DBAPIError
from sqlmodel import Session, col, select

from app.core.project_report import project_report, saved_report_pdf
from app.core.report_templates import TEMPLATES
from app.core.sync_telemetry import utc
from app.db.session import get_session
from app.models.identity import Organization, User, utc_now
from app.models.operations import Indicator, Project, ResultFrameworkNode, Submission, SyncRun
from app.models.reporting import Report, ReportSnapshot
from app.routes.auth import get_current_user
from app.routes.indicators import _read, list_indicators
from app.routes.intelligence import _project
from app.routes.kobo import _organization_admin_id
from app.schemas.reports import (
    PublicationInput,
    ReportInput,
    ReportPage,
    ReportPreview,
    ReportRead,
    ReportUpdate,
)

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


Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _report(report_id: UUID, user: User, db: Session) -> Report:
    org = _organization_admin_id(user, db)
    report = db.exec(select(Report).where(col(Report.id) == report_id, col(Report.organization_id) == org)).first()
    if report is None:
        raise HTTPException(404, "Report was not found.")
    _project(report.project_id, user, db)
    return report


def _report_read(report: Report) -> ReportRead:
    data = {**report.model_dump(exclude={"content"}), **report.content}
    for key in ("created_at", "updated_at", "published_at"):
        if data[key] is not None:
            data[key] = utc(data[key])
    return ReportRead.model_validate(data)


def _selection(project: Project, body: ReportInput, db: Session) -> None:
    ids = set(
        db.exec(
            select(Indicator.id).where(
                Indicator.project_id == project.id,
                Indicator.organization_id == project.organization_id,
            )
        ).all()
    )
    if set(body.indicator_ids) - ids:
        raise HTTPException(422, "Selected indicators must belong to this project.")


def _values(body: ReportInput) -> dict[str, Any]:
    values = body.model_dump(exclude={"sections", "indicator_ids", "expected_revision"})
    values["content"] = {
        "sections": {key: body.sections.get(key, "") for key in TEMPLATES[body.template_key]["sections"]},
        "indicator_ids": [str(key) for key in body.indicator_ids],
    }
    return values


def _digest(data: dict) -> str:
    return sha256(json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


@contextmanager
def _consistent_session(db: Session) -> Iterator[Session]:
    # A separate transaction avoids auth's earlier reads. PostgreSQL repeatable-read
    # keeps all indicator/catalogue/count queries on one MVCC snapshot. SQLite's
    # explicit transaction also avoids its legacy SELECT autocommit behavior.
    bind = db.get_bind()
    engine = bind if isinstance(bind, Engine) else bind.engine
    with engine.connect().execution_options(isolation_level="SERIALIZABLE") as connection:
        with Session(bind=connection) as session:
            if connection.dialect.name == "sqlite":
                connection.exec_driver_sql("BEGIN IMMEDIATE")
            try:
                yield session
                session.commit()
                if connection.in_transaction():
                    connection.commit()
            except DBAPIError as exc:
                session.rollback()
                connection.rollback()
                if getattr(exc.orig, "sqlstate", None) in {"40001", "40P01"} or "locked" in str(exc.orig).lower():
                    raise HTTPException(409, "Concurrent data change. Refresh the preview and retry.") from exc
                raise
            except Exception:
                session.rollback()
                connection.rollback()
                raise


def _capture(report: Report, user: User, db: Session) -> dict:
    project = _project(report.project_id, user, db)
    organization = db.get(Organization, report.organization_id)
    selected = {UUID(value) for value in report.content["indicator_ids"]}
    included = (
        db.exec(
            select(Indicator)
            .where(
                Indicator.project_id == project.id,
                Indicator.organization_id == project.organization_id,
                col(Indicator.id).in_(selected),
            )
            .order_by(col(Indicator.is_active).desc(), col(Indicator.name))
        ).all()
        if selected
        else []
    )
    results = [
        _read(item, db, report.reporting_period_start, report.reporting_period_end).model_dump(mode="json")
        for item in included
    ]
    if len(results) != len(selected):
        raise HTTPException(409, "An included indicator is no longer available. Edit the draft selection.")
    counts_query = select(Submission.review_status, func.count()).where(
        Submission.project_id == project.id,
        Submission.organization_id == project.organization_id,
        col(Submission.submitted_at) >= datetime.combine(report.reporting_period_start, datetime.min.time(), UTC),
    )
    if report.reporting_period_end != date.max:
        counts_query = counts_query.where(
            col(Submission.submitted_at)
            < datetime.combine(report.reporting_period_end, datetime.min.time(), UTC) + timedelta(days=1)
        )
    counts = dict(db.exec(counts_query.group_by(Submission.review_status)).all())
    framework = db.exec(
        select(ResultFrameworkNode)
        .where(
            ResultFrameworkNode.project_id == project.id,
            ResultFrameworkNode.organization_id == project.organization_id,
        )
        .order_by(col(ResultFrameworkNode.sort_order), col(ResultFrameworkNode.id))
    ).all()
    latest = db.exec(
        select(SyncRun)
        .where(
            SyncRun.project_id == project.id,
            SyncRun.organization_id == project.organization_id,
            col(SyncRun.status).in_(["completed", "unchanged"]),
        )
        .order_by(col(SyncRun.completed_at).desc())
    ).first()
    return {
        "source_metadata": {
            "calculation_service": "indicator_results",
            "timezone": "UTC",
            "last_successful_sync": utc(latest.completed_at).isoformat() if latest and latest.completed_at else None,
        },
        "snapshot_version": 1,
        "report": _report_read(report).model_dump(mode="json"),
        "project": {"id": str(project.id), "name": project.name, "description": project.description},
        "organization": {"id": str(report.organization_id), "name": organization.name if organization else ""},
        "indicators": results,
        "framework": [{"title": node.title, "node_type": node.node_type} for node in framework],
        "review_counts": counts,
        "methodology": (
            "UTC inclusive date range. Ready submissions only for linked indicators; manual results are independent. "
            "Overall targets are not prorated. Period-specific targets apply only to their exact UTC period; "
            "custom windows have no proportional target. Status and progress come from the Indicators service. "
            "Narratives are user-authored plain text."
        ),
    }


@router.get("/report-templates")
def report_templates(user: CurrentUser, db: Database) -> list[dict]:
    _organization_admin_id(user, db)
    return [{"key": key, **value} for key, value in TEMPLATES.items()]


@router.get("/projects/{project_id}/reports", response_model=ReportPage)
def saved_reports(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
) -> ReportPage:
    project = _project(project_id, user, db)
    filters = (Report.project_id == project.id, col(Report.organization_id) == project.organization_id)
    total = db.exec(select(func.count()).select_from(Report).where(*filters)).one()
    rows = db.exec(
        select(Report)
        .where(*filters)
        .order_by(col(Report.created_at).desc(), col(Report.id))
        .offset(offset)
        .limit(limit)
    ).all()
    return ReportPage(items=[_report_read(row) for row in rows], total=total)


@router.post("/projects/{project_id}/reports", response_model=ReportRead, status_code=201)
def create_report(project_id: UUID, body: ReportInput, user: CurrentUser, db: Database) -> ReportRead:
    project = _project(project_id, user, db)
    _selection(project, body, db)
    report = Report(
        **_values(body),
        project_id=project.id,
        organization_id=project.organization_id,
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_read(report)


@router.get("/reports/{report_id}", response_model=ReportRead)
def get_report(report_id: UUID, user: CurrentUser, db: Database) -> ReportRead:
    return _report_read(_report(report_id, user, db))


@router.patch("/reports/{report_id}", response_model=ReportRead)
def update_report(report_id: UUID, body: ReportUpdate, user: CurrentUser, db: Database) -> ReportRead:
    report = _report(report_id, user, db)
    project = _project(report.project_id, user, db)
    _selection(project, body, db)
    result = db.execute(
        update(Report)
        .where(
            col(Report.id) == report.id,
            col(Report.organization_id) == project.organization_id,
            col(Report.status) == "draft",
            col(Report.revision_number) == body.expected_revision,
        )
        .values(
            **_values(body), updated_by_id=user.id, updated_at=utc_now(), revision_number=body.expected_revision + 1
        )
        .execution_options(synchronize_session=False)
    )
    if cast(CursorResult, result).rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Published reports are read-only or this draft changed. Reopen it before editing.")
    db.commit()
    db.refresh(report)
    return _report_read(report)


@router.delete("/reports/{report_id}", status_code=204)
def delete_report(report_id: UUID, user: CurrentUser, db: Database, expected_revision: int = Query(ge=1)) -> Response:
    report = _report(report_id, user, db)
    result = db.execute(
        delete(Report).where(
            col(Report.id) == report.id, col(Report.status) == "draft", col(Report.revision_number) == expected_revision
        )
    )
    if cast(CursorResult, result).rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Only an unchanged draft can be deleted.")
    db.commit()
    return Response(status_code=204)


@router.post("/reports/{report_id}/duplicate", response_model=ReportRead, status_code=201)
def duplicate_report(report_id: UUID, user: CurrentUser, db: Database) -> ReportRead:
    original = _report(report_id, user, db)
    body = ReportInput.model_validate(_report_read(original).model_dump(include=set(ReportInput.model_fields)))
    body.title = body.title[:185] + " (copy)"
    return create_report(original.project_id, body, user, db)


@router.get("/reports/{report_id}/preview", response_model=ReportPreview)
def preview_report(report_id: UUID, user: CurrentUser, db: Database) -> ReportPreview:
    with _consistent_session(db) as stable:
        report = _report(report_id, user, stable)
        if report.status == "published":
            snapshot = stable.exec(select(ReportSnapshot).where(ReportSnapshot.report_id == report.id)).one()
            return ReportPreview(data=snapshot.snapshot_data, content_hash=snapshot.content_hash)
        data = _capture(report, user, stable)
        return ReportPreview(data=data, content_hash=_digest(data))


@router.post("/reports/{report_id}/publish", response_model=ReportRead)
def publish_report(report_id: UUID, body: PublicationInput, user: CurrentUser, db: Database) -> ReportRead:
    with _consistent_session(db) as stable:
        report = _report(report_id, user, stable)
        if report.status == "published":
            return _report_read(report)  # Idempotent retries never regenerate the artifact.
        data = _capture(report, user, stable)
        if report.revision_number != body.expected_revision or _digest(data) != body.preview_hash:
            raise HTTPException(409, "Report or source data changed. Review a fresh preview before publishing.")
        now = utc_now()
        data["published_at"] = now.isoformat()
        data["published_by_id"] = str(user.id)
        data["report"].update(
            status="published",
            published_at=now.isoformat(),
            published_by_id=str(user.id),
            revision_number=body.expected_revision + 1,
            updated_at=now.isoformat(),
            updated_by_id=str(user.id),
        )
        # Render before transitioning status. Failure rolls the entire transaction back.
        pdf = saved_report_pdf(data)
        result = stable.execute(
            update(Report)
            .where(
                col(Report.id) == report.id,
                col(Report.status) == "draft",
                col(Report.revision_number) == body.expected_revision,
            )
            .values(
                status="published",
                published_at=now,
                published_by_id=user.id,
                updated_at=now,
                updated_by_id=user.id,
                revision_number=body.expected_revision + 1,
            )
            .execution_options(synchronize_session=False)
        )
        if cast(CursorResult, result).rowcount != 1:
            raise HTTPException(409, "Report changed during publication. Reopen the report.")
        stable.add(
            ReportSnapshot(
                report_id=report.id,
                organization_id=report.organization_id,
                project_id=report.project_id,
                snapshot_data=data,
                generated_by_id=user.id,
                generated_at=now,
                content_hash=_digest(data),
                pdf_data=pdf,
            )
        )
        stable.flush()
        stable.refresh(report)
        return _report_read(report)


@router.get("/reports/{report_id}/snapshot", response_model=ReportPreview)
def report_snapshot(report_id: UUID, user: CurrentUser, db: Database) -> ReportPreview:
    report = _report(report_id, user, db)
    snapshot = db.exec(select(ReportSnapshot).where(ReportSnapshot.report_id == report.id)).first()
    if snapshot is None:
        raise HTTPException(404, "This report has not been published.")
    return ReportPreview(data=snapshot.snapshot_data, content_hash=snapshot.content_hash)


@router.get("/reports/{report_id}/export.pdf")
def saved_pdf(
    report_id: UUID,
    user: CurrentUser,
    db: Database,
    preview_hash: str | None = Query(default=None, pattern=r"^[a-f0-9]{64}$"),
) -> Response:
    report = _report(report_id, user, db)
    if report.status == "published":
        snapshot = db.exec(select(ReportSnapshot).where(ReportSnapshot.report_id == report.id)).one()
        data = snapshot.pdf_data
    else:
        preview = preview_report(report_id, user, db)
        if preview_hash and preview.content_hash != preview_hash:
            raise HTTPException(409, "Source data changed. Refresh the report preview before exporting.")
        data = saved_report_pdf(preview.data)
    title = re.sub(r"[^a-z0-9]+", "-", report.title.lower()).strip("-")[:70] or "report"
    filename = f"fieldsight-{title}-{report.reporting_period_start}-{report.reporting_period_end}.pdf"
    return Response(
        data,
        media_type="application/pdf",
        headers={"Cache-Control": "no-store", "Content-Disposition": f'attachment; filename="{filename}"'},
    )
