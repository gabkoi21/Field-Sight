"""Super-admin platform resources, grouped in CRUD order."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.core.security import password_hasher
from app.db.session import get_session
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role, Sector, User
from app.models.phase3 import OrganizationSettings
from app.routes.auth import get_current_user
from app.schemas.administration import (
    OrganizationCreate,
    OrganizationListItem,
    SectorCreate,
    SectorUpdate,
    UserDirectoryItem,
    UserOrganizationAccess,
)

router = APIRouter()
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def require_super_admin(user: CurrentUser) -> User:
    if user.platform_role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super administrator permission is required.")
    return user


# Users: platform-wide directory for Super Admin access management.
@router.get("/users", response_model=list[UserDirectoryItem])
def list_users(_: Annotated[User, Depends(require_super_admin)], db: Database) -> list[UserDirectoryItem]:
    users = db.exec(select(User).order_by(User.created_at.desc())).all()
    organizations = {row.id: row.name for row in db.exec(select(Organization)).all()}
    memberships = db.exec(select(OrganizationMembership)).all()
    memberships_by_user: dict[UUID, list[OrganizationMembership]] = {}
    for membership in memberships:
        memberships_by_user.setdefault(membership.user_id, []).append(membership)
    return [
        UserDirectoryItem(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            platform_role=user.platform_role.value if user.platform_role else None,
            created_at=user.created_at,
            memberships=[
                UserOrganizationAccess(
                    organization_id=membership.organization_id,
                    organization_name=organizations.get(membership.organization_id, "Unknown organization"),
                    role=membership.role.value,
                    is_active=membership.is_active,
                )
                for membership in memberships_by_user.get(user.id, [])
            ],
        )
        for user in users
    ]


# Sectors: Create → Read → Update → Delete (list is public-to-authenticated in sectors.py)
@router.post("/sectors", status_code=status.HTTP_201_CREATED)
def create_sector(payload: SectorCreate, _: Annotated[User, Depends(require_super_admin)], db: Database) -> Sector:
    if db.exec(select(Sector).where(Sector.code == payload.code)).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sector code already exists.")
    sector = Sector(**payload.model_dump())
    db.add(sector)
    db.commit()
    db.refresh(sector)
    return sector


@router.get("/sectors/{sector_id}")
def get_sector(sector_id: UUID, _: Annotated[User, Depends(require_super_admin)], db: Database) -> Sector:
    sector = db.get(Sector, sector_id)
    if sector is None:
        raise HTTPException(status_code=404, detail="Sector was not found.")
    return sector


@router.patch("/sectors/{sector_id}")
def update_sector(
    sector_id: UUID, payload: SectorUpdate, _: Annotated[User, Depends(require_super_admin)], db: Database
) -> Sector:
    sector = db.get(Sector, sector_id)
    if sector is None:
        raise HTTPException(status_code=404, detail="Sector was not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sector, field, value)
    db.add(sector)
    db.commit()
    db.refresh(sector)
    return sector


@router.delete("/sectors/{sector_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_sector(sector_id: UUID, _: Annotated[User, Depends(require_super_admin)], db: Database) -> Response:
    sector = db.get(Sector, sector_id)
    if sector is None:
        raise HTTPException(status_code=404, detail="Sector was not found.")
    sector.is_active = False
    db.add(sector)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Organizations: List → Create → Delete (tenant Read/Update are in organizations.py)
@router.get("/organizations", response_model=list[OrganizationListItem])
def list_organizations(_: Annotated[User, Depends(require_super_admin)], db: Database) -> list[OrganizationListItem]:
    organizations = db.exec(select(Organization).order_by(Organization.created_at.desc())).all()
    results: list[OrganizationListItem] = []
    for organization in organizations:
        settings = db.get(OrganizationSettings, organization.id)
        owner = db.exec(
            select(User)
            .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
            .where(
                OrganizationMembership.organization_id == organization.id,
                OrganizationMembership.role == Role.ORGANIZATION_ADMIN,
                OrganizationMembership.is_active,
            )
        ).first()
        sector_ids = db.exec(
            select(OrganizationSector.sector_id).where(
                OrganizationSector.organization_id == organization.id,
                OrganizationSector.is_active,
            )
        ).all()
        results.append(
            OrganizationListItem(
                id=organization.id,
                name=organization.name,
                slug=organization.slug,
                is_active=organization.is_active,
                created_at=organization.created_at,
                country=settings.country if settings else None,
                timezone=settings.timezone if settings else "UTC",
                owner_email=owner.email if owner else None,
                sector_ids=list(sector_ids),
            )
        )
    return results


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    _: Annotated[User, Depends(require_super_admin)],
    db: Database,
) -> dict[str, object]:
    owner_email = str(payload.owner_email).lower()
    if db.exec(select(Organization).where(Organization.slug == payload.slug)).first():
        raise HTTPException(status_code=409, detail="Organization slug already exists.")
    if db.exec(select(User).where(User.email == owner_email)).first():
        raise HTTPException(status_code=409, detail="Owner email already exists.")
    if payload.owner_username and db.exec(select(User).where(User.username == payload.owner_username)).first():
        raise HTTPException(status_code=409, detail="Owner username already exists.")
    requested_sector_ids = set(payload.sector_ids)
    sectors = db.exec(select(Sector).where(Sector.id.in_(requested_sector_ids), Sector.is_active)).all()
    if len(sectors) != len(requested_sector_ids):
        raise HTTPException(status_code=422, detail="One or more sectors are invalid.")
    organization = Organization(name=payload.name, slug=payload.slug)
    owner = User(
        email=owner_email,
        username=payload.owner_username,
        password_hash=password_hasher.hash(payload.owner_password),
    )
    db.add(organization)
    db.add(owner)
    db.flush()
    db.add(
        OrganizationMembership(
            organization_id=organization.id,
            user_id=owner.id,
            role=Role(payload.owner_role),
        )
    )
    db.add(
        OrganizationSettings(
            organization_id=organization.id,
            country=payload.country,
            timezone=payload.timezone,
        )
    )
    for sector_id in requested_sector_ids:
        db.add(OrganizationSector(organization_id=organization.id, sector_id=sector_id))
    db.commit()
    return {
        "organization_id": str(organization.id),
        "slug": organization.slug,
        "owner_id": str(owner.id),
        "owner_email": owner.email,
        "owner_username": owner.username,
        "owner_role": Role.ORGANIZATION_ADMIN.value,
        "sector_ids": [str(sector_id) for sector_id in requested_sector_ids],
    }


@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_organization(org_id: UUID, _: Annotated[User, Depends(require_super_admin)], db: Database) -> Response:
    organization = db.get(Organization, org_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization was not found.")
    organization.is_active = False
    db.add(organization)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)