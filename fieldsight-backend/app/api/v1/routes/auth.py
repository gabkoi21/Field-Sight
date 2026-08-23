"""Authentication endpoints and current-user dependency."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_refresh_token, new_refresh_token, verify_password
from app.db.session import get_session
from app.models.identity import OrganizationMembership, RefreshSession, User

router = APIRouter(prefix="/auth")


class LoginRequest(BaseModel):
    login: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


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
        path="/api/v1/auth",
    )
    return TokenResponse(access_token=create_access_token(user.id, refresh.id, settings))


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
    return _issue_tokens(response, user, db, settings)


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
    if record is None or record.revoked_at or record.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Refresh session is invalid.")
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Refresh session is invalid.")
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
    return user


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
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return response


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_session)) -> dict[str, object]:
    memberships = db.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id, OrganizationMembership.is_active
        )
    ).all()
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "platform_role": user.platform_role,
        "memberships": [{"organization_id": str(row.organization_id), "role": row.role.value} for row in memberships],
    }
