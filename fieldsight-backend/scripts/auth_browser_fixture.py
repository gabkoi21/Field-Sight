"""Disposable local browser fixture. Never use against an existing database."""

import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from datetime import UTC, datetime, timedelta

import jwt
import uvicorn
from fastapi import Request
from sqlmodel import Session, SQLModel, create_engine

import app.routes.auth as auth
from app.core.config import Settings
from app.core.security import password_hasher
from app.db.session import get_session
from app.main import create_app
from app.models.identity import Role, User

path = Path(__file__).resolve().parents[1] / "outputs" / f"browser-auth-{uuid4().hex}.db"
if path.exists():
    raise SystemExit("Fixture database already exists; choose a fresh disposable path.")
engine = create_engine(f"sqlite:///{path.as_posix()}", connect_args={"check_same_thread": False})
SQLModel.metadata.create_all(engine)
with Session(engine) as db:
    db.add(
        User(
            email="browser@example.com",
            password_hash=password_hasher.hash("SyntheticBrowser123!"),
            platform_role=Role.SUPER_ADMIN,
        )
    )
    db.commit()
settings = Settings(environment="test", cors_origins="http://localhost:5174,http://127.0.0.1:5174", log_level="WARNING")
original = auth.create_access_token


def short_token(user_id, session_id, settings):
    value = original(user_id, session_id, settings)
    claims = jwt.decode(value, settings.jwt_secret, algorithms=["HS256"], audience=settings.jwt_audience)
    claims["exp"] = datetime.now(UTC) + timedelta(seconds=65)
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


auth.create_access_token = short_token
app = create_app(settings)


def sessions():
    with Session(engine) as db:
        yield db


app.dependency_overrides[get_session] = sessions
observations = {"refresh_with_cookie": 0, "refresh_missing_cookie": 0}


@app.middleware("http")
async def observe(request: Request, call_next):
    # Only this disposable fixture can emulate the original CORS-only protection.
    if request.query_params.get("legacy") == "1":
        request.scope["headers"] = [(k, v) for k, v in request.scope["headers"] if k != b"sec-fetch-site"]
    if request.url.path == "/auth/refresh":
        key = "refresh_with_cookie" if request.cookies.get("refresh_token") else "refresh_missing_cookie"
        observations[key] += 1
    return await call_next(request)


@app.get("/test-observations")
def results():
    return observations


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001, access_log=False)
