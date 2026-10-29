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
            email="superadmin@fieldsight.local",
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
        "/organizations",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Community Health Initiative",
            "slug": "community-health-demo",
            "owner_email": "owner@example.com",
            "owner_password": "OwnerPass123!",
            "owner_role": "organization_admin",
            "sector_ids": [str(sector_id)],
            "country": "Liberia",
            "timezone": "Africa/Monrovia",
        },
    )

    assert response.status_code == 201
    assert response.json()["owner_role"] == "organization_admin"

    listed = TestClient(app).get("/organizations", headers={"Authorization": f"Bearer {token}"})
    assert listed.status_code == 200
    organization = listed.json()[0]
    assert organization["country"] == "Liberia"
    assert organization["timezone"] == "Africa/Monrovia"
    assert organization["owner_email"] == "owner@example.com"
    assert organization["sector_ids"] == [str(sector_id)]

    directory = TestClient(app).get("/users", headers={"Authorization": f"Bearer {token}"})
    assert directory.status_code == 200
    users = directory.json()
    assert len(users) == 2
    owner_entry = next(user for user in users if user["email"] == "owner@example.com")
    assert owner_entry["username"] is None
    assert owner_entry["platform_role"] is None
    assert owner_entry["memberships"] == [
        {
            "organization_id": response.json()["organization_id"],
            "organization_name": "Community Health Initiative",
            "role": "organization_admin",
            "is_active": True,
        }
    ]

    with Session(engine) as db:
        owner_account = db.exec(select(User).where(User.email == "owner@example.com")).one()
        owner_refresh = RefreshSession(
            user_id=owner_account.id,
            token_hash="organization-admin-enumerator-token",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add(owner_refresh)
        db.commit()
        owner_token = create_access_token(owner_account.id, owner_refresh.id, settings)

    forbidden_directory = TestClient(app).get(
        "/users",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert forbidden_directory.status_code == 403

    enumerator = TestClient(app).post(
        "/enumerators",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "full_name": "Mary Kamara",
            "email": "enumerator@example.com",
            "username": "field.enumerator",
            "password": "EnumeratorPass123!",
            "phone_number": "+231770123456",
            "employee_id": "EMP-001",
            "gender": "Female",
            "date_of_birth": "1995-03-12",
            "address": "Monrovia",
            "emergency_contact_name": "John Kamara",
            "emergency_contact_phone": "+231880123456",
            "notes": "Available weekdays",
        },
    )
    assert enumerator.status_code == 201
    assert enumerator.json()["full_name"] == "Mary Kamara"
    assert enumerator.json()["role"] == "enumerator"
    assert enumerator.json()["is_active"] is True
    generated_id = "EMP-" + enumerator.json()["user_id"].replace("-", "").upper()
    assert enumerator.json()["employee_id"] == generated_id

    complete_directory = TestClient(app).get(
        "/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete_directory.status_code == 200
    complete_users = complete_directory.json()
    assert len(complete_users) == 3
    enumerator_entry = next(user for user in complete_users if user["email"] == "enumerator@example.com")
    assert enumerator_entry["memberships"][0]["role"] == "enumerator"

    enumerator_list = TestClient(app).get(
        "/enumerators",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert enumerator_list.status_code == 200
    assert enumerator_list.json()[0]["email"] == "enumerator@example.com"
    assert enumerator_list.json()[0]["full_name"] == "Mary Kamara"

    membership_id = enumerator.json()["membership_id"]
    enumerator_detail = TestClient(app).get(
        f"/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert enumerator_detail.status_code == 200
    assert enumerator_detail.json()["username"] == "field.enumerator"
    assert enumerator_detail.json()["employee_id"] == generated_id
    attempted_id_change = TestClient(app).put(
        f"/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"employee_id": "MANUAL-ID"},
    )
    assert attempted_id_change.status_code == 200
    assert attempted_id_change.json()["employee_id"] == generated_id

    for field, expected in {
        "phone_number": "+231770123456",
        "gender": "Female", "date_of_birth": "1995-03-12", "address": "Monrovia",
        "emergency_contact_name": "John Kamara", "emergency_contact_phone": "+231880123456",
        "notes": "Available weekdays",
    }.items():
        assert enumerator_detail.json()[field] == expected
    with Session(engine) as db:
        account = db.exec(select(User).where(User.email == "enumerator@example.com")).one()
        assert password_hasher.verify("EnumeratorPass123!", account.password_hash)


    suspended = TestClient(app).put(
        f"/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )
    assert suspended.status_code == 200
    assert suspended.json()["is_active"] is False

    reactivated = TestClient(app).put(
        f"/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": True},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True

    deactivated = TestClient(app).delete(
        f"/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert deactivated.status_code == 204

    deactivated_detail = TestClient(app).get(
        f"/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert deactivated_detail.status_code == 200
    assert deactivated_detail.json()["is_active"] is False

    token_scoped_enumerator = TestClient(app).post(
        "/enumerators",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "full_name": "Token Scoped Enumerator",
            "email": "token.scoped@example.com",
            "username": "token.scoped",
            "password": "EnumeratorPass123!",
        },
    )
    assert token_scoped_enumerator.status_code == 201
    token_scoped_membership_id = token_scoped_enumerator.json()["membership_id"]

    token_scoped_list = TestClient(app).get(
        "/enumerators", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert token_scoped_list.status_code == 200
    assert any(item["membership_id"] == token_scoped_membership_id for item in token_scoped_list.json())

    token_scoped_detail = TestClient(app).get(
        f"/enumerators/{token_scoped_membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert token_scoped_detail.status_code == 200
    assert token_scoped_detail.json()["full_name"] == "Token Scoped Enumerator"

    token_scoped_suspended = TestClient(app).put(
        f"/enumerators/{token_scoped_membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )
    assert token_scoped_suspended.status_code == 200
    assert token_scoped_suspended.json()["is_active"] is False

    token_scoped_deactivated = TestClient(app).delete(
        f"/enumerators/{token_scoped_membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert token_scoped_deactivated.status_code == 204

    token_scoped_super_admin = TestClient(app).get(
        "/enumerators", headers={"Authorization": f"Bearer {token}"}
    )
    assert token_scoped_super_admin.status_code == 403

    super_admin_create = TestClient(app).post(
        "/enumerators",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Blocked Enumerator",
            "email": "blocked@example.com",
            "username": "blocked.enumerator",
            "password": "EnumeratorPass123!",
        },
    )
    assert super_admin_create.status_code == 403

    updated = TestClient(app).patch(
        f"/organizations/{response.json()['organization_id']}",
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

    relisted = TestClient(app).get("/organizations", headers={"Authorization": f"Bearer {token}"})
    updated_organization = relisted.json()[0]
    assert updated_organization["name"] == "Community Health Initiative Updated"
    assert updated_organization["slug"] == "community-health-updated"
    assert updated_organization["country"] == "Ghana"
    assert updated_organization["timezone"] == "Africa/Accra"
    assert updated_organization["sector_ids"] == []
    with Session(engine) as db:
        owner = db.exec(select(User).where(User.email == "owner@example.com")).one()
        membership = db.exec(select(OrganizationMembership).where(OrganizationMembership.user_id == owner.id)).one()
        assert owner.username is None
        assert membership.is_active
        assert membership.role == Role.ORGANIZATION_ADMIN
        assert password_hasher.verify("OwnerPass123!", owner.password_hash)


def test_platform_events_and_sector_catalog_are_super_admin_only(tmp_path: Path) -> None:
    from app.models.identity import Organization
    from app.models.operations import OrganizationAdminEvent
    from app.routes.administration import require_super_admin
    engine = create_engine(f"sqlite:///{tmp_path / 'events.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        admin = User(email="audit@example.com", password_hash="unused", platform_role=Role.SUPER_ADMIN)
        tenant = Organization(name="Audit tenant", slug="audit-tenant")
        db.add_all([admin, tenant]); db.commit()
        db.add(OrganizationAdminEvent(organization_id=tenant.id, actor_id=admin.id,
                                     action="project.archived", resource_id="recorded-resource"))
        db.add(Sector(code="inactive", name="Inactive sector", is_active=False)); db.commit()
        admin_id = admin.id
        tenant_id = tenant.id
    def session():
        with Session(engine) as db:
            yield db
    app = create_app(Settings(environment="test"))
    app.dependency_overrides[get_session] = session
    client = TestClient(app)
    assert client.get("/administration/activity/monthly?year=2026").status_code == 401
    assert client.get("/administration/events").status_code == 401
    assert client.get("/administration/sectors").status_code == 401
    from app.routes.auth import get_current_user
    app.dependency_overrides[get_current_user] = lambda: User(email="tenant@example.com", password_hash="unused")
    assert client.get("/administration/activity/monthly?year=2026").status_code == 403
    assert client.get("/administration/events").status_code == 403
    assert client.get("/administration/sectors").status_code == 403
    assert client.patch(f"/administration/organizations/{tenant_id}/status", json={"is_active": False}).status_code == 403
    app.dependency_overrides[require_super_admin] = lambda: User(id=admin_id, email="audit@example.com", password_hash="unused", platform_role=Role.SUPER_ADMIN)
    response = client.get("/administration/events", params={"q": "project.archived", "limit": 1})
    assert response.status_code == 200
    assert response.json()["total"] == 1
    event = response.json()["items"][0]
    assert event["actor"] == "audit@example.com"
    assert event["target"] == "recorded-resource"
    assert "password_hash" not in event
    assert client.get("/administration/events", params={"offset": 1}).json()["items"] == []
    assert client.get("/administration/events", params={"q": "missing"}).json()["total"] == 0
    assert client.get("/administration/events", params={"start": "2099-01-01T00:00:00Z"}).json()["total"] == 0
    assert client.get("/administration/events", params={"limit": 101}).status_code == 422
    assert client.get("/administration/sectors").json()[0]["is_active"] is False

    status_response = client.patch(f"/administration/organizations/{tenant_id}/status", json={"is_active": False})
    assert status_response.status_code == 200
    assert status_response.json()["is_active"] is False
    assert client.get("/administration/events", params={"q": "organization.suspended"}).json()["total"] == 1
    assert client.patch(f"/administration/organizations/{tenant_id}/status", json={"is_active": True}).json()["is_active"] is True
    with Session(engine) as db:
        assert db.get(Organization, tenant_id) is not None


def test_suspended_tenants_cannot_use_memberships_for_workspace_access(tmp_path: Path) -> None:
    import pytest
    from fastapi import HTTPException
    from app.models.identity import Organization
    from app.routes.auth import _has_workspace_access
    from app.routes.organizations import _authorize
    engine = create_engine(f"sqlite:///{tmp_path / 'suspension.db'}")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        user = User(email="member@example.org", password_hash="unused")
        suspended = Organization(name="Suspended", slug="suspended", is_active=False)
        active = Organization(name="Active", slug="active")
        db.add_all([user, suspended, active]); db.flush()
        db.add(OrganizationMembership(user_id=user.id, organization_id=suspended.id, role=Role.ORGANIZATION_ADMIN))
        db.commit()
        assert not _has_workspace_access(user, db)
        with pytest.raises(HTTPException) as error:
            _authorize(suspended.id, user, db, admin=True)
        assert error.value.status_code == 404
        db.add(OrganizationMembership(user_id=user.id, organization_id=active.id, role=Role.ORGANIZATION_ADMIN))
        db.commit()
        assert _has_workspace_access(user, db)
        assert _authorize(active.id, user, db, admin=True) is not None
        with pytest.raises(HTTPException):
            _authorize(suspended.id, user, db, admin=True)


def test_monthly_activity_uses_dated_submissions_and_real_monthly_leaders(tmp_path: Path) -> None:
    from uuid import uuid4
    from app.models.identity import Organization, OrganizationSector
    from app.models.operations import Submission, Project, KoboConnection
    from app.routes.administration import monthly_organization_activity
    engine = create_engine(f"sqlite:///{tmp_path / 'monthly.db'}")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        first = Organization(name="First NGO", slug="first")
        second = Organization(name="Second NGO", slug="second", is_active=False)
        admin = User(email="activity-admin@example.org", password_hash="unused", platform_role=Role.SUPER_ADMIN)
        sector = Sector(code="health", name="Health")
        db.add_all([first, second, admin, sector]); db.flush()
        projects = {}; connections = {}
        for org in (first, second):
            assignment = OrganizationSector(organization_id=org.id, sector_id=sector.id)
            db.add(assignment); db.flush()
            project = Project(organization_id=org.id, organization_sector_id=assignment.id, name="Monthly project", created_by_id=admin.id)
            connection = KoboConnection(organization_id=org.id, name="Test connection", server_url="https://example.org", token_encrypted="test-only", created_by_id=admin.id)
            db.add_all([project, connection]); db.flush()
            projects[org.id] = project.id; connections[org.id] = connection.id
        def submission(org, timestamp):
            return Submission(organization_id=org.id, project_id=projects[org.id], kobo_connection_id=connections[org.id],
                kobo_form_id="form", external_id=str(uuid4()), submitted_at=timestamp)
        db.add_all([
            submission(first, datetime(2026, 1, 2, tzinfo=UTC)),
            submission(second, datetime(2026, 1, 3, tzinfo=UTC)),
            submission(second, datetime(2026, 1, 4, tzinfo=UTC)),
            submission(first, datetime(2026, 2, 1, tzinfo=UTC)),
            submission(second, datetime(2026, 2, 2, tzinfo=UTC)),
            submission(first, datetime(2025, 12, 31, tzinfo=UTC)),
            submission(first, None),
        ]); db.commit()
        admin = User(email="admin@example.org", password_hash="unused", platform_role=Role.SUPER_ADMIN)
        result = monthly_organization_activity(admin, db, 2026)
        assert len(result["months"]) == 12
        january, february, march = result["months"][:3]
        assert january["organization_name"] == "Second NGO"
        assert january["submissions"] == 2
        assert january["tied_organizations"] == 1
        assert february["submissions"] == 1
        assert february["tied_organizations"] == 2
        assert march["organization_name"] is None
        assert march["submissions"] == 0
        assert 2025 in result["available_years"]
        assert monthly_organization_activity(admin, db, 2024)["months"][0]["submissions"] == 0
