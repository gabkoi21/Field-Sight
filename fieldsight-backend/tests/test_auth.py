from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import Settings
from app.core.security import password_hasher
from app.db.session import get_session
from app.main import create_app
from app.models.identity import User


def test_login_cookie_can_refresh_on_versioned_auth_route(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'auth.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as db:
        db.add(
            User(
                email="super@example.com",
                username="superadmin",
                password_hash=password_hasher.hash("SuperAdmin123!"),
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