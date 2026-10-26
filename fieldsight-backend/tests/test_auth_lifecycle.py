"""Authentication regressions against disposable SQLite data."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import Settings
from app.core.security import hash_refresh_token, password_hasher
from app.db.session import get_session
from app.main import create_app
from app.models.identity import Organization, OrganizationMembership, RefreshSession, Role, User


@pytest.fixture
def auth(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'sessions.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    settings = Settings(environment="test", log_level="WARNING")
    with Session(engine) as db:
        user = User(email="admin@example.com", password_hash=password_hasher.hash("SyntheticPassword123!"))
        org = Organization(name="Synthetic", slug="synthetic")
        db.add_all([user, org])
        db.flush()
        db.add(OrganizationMembership(user_id=user.id, organization_id=org.id, role=Role.ORGANIZATION_ADMIN))
        db.commit()
        uid = user.id

    def sessions():
        with Session(engine) as db:
            yield db

    app = create_app(settings)
    app.dependency_overrides[get_session] = sessions
    with TestClient(app) as client:
        yield client, engine, uid, app, settings
    engine.dispose()


def sign_in(client, remember=True):
    response = client.post(
        "/auth/login", json={"login": "admin@example.com", "password": "SyntheticPassword123!", "remember": remember}
    )
    assert response.status_code == 200
    return response


def bearer(response):
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_rotation_preserves_access_and_logout_revokes_family(auth):
    client, engine, uid, app, settings = auth
    first = sign_in(client)
    second = client.post("/auth/refresh")
    assert second.status_code == 200
    assert client.get("/auth/me", headers=bearer(first)).status_code == 200
    assert client.get("/auth/me", headers=bearer(second)).status_code == 200
    claims = jwt.decode(
        second.json()["access_token"], settings.jwt_secret, algorithms=["HS256"], audience=settings.jwt_audience
    )
    assert claims["exp"] - claims["iat"] == 900
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me", headers=bearer(first)).status_code == 401
    assert client.get("/auth/me", headers=bearer(second)).status_code == 401
    assert client.post("/auth/refresh").status_code == 401


@pytest.mark.parametrize("condition", ["missing", "unknown", "expired", "revoked", "inactive", "password"])
def test_invalid_sessions(auth, condition):
    client, engine, uid, app, settings = auth
    sign_in(client)
    if condition == "missing":
        client.cookies.clear()
    elif condition == "unknown":
        client.cookies.clear()
        client.cookies.set("refresh_token", "synthetic-invalid", path="/auth")
    else:
        with Session(engine) as db:
            record = db.exec(select(RefreshSession)).one()
            if condition == "expired":
                record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            elif condition in {"revoked", "password"}:
                record.revoked_at = datetime.now(UTC)
            else:
                user = db.get(User, uid)
                user.is_active = False
                db.add(user)
            db.add(record)
            db.commit()
    assert client.post("/auth/refresh").status_code == 401


@pytest.mark.parametrize("remember", [False, True])
def test_cookie_attributes_and_restore(auth, remember):
    client, engine, uid, app, settings = auth
    response = sign_in(client, remember)
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/auth" in cookie
    assert ("Max-Age=" in cookie) is remember
    renewed = client.post("/auth/refresh")
    assert renewed.status_code == 200 and renewed.json()["remember"] is remember
    assert client.get("/auth/me", headers=bearer(renewed)).status_code == 200


def test_competing_refresh_is_atomic_and_old_cookie_cannot_replay(auth):
    client, engine, uid, app, settings = auth
    first = sign_in(client)
    cookie = client.cookies.get("refresh_token")

    def rotate(_):
        with TestClient(app) as other:
            other.cookies.set("refresh_token", cookie, path="/auth")
            return other.post("/auth/refresh")

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(rotate, range(2)))
    assert [r.status_code for r in responses] == [200, 200]
    assert responses[0].cookies.get("refresh_token") == responses[1].cookies.get("refresh_token")
    with Session(engine) as db:
        records = db.exec(select(RefreshSession)).all()
        assert len(records) == 2
        old = db.exec(select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(cookie))).one()
        old.rotated_at = datetime.now(UTC) - timedelta(seconds=61)
        db.add(old)
        db.commit()
    replay = rotate(0)
    assert replay.status_code == 401
    assert client.get("/auth/me", headers=bearer(first)).status_code == 401


def test_origin_rejected_without_rotating(auth):
    client, engine, uid, app, settings = auth
    sign_in(client)
    assert client.post("/auth/refresh", headers={"Origin": "https://untrusted.example"}).status_code == 403
    assert client.post("/auth/refresh", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
    assert client.post("/auth/refresh").status_code == 200


def test_password_change_revokes_rotated_and_independent_sessions(auth):
    client, engine, uid, app, settings = auth
    original = sign_in(client)
    rotated = client.post("/auth/refresh")
    another = sign_in(client)
    changed = client.post(
        "/auth/change-password",
        headers=bearer(rotated),
        json={
            "current_password": "SyntheticPassword123!",
            "new_password": "SyntheticChanged456!",
        },
    )
    assert changed.status_code == 200
    for response in [original, rotated, another]:
        assert client.get("/auth/me", headers=bearer(response)).status_code == 401
    assert client.post("/auth/refresh").status_code == 401


def test_diagnostics_are_sanitized_and_correlated(auth, caplog):
    import logging

    client, engine, uid, app, settings = auth
    with caplog.at_level(logging.INFO):
        response = client.post("/auth/refresh", headers={"X-Request-ID": "untrusted-value"})
    record = next(r for r in caplog.records if r.getMessage() == "refresh_rejected")
    assert record.reason == "missing_cookie"
    assert record.request_id == response.headers["x-request-id"]
    assert record.request_id != "untrusted-value"
    assert "password" not in caplog.text.lower()
    assert "token_hash" not in caplog.text


def test_production_cookie_keeps_secure_defaults():
    from cryptography.fernet import Fernet
    from fastapi import Response
    from uuid import uuid4
    from app.routes.auth import _set_tokens

    settings = Settings(
        environment="production",
        jwt_secret="s" * 64,
        kobo_token_encryption_key=Fernet.generate_key().decode(),
        cors_origins="https://app.example.com",
    )
    response = Response()
    record = RefreshSession(
        user_id=uuid4(), token_hash="synthetic", remembered=True, expires_at=datetime.now(UTC) + timedelta(days=14)
    )
    _set_tokens(response, "synthetic", record, settings)
    cookie = response.headers["set-cookie"]
    assert "Secure" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert response.headers["cache-control"] == "no-store"


def test_lost_refresh_response_recovers_same_successor_within_grace(auth):
    client, engine, uid, app, settings = auth
    sign_in(client)
    original_cookie = client.cookies.get("refresh_token")
    first = client.post("/auth/refresh")
    client.cookies.clear()
    client.cookies.set("refresh_token", original_cookie, path="/auth")
    recovered = client.post("/auth/refresh")
    assert recovered.status_code == 200
    assert recovered.cookies.get("refresh_token") == first.cookies.get("refresh_token")
    with Session(engine) as db:
        assert len(db.exec(select(RefreshSession)).all()) == 2
