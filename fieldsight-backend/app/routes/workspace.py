"""Real, tenant-scoped quick-start workflows behind the workspace UI."""

import csv
import hashlib
import io
import secrets
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.core.security import hash_refresh_token, password_hasher, verify_password
from app.core.survey import flatten_answers, number
from app.db.session import get_session
from app.models.identity import OrganizationMembership, RefreshSession, Role, User
from app.models.operations import (
    FieldAssignment,
    Indicator,
    KoboConnection,
    Project,
    SavedAnalysis,
    Submission,
    SurveySchema,
)
from app.models.workspace import AnalyticalDashboard, CollectedResult, UserPreference, WorkspaceInvitation
from app.routes.auth import get_current_user
from app.routes.indicators import _indicator, _mapping
from app.routes.intelligence import _project
from app.routes.kobo import _organization_admin_id
from app.schemas.analysis import FieldType, SurveyField
from app.schemas.workspace import (
    AcceptInvitation,
    CollectedResultInput,
    DashboardInput,
    InvitationInput,
    MemberInput,
    PasswordInput,
    PreferenceInput,
    TableImportInput,
    TeamAssignmentInput,
)

router = APIRouter(tags=["workspace quick start"])
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _org(org_id: UUID, user: User, db: Session) -> None:
    if _organization_admin_id(user, db) != org_id:
        raise HTTPException(404, "Organization was not found.")


@router.get("/organizations/{org_id}/team")
def team(org_id: UUID, user: CurrentUser, db: Database) -> list[dict[str, object]]:
    _org(org_id, user, db)
    rows = db.exec(
        select(OrganizationMembership, User)
        .join(User)
        .where(
            OrganizationMembership.organization_id == org_id,
        )
    ).all()
    return [
        dict(
            id=m.id,
            user_id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            is_active=m.is_active and u.is_active,
        )
        for m, u in rows
    ]


@router.patch("/organizations/{org_id}/team/{membership_id}")
def update_member(
    org_id: UUID, membership_id: UUID, payload: MemberInput, user: CurrentUser, db: Database
) -> dict[str, str]:
    _org(org_id, user, db)
    member = db.get(OrganizationMembership, membership_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(404, "Member was not found.")
    if member.user_id == user.id and (not payload.is_active or payload.role != "organization_admin"):
        raise HTTPException(422, "Ask another administrator to change your own administrator access.")
    member.role = Role(payload.role)
    member.is_active = payload.is_active
    db.add(member)
    db.commit()
    return {"status": "updated"}


def _invitation_read(item: WorkspaceInvitation) -> dict[str, object]:
    expires = item.expires_at.replace(tzinfo=UTC)
    return dict(
        id=item.id,
        email=item.email,
        role=item.role,
        expires_at=expires,
        status="accepted"
        if item.accepted_at
        else "revoked"
        if item.revoked
        else "expired"
        if expires < datetime.now(UTC)
        else "pending",
    )


@router.get("/organizations/{org_id}/invitations")
def invitations(org_id: UUID, user: CurrentUser, db: Database) -> list[dict[str, object]]:
    _org(org_id, user, db)
    return [
        _invitation_read(item)
        for item in db.exec(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.organization_id == org_id,
            )
        ).all()
    ]


@router.post("/organizations/{org_id}/invitations", status_code=201)
def invite(org_id: UUID, payload: InvitationInput, user: CurrentUser, db: Database) -> dict[str, object]:
    _org(org_id, user, db)
    email = str(payload.email).lower()
    if db.exec(select(User).where(User.email == email)).first():
        raise HTTPException(409, "This email already has an account. Manage existing members from the team list.")
    for old in db.exec(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.organization_id == org_id,
            WorkspaceInvitation.email == email,
            col(WorkspaceInvitation.accepted_at).is_(None),
        )
    ).all():
        old.revoked = True
        db.add(old)
    token = secrets.token_urlsafe(48)
    invitation = WorkspaceInvitation(
        organization_id=org_id,
        email=email,
        role=payload.role,
        token_hash=hash_refresh_token(token),
        created_by_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(invitation)
    db.commit()
    return {**_invitation_read(invitation), "token": token, "delivery": "copy_link"}


@router.delete("/organizations/{org_id}/invitations/{invitation_id}", status_code=204)
def revoke_invitation(org_id: UUID, invitation_id: UUID, user: CurrentUser, db: Database) -> Response:
    _org(org_id, user, db)
    item = db.get(WorkspaceInvitation, invitation_id)
    if item is None or item.organization_id != org_id:
        raise HTTPException(404, "Invitation was not found.")
    item.revoked = True
    db.add(item)
    db.commit()
    return Response(status_code=204)


@router.post("/auth/accept-invitation", status_code=201)
def accept_invitation(payload: AcceptInvitation, db: Database) -> dict[str, str]:
    invitation = db.exec(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.token_hash == hash_refresh_token(payload.token),
        )
    ).first()
    if (
        invitation is None
        or invitation.revoked
        or invitation.accepted_at
        or invitation.expires_at.replace(tzinfo=UTC) < datetime.now(UTC)
    ):
        raise HTTPException(422, "This invitation is invalid, expired or already accepted.")
    if db.exec(select(User).where(User.email == invitation.email)).first():
        raise HTTPException(409, "An account already exists. Sign in with that account.")
    account = User(
        email=invitation.email, full_name=payload.full_name, password_hash=password_hasher.hash(payload.password)
    )
    db.add(account)
    db.flush()
    db.add(
        OrganizationMembership(
            organization_id=invitation.organization_id, user_id=account.id, role=Role(invitation.role)
        )
    )
    invitation.accepted_at = datetime.now(UTC)
    db.add(invitation)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "This invitation has already been used.") from exc
    return {"status": "accepted", "email": account.email, "role": invitation.role}


@router.get("/auth/profile")
def profile(user: CurrentUser, db: Database) -> dict[str, object]:
    preference = db.get(UserPreference, user.id)
    return dict(
        email=user.email, full_name=user.full_name, landing_page=preference.landing_page if preference else "/projects"
    )


@router.put("/auth/profile")
def update_profile(payload: PreferenceInput, user: CurrentUser, db: Database) -> dict[str, object]:
    user.full_name = payload.full_name
    preference = db.get(UserPreference, user.id) or UserPreference(user_id=user.id)
    preference.landing_page = payload.landing_page
    db.add_all([user, preference])
    db.commit()
    return profile(user, db)


@router.post("/auth/change-password")
def change_password(payload: PasswordInput, user: CurrentUser, db: Database) -> dict[str, object]:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(422, "Current password is incorrect.")
    user.password_hash = password_hasher.hash(payload.new_password)
    db.add(user)
    for session in db.exec(select(RefreshSession).where(RefreshSession.user_id == user.id)).all():
        session.revoked_at = datetime.now(UTC)
        db.add(session)
    db.commit()
    return {"status": "password_changed", "sign_in_required": True}


@router.get("/projects/{project_id}/team")
def project_team(project_id: UUID, user: CurrentUser, db: Database) -> list[dict[str, object]]:
    project = _project(project_id, user, db)
    assignments = db.exec(
        select(FieldAssignment).where(
            FieldAssignment.project_id == project.id,
            FieldAssignment.is_enabled,
        )
    ).all()
    members = team(project.organization_id, user, db)
    return [
        dict(**member, assignment_id=assignment.id)
        for assignment in assignments
        for member in members
        if member["id"] == assignment.membership_id
    ]


@router.post("/projects/{project_id}/team", status_code=201)
def add_project_member(
    project_id: UUID, payload: TeamAssignmentInput, user: CurrentUser, db: Database
) -> dict[str, str]:
    project = _project(project_id, user, db)
    member = db.get(OrganizationMembership, payload.membership_id)
    if member is None or member.organization_id != project.organization_id or not member.is_active:
        raise HTTPException(422, "Choose an active member of this organization.")
    if member.role == Role.ORGANIZATION_ADMIN:
        raise HTTPException(422, "Organization administrators already have access to every workspace.")
    existing = db.exec(
        select(FieldAssignment).where(
            FieldAssignment.project_id == project.id,
            FieldAssignment.membership_id == member.id,
            col(FieldAssignment.location_id).is_(None),
        )
    ).first()
    item = existing or FieldAssignment(
        organization_id=project.organization_id, membership_id=member.id, project_id=project.id, daily_target=0
    )
    item.is_enabled = True
    db.add(item)
    db.commit()
    return {"status": "assigned"}


@router.delete("/projects/{project_id}/team/{assignment_id}", status_code=204)
def remove_project_member(project_id: UUID, assignment_id: UUID, user: CurrentUser, db: Database) -> Response:
    project = _project(project_id, user, db)
    item = db.get(FieldAssignment, assignment_id)
    if item is None or item.project_id != project.id:
        raise HTTPException(404, "Assignment was not found.")
    item.is_enabled = False
    db.add(item)
    db.commit()
    return Response(status_code=204)


@router.get("/projects/{project_id}/tables")
def tables(project_id: UUID, user: CurrentUser, db: Database) -> list[dict[str, object]]:
    project = _project(project_id, user, db)
    records = db.exec(select(Submission).where(Submission.project_id == project.id)).all()
    schemas = db.exec(select(SurveySchema).where(SurveySchema.project_id == project.id)).all()
    forms = sorted({r.kobo_form_id for r in records} | {s.form_id for s in schemas})
    return [
        dict(
            id=form,
            title=next(
                (
                    (s.version or "").removeprefix("CSV: ")
                    for s in schemas
                    if s.form_id == form and (s.version or "").startswith("CSV: ")
                ),
                project.kobo_form_name if project.kobo_form_id == form else form,
            ),
            source="CSV upload" if form.startswith("csv-") else "Demo sample" if form.startswith("demo-") else "Kobo",
            records=sum(r.kobo_form_id == form for r in records),
        )
        for form in forms
    ]


@router.get("/projects/{project_id}/tables/{form_id}")
def table_rows(
    project_id: UUID,
    form_id: str,
    user: CurrentUser,
    db: Database,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> dict[str, object]:
    project = _project(project_id, user, db)
    from app.routes.analysis import _catalogue

    catalogue, records, _ = _catalogue(project, form_id, db)
    records = sorted(records, key=lambda item: (str(item.submitted_at or ""), str(item.id)), reverse=True)
    fields = [field.model_dump() for field in catalogue.fields]
    return dict(
        fields=fields,
        total=len(records),
        offset=offset,
        rows=[
            dict(
                id=r.id,
                review_status=r.review_status,
                submitted_at=r.submitted_at,
                answers=flatten_answers(r.raw_answers),
            )
            for r in records[offset : offset + limit]
        ],
    )


@router.post("/projects/{project_id}/tables/import", status_code=201)
def import_table(project_id: UUID, payload: TableImportInput, user: CurrentUser, db: Database) -> dict[str, object]:
    project = _project(project_id, user, db)
    reader = csv.reader(io.StringIO(payload.csv_text.lstrip("\ufeff")), strict=True)
    try:
        headers = next(reader)
        if (
            not headers
            or len(headers) > 80
            or any(not h.strip() or len(h) > 200 for h in headers)
            or len(set(headers)) != len(headers)
        ):
            raise ValueError("Use 1–80 unique, non-empty column headings, at most 200 characters each.")
        for column in (payload.date_column, payload.location_column):
            if column and column not in headers:
                raise ValueError("The date or location column is not in the CSV headings.")
        rows = []
        for values in reader:
            if not values:
                continue
            if len(values) != len(headers) or any(len(v) > 10000 for v in values):
                raise ValueError("Each row must match the headings, with at most 10,000 characters per cell.")
            row = dict(zip(headers, values, strict=True))
            stamp = None
            if payload.date_column and row[payload.date_column]:
                stamp = datetime.fromisoformat(row[payload.date_column].replace("Z", "+00:00"))
                stamp = stamp.replace(tzinfo=UTC) if stamp.tzinfo is None else stamp.astimezone(UTC)
            rows.append((row, stamp))
            if len(rows) > 2000:
                raise ValueError("Import up to 2,000 rows at a time.")
        if not rows:
            raise ValueError("Include at least one data row.")
    except (ValueError, csv.Error, StopIteration) as exc:
        raise HTTPException(422, str(exc) or "The CSV is empty or malformed.") from exc
    digest = hashlib.sha256(
        (str(project.id) + payload.csv_text + str(payload.date_column) + str(payload.location_column)).encode()
    ).hexdigest()[:24]
    form_id = f"csv-{digest}"
    if db.exec(
        select(SurveySchema).where(SurveySchema.project_id == project.id, SurveySchema.form_id == form_id)
    ).first():
        raise HTTPException(409, "This file and column mapping were already imported into this workspace.")
    connection = db.exec(
        select(KoboConnection).where(
            KoboConnection.organization_id == project.organization_id,
            KoboConnection.name == "Local CSV imports (offline)",
        )
    ).first()
    if connection is None:
        connection = KoboConnection(
            organization_id=project.organization_id,
            name="Local CSV imports (offline)",
            server_url="https://example.invalid",
            token_encrypted="LOCAL-NO-REMOTE-ACCESS",
            created_by_id=user.id,
            is_verified=False,
        )
        db.add(connection)
        db.flush()
    fields = []
    for heading in headers:
        values = [r[heading] for r, _ in rows if r[heading].strip()]
        kind: FieldType = (
            "date"
            if heading == payload.date_column
            else "number"
            if values and all(number(v) is not None for v in values)
            else "text"
        )
        fields.append(SurveyField(source_field=heading, label=heading, type=kind, source="mapping").model_dump())
    db.add(
        SurveySchema(
            organization_id=project.organization_id,
            project_id=project.id,
            form_id=form_id,
            version=f"CSV: {payload.title}",
            fields_json=fields,
        )
    )
    for index, (answers, stamp) in enumerate(rows):
        db.add(
            Submission(
                organization_id=project.organization_id,
                project_id=project.id,
                kobo_connection_id=connection.id,
                kobo_form_id=form_id,
                external_id=str(index + 1),
                submitted_at=stamp,
                location=answers.get(payload.location_column) if payload.location_column else None,
                review_status="needs_review",
                raw_answers=dict(answers),
            )
        )
    db.commit()
    return dict(form_id=form_id, imported=len(rows), review_status="needs_review")


@router.get("/indicators/{indicator_id}/collected-results")
def collected_results(indicator_id: UUID, user: CurrentUser, db: Database) -> Sequence[CollectedResult]:
    indicator = _indicator(indicator_id, user, db)
    return db.exec(
        select(CollectedResult)
        .where(CollectedResult.indicator_id == indicator.id)
        .order_by(col(CollectedResult.result_date).desc(), col(CollectedResult.created_at).desc())
    ).all()


@router.post("/indicators/{indicator_id}/collected-results", status_code=201)
def add_collected_result(
    indicator_id: UUID, payload: CollectedResultInput, user: CurrentUser, db: Database
) -> CollectedResult:
    indicator = _indicator(indicator_id, user, db)
    if _mapping(indicator, db):
        raise HTTPException(
            409, "This indicator uses linked table results. Remove its mapping before entering manual results."
        )
    if indicator.unit == "text":
        if not (payload.narrative or "").strip() or payload.value is not None:
            raise HTTPException(422, "Qualitative indicators require a narrative and no numeric value.")
    elif payload.value is None or payload.narrative:
        raise HTTPException(422, "Numeric indicators require a numeric result; use notes for context.")
    if indicator.unit == "percentage" and payload.value is not None and not 0 <= payload.value <= 100:
        raise HTTPException(422, "Percentage results must be between 0 and 100.")
    item = CollectedResult(
        indicator_id=indicator.id,
        organization_id=indicator.organization_id,
        created_by_id=user.id,
        **payload.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/indicators/{indicator_id}/collected-results/{result_id}", status_code=204)
def delete_collected_result(indicator_id: UUID, result_id: UUID, user: CurrentUser, db: Database) -> Response:
    indicator = _indicator(indicator_id, user, db)
    item = db.get(CollectedResult, result_id)
    if item is None or item.indicator_id != indicator.id:
        raise HTTPException(404, "Collected result was not found.")
    db.delete(item)
    db.commit()
    return Response(status_code=204)


def _dashboard(id: UUID, user: User, db: Session) -> AnalyticalDashboard:
    item = db.get(AnalyticalDashboard, id)
    if item is None or item.organization_id != _organization_admin_id(user, db):
        raise HTTPException(404, "Dashboard was not found.")
    _project(item.project_id, user, db)
    return item


@router.get("/dashboards")
def dashboards(user: CurrentUser, db: Database) -> Sequence[AnalyticalDashboard]:
    org = _organization_admin_id(user, db)
    return db.exec(
        select(AnalyticalDashboard)
        .where(AnalyticalDashboard.organization_id == org)
        .order_by(col(AnalyticalDashboard.created_at).desc())
    ).all()


def _validate_widgets(payload: DashboardInput, user: User, db: Session) -> Project:
    project = _project(payload.project_id, user, db)
    if len({widget.id for widget in payload.widgets}) != len(payload.widgets):
        raise HTTPException(422, "Widget IDs must be unique.")
    for widget in payload.widgets:
        if widget.kind == "text":
            continue
        source: Indicator | SavedAnalysis | None = None
        if widget.source_id:
            source = (
                db.get(Indicator, widget.source_id)
                if widget.kind == "indicator"
                else db.get(SavedAnalysis, widget.source_id)
            )
        if source is None or source.project_id != project.id or source.organization_id != project.organization_id:
            raise HTTPException(422, "Every widget must reference an accessible item in this workspace.")
    return project


@router.post("/dashboards", status_code=201)
def create_dashboard(payload: DashboardInput, user: CurrentUser, db: Database) -> AnalyticalDashboard:
    project = _validate_widgets(payload, user, db)
    item = AnalyticalDashboard(
        organization_id=project.organization_id, created_by_id=user.id, **payload.model_dump(mode="json")
    )
    # SQLModel UUID fields need native UUID values when instantiated from JSON dictionaries.
    item.project_id = project.id
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/dashboards/{dashboard_id}")
def save_dashboard(dashboard_id: UUID, payload: DashboardInput, user: CurrentUser, db: Database) -> AnalyticalDashboard:
    item = _dashboard(dashboard_id, user, db)
    project = _validate_widgets(payload, user, db)
    item.title, item.description, item.project_id = payload.title, payload.description, project.id
    item.widgets = [widget.model_dump(mode="json") for widget in payload.widgets]
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/dashboards/{dashboard_id}", status_code=204)
def delete_dashboard(dashboard_id: UUID, user: CurrentUser, db: Database) -> Response:
    item = _dashboard(dashboard_id, user, db)
    db.delete(item)
    db.commit()
    return Response(status_code=204)
