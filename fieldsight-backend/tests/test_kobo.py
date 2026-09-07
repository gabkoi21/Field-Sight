from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, password_hasher
from app.db.session import get_session
from app.main import create_app
from app.models.identity import Organization, OrganizationMembership, RefreshSession, Role, User
from app.models.operations import KoboConnection


def test_organization_admin_can_create_verified_encrypted_kobo_connection(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'kobo.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    settings = Settings(environment="test", kobo_token_encryption_key=Fernet.generate_key().decode())

    with Session(engine) as db:
        admin = User(
            email="owner@example.com",
            username="owner",
            password_hash=password_hasher.hash("OwnerPass123!"),
        )
        organization = Organization(name="Community Health", slug="community-health")
        db.add_all([admin, organization])
        db.flush()
        db.add(OrganizationMembership(organization_id=organization.id, user_id=admin.id, role=Role.ORGANIZATION_ADMIN))
        refresh = RefreshSession(
            user_id=admin.id,
            token_hash="kobo-test-refresh-token",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add(refresh)
        db.commit()
        token = create_access_token(admin.id, refresh.id, settings)

    def override_session():  # type: ignore[no-untyped-def]
        with Session(engine) as db:
            yield db

    app = create_app(settings)
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_settings] = lambda: settings
    client = TestClient(app)
    with patch("app.routes.kobo.verify_kobo_token") as verify:
        created = client.post(
            "/kobo/connections",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Wash project",
                "server_url": "https://kf.kobotoolbox.org",
                "api_token": "a" * 48,
            },
        )

    assert created.status_code == 201
    assert created.json()["is_verified"] is True
    assert "api_token" not in created.json()
    verify.assert_called_once()

    listed = client.get("/kobo/connections", headers={"Authorization": f"Bearer {token}"})
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "Wash project"

    with Session(engine) as db:
        stored = db.exec(select(KoboConnection)).one()
        assert stored.token_encrypted != "a" * 48
