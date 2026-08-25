"""Tenant-scoped organization APIs, grouped in CRUD order by resource."""

from __future__ import annotations

import re
import secrets
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.security import password_hasher
from app.db.session import get_session
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role, Sector, User
from app.models.phase3 import FieldAssignment, Location, OrganizationSettings, Project, ProjectStatus
from app.routes.auth import get_current_user
from app.schemas.crud import AssignmentUpdate, EnumeratorUpdate, LocationUpdate, ProjectUpdate
from app.schemas.enumerators import EnumeratorCreate, EnumeratorRead
from app.schemas.organizations import (
    AssignmentCreate,
    LocationCreate,
    OrganizationUpdate,
    ProjectCreate,
    SectorAssignmentRequest,
    SettingsUpdate,
    UploadIntentRequest,
)

router = APIRouter(prefix="/organizations")
organization_lookup_router = APIRouter(prefix="/organization")
CurrentUser = Annotated[User, Depends(get_current_user)]
Database = Annotated[Session, Depends(get_session)]


def _membership(org_id: UUID, user: User, db: Session) -> OrganizationMembership | None:
    return db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.is_active,
        )
    ).first()


def _authorize(org_id: UUID, user: User, db: Session, *, admin: bool = False) -> OrganizationMembership | None:
    membership = _membership(org_id, user, db)
    if user.platform_role == Role.SUPER_ADMIN:
        return membership
    if membership is None:
        raise HTTPException(status_code=404, detail="Organization was not found.")
    if admin and membership.role != Role.ORGANIZATION_ADMIN:
        raise HTTPException(status_code=403, detail="Organization administrator permission is required.")
    return membership


def _organization(org_id: UUID, db: Session) -> Organization:
    organization = db.get(Organization, org_id)
    if organization is None or not organization.is_active:
        raise HTTPException(status_code=404, detail="Organization was not found.")
    return organization


def _project(org_id: UUID, project_id: UUID, db: Session) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Project was not found.")
    return project


def _location(org_id: UUID, location_id: UUID, db: Session) -> Location:
    location = db.get(Location, location_id)
    if location is None or location.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Location was not found.")
    return location


def _enumerator(org_id: UUID, membership_id: UUID, db: Session) -> OrganizationMembership:
    membership = db.get(OrganizationMembership, membership_id)
    if membership is None or membership.organization_id != org_id or membership.role != Role.ENUMERATOR:
        raise HTTPException(status_code=404, detail="Enumerator was not found.")
    return membership


def _assignment(org_id: UUID, assignment_id: UUID, db: Session) -> FieldAssignment:
    assignment = db.get(FieldAssignment, assignment_id)
    if assignment is None or assignment.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Assignment was not found.")
    return assignment


# Organization: Read → Update (platform Create/Delete are in administration.py)
@router.get("/{org_id}")
def get_organization(org_id: UUID, user: CurrentUser, db: Database) -> Organization:
    _authorize(org_id, user, db)
    return _organization(org_id, db)


@router.patch("/{org_id}")
def update_organization(org_id: UUID, payload: OrganizationUpdate, user: CurrentUser, db: Database) -> Organization:
    _authorize(org_id, user, db, admin=True)
    organization = _organization(org_id, db)
    changes = payload.model_dump(exclude_unset=True)
    country = changes.pop("country", None)
    timezone = changes.pop("timezone", None)
    sector_ids = changes.pop("sector_ids", None)
    requested_slug = changes.get("slug")
    if requested_slug and requested_slug != organization.slug:
        duplicate = db.exec(
            select(Organization).where(Organization.slug == requested_slug, Organization.id != org_id)
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Organization slug already exists.")
    for field, value in changes.items():
        setattr(organization, field, value)
    settings = db.get(OrganizationSettings, org_id) or OrganizationSettings(organization_id=org_id)
    if "country" in payload.model_fields_set:
        settings.country = country
    if "timezone" in payload.model_fields_set and timezone is not None:
        settings.timezone = timezone
    settings.updated_at = datetime.now(UTC)
    db.add(organization)
    db.add(settings)
    if sector_ids is not None:
        unique_ids = set(sector_ids)
        sectors = db.exec(select(Sector).where(Sector.id.in_(unique_ids), Sector.is_active)).all()
        if len(sectors) != len(unique_ids):
            raise HTTPException(status_code=422, detail="One or more sectors are invalid or inactive.")
        existing = db.exec(select(OrganizationSector).where(OrganizationSector.organization_id == org_id)).all()
        by_sector = {row.sector_id: row for row in existing}
        for row in existing:
            row.is_active = row.sector_id in unique_ids
            db.add(row)
        for sector_id in unique_ids - by_sector.keys():
            db.add(OrganizationSector(organization_id=org_id, sector_id=sector_id))
    db.commit()
    db.refresh(organization)
    return organization


# Settings: Read → Update (singleton resource; Create/Delete are not applicable)
@router.get("/{org_id}/settings")
def get_settings_route(org_id: UUID, user: CurrentUser, db: Database) -> OrganizationSettings:
    _authorize(org_id, user, db)
    settings = db.get(OrganizationSettings, org_id)
    if settings is None:
        settings = OrganizationSettings(organization_id=org_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.patch("/{org_id}/settings")
def update_settings(org_id: UUID, payload: SettingsUpdate, user: CurrentUser, db: Database) -> OrganizationSettings:
    _authorize(org_id, user, db, admin=True)
    settings = db.get(OrganizationSettings, org_id) or OrganizationSettings(organization_id=org_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    settings.updated_at = datetime.now(UTC)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


# Members: List only; enumerator CRUD follows below.
@router.get("/{org_id}/members")
def list_members(org_id: UUID, user: CurrentUser, db: Database) -> list[OrganizationMembership]:
    _authorize(org_id, user, db, admin=True)
    return list(db.exec(select(OrganizationMembership).where(OrganizationMembership.organization_id == org_id)))


# Enumerators: managed only by an active Organization Admin membership.
def _authorize_organization_admin(org_id: UUID, user: User, db: Session) -> OrganizationMembership:
    membership = _membership(org_id, user, db)
    if membership is None:
        raise HTTPException(status_code=404, detail="Organization was not found.")
    if membership.role != Role.ORGANIZATION_ADMIN:
        raise HTTPException(status_code=403, detail="Organization administrator permission is required.")
    return membership


def _enumerator_read(membership: OrganizationMembership, db: Session) -> EnumeratorRead:
    account = db.get(User, membership.user_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Enumerator account was not found.")
    return EnumeratorRead(
        user_id=account.id,
        membership_id=membership.id,
        email=account.email,
        username=account.username,
        role=membership.role.value,
        is_active=account.is_active and membership.is_active,
        created_at=membership.created_at,
    )


@router.get("/{org_id}/enumerators", response_model=list[EnumeratorRead])
def list_enumerators(org_id: UUID, user: CurrentUser, db: Database) -> list[EnumeratorRead]:
    _authorize_organization_admin(org_id, user, db)
    memberships = db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.role == Role.ENUMERATOR,
        )
    ).all()
    return [_enumerator_read(membership, db) for membership in memberships]


@router.post("/{org_id}/enumerators", response_model=EnumeratorRead, status_code=status.HTTP_201_CREATED)
def create_enumerator(org_id: UUID, payload: EnumeratorCreate, user: CurrentUser, db: Database) -> EnumeratorRead:
    _authorize_organization_admin(org_id, user, db)
    _organization(org_id, db)
    email = str(payload.email).lower()
    if db.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Enumerator email already exists.")
    if db.exec(select(User).where(User.username == payload.username)).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Enumerator username already exists.")
    enumerator = User(email=email, username=payload.username, password_hash=password_hasher.hash(payload.password))
    db.add(enumerator)
    db.flush()
    membership = OrganizationMembership(organization_id=org_id, user_id=enumerator.id, role=Role.ENUMERATOR)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return _enumerator_read(membership, db)


@router.get("/{org_id}/enumerators/{membership_id}", response_model=EnumeratorRead)
def get_enumerator(org_id: UUID, membership_id: UUID, user: CurrentUser, db: Database) -> EnumeratorRead:
    _authorize_organization_admin(org_id, user, db)
    return _enumerator_read(_enumerator(org_id, membership_id, db), db)


@router.patch("/{org_id}/enumerators/{membership_id}", response_model=EnumeratorRead)
def update_enumerator(
    org_id: UUID, membership_id: UUID, payload: EnumeratorUpdate, user: CurrentUser, db: Database
) -> EnumeratorRead:
    _authorize_organization_admin(org_id, user, db)
    membership = _enumerator(org_id, membership_id, db)
    if payload.is_active is not None:
        membership.is_active = payload.is_active
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return _enumerator_read(membership, db)


@router.delete("/{org_id}/enumerators/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_enumerator(org_id: UUID, membership_id: UUID, user: CurrentUser, db: Database) -> Response:
    _authorize_organization_admin(org_id, user, db)
    membership = _enumerator(org_id, membership_id, db)
    membership.is_active = False
    db.add(membership)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Organization sectors: List → Replace
@router.get("/{org_id}/sectors")
def list_organization_sectors(org_id: UUID, user: CurrentUser, db: Database) -> list[OrganizationSector]:
    _authorize(org_id, user, db)
    return list(
        db.exec(
            select(OrganizationSector).where(OrganizationSector.organization_id == org_id, OrganizationSector.is_active)
        )
    )


@router.put("/{org_id}/sectors")
def replace_organization_sectors(
    org_id: UUID, payload: SectorAssignmentRequest, user: CurrentUser, db: Database
) -> list[OrganizationSector]:
    _authorize(org_id, user, db, admin=True)
    unique_ids = set(payload.sector_ids)
    sectors = db.exec(select(Sector).where(Sector.id.in_(unique_ids), Sector.is_active)).all()
    if len(sectors) != len(unique_ids):
        raise HTTPException(status_code=422, detail="One or more sectors are invalid or inactive.")
    existing = db.exec(select(OrganizationSector).where(OrganizationSector.organization_id == org_id)).all()
    by_sector = {row.sector_id: row for row in existing}
    for row in existing:
        row.is_active = row.sector_id in unique_ids
        db.add(row)
    for sector_id in unique_ids - by_sector.keys():
        db.add(OrganizationSector(organization_id=org_id, sector_id=sector_id))
    db.commit()
    return list(
        db.exec(
            select(OrganizationSector).where(OrganizationSector.organization_id == org_id, OrganizationSector.is_active)
        )
    )


# Projects: List → Create → Read → Update → Delete (archive)
@router.get("/{org_id}/projects")
def list_projects(org_id: UUID, user: CurrentUser, db: Database) -> list[Project]:
    _authorize(org_id, user, db)
    return list(db.exec(select(Project).where(Project.organization_id == org_id).order_by(Project.created_at.desc())))


@router.post("/{org_id}/projects", status_code=status.HTTP_201_CREATED)
def create_project(org_id: UUID, payload: ProjectCreate, user: CurrentUser, db: Database) -> Project:
    _authorize(org_id, user, db, admin=True)
    sector = db.get(OrganizationSector, payload.organization_sector_id)
    if sector is None or sector.organization_id != org_id or not sector.is_active:
        raise HTTPException(status_code=422, detail="Project sector must be active in this organization.")
    if payload.end_date and payload.start_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="End date cannot be before start date.")
    project = Project(organization_id=org_id, created_by_id=user.id, **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{org_id}/projects/{project_id}")
def get_project(org_id: UUID, project_id: UUID, user: CurrentUser, db: Database) -> Project:
    _authorize(org_id, user, db)
    return _project(org_id, project_id, db)


@router.patch("/{org_id}/projects/{project_id}")
def update_project(org_id: UUID, project_id: UUID, payload: ProjectUpdate, user: CurrentUser, db: Database) -> Project:
    _authorize(org_id, user, db, admin=True)
    project = _project(org_id, project_id, db)
    changes = payload.model_dump(exclude_unset=True)
    start_date = changes.get("start_date", project.start_date)
    end_date = changes.get("end_date", project.end_date)
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=422, detail="End date cannot be before start date.")
    for field, value in changes.items():
        setattr(project, field, value)
    project.updated_at = datetime.now(UTC)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{org_id}/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_project(org_id: UUID, project_id: UUID, user: CurrentUser, db: Database) -> Response:
    _authorize(org_id, user, db, admin=True)
    project = _project(org_id, project_id, db)
    project.status = ProjectStatus.ARCHIVED
    project.updated_at = datetime.now(UTC)
    db.add(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Locations: List → Create → Read → Update → Delete (deactivate)
@router.get("/{org_id}/locations")
def list_locations(org_id: UUID, user: CurrentUser, db: Database) -> list[Location]:
    _authorize(org_id, user, db)
    return list(db.exec(select(Location).where(Location.organization_id == org_id, Location.is_active)))


@router.post("/{org_id}/locations", status_code=status.HTTP_201_CREATED)
def create_location(org_id: UUID, payload: LocationCreate, user: CurrentUser, db: Database) -> Location:
    _authorize(org_id, user, db, admin=True)
    if payload.parent_id:
        parent = db.get(Location, payload.parent_id)
        if parent is None or parent.organization_id != org_id:
            raise HTTPException(status_code=422, detail="Parent location must belong to this organization.")
    location = Location(organization_id=org_id, **payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/{org_id}/locations/{location_id}")
def get_location(org_id: UUID, location_id: UUID, user: CurrentUser, db: Database) -> Location:
    _authorize(org_id, user, db)
    return _location(org_id, location_id, db)


@router.patch("/{org_id}/locations/{location_id}")
def update_location(
    org_id: UUID, location_id: UUID, payload: LocationUpdate, user: CurrentUser, db: Database
) -> Location:
    _authorize(org_id, user, db, admin=True)
    location = _location(org_id, location_id, db)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("parent_id"):
        parent = _location(org_id, changes["parent_id"], db)
        if parent.id == location.id:
            raise HTTPException(status_code=422, detail="A location cannot be its own parent.")
    for field, value in changes.items():
        setattr(location, field, value)
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/{org_id}/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_location(org_id: UUID, location_id: UUID, user: CurrentUser, db: Database) -> Response:
    _authorize(org_id, user, db, admin=True)
    location = _location(org_id, location_id, db)
    location.is_active = False
    db.add(location)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Assignments: List → Create → Read → Update → Delete (disable)
@router.get("/{org_id}/assignments")
def list_assignments(org_id: UUID, user: CurrentUser, db: Database) -> list[FieldAssignment]:
    _authorize(org_id, user, db, admin=True)
    return list(db.exec(select(FieldAssignment).where(FieldAssignment.organization_id == org_id)))


@router.post("/{org_id}/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(org_id: UUID, payload: AssignmentCreate, user: CurrentUser, db: Database) -> FieldAssignment:
    _authorize(org_id, user, db, admin=True)
    membership, project = db.get(OrganizationMembership, payload.membership_id), db.get(Project, payload.project_id)
    if membership is None or membership.organization_id != org_id or membership.role != Role.ENUMERATOR:
        raise HTTPException(status_code=422, detail="Assignment membership must be an enumerator in this organization.")
    if project is None or project.organization_id != org_id:
        raise HTTPException(status_code=422, detail="Assignment project must belong to this organization.")
    if payload.location_id:
        _location(org_id, payload.location_id, db)
    assignment = FieldAssignment(organization_id=org_id, **payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/{org_id}/assignments/{assignment_id}")
def get_assignment(org_id: UUID, assignment_id: UUID, user: CurrentUser, db: Database) -> FieldAssignment:
    _authorize(org_id, user, db, admin=True)
    return _assignment(org_id, assignment_id, db)


@router.patch("/{org_id}/assignments/{assignment_id}")
def update_assignment(
    org_id: UUID, assignment_id: UUID, payload: AssignmentUpdate, user: CurrentUser, db: Database
) -> FieldAssignment:
    _authorize(org_id, user, db, admin=True)
    assignment = _assignment(org_id, assignment_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{org_id}/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def disable_assignment(org_id: UUID, assignment_id: UUID, user: CurrentUser, db: Database) -> Response:
    _authorize(org_id, user, db, admin=True)
    assignment = _assignment(org_id, assignment_id, db)
    assignment.is_enabled = False
    db.add(assignment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Branding upload intent (command endpoint; CRUD does not apply)
@router.post("/{org_id}/uploads/logo-intent")
def create_logo_upload_intent(
    org_id: UUID,
    payload: UploadIntentRequest,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    _authorize(org_id, user, db, admin=True)
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", payload.filename)
    object_key = f"organizations/{org_id}/logos/{secrets.token_hex(12)}-{safe_name}"
    return {
        "object_key": object_key,
        "upload_url": f"{settings.upload_base_url}/{object_key}",
        "method": "PUT",
        "content_type": payload.content_type,
        "max_size_bytes": 5_000_000,
        "provider": "local-development-placeholder",
    }
