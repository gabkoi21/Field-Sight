"""Provider pagination and real API/database sync regression coverage."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

import httpx
import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, SQLModel, create_engine, select

from alembic import command
from app.core.config import Settings, get_settings
from app.core.kobo import list_kobo_submissions
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
from app.models.operations import KoboConnection, Project, Submission, SyncRun

SERVER = "https://kf.kobotoolbox.org"
DATA = SERVER + "/api/v2/assets/form-1/data/"


def page(results: list[dict[str, object]], next_url: str | None = None, count: int | None = None) -> httpx.Response:
    payload: dict[str, object] = {"results": results, "next": next_url}
    if count is not None:
        payload["count"] = count
    return httpx.Response(200, json=payload)


@pytest.fixture
def sync_client(tmp_path: Path) -> Iterator[tuple[TestClient, Engine, str, dict[str, str]]]:
    engine = create_engine(f"sqlite:///{tmp_path / 'sync.db'}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    settings = Settings(environment="test")
    with Session(engine) as db:
        user = User(email="sync@example.com", password_hash="unused")
        org = Organization(name="Sync Org", slug="sync-org")
        sector = Sector(code="health", name="Health")
        db.add_all([user, org, sector])
        db.flush()
        org_sector = OrganizationSector(organization_id=org.id, sector_id=sector.id)
        membership = OrganizationMembership(organization_id=org.id, user_id=user.id, role=Role.ORGANIZATION_ADMIN)
        connection = KoboConnection(
            organization_id=org.id, name="Kobo", server_url=SERVER,
            token_encrypted="encrypted", is_verified=True, created_by_id=user.id,
        )
        refresh = RefreshSession(
            user_id=user.id, token_hash="sync-refresh", expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add_all([org_sector, membership, connection, refresh])
        db.flush()
        project = Project(
            organization_id=org.id, organization_sector_id=org_sector.id, name="Survey",
            created_by_id=user.id, kobo_connection_id=connection.id, kobo_form_id="form-1",
        )
        db.add(project)
        db.commit()
        project_id = str(project.id)
        token = create_access_token(user.id, refresh.id, settings)

    def override_session() -> Iterator[Session]:
        with Session(engine) as db:
            yield db

    app = create_app(settings)
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as client, patch("app.routes.collection.decrypt_kobo_token", return_value="private-token"):
        yield client, engine, project_id, {"Authorization": f"Bearer {token}"}
    engine.dispose()


def test_1500_records_repeat_and_changed_record(sync_client: tuple[TestClient, Engine, str, dict[str, str]]) -> None:
    client, engine, project_id, headers = sync_client
    records: list[dict[str, object]] = [
        {"_id": index, "answer": index, "_submission_time": "2026-10-20T12:00:00Z"}
        for index in range(1500)
    ]

    def responses() -> list[httpx.Response]:
        return [page(records[:1000], "?start=1000&limit=1000", 1500), page(records[1000:], count=1500)]

    with patch("app.core.kobo.httpx.get", side_effect=responses()) as get:
        first = client.post(f"/projects/{project_id}/sync", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["received"] == first.json()["created"] == 1500
    assert get.call_count == 2
    assert "start=1000" in get.call_args_list[1].args[0]
    with Session(engine) as db:
        original = db.exec(select(Submission).where(Submission.external_id == "0")).one()
        original_updated_at = original.updated_at

    with patch("app.core.kobo.httpx.get", side_effect=responses()):
        second = client.post(f"/projects/{project_id}/sync", headers=headers)
    assert second.json()["status"] == "unchanged"
    assert second.json()["created"] == second.json()["updated"] == 0
    records[1499] = {**records[1499], "answer": 9999}
    with patch("app.core.kobo.httpx.get", side_effect=responses()):
        changed = client.post(f"/projects/{project_id}/sync", headers=headers)
    assert changed.json()["created"] == 0
    assert changed.json()["updated"] == 1
    with Session(engine) as db:
        assert len(db.exec(select(Submission)).all()) == 1500
        assert db.exec(select(Submission).where(Submission.external_id == "0")).one().updated_at == original_updated_at
        assert db.exec(select(Submission).where(Submission.external_id == "1499")).one().raw_answers["answer"] == 9999
    runs = client.get("/sync-runs", headers=headers).json()
    assert len(runs) == 3
    assert all(run["completed_at"] and run["received"] == 1500 for run in runs)


def test_later_page_failure_preserves_previous_import(
    sync_client: tuple[TestClient, Engine, str, dict[str, str]],
) -> None:
    client, engine, project_id, headers = sync_client
    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1, "answer": "original"}], count=1)):
        assert client.post(f"/projects/{project_id}/sync", headers=headers).status_code == 200
    with patch("app.core.kobo.httpx.get", side_effect=[
        page([{"_id": 1, "answer": "changed"}], "?start=1", 2), httpx.Response(503, text="private-token"),
    ]):
        failed = client.post(f"/projects/{project_id}/sync", headers=headers)
    assert failed.status_code == 422
    assert "private-token" not in failed.text
    with Session(engine) as db:
        assert db.exec(select(Submission)).one().raw_answers["answer"] == "original"
        run = db.exec(select(SyncRun).where(SyncRun.status == "failed")).one()
        assert run.completed_at and "private-token" not in (run.error_message or "")


def test_missing_external_id_rolls_back_import(sync_client: tuple[TestClient, Engine, str, dict[str, str]]) -> None:
    client, engine, project_id, headers = sync_client
    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1}, {"answer": "missing ID"}], count=2)):
        result = client.post(f"/projects/{project_id}/sync", headers=headers)
    assert result.status_code == 422
    with Session(engine) as db:
        assert not db.exec(select(Submission)).all()
        assert db.exec(select(SyncRun)).one().status == "failed"


def test_storage_failure_rolls_back_and_keeps_safe_failure_history(
    sync_client: tuple[TestClient, Engine, str, dict[str, str]],
) -> None:
    client, engine, project_id, headers = sync_client
    original_commit = Session.commit
    calls = 0

    def fail_import_commit(db: Session) -> None:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise SQLAlchemyError("private survey answer and token")
        original_commit(db)

    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1}], count=1)):
        with patch.object(Session, "commit", fail_import_commit):
            response = client.post(f"/projects/{project_id}/sync", headers=headers)
    assert response.status_code == 422
    assert "private survey" not in response.text
    with Session(engine) as db:
        assert not db.exec(select(Submission)).all()
        run = db.exec(select(SyncRun)).one()
        assert run.status == "failed"
        assert run.error_message == "Submission storage failed. Retry the full import."


def test_same_external_id_on_another_form_is_distinct(
    sync_client: tuple[TestClient, Engine, str, dict[str, str]],
) -> None:
    client, engine, project_id, headers = sync_client
    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1, "answer": "first"}], count=1)):
        assert client.post(f"/projects/{project_id}/sync", headers=headers).json()["created"] == 1
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        assert project
        project.kobo_form_id = "form-2"
        db.add(project)
        db.commit()
    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1, "answer": "second"}], count=1)):
        assert client.post(f"/projects/{project_id}/sync", headers=headers).json()["created"] == 1
        assert client.post(f"/projects/{project_id}/sync", headers=headers).json()["status"] == "unchanged"
    with Session(engine) as db:
        submissions = db.exec(select(Submission)).all()
        assert len(submissions) == 2
        assert {row.raw_answers["answer"] for row in submissions} == {"first", "second"}


def test_sync_rejects_unauthenticated_and_non_admin_requests(
    sync_client: tuple[TestClient, Engine, str, dict[str, str]],
) -> None:
    client, engine, project_id, headers = sync_client
    assert client.post(f"/projects/{project_id}/sync").status_code == 401
    with Session(engine) as db:
        membership = db.exec(select(OrganizationMembership)).one()
        membership.role = Role.ENUMERATOR
        db.add(membership)
        db.commit()
    with patch("app.core.kobo.httpx.get") as get:
        assert client.post(f"/projects/{project_id}/sync", headers=headers).status_code == 403
        get.assert_not_called()


def test_cross_organization_sync_is_hidden(sync_client: tuple[TestClient, Engine, str, dict[str, str]]) -> None:
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        other = Organization(name="Other", slug="other")
        db.add(other)
        db.flush()
        project = db.get(Project, UUID(project_id))
        assert project
        project.organization_id = other.id
        db.add(project)
        db.commit()
    with patch("app.core.kobo.httpx.get") as get:
        assert client.post(f"/projects/{project_id}/sync", headers=headers).status_code == 404
        get.assert_not_called()


def test_identity_migration_preserves_existing_records(
    sync_client: tuple[TestClient, Engine, str, dict[str, str]], monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, engine, project_id, headers = sync_client
    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1, "answer": "keep"}], count=1)):
        assert client.post(f"/projects/{project_id}/sync", headers=headers).status_code == 200
    assert engine.url.database
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{Path(engine.url.database).as_posix()}")
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "0013_submission_form_identity")
        command.downgrade(config, "0012_indicator_mappings")
        command.upgrade(config, "head")
        with Session(engine) as db:
            assert db.exec(select(Submission)).one().raw_answers == {"_id": 1, "answer": "keep"}
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize("next_url", [
    "https://example.com/steal", "http://kf.kobotoolbox.org/api/v2/assets/form-1/data/",
    SERVER + "/api/v2/assets/other-form/data/", "https://user:pass@kf.kobotoolbox.org/api/v2/assets/form-1/data/",
    DATA + "?format=json&limit=1000", "?limit=1000&format=json",
    "https://[invalid-host/data/",
])
def test_rejects_unsafe_or_repeated_next_without_sending_token(next_url: str) -> None:
    with patch("app.core.kobo.httpx.get", return_value=page([{"_id": 1}], next_url)) as get:
        with pytest.raises(ValueError):
            list_kobo_submissions(SERVER, "private-token", "form-1")
    assert get.call_count == 1


@pytest.mark.parametrize("response", [
    httpx.Response(200, text="not JSON"), httpx.Response(302, headers={"location": "https://example.com"}),
    httpx.Response(401), httpx.Response(403), httpx.Response(429), httpx.Response(500),
    httpx.Response(200, json={}), httpx.Response(200, json={"results": [], "next": 12}),
    httpx.Response(200, json={"results": [42], "next": None}), page([], count=1),
    httpx.Response(200, json={"results": [], "next": None, "count": True}),
])
def test_rejects_invalid_provider_responses(response: httpx.Response) -> None:
    with patch("app.core.kobo.httpx.get", return_value=response), pytest.raises(ValueError):
        list_kobo_submissions(SERVER, "private-token", "form-1")


def test_network_failure_and_repeated_records() -> None:
    with patch("app.core.kobo.httpx.get", side_effect=httpx.ReadTimeout("private-token")):
        with pytest.raises(ValueError, match="could not be reached") as exc:
            list_kobo_submissions(SERVER, "private-token", "form-1")
    assert "private-token" not in str(exc.value)
    with patch("app.core.kobo.httpx.get", side_effect=[page([{"_id": 1}], "?start=1"), page([{"_id": 1}])]):
        with pytest.raises(ValueError, match="duplicate"):
            list_kobo_submissions(SERVER, "private-token", "form-1")


def test_empty_form_and_changed_totals() -> None:
    with patch("app.core.kobo.httpx.get", return_value=page([], count=0)):
        assert list_kobo_submissions(SERVER, "private-token", "form-1") == []
    with patch("app.core.kobo.httpx.get", side_effect=[
        page([{"_id": 1}], "?start=1", 2), page([{"_id": 2}], count=3),
    ]):
        with pytest.raises(ValueError, match="totals changed"):
            list_kobo_submissions(SERVER, "private-token", "form-1")
