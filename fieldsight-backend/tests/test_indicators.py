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
from app.models.operations import KoboConnection, Project, Submission


def test_admin_can_manage_project_indicators(tmp_path: object) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'indicators.db'}", connect_args={"check_same_thread": False})  # type: ignore[operator]
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
        organization_sector = OrganizationSector(organization_id=organization.id, sector_id=sector.id)
        db.add_all([membership, organization_sector])
        db.flush()
        project = Project(
            organization_id=organization.id,
            organization_sector_id=organization_sector.id,
            name="Water access",
            created_by_id=user.id,
        )
        refresh = RefreshSession(
            user_id=user.id,
            token_hash="indicator-refresh",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        connection = KoboConnection(
            organization_id=organization.id,
            name="Water Kobo",
            server_url="https://kf.kobotoolbox.org",
            token_encrypted="test-token",
            created_by_id=user.id,
        )
        db.add_all([project, refresh, connection])
        db.flush()
        db.add_all(
            [
                Submission(
                    organization_id=organization.id,
                    project_id=project.id,
                    kobo_connection_id=connection.id,
                    kobo_form_id="water-form",
                    external_id="submission-1",
                    submitted_at=datetime(2026, 9, 1, tzinfo=UTC),
                    location="Kajo-Keji",
                    review_status="ready",
                    raw_answers={"safe_water": "Yes"},
                ),
                Submission(
                    organization_id=organization.id,
                    project_id=project.id,
                    kobo_connection_id=connection.id,
                    kobo_form_id="water-form",
                    external_id="submission-2",
                    submitted_at=datetime(2026, 9, 2, tzinfo=UTC),
                    location="Yei",
                    review_status="ready",
                    raw_answers={"safe_water": "No"},
                ),
            ]
        )
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
    created = client.post(
        f"/projects/{project_id}/indicators",
        headers=headers,
        json={
            "name": "Households with safe water",
            "code": "WASH-01",
            "unit": "percentage",
            "baseline_value": 42,
            "target_value": 70,
            "target_date": "2027-12-31",
            "reporting_frequency": "quarterly",
        },
    )
    assert created.status_code == 201
    assert created.json()["status"] == "not_started"
    indicator_id = created.json()["id"]
    listed = client.get(f"/projects/{project_id}/indicators", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["code"] == "WASH-01"
    fields = client.get(f"/projects/{project_id}/indicator-fields", headers=headers)
    assert fields.json()[0]["source_field"] == "safe_water"
    assert fields.json()[0]["form_id"] == "water-form"
    mapping = client.put(
        f"/indicators/{indicator_id}/mapping",
        headers=headers,
        json={
            "source_field": "safe_water",
            "calculation": "percentage_matching",
            "match_value": "Yes",
        },
    )
    assert mapping.status_code == 200
    calculated = client.get(f"/indicators/{indicator_id}", headers=headers)
    assert calculated.json()["current_value"] == 50
    assert calculated.json()["mapped_records"] == 2
    assert calculated.json()["status"] == "in_progress"
    assert calculated.json()["schedule_status"] == "not_due"
    assert calculated.json()["target_achieved"] is False
    assert len(calculated.json()["history"]) == 1
    assert calculated.json()["history"][0]["period"] == "2026-Q3"
    assert {item["location"] for item in calculated.json()["location_breakdown"]} == {"Kajo-Keji", "Yei"}
    assert client.patch(f"/indicators/{indicator_id}", headers=headers, json={"target_value": 75}).status_code == 409
    preview = client.post(f"/indicators/{indicator_id}/definition-preview", headers=headers,
                          json={"target_value": 75}).json()
    updated = client.patch(f"/indicators/{indicator_id}", headers=headers, json={"target_value": 75,
        "confirm_change": True, "change_reason": "Revised after review",
        "expected_version": preview["expected_version"], "preview_token": preview["preview_token"]})
    assert updated.status_code == 200
    assert updated.json()["target_value"] == 75
    assert updated.json()["status"] == "in_progress"
    deleted = client.delete(f"/indicators/{indicator_id}", headers=headers)
    assert deleted.status_code == 204
