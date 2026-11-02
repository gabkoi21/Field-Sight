"""Username verification uses the connected server and never invents private details."""

from unittest.mock import Mock

import httpx
import pytest

from app.core.kobo_users import verify_kobo_username


def test_verified_username_uses_encoded_path_and_server_token(monkeypatch):
    get = Mock(return_value=httpx.Response(200, json={"username": "collector+one"}))
    monkeypatch.setattr("app.core.kobo_users.httpx.get", get)
    verify_kobo_username("https://kf.kobotoolbox.org", "test-token", "collector+one")
    assert get.call_args.args == ("https://kf.kobotoolbox.org/api/v2/users/collector%2Bone/",)
    assert get.call_args.kwargs["headers"] == {"Authorization": "Token test-token"}
    assert get.call_args.kwargs["follow_redirects"] is False


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(404),
        httpx.Response(401),
        httpx.Response(403),
        httpx.Response(500),
        httpx.Response(302),
        httpx.Response(200, content="invalid"),
        httpx.Response(200, json={"username": "someone_else"}),
        httpx.Response(200, json=[]),
    ],
)
def test_invalid_provider_response_is_rejected(monkeypatch, response):
    monkeypatch.setattr("app.core.kobo_users.httpx.get", Mock(return_value=response))
    with pytest.raises(ValueError):
        verify_kobo_username("https://kf.kobotoolbox.org", "test-token", "collector")


def test_timeout_and_anonymous_account_are_rejected(monkeypatch):
    monkeypatch.setattr("app.core.kobo_users.httpx.get", Mock(side_effect=httpx.ConnectTimeout("timeout")))
    with pytest.raises(ValueError, match="could not be reached"):
        verify_kobo_username("https://kf.kobotoolbox.org", "test-token", "collector")
    with pytest.raises(ValueError, match="named Kobo"):
        verify_kobo_username("https://kf.kobotoolbox.org", "test-token", "AnonymousUser")
