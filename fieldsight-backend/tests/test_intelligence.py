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
from app.models.operations import Project


def test_admin_can_configure_project_intelligence(tmp_path: object) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'intelligence.db'}",  # type: ignore[operator]
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    settings = Settings(environment="test")

    with Session(engine) as db:
        user = User(email="admin@example.com", password_hash="unused")
        organization = Organization(name="Community Health", slug="community-health")
        sector = Sector(code="health", name="Health")
        db.add_all([user, organization, sector])
        db.flush()
        membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=user.id,
            role=Role.ORGANIZATION_ADMIN,
        )
        organization_sector = OrganizationSector(
            organization_id=organization.id,
            sector_id=sector.id,
        )
        db.add_all([membership, organization_sector])
        db.flush()
        project = Project(
            organization_id=organization.id,
            organization_sector_id=organization_sector.id,
            name="Water access baseline",
            created_by_id=user.id,
        )
        refresh = RefreshSession(
            user_id=user.id,
            token_hash="intelligence-refresh",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add_all([project, refresh])
        db.commit()
        token = create_access_token(user.id, refresh.id, settings)
        project_id = project.id

    def override_session():  # type: ignore[no-untyped-def]
        with Session(engine) as db:
            yield db

    app = create_app(settings)
    app.dependency_overrides[get_session] = override_session
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}

    mappings = client.put(
        f"/projects/{project_id}/field-mappings",
        headers=headers,
        json=[
            {
                "source_field": "clean_water",
                "display_name": "Access to clean water",
                "data_type": "boolean",
                "is_required": True,
                "is_location": False,
            }
        ],
    )
    assert mappings.status_code == 200
    assert mappings.json()[0]["display_name"] == "Access to clean water"

    target = client.post(
        f"/projects/{project_id}/targets",
        headers=headers,
        json={"name": "Households surveyed", "target_value": 2500, "unit": "households"},
    )
    assert target.status_code == 201

    intelligence = client.get(f"/projects/{project_id}/intelligence", headers=headers)
    assert intelligence.status_code == 200
    assert intelligence.json()["targets"][0]["target"] == 2500
    assert intelligence.json()["pulse"][0]["name"] == "Data collection"
