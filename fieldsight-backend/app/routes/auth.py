"""Authentication endpoints and current-user dependency."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import NoReturn
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import update
from sqlmodel import Session, col, select

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    hash_refresh_token,
    new_refresh_token,
    rotated_refresh_token,
    verify_password,
)
from app.db.session import get_session
from app.models.identity import Organization, OrganizationMembership, RefreshSession, Role, User
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth")
ROTATION_RECOVERY_SECONDS = 60


def _is_expired(value: datetime) -> bool:
    """Compare SQLite-naive and timezone-aware expiration values consistently."""
    normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return normalized <= datetime.now(UTC)


def _has_workspace_access(user: User, db: Session) -> bool:
    """Only platform and organization administrators use the FieldSight workspace."""
    if user.platform_role == Role.SUPER_ADMIN:
        return True
    return (
        db.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.role == Role.ORGANIZATION_ADMIN,
                OrganizationMembership.is_active,
            )
        ).first()
        is not None
    )


def _require_workspace_access(user: User, db: Session) -> None:
    if not _has_workspace_access(user, db):
        raise HTTPException(
            status_code=403,
            detail=(
                "FieldSight workspace access is limited to platform and organization administrators. "
                "Enumerators use KoboToolbox."
            ),
        )


def _set_tokens(response: Response, raw: str, record: RefreshSession, settings: Settings) -> TokenResponse:
    response.headers["Cache-Control"] = "no-store"
    remaining = max(0, int((_utc(record.expires_at) - datetime.now(UTC)).total_seconds()))
    response.set_cookie(
        "refresh_token",
        raw,
        httponly=True,
        secure=not settings.is_development,
        samesite="lax",
        max_age=remaining if record.remembered else None,
        path="/auth",
    )
    return TokenResponse(
        access_token=create_access_token(record.user_id, record.family_id or record.id, settings),
        remember=record.remembered,
    )


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _reject(request: Request, reason: str, code: int = 401) -> NoReturn:
    get_logger(__name__).info(
        "refresh_rejected",
        extra={"reason": reason, "request_id": request.state.request_id},
    )
    raise HTTPException(
        code,
        "Refresh session is invalid." if code == 401 else "Session renewal is in progress.",
        headers={"Retry-After": "1"} if code == 409 else None,
    )


def _check_origin(request: Request, settings: Settings) -> None:
    # Browser cookie endpoints must only accept requests from the configured web origins.
    origin = request.headers.get("origin")
    if request.headers.get("sec-fetch-site") == "cross-site" or (origin and origin not in settings.cors_origin_list):
        raise HTTPException(403, "Request origin is not allowed.")


# Why: exchanges valid user credentials for an authenticated API session.
@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    _check_origin(request, settings)
    user = db.exec(select(User).where((User.email == payload.login.lower()) | (User.username == payload.login))).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    _require_workspace_access(user, db)
    raw = new_refresh_token()
    record = RefreshSession(
        user_id=user.id,
        token_hash=hash_refresh_token(raw),
        remembered=payload.remember,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    )
    db.add(record)
    db.commit()
    return _set_tokens(response, raw, record, settings)


# Why: renews an expired access token without asking the user to sign in again.
@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    _check_origin(request, settings)
    if not refresh_token:
        _reject(request, "missing_cookie")
    record = db.exec(
        select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(refresh_token or ""))
    ).first()
    if record is None:
        _reject(request, "unknown_cookie")
    family_id = record.family_id or record.id
    # Lock the root with a conditional write, supported by both SQLite and PostgreSQL.
    locked = db.execute(
        update(RefreshSession)
        .where(
            col(RefreshSession.id) == family_id,
            col(RefreshSession.revoked_at).is_(None),
        )
        .values(revoked_at=None)
    )
    if locked.rowcount != 1:  # type: ignore[attr-defined]
        db.rollback()
        _reject(request, "revoked")
    db.refresh(record)
    if record.revoked_at or _is_expired(record.expires_at):
        db.rollback()
        _reject(request, "revoked" if record.revoked_at else "expired")
    if record.replaced_by_id:
        if (
            record.rotated_at
            and (datetime.now(UTC) - _utc(record.rotated_at)).total_seconds() <= ROTATION_RECOVERY_SECONDS
        ):
            # An aborted response may not have delivered Set-Cookie. Reconstruct the
            # same successor, rather than consuming another token or losing the session.
            raw = refresh_token or ""
            successor = record
            while successor.replaced_by_id:
                raw = rotated_refresh_token(raw, successor.replaced_by_id, settings)
                next_record = db.get(RefreshSession, successor.replaced_by_id)
                if next_record is None or next_record.revoked_at or _is_expired(next_record.expires_at):
                    db.rollback()
                    _reject(request, "revoked")
                successor = next_record
                if hash_refresh_token(raw) != successor.token_hash:
                    db.rollback()
                    _reject(request, "rotation_key_changed", 409)
            user = db.get(User, record.user_id)
            if user is None or not user.is_active:
                db.rollback()
                _reject(request, "inactive_account")
            _require_workspace_access(user, db)
            db.commit()
            return _set_tokens(response, raw, successor, settings)
        root = db.get(RefreshSession, family_id)
        if root:
            root.revoked_at = datetime.now(UTC)
            db.add(root)
            db.commit()
        _reject(request, "replay")
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        db.rollback()
        _reject(request, "inactive_account")
    _require_workspace_access(user, db)
    successor = RefreshSession(
        user_id=user.id,
        token_hash="pending",
        family_id=family_id,
        remembered=record.remembered,
        expires_at=record.expires_at,
    )
    raw = rotated_refresh_token(refresh_token or "", successor.id, settings)
    successor.token_hash = hash_refresh_token(raw)
    record.replaced_by_id = successor.id
    record.rotated_at = datetime.now(UTC)
    db.add_all([record, successor])
    db.commit()
    return _set_tokens(response, raw, successor, settings)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication is required.")
    try:
        claims = jwt.decode(
            authorization[7:],
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
        user_id, session_id = UUID(claims["sub"]), UUID(claims["sid"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Authentication is invalid.") from exc
    refresh, user = db.get(RefreshSession, session_id), db.get(User, user_id)
    if (
        refresh is None
        or refresh.revoked_at
        or _is_expired(refresh.expires_at)
        or refresh.user_id != user_id
        or user is None
        or not user.is_active
    ):
        raise HTTPException(status_code=401, detail="Authentication is invalid.")
    _require_workspace_access(user, db)
    return user


# Why: revokes the current refresh session when a user signs out.
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    _check_origin(request, settings)
    if refresh_token:
        record = db.exec(
            select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(refresh_token))
        ).first()
        if record:
            record = db.get(RefreshSession, record.family_id or record.id)
        if record and not record.revoked_at:
            record.revoked_at = datetime.now(UTC)
            db.add(record)
            db.commit()
    response.delete_cookie("refresh_token", path="/auth")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


# Why: gives the frontend the signed-in user and tenant membership context.
@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_session)) -> dict[str, object]:
    memberships = db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id, OrganizationMembership.is_active
        )
    ).all()
    membership_data = []
    for membership in memberships:
        organization = db.get(Organization, membership.organization_id)
        membership_data.append(
            {
                "organization_id": str(membership.organization_id),
                "organization_name": organization.name if organization else "Organization",
                "role": membership.role.value,
            }
        )
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "platform_role": user.platform_role,
        "memberships": membership_data,
    }
