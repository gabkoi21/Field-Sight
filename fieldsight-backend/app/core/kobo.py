"""KoboToolbox API verification and encrypted token storage helpers."""

from __future__ import annotations

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


def _kobo_assets(server_url: str, api_token: str) -> list[dict[str, object]]:
    try:
        response = httpx.get(
            f"{server_url}/api/v2/assets/?asset_type=survey",
            headers={"Authorization": f"Token {api_token}"},
            timeout=15.0,
            follow_redirects=False,
        )
    except httpx.HTTPError as exc:
        raise ValueError("KoboToolbox could not be reached. Check the server URL and try again.") from exc
    if response.status_code in {401, 403}:
        raise ValueError("Kobo rejected the API token.")
    if response.status_code >= 400:
        raise ValueError("KoboToolbox could not complete this request right now.")
    payload = response.json()
    results = payload.get("results", []) if isinstance(payload, dict) else []
    return [item for item in results if isinstance(item, dict)]


def verify_kobo_token(server_url: str, api_token: str) -> None:
    """Make a minimal read-only Kobo API v2 request to validate the token."""
    _kobo_assets(server_url, api_token)


def list_kobo_forms(server_url: str, api_token: str) -> list[dict[str, str | None]]:
    """Return Kobo survey forms without exposing the API token."""
    forms: list[dict[str, str | None]] = []
    for asset in _kobo_assets(server_url, api_token):
        form_id = asset.get("uid")
        name = asset.get("name")
        if isinstance(form_id, str) and isinstance(name, str):
            version = asset.get("version")
            forms.append({"id": form_id, "name": name, "version": str(version) if version else None})
    return forms


def delete_kobo_form(server_url: str, api_token: str, form_id: str) -> None:
    """Delete a Kobo survey asset and its provider-hosted submissions."""
    try:
        response = httpx.delete(
            f"{server_url}/api/v2/assets/{form_id}/",
            headers={"Authorization": f"Token {api_token}"},
            timeout=30.0,
            follow_redirects=False,
        )
    except httpx.HTTPError as exc:
        raise ValueError("KoboToolbox could not be reached. The local project was not deleted.") from exc
    if response.status_code == 404:
        return
    if response.status_code in {401, 403}:
        raise ValueError("Kobo rejected permission to delete this form. The local project was not deleted.")
    if response.status_code >= 400:
        raise ValueError("KoboToolbox could not delete this form. The local project was not deleted.")

def list_kobo_submissions(server_url: str, api_token: str, form_id: str) -> list[dict[str, object]]:
    """Fetch one Kobo form's submissions while keeping provider credentials server-side."""
    try:
        response = httpx.get(
            f"{server_url}/api/v2/assets/{form_id}/data/",
            params={"format": "json", "limit": 1000},
            headers={"Authorization": f"Token {api_token}"},
            timeout=30.0,
            follow_redirects=False,
        )
    except httpx.HTTPError as exc:
        raise ValueError("KoboToolbox could not be reached while importing submissions.") from exc
    if response.status_code in {401, 403}:
        raise ValueError("Kobo rejected the stored API token.")
    if response.status_code >= 400:
        raise ValueError("KoboToolbox could not download this form's submissions.")
    payload = response.json()
    results = payload.get("results", []) if isinstance(payload, dict) else payload
    return [item for item in results if isinstance(item, dict)] if isinstance(results, list) else []
