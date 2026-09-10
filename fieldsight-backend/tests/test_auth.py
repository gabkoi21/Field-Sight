from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import Settings
from app.core.security import password_hasher
from app.db.session import get_session
from app.main import create_app
from app.models.identity import Role, User


def test_login_cookie_can_refresh_on_versioned_auth_route(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'auth.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as db:
        db.add(
            User(
                email="super@example.com",
                username="superadmin",
                password_hash=password_hasher.hash("SuperAdmin123!"),
                platform_role=Role.SUPER_ADMIN,
            )
        )
        db.commit()

    def override_session():  # type: ignore[no-untyped-def]
        with Session(engine) as db:
            yield db

    app = create_app(Settings(environment="test"))
    app.dependency_overrides[get_session] = override_session
    client = TestClient(app)

    login = client.post(
        "/auth/login",
        json={"login": "superadmin", "password": "SuperAdmin123!"},
    )

    assert login.status_code == 200
    assert "Path=/auth" in login.headers["set-cookie"]

    refreshed = client.post("/auth/refresh")

    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]


def test_enumerator_cannot_sign_in_to_fieldsight(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'enumerator-auth.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as db:
        enumerator = User(
            email="enumerator@example.com",
            username="enumerator",
            password_hash=password_hasher.hash("Enumerator123!"),
        )
        db.add(enumerator)
        db.commit()

    def override_session():  # type: ignore[no-untyped-def]
        with Session(engine) as db:
            yield db

    app = create_app(Settings(environment="test"))
    app.dependency_overrides[get_session] = override_session
    response = TestClient(app).post(
        "/auth/login",
        json={"login": "enumerator", "password": "Enumerator123!"},
    )

    assert response.status_code == 403
    assert response.json()["message"].startswith("FieldSight workspace access")
