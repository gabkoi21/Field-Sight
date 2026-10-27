"""Small tenant-scoped action register. All writes and events commit together."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, update
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, select

from app.db.session import get_session
from app.models.identity import OrganizationMembership, Role, User
from app.models.operations import (
    FieldAssignment,
    Indicator,
    Project,
    ProjectAction,
    ProjectActionEvent,
    ProjectStatus,
    Submission,
)
from app.routes.auth import get_current_user
from app.routes.kobo import _organization_admin_id

router = APIRouter(tags=["Project actions"])
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
ActionStatus = Literal["open", "in_progress", "resolved", "closed"]
Priority = Literal["low", "medium", "high"]
UNRESOLVED = ("open", "in_progress")
TRANSITIONS = {
    "open": {"in_progress"},
    "in_progress": {"open", "resolved"},
    "resolved": {"in_progress", "closed"},
    "closed": {"open"},
}


class ActionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10000)
    priority: Priority = "medium"
    assigned_user_id: UUID | None = None
    due_date: date | None = None
    submission_id: UUID | None = None
    indicator_id: UUID | None = None


class ActionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    expected_version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    priority: Priority | None = None
    status: ActionStatus | None = None
    assigned_user_id: UUID | None = None
    due_date: date | None = None
    submission_id: UUID | None = None
    indicator_id: UUID | None = None
    resolution_summary: str | None = Field(default=None, max_length=10000)
    note: str | None = Field(default=None, max_length=5000)

    @field_validator("title", "description", "priority", "status")
    @classmethod
    def non_null_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


def project_scope(project_id: UUID, user: User, db: Session, *, writable: bool = False) -> Project:
    organization_id = _organization_admin_id(user, db)
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(404, "Project was not found.")
    if writable:
        db.execute(update(Project).where(col(Project.id) == project.id).values(updated_at=Project.updated_at))
        db.refresh(project)
        if project.status == ProjectStatus.ARCHIVED:
            raise HTTPException(409, "Archived projects retain read-only action history. Restore the project to edit.")
    return project


def scoped_action(project: Project, identifier: UUID, db: Session) -> ProjectAction:
    item = db.get(ProjectAction, identifier)
    if item is None or item.project_id != project.id or item.organization_id != project.organization_id:
        raise HTTPException(404, "Action was not found.")
    return item


def validate_links(project: Project, values: dict[str, object], db: Session) -> None:
    for key, model in (("submission_id", Submission), ("indicator_id", Indicator)):
        identifier = values.get(key)
        if identifier:
            evidence = cast(Submission | Indicator | None, db.get(model, identifier))
            if (
                evidence is None
                or evidence.project_id != project.id
                or evidence.organization_id != project.organization_id
            ):
                raise HTTPException(422, "Linked evidence must belong to this project.")
    user_id = values.get("assigned_user_id")
    if not user_id:
        return
    member = db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == project.organization_id,
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.is_active,
        )
    ).first()
    account = db.get(User, user_id)
    if member is None or account is None or not account.is_active:
        raise HTTPException(422, "Assign an active member of this organization and project.")
    if member.role == Role.ORGANIZATION_ADMIN:
        return
    today = datetime.now(UTC).date()
    assignment = db.exec(
        select(FieldAssignment).where(
            FieldAssignment.organization_id == project.organization_id,
            FieldAssignment.project_id == project.id,
            FieldAssignment.membership_id == member.id,
            FieldAssignment.is_enabled,
            col(FieldAssignment.effective_from).is_(None) | (col(FieldAssignment.effective_from) <= today),
            col(FieldAssignment.effective_to).is_(None) | (col(FieldAssignment.effective_to) >= today),
        )
    ).first()
    if assignment is None:
        raise HTTPException(422, "Assign an active member of this organization and project.")


def read_action(item: ProjectAction) -> dict[str, object]:
    values = item.model_dump(mode="json")
    # SQLite may return naive DateTime values; the stored convention is UTC.
    for key in ("created_at", "updated_at", "resolved_at", "closed_at"):
        value = getattr(item, key)
        values[key] = (
            value.replace(tzinfo=UTC).isoformat()
            if value and value.tzinfo is None
            else (value.astimezone(UTC).isoformat() if value else None)
        )
    values["overdue"] = bool(item.status in UNRESOLVED and item.due_date and item.due_date < datetime.now(UTC).date())
    return values


def record_event(
    item: ProjectAction, user: User, db: Session, previous: dict[str, object], event_type: str, note: str | None = None
) -> None:
    db.add(
        ProjectActionEvent(
            organization_id=item.organization_id,
            project_id=item.project_id,
            action_id=item.id,
            actor_id=user.id,
            event_type=event_type,
            previous_values=previous,
            new_values=read_action(item),
            note=note,
        )
    )


@router.get("/projects/{project_id}/actions")
def list_actions(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    status: ActionStatus | None = None,
    priority: Priority | None = None,
    assigned_user_id: UUID | None = None,
    overdue: bool | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    search: str = Query(default="", max_length=200),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, object]:
    project = project_scope(project_id, user, db)
    if due_from and due_to and due_from > due_to:
        raise HTTPException(422, "Due date range is reversed.")
    base = (ProjectAction.organization_id == project.organization_id, ProjectAction.project_id == project.id)
    unresolved = (*base, col(ProjectAction.status).in_(UNRESOLVED))
    late = col(ProjectAction.due_date) < datetime.now(UTC).date()

    def count(*conditions: ColumnElement[bool] | bool) -> int:
        return db.exec(select(func.count()).select_from(ProjectAction).where(*conditions)).one()

    summary = {
        "unresolved": count(*unresolved),
        "overdue": count(*unresolved, late),
        "high_priority": count(*unresolved, ProjectAction.priority == "high"),
    }
    query = select(ProjectAction).where(*base)
    if status:
        query = query.where(ProjectAction.status == status)
    if priority:
        query = query.where(ProjectAction.priority == priority)
    if assigned_user_id:
        query = query.where(ProjectAction.assigned_user_id == assigned_user_id)
    if overdue is not None:
        condition = col(ProjectAction.status).in_(UNRESOLVED) & col(ProjectAction.due_date).is_not(None) & late
        query = query.where(condition if overdue else ~condition)
    if due_from:
        query = query.where(col(ProjectAction.due_date) >= due_from)
    if due_to:
        query = query.where(col(ProjectAction.due_date) <= due_to)
    if search:
        query = query.where(
            col(ProjectAction.title).icontains(search, autoescape=True)
            | col(ProjectAction.description).icontains(search, autoescape=True)
        )
    total = db.exec(select(func.count()).select_from(query.subquery())).one()
    items = db.exec(
        query.order_by(col(ProjectAction.created_at).desc(), col(ProjectAction.id).desc()).offset(offset).limit(limit)
    ).all()
    return {
        "items": [read_action(item) for item in items],
        "total": total,
        "offset": offset,
        "limit": limit,
        "summary": summary,
    }


@router.post("/projects/{project_id}/actions", status_code=201)
def create_action(project_id: UUID, payload: ActionCreate, user: CurrentUser, db: Database) -> dict[str, object]:
    project = project_scope(project_id, user, db, writable=True)
    values = payload.model_dump()
    validate_links(project, values, db)
    item = ProjectAction(
        organization_id=project.organization_id, project_id=project.id, created_by_id=user.id, **values
    )
    db.add(item)
    db.flush()
    record_event(item, user, db, {}, "created")
    db.commit()
    db.refresh(item)
    return read_action(item)


@router.get("/projects/{project_id}/actions/{action_id}")
def action_detail(
    project_id: UUID,
    action_id: UUID,
    user: CurrentUser,
    db: Database,
    history_offset: int = Query(default=0, ge=0),
) -> dict[str, object]:
    project = project_scope(project_id, user, db)
    item = scoped_action(project, action_id, db)
    query = select(ProjectActionEvent).where(
        ProjectActionEvent.action_id == item.id,
        ProjectActionEvent.organization_id == project.organization_id,
        ProjectActionEvent.project_id == project.id,
    )
    total = db.exec(select(func.count()).select_from(query.subquery())).one()
    events = db.exec(
        query.order_by(col(ProjectActionEvent.occurred_at).desc(), col(ProjectActionEvent.id).desc())
        .offset(history_offset)
        .limit(50)
    ).all()
    history = []
    for event in events:
        values = event.model_dump(mode="json")
        values["occurred_at"] = (
            event.occurred_at.replace(tzinfo=UTC).isoformat()
            if (event.occurred_at.tzinfo is None)
            else event.occurred_at.astimezone(UTC).isoformat()
        )
        history.append(values)
    return {**read_action(item), "history": history, "history_total": total}


@router.patch("/projects/{project_id}/actions/{action_id}")
def update_action(
    project_id: UUID,
    action_id: UUID,
    payload: ActionUpdate,
    user: CurrentUser,
    db: Database,
) -> dict[str, object]:
    project = project_scope(project_id, user, db, writable=True)
    item = scoped_action(project, action_id, db)
    db.refresh(item)
    if item.version != payload.expected_version:
        raise HTTPException(409, "Action changed. Reload before editing.")
    values = payload.model_dump(exclude_unset=True, exclude={"expected_version", "note"})
    validate_links(project, values, db)
    previous = read_action(item)
    target = values.get("status", item.status)
    changed_status = target != item.status
    if item.status == "closed" and not changed_status:
        raise HTTPException(409, "Reopen the closed action with a reason before editing.")
    if changed_status:
        if target not in TRANSITIONS[item.status]:
            raise HTTPException(422, "Invalid status transition. Use Open, In progress, Resolved, then Closed.")
        if (item.status in {"closed", "resolved"} or target == "closed") and not (payload.note or "").strip():
            raise HTTPException(422, "Verification or reopening requires a written note.")
        if target == "resolved" and not (str(values.get("resolution_summary") or "")).strip():
            raise HTTPException(422, "Resolution requires a written summary.")
    if target == "closed" and not str(values.get("resolution_summary", item.resolution_summary) or "").strip():
        raise HTTPException(422, "Closing requires the recorded resolution summary.")
    if item.status == "resolved" and not changed_status and "resolution_summary" in values:
        if not str(values["resolution_summary"] or "").strip():
            raise HTTPException(422, "Keep the resolution summary until the action is reopened.")
    if not changed_status and all(getattr(item, key) == value for key, value in values.items()) and not payload.note:
        return previous
    for key, value in values.items():
        setattr(item, key, value)
    now = datetime.now(UTC)
    if changed_status:
        if target == "resolved":
            item.resolved_at = now
        elif target == "closed":
            item.closed_at = now
        else:
            item.resolved_at = item.closed_at = None
            item.resolution_summary = None
    item.version += 1
    item.updated_at = now
    db.add(item)
    record_event(item, user, db, previous, "status_changed" if changed_status else "updated", payload.note)
    db.commit()
    db.refresh(item)
    return read_action(item)
