"""Super-admin platform resources, grouped in CRUD order."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, col, select

from app.core.security import password_hasher
from app.db.session import get_session
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role, Sector, User
from app.models.operations import OrganizationAdminEvent, OrganizationSettings, Project, Submission
from app.routes.auth import get_current_user
from app.schemas.administration import (
    OrganizationCreate,
    OrganizationListItem,
    OrganizationStatusUpdate,
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


@router.get("/administration/overview")
def platform_overview(_: Annotated[User, Depends(require_super_admin)], db: Database) -> dict[str, int]:
    """Count stored accounts once, including inactive/unassigned and Super Admin accounts.

    Projects include every status and organization, including private projects and
    suspended tenants. No tenant records or private project details are returned.
    """
    from sqlalchemy import func

    totals = db.exec(
        select(
            select(func.count()).select_from(Organization).scalar_subquery(),
            select(func.count()).select_from(User).scalar_subquery(),
            select(func.count()).select_from(Organization).where(Organization.is_active).scalar_subquery(),
            select(func.count()).select_from(Project).scalar_subquery(),
        )
    ).one()
    return dict(
        zip(
            ("total_organizations", "total_platform_users", "active_organizations", "total_projects"),
            totals,
            strict=True,
        )
    )


# Users: platform-wide directory for Super Admin access management.
@router.get("/users", response_model=list[UserDirectoryItem])
def list_users(_: Annotated[User, Depends(require_super_admin)], db: Database) -> list[UserDirectoryItem]:
    users = db.exec(select(User).order_by(col(User.created_at).desc())).all()
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


@router.get("/administration/sectors")
def platform_sectors(_: Annotated[User, Depends(require_super_admin)], db: Database) -> list[Sector]:
    return list(db.exec(select(Sector).order_by(Sector.name)).all())


# Sectors: Create Ã¢â€ â€™ Read Ã¢â€ â€™ Update Ã¢â€ â€™ Delete (list is public-to-authenticated in sectors.py)
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


# Organizations: List Ã¢â€ â€™ Create Ã¢â€ â€™ Delete (tenant Read/Update are in organizations.py)
@router.get("/organizations", response_model=list[OrganizationListItem])
def list_organizations(_: Annotated[User, Depends(require_super_admin)], db: Database) -> list[OrganizationListItem]:
    organizations = db.exec(select(Organization).order_by(col(Organization.created_at).desc())).all()
    results: list[OrganizationListItem] = []
    for organization in organizations:
        settings = db.get(OrganizationSettings, organization.id)
        owner = db.exec(
            select(User)
            .join(OrganizationMembership, col(OrganizationMembership.user_id) == col(User.id))
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
                user_count=len(
                    db.exec(
                        select(OrganizationMembership.user_id).where(
                            OrganizationMembership.organization_id == organization.id, OrganizationMembership.is_active
                        )
                    ).all()
                ),
                project_count=len(db.exec(select(Project.id).where(Project.organization_id == organization.id)).all()),
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
    sectors = db.exec(select(Sector).where(col(Sector.id).in_(requested_sector_ids), Sector.is_active)).all()
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


@router.get("/administration/events")
def platform_events(
    _: Annotated[User, Depends(require_super_admin)],
    db: Database,
    q: str = "",
    start: datetime | None = None,
    end: datetime | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
) -> dict[str, object]:
    """Recorded organization administration only; no secrets or invented history."""
    from sqlalchemy import func, or_

    statement = (
        select(OrganizationAdminEvent, User.email, Organization.name)
        .join(User, User.id == OrganizationAdminEvent.actor_id)
        .join(Organization, Organization.id == OrganizationAdminEvent.organization_id)
    )
    if q.strip():
        pattern = "%" + q.strip() + "%"
        statement = statement.where(
            or_(
                col(User.email).ilike(pattern),
                col(Organization.name).ilike(pattern),
                col(OrganizationAdminEvent.action).ilike(pattern),
                col(OrganizationAdminEvent.resource_id).ilike(pattern),
            )
        )
    if start is not None:
        statement = statement.where(OrganizationAdminEvent.occurred_at >= start)
    if end is not None:
        statement = statement.where(OrganizationAdminEvent.occurred_at <= end)
    total = db.exec(select(func.count()).select_from(statement.subquery())).one()
    rows = db.exec(
        statement.order_by(col(OrganizationAdminEvent.occurred_at).desc(), col(OrganizationAdminEvent.id).desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "total": total,
        "items": [
            {
                "id": str(event.id),
                "actor": email,
                "action": event.action,
                "target": event.resource_id,
                "organization": name,
                "occurred_at": event.occurred_at,
            }
            for event, email, name in rows
        ],
    }


@router.patch("/administration/organizations/{org_id}/status")
def change_organization_status(
    org_id: UUID, payload: OrganizationStatusUpdate, actor: Annotated[User, Depends(require_super_admin)], db: Database
) -> dict[str, bool]:
    organization = db.get(Organization, org_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization was not found.")
    if organization.is_active != payload.is_active:
        organization.is_active = payload.is_active
        db.add(organization)
        db.add(
            OrganizationAdminEvent(
                organization_id=org_id,
                actor_id=actor.id,
                action="organization.restored" if payload.is_active else "organization.suspended",
                resource_id=str(org_id),
            )
        )
        db.commit()
    return {"is_active": organization.is_active}


@router.get("/administration/activity/monthly")
def monthly_organization_activity(
    _: Annotated[User, Depends(require_super_admin)],
    db: Database,
    year: int = Query(ge=2000, le=2100),
) -> dict[str, object]:
    """Monthly leaders by dated submission count; ties use organization ID."""
    from sqlalchemy import extract, func

    dated_at = (
        func.timezone("UTC", Submission.submitted_at)
        if db.get_bind().dialect.name == "postgresql"
        else Submission.submitted_at
    )
    month = extract("month", dated_at)
    count = func.count(Submission.id)
    rows = db.exec(
        select(month, Organization.id, Organization.name, count)
        .join(Organization, Organization.id == Submission.organization_id)
        .where(
            Submission.submitted_at >= datetime(year, 1, 1, tzinfo=UTC),
            Submission.submitted_at < datetime(year + 1, 1, 1, tzinfo=UTC),
        )
        .group_by(month, Organization.id, Organization.name)
        .order_by(month, count.desc(), Organization.id)
    ).all()
    years = db.exec(select(extract("year", dated_at)).where(Submission.submitted_at.is_not(None)).distinct()).all()
    by_month: dict[int, list[tuple[object, ...]]] = {}
    for row in rows:
        by_month.setdefault(int(row[0]), []).append(row)
    months = []
    for number in range(1, 13):
        activity = by_month.get(number, [])
        leader = activity[0] if activity else None
        months.append(
            {
                "month": number,
                "organization_id": str(leader[1]) if leader else None,
                "organization_name": leader[2] if leader else None,
                "submissions": int(leader[3]) if leader else 0,
                "tied_organizations": sum(row[3] == leader[3] for row in activity) if leader else 0,
            }
        )
    return {
        "year": year,
        "available_years": sorted(
            {int(value) for value in years if value is not None and 2000 <= int(value) <= 2100} | {year}, reverse=True
        ),
        "months": months,
    }
