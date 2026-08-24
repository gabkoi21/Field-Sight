from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import Settings
from app.core.security import create_access_token, password_hasher
from app.db.session import get_session
from app.main import create_app
from app.models.identity import OrganizationMembership, RefreshSession, Role, Sector, User


def test_create_organization_also_creates_active_admin(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'administration.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    settings = Settings(environment="test")

    with Session(engine) as db:
        super_admin = User(
            email="super@example.com",
            password_hash=password_hasher.hash("SuperAdmin123!"),
            platform_role=Role.SUPER_ADMIN,
        )
        sector = Sector(code="health", name="Health")
        db.add_all([super_admin, sector])
        db.commit()
        refresh = RefreshSession(
            user_id=super_admin.id,
            token_hash="administration-test-token",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add(refresh)
        db.commit()
        token = create_access_token(super_admin.id, refresh.id, settings)
        sector_id = sector.id

    def override_session():  # type: ignore[no-untyped-def]
        with Session(engine) as db:
            yield db

    app = create_app(settings)
    app.dependency_overrides[get_session] = override_session
    response = TestClient(app).post(
        "/api/v1/organizations",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Community Health Initiative",
            "slug": "community-health-demo",
            "owner_email": "owner@example.com",
            "owner_username": "edu@gmail.com",
            "owner_password": "OwnerPass123!",
            "sector_ids": [str(sector_id)],
            "country": "Liberia",
            "timezone": "Africa/Monrovia",
        },
    )

    assert response.status_code == 201
    assert response.json()["owner_role"] == "organization_admin"

    listed = TestClient(app).get("/api/v1/organizations", headers={"Authorization": f"Bearer {token}"})
    assert listed.status_code == 200
    organization = listed.json()[0]
    assert organization["country"] == "Liberia"
    assert organization["timezone"] == "Africa/Monrovia"
    assert organization["owner_email"] == "owner@example.com"
    assert organization["sector_ids"] == [str(sector_id)]

    updated = TestClient(app).patch(
        f"/api/v1/organizations/{response.json()['organization_id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Community Health Initiative Updated",
            "slug": "community-health-updated",
            "country": "Ghana",
            "timezone": "Africa/Accra",
            "sector_ids": [],
        },
    )
    assert updated.status_code == 200

    relisted = TestClient(app).get("/api/v1/organizations", headers={"Authorization": f"Bearer {token}"})
    updated_organization = relisted.json()[0]
    assert updated_organization["name"] == "Community Health Initiative Updated"
    assert updated_organization["slug"] == "community-health-updated"
    assert updated_organization["country"] == "Ghana"
    assert updated_organization["timezone"] == "Africa/Accra"
    assert updated_organization["sector_ids"] == []
    with Session(engine) as db:
        owner = db.exec(select(User).where(User.email == "owner@example.com")).one()
        membership = db.exec(select(OrganizationMembership).where(OrganizationMembership.user_id == owner.id)).one()
        assert owner.username == "edu@gmail.com"
        assert membership.is_active
        assert membership.role == Role.ORGANIZATION_ADMIN
        assert password_hasher.verify("OwnerPass123!", owner.password_hash)
