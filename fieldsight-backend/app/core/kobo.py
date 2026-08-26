"""KoboToolbox API verification and encrypted token storage helpers."""

from __future__ import annotations

import base64
import hashlib
from urllib.parse import urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings

_KOBO_HOSTS = {"kf.kobotoolbox.org", "eu.kobotoolbox.org", "kc.kobotoolbox.org"}


def normalize_kobo_server_url(value: str) -> str:
    """Accept only Kobo's public HTTPS API hosts to prevent arbitrary outbound requests."""
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in _KOBO_HOSTS or parsed.query or parsed.fragment:
        raise ValueError("Use a supported KoboToolbox HTTPS server URL.")
    path = parsed.path.rstrip("/")
    if path not in {"", "/"}:
        raise ValueError("Kobo server URL must not include an API path.")
    return f"https://{parsed.hostname}"


def _fernet(settings: Settings) -> Fernet:
    if not settings.kobo_token_encryption_key:
        raise ValueError("Kobo token encryption is not configured.")
    return Fernet(settings.kobo_token_encryption_key.encode())


def encrypt_kobo_token(token: str, settings: Settings) -> str:
    return _fernet(settings).encrypt(token.encode()).decode()


def decrypt_kobo_token(value: str, settings: Settings) -> str:
    try:
        return _fernet(settings).decrypt(value.encode()).decode()
    except (InvalidToken, UnicodeDecodeError) as exc:
        raise ValueError("Stored Kobo credentials cannot be read.") from exc


def verify_kobo_token(server_url: str, api_token: str) -> None:
    """Make a minimal read-only Kobo API v2 request to validate the token."""
    try:
        response = httpx.get(
            f"{server_url}/api/v2/assets/?limit=1",
            headers={"Authorization": f"Token {api_token}"},
            timeout=10.0,
            follow_redirects=False,
        )
    except httpx.HTTPError as exc:
        raise ValueError("KoboToolbox could not be reached. Check the server URL and try again.") from exc
    if response.status_code in {401, 403}:
        raise ValueError("Kobo rejected the API token.")
    if response.status_code >= 400:
        raise ValueError("KoboToolbox could not verify this connection right now.")
