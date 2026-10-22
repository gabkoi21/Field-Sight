"""KoboToolbox API verification and encrypted token storage helpers."""

from __future__ import annotations

from urllib.parse import quote, urljoin, urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings

_KOBO_HOSTS = {"kf.kobotoolbox.org", "eu.kobotoolbox.org", "kc.kobotoolbox.org"}
_SYSTEM_QUESTION_PATHS = {
    "start",
    "end",
    "formhub/uuid",
    "meta/instanceID",
    "meta/rootUuid",
    "meta/instanceName",
    "meta/deprecatedID",
}


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


def list_kobo_form_questions(server_url: str, api_token: str, form_id: str) -> list[dict[str, str]]:
    """Return selectable survey questions from an assigned Kobo form."""
    try:
        response = httpx.get(
            f"{server_url}/api/v2/assets/{form_id}/",
            headers={"Authorization": f"Token {api_token}"},
            timeout=15.0,
            follow_redirects=False,
        )
    except httpx.HTTPError as exc:
        raise ValueError("KoboToolbox could not be reached while reading this form.") from exc
    if response.status_code in {401, 403}:
        raise ValueError("Kobo rejected the stored API token.")
    if response.status_code == 404:
        raise ValueError("The assigned Kobo form was not found.")
    if response.status_code >= 400:
        raise ValueError("KoboToolbox could not read this form right now.")
    payload = response.json()
    content = payload.get("content", {}) if isinstance(payload, dict) else {}
    survey = content.get("survey", []) if isinstance(content, dict) else []
    if not isinstance(survey, list):
        return []
    non_questions = {"begin_group", "end_group", "begin_repeat", "end_repeat", "note", "calculate", "start", "end"}
    questions: list[dict[str, str]] = []
    for item in survey:
        if not isinstance(item, dict) or str(item.get("type", "")) in non_questions:
            continue
        name = item.get("name")
        xpath = item.get("$xpath")
        if not isinstance(name, str) or not name:
            continue
        source_field = name
        if isinstance(xpath, str) and xpath.strip("/"):
            parts = [part for part in xpath.strip("/").split("/") if part]
            if len(parts) > 1:
                source_field = "/".join(parts[1:])
        if source_field in _SYSTEM_QUESTION_PATHS:
            continue
        label = item.get("label")
        if isinstance(label, list):
            label = next((value for value in label if isinstance(value, str) and value), None)
        questions.append({"source_field": source_field, "label": str(label or name)})
    return questions


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
    """Read every v2 page, or fail without returning a partial import.

    Never forward the stored token to a provider-supplied URL outside this
    server and form. Bound pagination and reject repeated URLs/records.
    """
    server_url = normalize_kobo_server_url(server_url)
    path = f"/api/v2/assets/{quote(form_id, safe='')}/data/"
    url = f"{server_url}{path}?format=json&limit=1000"
    visited: set[str] = set()
    identifiers: set[str] = set()
    submissions: list[dict[str, object]] = []
    expected_count: int | None = None
    for _ in range(10_000):
        try:
            parsed = urlparse(url)
            request_url = httpx.URL(url)
        except (ValueError, httpx.InvalidURL) as exc:
            raise ValueError("Kobo returned an invalid submission pagination URL.") from exc
        if (
            parsed.scheme != "https"
            or parsed.netloc != urlparse(server_url).netloc
            or parsed.path not in {path, path.rstrip("/") + ".json"}
            or parsed.fragment
        ):
            raise ValueError("Kobo returned an unsafe submission pagination URL.")
        canonical_url = str(request_url.copy_with(query=b"")) + str(sorted(request_url.params.multi_items()))
        if canonical_url in visited:
            raise ValueError("Kobo returned a repeated submission page. Import was not completed.")
        visited.add(canonical_url)
        try:
            response = httpx.get(
                url,
                headers={"Authorization": f"Token {api_token}"},
                timeout=30.0,
                follow_redirects=False,
            )
        except httpx.HTTPError as exc:
            raise ValueError("KoboToolbox could not be reached while importing submissions.") from exc
        if response.status_code in {401, 403}:
            raise ValueError("Kobo rejected the stored API token.")
        if not 200 <= response.status_code < 300:
            raise ValueError("KoboToolbox could not download this form's submissions.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise ValueError("Kobo returned invalid JSON. Import was not completed.") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("results"), list) or "next" not in payload:
            raise ValueError("Kobo returned an invalid submission page. Import was not completed.")
        count = payload.get("count")
        if count is not None:
            if type(count) is not int or count < 0 or (expected_count is not None and count != expected_count):
                raise ValueError("Kobo submission totals changed or are invalid. Retry the full import.")
            expected_count = count
        for item in payload["results"]:
            if not isinstance(item, dict):
                raise ValueError("Kobo returned an invalid submission record. Import was not completed.")
            # Kobo v2 supplies _id. Reject overlapping/repeated pages rather
            # than counting them as successfully downloaded distinct records.
            if item.get("_id") is not None:
                identifier = str(item["_id"])
                if identifier in identifiers:
                    raise ValueError("Kobo returned duplicate submission IDs. Retry the full import.")
                identifiers.add(identifier)
            submissions.append(item)
        next_url = payload["next"]
        if next_url is None:
            if expected_count is not None and len(submissions) != expected_count:
                raise ValueError("Kobo returned an incomplete submission download. Retry the full import.")
            return submissions
        if not isinstance(next_url, str) or not next_url or not payload["results"]:
            raise ValueError("Kobo returned invalid submission pagination. Import was not completed.")
        try:
            url = urljoin(url, next_url)
        except ValueError as exc:
            raise ValueError("Kobo returned an invalid submission pagination URL.") from exc
    raise ValueError("Kobo submission pagination exceeded the safety limit. Import was not completed.")
