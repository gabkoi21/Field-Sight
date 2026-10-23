"""Connection removal protects shared projects and organization ownership."""

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.models.identity import OrganizationMembership, Role
from app.models.operations import KoboConnection, Project


def test_delete_unused_unverified_connection_without_remote_calls(sync_client):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        item = KoboConnection(
            organization_id=project.organization_id,
            name="Offline",
            server_url="https://example.invalid",
            token_encrypted="encrypted-secret",
            created_by_id=project.created_by_id,
            is_verified=False,
        )
        db.add(item)
        db.commit()
        item_id = item.id
    with patch("app.routes.kobo.decrypt_kobo_token") as decrypt:
        result = client.delete(f"/kobo/connections/{item_id}", headers=headers)
    assert result.status_code == 204, result.text
    assert "encrypted-secret" not in result.text
    decrypt.assert_not_called()
    with Session(engine) as db:
        assert db.get(KoboConnection, item_id) is None
        assert db.get(Project, UUID(project_id)) is not None


def test_in_use_connection_and_permissions(sync_client):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        connection_id = project.kobo_connection_id
    path = f"/kobo/connections/{connection_id}"
    assert client.delete(path).status_code == 401
    assert client.delete(f"/kobo/connections/{uuid4()}", headers=headers).status_code == 404
    assert client.delete(path, headers=headers).status_code == 409
    with Session(engine) as db:
        assert db.get(KoboConnection, connection_id) is not None
        membership = db.exec(select(OrganizationMembership)).one()
        membership.role = Role.ENUMERATOR
        db.add(membership)
        db.commit()
    assert client.delete(path, headers=headers).status_code == 403


def test_foreign_connection_is_not_accessible(sync_client):
    from app.models.identity import Organization

    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        org = Organization(name="Other", slug="other")
        db.add(org)
        db.flush()
        connection = KoboConnection(
            organization_id=org.id,
            name="Foreign",
            server_url="https://example.invalid",
            token_encrypted="secret",
            created_by_id=project.created_by_id,
        )
        db.add(connection)
        db.commit()
        connection_id = connection.id
    assert client.delete(f"/kobo/connections/{connection_id}", headers=headers).status_code == 404
    with Session(engine) as db:
        assert db.get(KoboConnection, connection_id) is not None


@pytest.mark.parametrize("history_kind", ["submission", "sync_run"])
def test_historical_references_remain_but_token_and_visible_connection_are_removed(sync_client, history_kind):
    from app.models.operations import Submission, SyncRun

    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        connection_id = project.kobo_connection_id
        project.kobo_connection_id = None
        db.add(project)
        scope = dict(
            organization_id=project.organization_id,
            project_id=project.id,
            kobo_connection_id=connection_id,
            kobo_form_id="form-1",
        )
        item = (
            Submission(**scope, external_id="1", raw_answers={"visits": 12})
            if history_kind == "submission"
            else SyncRun(**scope)
        )
        db.add(item)
        db.commit()
        item_id = item.id
    response = client.delete(f"/kobo/connections/{connection_id}", headers=headers)
    assert response.status_code == 204, response.text
    assert all(row["id"] != str(connection_id) for row in client.get("/kobo/connections", headers=headers).json())
    assert client.get(f"/kobo/connections/{connection_id}/forms", headers=headers).status_code == 404
    assert client.delete(f"/kobo/connections/{connection_id}", headers=headers).status_code == 204
    with Session(engine) as db:
        archived = db.get(KoboConnection, connection_id)
        assert archived.is_deleted and not archived.is_verified
        assert archived.token_encrypted == ""
        assert db.get(Submission if history_kind == "submission" else SyncRun, item_id) is not None
        assert db.get(Project, UUID(project_id)) is not None
