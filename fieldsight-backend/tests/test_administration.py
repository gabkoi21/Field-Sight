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

    organization_id = response.json()["organization_id"]
    enumerator = TestClient(app).post(
        f"/organizations/{organization_id}/enumerators",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "full_name": "Mary Kamara",
            "email": "enumerator@example.com",
            "username": "field.enumerator",
            "password": "EnumeratorPass123!",
        },
    )
    assert enumerator.status_code == 201
    assert enumerator.json()["full_name"] == "Mary Kamara"
    assert enumerator.json()["role"] == "enumerator"
    assert enumerator.json()["is_active"] is True

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
        f"/organizations/{organization_id}/enumerators",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert enumerator_list.status_code == 200
    assert enumerator_list.json()[0]["email"] == "enumerator@example.com"
    assert enumerator_list.json()[0]["full_name"] == "Mary Kamara"

    membership_id = enumerator.json()["membership_id"]
    enumerator_detail = TestClient(app).get(
        f"/organizations/{organization_id}/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert enumerator_detail.status_code == 200
    assert enumerator_detail.json()["username"] == "field.enumerator"

    suspended = TestClient(app).patch(
        f"/organizations/{organization_id}/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )
    assert suspended.status_code == 200
    assert suspended.json()["is_active"] is False

    reactivated = TestClient(app).patch(
        f"/organizations/{organization_id}/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": True},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True

    deactivated = TestClient(app).delete(
        f"/organizations/{organization_id}/enumerators/{membership_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert deactivated.status_code == 204

    deactivated_detail = TestClient(app).get(
        f"/organizations/{organization_id}/enumerators/{membership_id}",
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

    token_scoped_suspended = TestClient(app).patch(
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
        f"/organizations/{organization_id}/enumerators",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Blocked Enumerator",
            "email": "blocked@example.com",
            "username": "blocked.enumerator",
            "password": "EnumeratorPass123!",
        },
    )
    assert super_admin_create.status_code == 404

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
