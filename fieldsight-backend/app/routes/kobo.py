"""Organization-admin KoboToolbox connection APIs."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.kobo import (
    decrypt_kobo_token,
    encrypt_kobo_token,
    list_kobo_forms,
    normalize_kobo_server_url,
    verify_kobo_token,
)
from app.db.session import get_session
from app.models.identity import OrganizationMembership, Role, User
from app.models.phase3 import KoboConnection, Project
from app.routes.auth import get_current_user
from app.schemas.kobo import (
    KoboConnectionCreate,
    KoboConnectionRead,
    KoboFormRead,
    KoboFormSelection,
    ProjectKoboFormSelection,
)

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


def _connection(connection_id: UUID, organization_id: UUID, db: Session) -> KoboConnection:
    connection = db.get(KoboConnection, connection_id)
    if connection is None or connection.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Kobo connection was not found.")
    if not connection.is_verified:
        raise HTTPException(status_code=422, detail="Kobo connection must be verified first.")
    return connection


def _read(connection: KoboConnection) -> KoboConnectionRead:
    return KoboConnectionRead(
        id=connection.id,
        name=connection.name,
        server_url=connection.server_url,
        is_verified=connection.is_verified,
        verified_at=connection.verified_at,
        selected_form_id=connection.selected_form_id,
        selected_form_name=connection.selected_form_name,
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


@router.get("/{connection_id}/forms", response_model=list[KoboFormRead], tags=["Kobo forms"])
def get_kobo_forms(
    connection_id: UUID,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[KoboFormRead]:
    organization_id = _organization_admin_id(user, db)
    connection = _connection(connection_id, organization_id, db)
    try:
        token = decrypt_kobo_token(connection.token_encrypted, settings)
        return [KoboFormRead(**form) for form in list_kobo_forms(connection.server_url, token)]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.put("/{connection_id}/selected-form", response_model=KoboConnectionRead, tags=["Kobo forms"])
def select_kobo_form(
    connection_id: UUID,
    payload: KoboFormSelection,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> KoboConnectionRead:
    organization_id = _organization_admin_id(user, db)
    connection = _connection(connection_id, organization_id, db)
    try:
        token = decrypt_kobo_token(connection.token_encrypted, settings)
        forms = list_kobo_forms(connection.server_url, token)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    selected = next((form for form in forms if form["id"] == payload.form_id), None)
    if selected is None:
        raise HTTPException(status_code=422, detail="Select a form that exists in this Kobo connection.")
    connection.selected_form_id = payload.form_id
    connection.selected_form_name = selected["name"] or payload.form_name
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return _read(connection)


@router.put("/projects/{project_id}/form", response_model=KoboConnectionRead, tags=["Kobo forms"])
def assign_kobo_form_to_project(
    project_id: UUID,
    payload: ProjectKoboFormSelection,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> KoboConnectionRead:
    """Assign a Kobo form to one project; other projects keep their own form."""
    organization_id = _organization_admin_id(user, db)
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Project was not found.")
    connection = _connection(payload.connection_id, organization_id, db)
    try:
        token = decrypt_kobo_token(connection.token_encrypted, settings)
        forms = list_kobo_forms(connection.server_url, token)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    selected = next((form for form in forms if form["id"] == payload.form_id), None)
    if selected is None:
        raise HTTPException(status_code=422, detail="Select a form that exists in this Kobo connection.")
    project.kobo_connection_id = connection.id
    project.kobo_form_id = payload.form_id
    project.kobo_form_name = selected["name"]
    db.add(project)
    db.commit()
    return _read(connection)