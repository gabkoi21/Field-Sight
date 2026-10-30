from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role, Sector, User
from app.models.operations import Project, ProjectStatus
from app.routes.auth import get_current_user


def test_platform_counts_and_permission_boundaries(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'overview.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    admin = User(email="admin@test.org", password_hash="unused", platform_role=Role.SUPER_ADMIN)
    member = User(email="member@test.org", password_hash="unused")
    inactive = User(email="inactive@test.org", password_hash="unused", is_active=False)
    with Session(engine) as db:
        orgs = [Organization(name="Active", slug="active"), Organization(name="Paused", slug="paused", is_active=False)]
        sector = Sector(code="health", name="Health")
        db.add_all([admin, member, inactive, sector, *orgs])
        db.flush()
        for org in orgs:
            os = OrganizationSector(organization_id=org.id, sector_id=sector.id)
            db.add(os)
            db.flush()
            db.add(OrganizationMembership(organization_id=org.id, user_id=member.id, role=Role.ENUMERATOR))
            db.add(
                Project(
                    organization_id=org.id,
                    organization_sector_id=os.id,
                    name="Private archive",
                    created_by_id=admin.id,
                    is_private=True,
                    status=ProjectStatus.ARCHIVED,
                )
            )
        db.commit()
        db.refresh(admin)
        db.refresh(member)
        db.expunge_all()

    def session():
        with Session(engine) as db:
            yield db

    app = create_app(Settings(environment="test"))
    app.dependency_overrides[get_session] = session
    client = TestClient(app)
    assert client.get("/administration/overview").status_code == 401
    app.dependency_overrides[get_current_user] = lambda: member
    for path in ("/administration/overview", "/administration/events", "/users"):
        assert client.get(path).status_code == 403
    app.dependency_overrides[get_current_user] = lambda: admin
    assert client.get("/administration/overview").json() == {
        "total_organizations": 2,
        "active_organizations": 1,
        "total_platform_users": 3,
        "total_projects": 2,
    }
    assert client.get("/administration/events").json() == {"total": 0, "items": []}
    response = client.put("/auth/profile", json={"full_name": "Updated Admin", "landing_page": "/projects"})
    assert response.status_code == 200
    assert client.get("/auth/profile").json()["full_name"] == "Updated Admin"
