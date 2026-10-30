"""Provider errors must not authenticate credentials or leak response bodies."""
from unittest.mock import patch

import httpx
import pytest

from app.core.kobo import delete_kobo_form, list_kobo_form_questions, verify_kobo_token

SERVER = "https://kf.kobotoolbox.org"


@pytest.mark.parametrize("operation", [verify_kobo_token, list_kobo_form_questions])
@pytest.mark.parametrize("response", [
    httpx.Response(302, headers={"location": "https://example.com"}),
    httpx.Response(200, text="private-provider-body"),
    httpx.Response(200, json=[]),
])
def test_invalid_provider_response_is_safe(operation, response):
    args = (SERVER, "private-token")
    if operation is list_kobo_form_questions:
        args += ("form-1",)
    with patch("app.core.kobo.httpx.get", return_value=response):
        with pytest.raises(ValueError) as error:
            operation(*args)
    assert "private" not in str(error.value)


@pytest.mark.parametrize("payload", [{}, {"results": None}, {"results": ["invalid"]}])
def test_invalid_form_list_cannot_verify_credentials(payload):
    with patch("app.core.kobo.httpx.get", return_value=httpx.Response(200, json=payload)):
        with pytest.raises(ValueError, match="invalid form list"):
            verify_kobo_token(SERVER, "private-token")


def test_redirect_does_not_report_successful_remote_deletion():
    with patch("app.core.kobo.httpx.delete", return_value=httpx.Response(302)):
        with pytest.raises(ValueError, match="local project was not deleted"):
            delete_kobo_form(SERVER, "private-token", "form-1")
