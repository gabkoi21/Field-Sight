"""Password and token helpers; raw refresh tokens are never persisted."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import Settings

password_hasher = PasswordHash.recommended()


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def create_access_token(user_id: UUID, session_id: UUID, settings: Settings) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "sid": str(session_id),
        "jti": str(uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def rotated_refresh_token(previous: str, successor_id: UUID, settings: Settings) -> str:
    """Reconstruct only the immediate successor during bounded lost-response recovery."""
    message = f"fieldsight-refresh-rotation:{successor_id}:{previous}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()
