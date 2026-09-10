"""Authentication endpoints and current-user dependency."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response, status
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_refresh_token, new_refresh_token, verify_password
from app.db.session import get_session
from app.models.identity import Organization, OrganizationMembership, RefreshSession, Role, User
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth")


def _is_expired(value: datetime) -> bool:
    """Compare SQLite-naive and timezone-aware expiration values consistently."""
    normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return normalized <= datetime.now(UTC)


def _has_workspace_access(user: User, db: Session) -> bool:
    """Only platform and organization administrators use the FieldSight workspace."""
    if user.platform_role == Role.SUPER_ADMIN:
        return True
    return db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.role == Role.ORGANIZATION_ADMIN,
            OrganizationMembership.is_active,
        )
    ).first() is not None


def _require_workspace_access(user: User, db: Session) -> None:
    if not _has_workspace_access(user, db):
        raise HTTPException(
            status_code=403,
            detail=(
                "FieldSight workspace access is limited to platform and organization administrators. "
                "Enumerators use KoboToolbox."
            ),
        )


def _issue_tokens(response: Response, user: User, db: Session, settings: Settings) -> TokenResponse:
    raw = new_refresh_token()
    refresh = RefreshSession(
        user_id=user.id,
        token_hash=hash_refresh_token(raw),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    )
    db.add(refresh)
    db.commit()
    response.set_cookie(
        "refresh_token",
        raw,
        httponly=True,
        secure=not settings.is_development,
        samesite="lax",
        max_age=settings.refresh_token_days * 86400,
        path="/auth",
    )
    return TokenResponse(access_token=create_access_token(user.id, refresh.id, settings))


# Why: exchanges valid user credentials for an authenticated API session.
@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = db.exec(select(User).where((User.email == payload.login.lower()) | (User.username == payload.login))).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    _require_workspace_access(user, db)
    return _issue_tokens(response, user, db, settings)


# Why: renews an expired access token without asking the user to sign in again.
@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh session is required.")
    record = db.exec(
        select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(refresh_token))
    ).first()
    if record is None or record.revoked_at or _is_expired(record.expires_at):
        raise HTTPException(status_code=401, detail="Refresh session is invalid.")
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Refresh session is invalid.")
    _require_workspace_access(user, db)
    record.revoked_at = datetime.now(UTC)
    db.add(record)
    return _issue_tokens(response, user, db, settings)


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
    if refresh is None or refresh.revoked_at or user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Authentication is invalid.")
    _require_workspace_access(user, db)
    return user


# Why: revokes the current refresh session when a user signs out.
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response, refresh_token: str | None = Cookie(default=None), db: Session = Depends(get_session)
) -> Response:
    if refresh_token:
        record = db.exec(
            select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(refresh_token))
        ).first()
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
