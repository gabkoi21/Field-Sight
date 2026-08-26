"""Organization-admin KoboToolbox connection APIs."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.kobo import encrypt_kobo_token, normalize_kobo_server_url, verify_kobo_token
from app.db.session import get_session
from app.models.identity import OrganizationMembership, Role, User
from app.models.phase3 import KoboConnection
from app.routes.auth import get_current_user
from app.schemas.kobo import KoboConnectionCreate, KoboConnectionRead

router = APIRouter(prefix="/kobo/connections")
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _organization_admin_id(user: User, db: Session) -> UUID:
    memberships = db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.role == Role.ORGANIZATION_ADMIN,
            OrganizationMembership.is_active,
        )
    ).all()
    if len(memberships) != 1:
        raise HTTPException(status_code=403, detail="An active organization administrator membership is required.")
    return memberships[0].organization_id


def _read(connection: KoboConnection) -> KoboConnectionRead:
    return KoboConnectionRead(
        id=connection.id,
        name=connection.name,
        server_url=connection.server_url,
        is_verified=connection.is_verified,
        verified_at=connection.verified_at,
        created_at=connection.created_at,
    )


@router.get("", response_model=list[KoboConnectionRead], tags=["Kobo connections"])
def list_kobo_connections(user: CurrentUser, db: Database) -> list[KoboConnectionRead]:
    organization_id = _organization_admin_id(user, db)
    connections = db.exec(
        select(KoboConnection)
        .where(KoboConnection.organization_id == organization_id)
        .order_by(KoboConnection.created_at.desc())
    ).all()
    return [_read(connection) for connection in connections]


@router.post("", response_model=KoboConnectionRead, status_code=status.HTTP_201_CREATED, tags=["Kobo connections"])
def create_kobo_connection(
    payload: KoboConnectionCreate,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> KoboConnectionRead:
    organization_id = _organization_admin_id(user, db)
    try:
        server_url = normalize_kobo_server_url(str(payload.server_url))
        verify_kobo_token(server_url, payload.api_token)
        encrypted_token = encrypt_kobo_token(payload.api_token, settings)
    except ValueError as exc:
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE if "encryption" in str(exc).lower() else 422
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    connection = KoboConnection(
        organization_id=organization_id,
        name=payload.name.strip(),
        server_url=server_url,
        token_encrypted=encrypted_token,
        is_verified=True,
        verified_at=datetime.now(UTC),
        created_by_id=user.id,
    )
    db.add(connection)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A Kobo connection with this name already exists.") from exc
    db.refresh(connection)
    return _read(connection)
