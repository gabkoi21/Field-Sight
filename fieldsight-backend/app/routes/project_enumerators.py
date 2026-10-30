"""Project collectors and honest, manually reported Kobo sharing state."""

from collections.abc import Sequence
from datetime import UTC, timedelta
from typing import Annotated, Any, Literal, Self, cast
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from sqlalchemy import update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.core.config import Settings, get_settings
from app.core.kobo import decrypt_kobo_token
from app.core.kobo_permissions import reconcile_collection_access
from app.models.identity import OrganizationMembership, Role, User, utc_now
from app.models.operations import (
    CollectorFormAccess,
    CollectorProfile,
    FieldAssignment,
    KoboConnection,
    OrganizationAdminEvent,
    Project,
)
from app.routes.intelligence import _project
from app.routes.workspace import CurrentUser, Database

router = APIRouter(prefix="/projects/{project_id}/enumerators", tags=["project enumerators"])


class FormInput(BaseModel):
    connection_id: UUID
    form_id: str = Field(min_length=1, max_length=255)
    state: Literal["not_configured", "pending", "reported_configured_unverified"] = "not_configured"


class AssignmentInput(BaseModel):
    collector_id: UUID | None = None
    membership_id: UUID | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    email: EmailStr | None = None
    kobo_username: str = Field(min_length=1, max_length=100)
    forms: list[FormInput] = Field(default_factory=list, max_length=20)

    @field_validator("kobo_username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        import re

        value = value.strip()
        if not value or not re.fullmatch(r"[\w.@+-]+", value, re.ASCII):
            raise ValueError("Use a Kobo username, without spaces or a URL.")
        return value

    @model_validator(mode="after")
    def single_identity(self) -> Self:
        if self.collector_id and self.membership_id:
            raise ValueError("Choose one existing enumerator.")
        return self


def audit(db: Session, project: Project, user: User, action: str, resource: UUID) -> None:
    db.add(
        OrganizationAdminEvent(
            organization_id=project.organization_id,
            actor_id=user.id,
            action=action,
            resource_id=str(resource),
        )
    )


def commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This enumerator or assignment already exists. Refresh and select it.") from None


def connected_form(project: Project, db: Session) -> list[dict[str, Any]]:
    connection = db.get(KoboConnection, project.kobo_connection_id) if project.kobo_connection_id else None
    if (
        not connection
        or connection.organization_id != project.organization_id
        or connection.is_deleted
        or not project.kobo_form_id
    ):
        return []
    return [
        dict(
            connection_id=connection.id,
            form_id=project.kobo_form_id,
            name=project.kobo_form_name or project.kobo_form_id,
            server_url=connection.server_url,
        )
    ]


def profile_read(profile: CollectorProfile) -> dict[str, Any]:
    return dict(
        collector_id=profile.id,
        membership_id=profile.membership_id,
        full_name=profile.full_name,
        email=profile.email,
        kobo_username=profile.kobo_username,
    )


@router.get("/eligible")
def eligible(project_id: UUID, user: CurrentUser, db: Database, search: str = "") -> list[dict]:
    project = _project(project_id, user, db)
    profiles = db.exec(
        select(CollectorProfile).where(CollectorProfile.organization_id == project.organization_id)
    ).all()
    rows = [profile_read(p) for p in profiles]
    represented = {p.membership_id for p in profiles}
    for member, person in db.exec(
        select(OrganizationMembership, User)
        .join(User)
        .where(
            OrganizationMembership.organization_id == project.organization_id,
            OrganizationMembership.role == Role.ENUMERATOR,
            OrganizationMembership.is_active,
            User.is_active,
        )
    ).all():
        if member.id not in represented:
            rows.append(
                dict(
                    collector_id=None,
                    membership_id=member.id,
                    full_name=person.full_name,
                    email=person.email,
                    kobo_username=None,
                )
            )
    return [row for row in rows if search.lower() in f"{row['full_name']} {row['email']}".lower()]


def assignment_read(item: FieldAssignment, project: Project, db: Session) -> dict[str, Any]:
    profile = db.get(CollectorProfile, item.collector_id) if item.collector_id else None
    if profile:
        identity = profile_read(profile)
    else:
        member = db.get(OrganizationMembership, item.membership_id)
        person = db.get(User, member.user_id) if member else None
        identity = dict(
            collector_id=None,
            membership_id=item.membership_id,
            full_name=person.full_name if person else None,
            email=person.email if person else None,
            kobo_username=None,
        )
    current = {(str(f["connection_id"]), f["form_id"]) for f in connected_form(project, db)}
    forms = [
        dict(
            id=f.id,
            connection_id=f.connection_id,
            form_id=f.form_id,
            state=f.state,
            is_selected=f.is_selected,
            updated_at=f.updated_at,
            mapping_current=(str(f.connection_id), f.form_id) in current,
            permission_username=f.permission_username,
            last_error=f.last_error,
            last_checked_at=f.last_checked_at,
            requested_action=f.requested_action,
        )
        for f in db.exec(select(CollectorFormAccess).where(CollectorFormAccess.assignment_id == item.id)).all()
    ]
    return dict(**identity, id=item.id, is_active=item.is_enabled, assigned_at=item.created_at, forms=forms)


@router.get("")
def listing(project_id: UUID, user: CurrentUser, db: Database) -> dict:
    project = _project(project_id, user, db)
    rows = db.exec(
        select(FieldAssignment).where(
            FieldAssignment.organization_id == project.organization_id,
            FieldAssignment.project_id == project.id,
            col(FieldAssignment.location_id).is_(None),
        )
    ).all()
    return dict(items=[assignment_read(row, project, db) for row in rows], connected_forms=connected_form(project, db))


def save_forms(item: FieldAssignment, payload: AssignmentInput, project: Project, user: User, db: Session) -> None:
    allowed = {(str(f["connection_id"]), f["form_id"]) for f in connected_form(project, db)}
    requested = [(str(f.connection_id), f.form_id) for f in payload.forms]
    if len(requested) != len(set(requested)) or any(key not in allowed for key in requested):
        raise HTTPException(422, "Select each current connected project form at most once.")
    if any(f.state == "reported_configured_unverified" for f in payload.forms) and not payload.kobo_username:
        raise HTTPException(422, "Record a Kobo username before reporting sharing configured.")
    old = db.exec(select(CollectorFormAccess).where(CollectorFormAccess.assignment_id == item.id)).all()
    ensure_not_running(old)
    for previous in old:
        previous.is_selected = (str(previous.connection_id), previous.form_id) in requested
        previous.updated_by_id, previous.updated_at = user.id, utc_now()
        db.add(previous)
    for incoming in payload.forms:
        f = next((f for f in old if f.connection_id == incoming.connection_id and f.form_id == incoming.form_id), None)
        if f is None:
            f = CollectorFormAccess(
                assignment_id=item.id,
                connection_id=incoming.connection_id,
                form_id=incoming.form_id,
                updated_by_id=user.id,
            )
        f.is_selected = True
        if not f.permission_username:
            f.state = incoming.state
        f.updated_by_id, f.updated_at = user.id, utc_now()
        db.add(f)
    audit(db, project, user, "enumerator.forms:" + payload.model_dump_json(include={"forms"}), item.id)


def update_identity(
    profile: CollectorProfile, payload: AssignmentInput, project: Project, user: User, db: Session
) -> None:
    if profile.kobo_username != payload.kobo_username:
        ids = select(FieldAssignment.id).where(FieldAssignment.collector_id == profile.id)
        forms = db.exec(select(CollectorFormAccess).where(col(CollectorFormAccess.assignment_id).in_(ids))).all()
        ensure_not_running(forms)
        if any(f.permission_username and f.state not in {"revoked", "not_configured"} for f in forms):
            raise HTTPException(409, "Revoke the previous Kobo username's tracked access before changing identity.")
        for f in forms:
            f.permission_username = None
            f.state, f.updated_at, f.updated_by_id = "not_configured", utc_now(), user.id
            db.add(f)
        audit(db, project, user, "enumerator.kobo_identity_changed", profile.id)
    profile.kobo_username = payload.kobo_username
    db.add(profile)


@router.post("", status_code=201)
def assign(project_id: UUID, payload: AssignmentInput, user: CurrentUser, db: Database) -> dict:
    project = _project(project_id, user, db)
    profile = db.get(CollectorProfile, payload.collector_id) if payload.collector_id else None
    if payload.collector_id and (not profile or profile.organization_id != project.organization_id):
        raise HTTPException(404, "Enumerator was not found.")
    membership_id = profile.membership_id if profile else payload.membership_id
    if membership_id:
        member = db.get(OrganizationMembership, membership_id)
        person = db.get(User, member.user_id) if member else None
        if (
            not member
            or member.organization_id != project.organization_id
            or member.role != Role.ENUMERATOR
            or not member.is_active
            or not person
            or not person.is_active
        ):
            raise HTTPException(422, "Choose an active organization enumerator.")
        if not profile:
            profile = db.exec(select(CollectorProfile).where(CollectorProfile.membership_id == member.id)).first()
        if not profile:
            profile = CollectorProfile(
                organization_id=project.organization_id,
                membership_id=member.id,
                full_name=person.full_name or person.email,
                email=person.email,
            )
    if not profile:
        if not payload.email or not payload.full_name or not payload.full_name.strip():
            raise HTTPException(422, "Name and email are required for a new collection-only enumerator.")
        email = str(payload.email).lower()
        # Existing organization accounts must be selected explicitly, never duplicated as contacts.
        if db.exec(
            select(OrganizationMembership)
            .join(User)
            .where(
                OrganizationMembership.organization_id == project.organization_id,
                User.email == email,
            )
        ).first():
            raise HTTPException(409, "Select the existing organization enumerator.")
        profile = CollectorProfile(
            organization_id=project.organization_id, full_name=payload.full_name.strip(), email=email
        )
        audit(db, project, user, "enumerator.created", profile.id)
    db.add(profile)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Select the existing enumerator with this email.") from None
    item = db.exec(
        select(FieldAssignment).where(
            FieldAssignment.project_id == project.id,
            (FieldAssignment.collector_id == profile.id)
            | ((FieldAssignment.membership_id == membership_id) if membership_id else False),
            col(FieldAssignment.location_id).is_(None),
        )
    ).first()
    if item and item.is_enabled:
        raise HTTPException(409, "Enumerator is already assigned to this project.")
    item = item or FieldAssignment(
        organization_id=project.organization_id, project_id=project.id, membership_id=membership_id
    )
    item.collector_id, item.is_enabled = profile.id, True
    update_identity(profile, payload, project, user, db)
    db.add_all([item, profile])
    db.flush()
    save_forms(item, payload, project, user, db)
    audit(db, project, user, "enumerator.assigned", item.id)
    commit(db)
    return assignment_read(item, project, db)


def scoped_assignment(project: Project, assignment_id: UUID, db: Session) -> FieldAssignment:
    item = db.get(FieldAssignment, assignment_id)
    if not item or item.project_id != project.id or item.organization_id != project.organization_id:
        raise HTTPException(404, "Assignment was not found.")
    return item


@router.patch("/{assignment_id}")
def edit(project_id: UUID, assignment_id: UUID, payload: AssignmentInput, user: CurrentUser, db: Database) -> dict:
    project = _project(project_id, user, db)
    item = scoped_assignment(project, assignment_id, db)
    if not item.is_enabled:
        raise HTTPException(409, "Reassign the enumerator before editing forms.")
    profile = db.get(CollectorProfile, item.collector_id) if item.collector_id else None
    if not profile:
        member = db.get(OrganizationMembership, item.membership_id)
        person = db.get(User, member.user_id) if member else None
        if (
            not member
            or member.organization_id != project.organization_id
            or member.role != Role.ENUMERATOR
            or not person
        ):
            raise HTTPException(422, "Choose an organization enumerator.")
        profile = db.exec(select(CollectorProfile).where(CollectorProfile.membership_id == member.id)).first()
        profile = profile or CollectorProfile(
            organization_id=project.organization_id,
            membership_id=member.id,
            full_name=person.full_name or person.email,
            email=person.email,
        )
        db.add(profile)
        db.flush()
        item.collector_id = profile.id
        db.add(item)
    update_identity(profile, payload, project, user, db)
    save_forms(item, payload, project, user, db)
    commit(db)
    return assignment_read(item, project, db)


@router.delete("/{assignment_id}", status_code=204)
def remove(project_id: UUID, assignment_id: UUID, user: CurrentUser, db: Database) -> Response:
    project = _project(project_id, user, db)
    item = scoped_assignment(project, assignment_id, db)
    ensure_not_running(db.exec(select(CollectorFormAccess).where(CollectorFormAccess.assignment_id == item.id)).all())
    item.is_enabled = False
    db.add(item)
    audit(db, project, user, "enumerator.removed_kobo_revocation_required", item.id)
    commit(db)
    return Response(status_code=204)


def ensure_not_running(forms: Sequence[CollectorFormAccess]) -> None:
    if any(
        f.state == "pending" and f.operation_id and f.updated_at.replace(tzinfo=UTC) > utc_now() - timedelta(minutes=2)
        for f in forms
    ):
        raise HTTPException(
            409, "A Kobo access operation is running. Wait and refresh before changing this assignment."
        )


class AccessAction(BaseModel):
    action: Literal["grant", "verify", "revoke"]


@router.post("/{assignment_id}/forms/{access_id}/access")
def manage_access(
    project_id: UUID,
    assignment_id: UUID,
    access_id: UUID,
    payload: AccessAction,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    project = _project(project_id, user, db)
    item = scoped_assignment(project, assignment_id, db)
    access = db.get(CollectorFormAccess, access_id)
    if not access or access.assignment_id != item.id:
        raise HTTPException(404, "Assigned form was not found.")
    connection = db.get(KoboConnection, access.connection_id)
    if not connection or connection.organization_id != project.organization_id or connection.is_deleted:
        raise HTTPException(422, "The Kobo connection is unavailable. Review sharing directly in Kobo.")
    if not connection.is_verified:
        raise HTTPException(422, "Verify this Kobo connection first.")
    profile = db.get(CollectorProfile, item.collector_id) if item.collector_id else None
    username = access.permission_username or (profile.kobo_username if profile else None)
    if not username:
        raise HTTPException(422, "Record a Kobo username first.")
    if payload.action == "grant" and (
        not item.is_enabled
        or not access.is_selected
        or connection.id != project.kobo_connection_id
        or access.form_id != project.kobo_form_id
        or not profile
        or username != profile.kobo_username
    ):
        raise HTTPException(409, "Grant access only to an active assignment's current selected project form.")
    ensure_not_running([access])
    was_revocation = access.state == "revoked" or access.requested_action == "revoke"
    operation = str(uuid4())
    # Atomic claim prevents duplicate in-flight requests; stale operations can be reconciled after two minutes.
    claim = db.execute(
        update(CollectorFormAccess)
        .where(
            col(CollectorFormAccess.id) == access.id,
            (col(CollectorFormAccess.operation_id).is_(None))
            | (CollectorFormAccess.state != "pending")
            | (CollectorFormAccess.updated_at < utc_now() - timedelta(minutes=2)),
        )
        .values(
            state="pending",
            operation_id=operation,
            requested_action=payload.action,
            permission_username=username,
            updated_at=utc_now(),
            updated_by_id=user.id,
            last_error=None,
        )
    )
    if cast(CursorResult, claim).rowcount != 1:
        db.rollback()
        raise HTTPException(409, "A Kobo access operation is already running.")
    audit(db, project, user, "enumerator.kobo_" + payload.action + "_requested:" + username, access.id)
    commit(db)
    try:
        token = decrypt_kobo_token(connection.token_encrypted, settings)
        state = reconcile_collection_access(connection.server_url, token, access.form_id, username, payload.action)
        if payload.action == "verify" and state == "not_configured" and was_revocation:
            state = "revoked"
        error = None
    except ValueError as exc:
        state, error = "failed", str(exc)
    completed = db.execute(
        update(CollectorFormAccess)
        .where(
            col(CollectorFormAccess.id) == access_id,
            col(CollectorFormAccess.operation_id) == operation,
        )
        .values(state=state, last_error=error, last_checked_at=utc_now(), updated_at=utc_now())
    )
    if cast(CursorResult, completed).rowcount != 1:
        audit(db, project, user, "enumerator.kobo_operation_superseded", access_id)
        commit(db)
        raise HTTPException(409, "A newer Kobo access check superseded this result. Refresh the assignment.")
    audit(db, project, user, "enumerator.kobo_" + payload.action + ":" + state + ":" + username, access_id)
    commit(db)
    db.expire_all()
    return assignment_read(item, project, db)
