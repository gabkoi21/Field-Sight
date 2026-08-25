from fastapi.testclient import TestClient

from app.main import create_app


def test_liveness_probe_returns_ok() -> None:
    response = TestClient(create_app()).get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"]


def test_versioned_status_returns_non_sensitive_metadata() -> None:
    response = TestClient(create_app()).get("/status")

    assert response.status_code == 200
    assert response.json()["api_version"] == "v1"
    assert response.json()["service"] == "FieldSight API"
