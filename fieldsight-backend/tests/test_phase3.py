from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import Settings
from app.core.security import create_access_token
from app.db.session import get_session
from app.main import create_app
from app.models.identity import (
    Organization,
    OrganizationMembership,
    OrganizationSector,
    RefreshSession,
    Role,
    Sector,
    User,
)


def test_tenant_boundary_and_project_sector_validation(tmp_path: object) -> None:
    database_path = tmp_path / "phase3.db"  # type: ignore[operator]
    engine = create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    settings = Settings(environment="test")

    with Session(engine) as db:
        user = User(email="admin@example.com", password_hash="unused")
        own_org = Organization(name="Own", slug="own")
        other_org = Organization(name="Other", slug="other")
        sector = Sector(code="health", name="Health")
        db.add_all([user, own_org, other_org, sector])
        db.commit()
        membership = OrganizationMembership(
            organization_id=own_org.id,
            user_id=user.id,
            role=Role.ORGANIZATION_ADMIN,
        )
        own_sector = OrganizationSector(organization_id=own_org.id, sector_id=sector.id)
        other_sector = OrganizationSector(organization_id=other_org.id, sector_id=sector.id)
        refresh = RefreshSession(
            user_id=user.id,
            token_hash="test-token-hash",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add_all([membership, own_sector, other_sector, refresh])
        db.commit()
        access_token = create_access_token(user.id, refresh.id, settings)
        own_org_id, other_org_id, other_sector_id = own_org.id, other_org.id, other_sector.id

    def override_session():  # type: ignore[no-untyped-def]
        with Session(engine) as db:
            yield db

    app = create_app(settings)
    app.dependency_overrides[get_session] = override_session
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {access_token}"}

    cross_tenant = client.get(f"/organizations/{other_org_id}", headers=headers)
    assert cross_tenant.status_code == 404

    invalid_sector = client.post(
        f"/organizations/{own_org_id}/projects",
        headers=headers,
        json={"name": "Invalid project", "organization_sector_id": str(other_sector_id)},
    )
    assert invalid_sector.status_code == 422
