from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from pytest import MonkeyPatch
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
from app.models.phase3 import KoboConnection, Project, Submission


def test_dashboard_uses_local_aggregate_queries_without_contacting_kobo(
    tmp_path: object,
    monkeypatch: MonkeyPatch,
) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'dashboard.db'}",  # type: ignore[operator]
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    settings = Settings(environment="test")
    now = datetime.now(UTC)

    with Session(engine) as db:
        user = User(email="dashboard-admin@example.com", password_hash="unused")
        organization = Organization(name="Dashboard Org", slug="dashboard-org")
        sector = Sector(code="health", name="Health")
        db.add_all([user, organization, sector])
        db.flush()
        membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=user.id,
            role=Role.ORGANIZATION_ADMIN,
        )
        organization_sector = OrganizationSector(organization_id=organization.id, sector_id=sector.id)
        connection = KoboConnection(
            organization_id=organization.id,
            name="Connected Kobo",
            server_url="https://kf.kobotoolbox.org",
            token_encrypted="not-needed-by-dashboard",
            is_verified=True,
            created_by_id=user.id,
        )
        refresh = RefreshSession(
            user_id=user.id,
            token_hash="dashboard-refresh",
            expires_at=now + timedelta(days=1),
        )
        db.add_all([membership, organization_sector, connection, refresh])
        db.flush()
        project = Project(
            organization_id=organization.id,
            organization_sector_id=organization_sector.id,
            name="Household survey",
            created_by_id=user.id,
            kobo_connection_id=connection.id,
            kobo_form_id="form-1",
        )
        db.add(project)
        db.flush()
        db.add_all(
            [
                Submission(
                    organization_id=organization.id,
                    project_id=project.id,
                    kobo_connection_id=connection.id,
                    kobo_form_id="form-1",
                    external_id="current-ready",
                    submitted_at=now - timedelta(days=1),
                    location="North",
                    review_status="ready",
                ),
                Submission(
                    organization_id=organization.id,
                    project_id=project.id,
                    kobo_connection_id=connection.id,
                    kobo_form_id="form-1",
                    external_id="current-review",
                    submitted_at=now - timedelta(days=2),
                    location="South",
                    review_status="needs_review",
                ),
                Submission(
                    organization_id=organization.id,
                    project_id=project.id,
                    kobo_connection_id=connection.id,
                    kobo_form_id="form-1",
                    external_id="previous-invalid",
                    submitted_at=now - timedelta(days=10),
                    location="North",
                    review_status="invalid",
                ),
            ]
        )
        db.commit()
        token = create_access_token(user.id, refresh.id, settings)

    def override_session():  # type: ignore[no-untyped-def]
        with Session(engine) as db:
            yield db

    def fail_if_kobo_is_called(*args: object, **kwargs: object) -> list[dict[str, object]]:
        raise AssertionError("The dashboard overview must not contact KoboToolbox.")

    monkeypatch.setattr("app.routes.collection.list_kobo_submissions", fail_if_kobo_is_called)
    app = create_app(settings)
    app.dependency_overrides[get_session] = override_session
    client = TestClient(app)

    response = client.get(
        "/dashboard/overview?period=7d",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_submissions"] == 2
    assert payload["ready_records"] == 1
    assert payload["needs_review"] == 1
    assert payload["invalid_records"] == 0
    assert payload["submission_change_percent"] == 100.0
    assert payload["available_locations"] == ["North", "South"]
    assert sum(day["submissions"] for day in payload["trend"]) == 2
    assert payload["projects"][0]["actual"] == 2
    assert payload["pending_sync_count"] is None
    assert payload["sync_status"] == {
        "pending_count": None,
        "sources": [],
        "healthy_sources": 0,
        "delayed_sources": 1,
        "connected_sources": 1,
    }
