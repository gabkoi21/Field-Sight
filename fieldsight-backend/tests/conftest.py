"""Tests must never fall through to a live provider request."""

import httpx
import pytest


@pytest.fixture(autouse=True)
def block_live_http(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("Live HTTP is disabled in tests; use a mocked provider transport.")

    async def async_blocked(*args, **kwargs):
        raise AssertionError("Live HTTP is disabled in tests; use a mocked provider transport.")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", async_blocked)
