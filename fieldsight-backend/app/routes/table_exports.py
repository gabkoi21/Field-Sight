"""Tenant-scoped downloads and recurring report configuration."""

from datetime import UTC, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Response
from sqlmodel import select

from app.core.table_exports import bounds, build_report, render_report
from app.models.operations import OrganizationAdminEvent
from app.models.table_exports import TableExportArtifact, TableExportSchedule
from app.routes.intelligence import _project
from app.routes.workspace import CurrentUser, Database
from app.schemas.table_exports import TableExportInput, TableScheduleInput

router = APIRouter(prefix="/projects/{project_id}/tables/{form_id}", tags=["Table exports"])


def download(content: bytes, media: str, filename: str) -> Response:
    return Response(
        content,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/export")
def export_table(project_id: UUID, form_id: str, payload: TableExportInput, user: CurrentUser, db: Database):
    project = _project(project_id, user, db)
    report = build_report(db, project, form_id, payload)
    content, media, filename = render_report(report, payload)
    db.add(
        OrganizationAdminEvent(
            organization_id=project.organization_id,
            actor_id=user.id,
            action="table_export",
            resource_id=f"{project.id}/{form_id}",
        )
    )
    db.commit()
    return download(content, media, filename)


@router.get("/export-schedules")
def schedules(project_id: UUID, form_id: str, user: CurrentUser, db: Database):
    _project(project_id, user, db)
    items = db.exec(
        select(TableExportSchedule)
        .where(
            TableExportSchedule.project_id == project_id,
            TableExportSchedule.form_id == form_id,
        )
        .order_by(TableExportSchedule.created_at.desc())
    ).all()
    result = []
    for item in items:
        reports = db.exec(
            select(
                TableExportArtifact.id,
                TableExportArtifact.filename,
                TableExportArtifact.created_at,
                TableExportArtifact.period_start,
                TableExportArtifact.period_end,
            )
            .where(
                TableExportArtifact.schedule_id == item.id,
            )
            .order_by(TableExportArtifact.created_at.desc())
            .limit(24)
        ).all()
        result.append(
            {
                **item.model_dump(),
                "reports": [
                    dict(zip(["id", "filename", "created_at", "period_start", "period_end"], row, strict=True))
                    for row in reports
                ],
            }
        )
    return result


@router.post("/export-schedules", status_code=201)
def create_schedule(project_id: UUID, form_id: str, payload: TableScheduleInput, user: CurrentUser, db: Database):
    project = _project(project_id, user, db)
    # Validate all field references, date options and table ownership before persisting.
    build_report(db, project, form_id, payload.options)
    _, end = bounds(payload.options)
    due = datetime.combine(end + timedelta(days=1), time.min, ZoneInfo(payload.options.timezone)).astimezone(UTC)
    item = TableExportSchedule(
        organization_id=project.organization_id,
        project_id=project.id,
        form_id=form_id,
        created_by_id=user.id,
        options=payload.options.model_dump(mode="json"),
        next_run_at=due,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item.model_dump()


@router.patch("/export-schedules/{schedule_id}")
def toggle_schedule(project_id: UUID, form_id: str, schedule_id: UUID, active: bool, user: CurrentUser, db: Database):
    _project(project_id, user, db)
    item = db.get(TableExportSchedule, schedule_id)
    if not item or item.project_id != project_id or item.form_id != form_id:
        raise HTTPException(404, "Export schedule was not found.")
    item.active = active
    db.add(item)
    db.commit()
    return {"active": active}


@router.get("/export-reports/{report_id}")
def get_report(project_id: UUID, form_id: str, report_id: UUID, user: CurrentUser, db: Database):
    _project(project_id, user, db)
    report = db.get(TableExportArtifact, report_id)
    schedule = db.get(TableExportSchedule, report.schedule_id) if report else None
    if not schedule or schedule.project_id != project_id or schedule.form_id != form_id:
        raise HTTPException(404, "Report was not found.")
    return download(report.content, report.media_type, report.filename)
