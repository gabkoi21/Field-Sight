"""Grant collection permissions or revoke one collector's direct form access."""

from typing import Any, Literal
from urllib.parse import quote, urlparse

import httpx

from app.core.kobo import normalize_kobo_server_url


def reconcile_collection_access(
    server: str,
    token: str,
    form_id: str,
    username: str,
    action: Literal["grant", "verify", "revoke"],
) -> str:
    """Reconcile the supplied account; revocation removes every direct form permission.

    Removing only Add submissions leaves View form behind and keeps the project
    visible in the collector's account. Never confirm revocation while any of
    this username's direct permissions remain.
    """
    server = normalize_kobo_server_url(server)
    asset_path = f"/api/v2/assets/{quote(form_id, safe='')}/"
    assignments_path = asset_path + "permission-assignments/"
    user_url = f"{server}/api/v2/users/{quote(username, safe='')}/"
    add_url = f"{server}/api/v2/permissions/add_submissions/"
    view_url = f"{server}/api/v2/permissions/view_asset/"

    with httpx.Client(headers={"Authorization": f"Token {token}"}, timeout=15, follow_redirects=False) as client:

        def request(method: str, path: str, **kwargs: Any) -> Any:
            try:
                response = client.request(method, server + path, **kwargs)
            except httpx.HTTPError:
                raise ValueError(
                    "Kobo could not be reached. The change may have completed; check access before retrying."
                ) from None
            if response.status_code in {401, 403}:
                raise ValueError("Kobo rejected access. The connection token must belong to a form owner or manager.")
            if method == "DELETE" and response.status_code == 404:
                return None  # Cascading permission removal may already remove this assignment.
            if response.status_code in {400, 404, 409}:
                raise ValueError(
                    "Kobo rejected the form, username or permission. Check the account exists on this server."
                )
            if not 200 <= response.status_code < 300:
                raise ValueError("Kobo could not complete the request. Check access before retrying.")
            if response.status_code == 204:
                return None
            try:
                return response.json()
            except ValueError:
                raise ValueError(
                    "Kobo returned an invalid permission response. Check access before retrying."
                ) from None

        asset = request("GET", asset_path)
        if not isinstance(asset, dict) or asset.get("uid") != form_id:
            raise ValueError("Kobo returned an unexpected form.")
        effective = asset.get("effective_permissions", [])
        if not isinstance(effective, list) or not any(
            isinstance(p, dict) and p.get("codename") == "manage_asset" for p in effective
        ):
            raise ValueError("The Kobo connection account needs Manage project permission to reconcile sharing safely.")
        if asset.get("owner") == user_url or username == "AnonymousUser":
            raise ValueError("Use a named collector account, not the form owner or AnonymousUser.")
        if action == "grant" and (not asset.get("has_deployment") or not asset.get("deployment__active")):
            raise ValueError("Deploy and activate the Kobo form before granting collection access.")
        assignable = asset.get("assignable_permissions", [])
        if not isinstance(assignable, list) or not any(
            isinstance(p, dict) and p.get("url") == add_url for p in assignable
        ):
            raise ValueError("This Kobo deployment does not advertise the supported collection permission.")

        def permissions() -> list[dict[str, Any]]:
            rows = request("GET", assignments_path)
            # Kobo's permission endpoint is explicitly unpaginated. Reject unexpected/incomplete shapes.
            if not isinstance(rows, list) or any(
                not isinstance(p, dict) or not all(isinstance(p.get(key), str) for key in ("user", "permission", "url"))
                for p in rows
            ):
                raise ValueError("Kobo returned an unsupported permission list; no access state can be verified.")
            anonymous = f"{server}/api/v2/users/AnonymousUser/"
            if any(p["user"] == anonymous and p["permission"] == add_url for p in rows):
                raise ValueError(
                    "This form allows anonymous submissions. Configure authenticated collection in Kobo first."
                )
            if action == "revoke" and any(p["user"] == anonymous and p["permission"] == view_url for p in rows):
                raise ValueError(
                    "This form is publicly visible. Disable public form sharing in Kobo before revoking form access."
                )
            if any(
                p["user"] == user_url and p["permission"] == f"{server}/api/v2/permissions/manage_asset/" for p in rows
            ):
                raise ValueError(
                    "This collector has broader project management access. Review it in KoboToolbox first."
                )
            return rows

        rows = permissions()
        target = [p for p in rows if p["user"] == user_url]
        if action == "grant":
            # Explicit View form also supports deployments whose project list
            # does not discover forms through calculated collection permissions.
            for required in (view_url, add_url):
                if not any(p["permission"] == required for p in target):
                    request("POST", assignments_path, json={"user": user_url, "permission": required})
        elif action == "revoke":
            paths = []
            # Remove all of this account's direct form permissions. View form is
            # removed last, since Kobo can cascade dependent permission removal.
            for permission in sorted(target, key=lambda permission: permission["permission"] == view_url):
                parsed = urlparse(permission["url"])
                expected = urlparse(server)
                suffix = parsed.path.removeprefix(assignments_path)
                if (
                    parsed.scheme != expected.scheme
                    or parsed.netloc != expected.netloc
                    or parsed.query
                    or parsed.fragment
                    or not parsed.path.startswith(assignments_path)
                    or not suffix.rstrip("/").isalnum()
                    or not suffix.endswith("/")
                ):
                    raise ValueError("Kobo returned an unsafe permission assignment URL.")
                paths.append(parsed.path)
            for path in paths:
                request("DELETE", path)
        # Always re-read; HTTP success alone is not proof that permission changed.
        target = [p for p in permissions() if p["user"] == user_url]
        has_add = any(p["permission"] == add_url for p in target)
        has_view = any(p["permission"] == view_url for p in target)
        if action == "revoke":
            if target:
                raise ValueError(
                    "Kobo still reports direct form access. "
                    "Revocation has not been confirmed; retry after checking sharing."
                )
            return "revoked"
        if action == "verify" and not target:
            return "revoked"
        if has_add and has_view:
            return "verified_granted"
        if action == "grant":
            raise ValueError("Kobo has not confirmed explicit View form and Add submissions. Check access or retry.")
        return "not_configured"
