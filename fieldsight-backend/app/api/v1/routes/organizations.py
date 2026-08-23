"""Tenant-scoped Phase 3 organization APIs."""

from __future__ import annotations

import re
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select

from app.api.v1.routes.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import hash_refresh_token
from app.db.session import get_session
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role, Sector, User
from app.models.phase3 import FieldAssignment, Invitation, Location, OrganizationSettings, Project, ProjectStatus

router = APIRouter(prefix="/organizations")


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class SettingsUpdate(BaseModel):
    timezone: str | None = None
    country: str | None = None
    default_language: str | None = None
    retention_days: int | None = Field(default=None, ge=1, le=3650)
    export_reason_required: bool | None = None
    notification_preferences: dict[str, object] | None = None


class InviteRequest(BaseModel):
    email: EmailStr
    role: Role


class SectorAssignmentRequest(BaseModel):
    sector_ids: list[UUID]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    organization_sector_id: UUID
    description: str = ""
    country: str | None = None
    status: ProjectStatus = ProjectStatus.DRAFT
    start_date: date | None = None
    end_date: date | None = None
    target_sample_size: int | None = Field(default=None, ge=1)
    is_private: bool = False


class LocationCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    level: str = Field(default="site", max_length=80)
    parent_id: UUID | None = None


class AssignmentCreate(BaseModel):
    membership_id: UUID
    project_id: UUID
    location_id: UUID | None = None
    daily_target: int = Field(default=0, ge=0)
    effective_from: date | None = None
    effective_to: date | None = None


class UploadIntentRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(pattern=r"^image/(png|jpeg|webp)$")
    size_bytes: int = Field(gt=0, le=5_000_000)


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


CurrentUser = Annotated[User, Depends(get_current_user)]
Database = Annotated[Session, Depends(get_session)]


@router.get("/{org_id}")
def get_organization(org_id: UUID, user: CurrentUser, db: Database) -> Organization:
    _authorize(org_id, user, db)
    return _organization(org_id, db)


@router.patch("/{org_id}")
def update_organization(org_id: UUID, payload: OrganizationUpdate, user: CurrentUser, db: Database) -> Organization:
    _authorize(org_id, user, db, admin=True)
    organization = _organization(org_id, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(organization, key, value)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


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
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    settings.updated_at = datetime.now(UTC)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/{org_id}/members")
def list_members(org_id: UUID, user: CurrentUser, db: Database) -> list[OrganizationMembership]:
    _authorize(org_id, user, db, admin=True)
    return list(db.exec(select(OrganizationMembership).where(OrganizationMembership.organization_id == org_id)))


@router.post("/{org_id}/members", status_code=status.HTTP_201_CREATED)
def invite_member(
    org_id: UUID,
    payload: InviteRequest,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    _authorize(org_id, user, db, admin=True)
    _organization(org_id, db)
    if payload.role not in {Role.ORGANIZATION_ADMIN, Role.ENUMERATOR}:
        raise HTTPException(status_code=422, detail="Only organization roles may be invited.")
    raw_token = secrets.token_urlsafe(32)
    invitation = Invitation(
        organization_id=org_id,
        email=str(payload.email).lower(),
        role=payload.role,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.invitation_days),
        created_by_id=user.id,
    )
    db.add(invitation)
    db.commit()
    result: dict[str, object] = {
        "id": invitation.id,
        "email": invitation.email,
        "role": invitation.role,
        "expires_at": invitation.expires_at,
    }
    if settings.is_development:
        result["development_invitation_token"] = raw_token
    return result


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
        location = db.get(Location, payload.location_id)
        if location is None or location.organization_id != org_id:
            raise HTTPException(status_code=422, detail="Assignment location must belong to this organization.")
    assignment = FieldAssignment(organization_id=org_id, **payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


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
