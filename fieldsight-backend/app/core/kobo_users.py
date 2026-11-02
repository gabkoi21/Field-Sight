"""Verify a named Kobo account without requesting private account credentials."""

from urllib.parse import quote

import httpx

from app.core.kobo import normalize_kobo_server_url


def verify_kobo_username(server: str, token: str, username: str) -> None:
    server = normalize_kobo_server_url(server)
    if username == "AnonymousUser":
        raise ValueError("Enter a named Kobo account username.")
    try:
        response = httpx.get(
            f"{server}/api/v2/users/{quote(username, safe='')}/",
            headers={"Authorization": f"Token {token}"},
            timeout=15,
            follow_redirects=False,
        )
    except httpx.HTTPError:
        raise ValueError("Kobo could not be reached. Try adding the enumerator again.") from None
    if response.status_code == 404:
        raise ValueError("This Kobo username was not found on the project's Kobo server.")
    if response.status_code in {401, 403}:
        raise ValueError("Verify the project's Kobo connection before adding this username.")
    if response.status_code != 200:
        raise ValueError("Kobo could not verify this username. Try again later.")
    try:
        account = response.json()
    except ValueError:
        raise ValueError("Kobo returned an invalid account response. Try again later.") from None
    if not isinstance(account, dict) or account.get("username") != username:
        raise ValueError("Kobo returned an unexpected account. Check the username.")
