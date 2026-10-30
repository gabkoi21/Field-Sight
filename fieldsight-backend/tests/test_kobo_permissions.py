"""Kobo contract and API reconciliation tests; no live permissions are changed."""

import json
from uuid import UUID, uuid4

import httpx
import pytest
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client
from test_project_enumerators import payload

from app.core.kobo_permissions import reconcile_collection_access
from app.models.identity import Organization, OrganizationMembership, Role
from app.models.operations import CollectorFormAccess, FieldAssignment, OrganizationAdminEvent, Project

SERVER = "https://kf.kobotoolbox.org"
ASSET = "/api/v2/assets/form-1/"
LIST = ASSET + "permission-assignments/"


class Provider:
    def __init__(self, monkeypatch):
        self.rows = []
        self.calls = []
        self.fail = None
        self.apply = True
        self.asset = dict(
            uid="form-1",
            owner=SERVER + "/api/v2/users/owner/",
            has_deployment=True,
            deployment__active=True,
            effective_permissions=[{"codename": "manage_asset"}],
            assignable_permissions=[{"url": SERVER + "/api/v2/permissions/add_submissions/"}],
        )
        original = httpx.Client
        monkeypatch.setattr(
            "app.core.kobo_permissions.httpx.Client",
            lambda **kw: original(**kw, transport=httpx.MockTransport(self.handle)),
        )

    def permission(self, code, username="collector_1"):
        return dict(
            url=SERVER + LIST + f"p{len(self.rows)}X/",
            user=SERVER + f"/api/v2/users/{username}/",
            permission=SERVER + f"/api/v2/permissions/{code}/",
        )

    def handle(self, request):
        self.calls.append((request.method, request.url.path))
        assert request.headers["Authorization"] == "Token secret"
        if self.fail:
            if self.fail == "timeout":
                raise httpx.ReadTimeout("secret", request=request)
            return httpx.Response(self.fail, json={"detail": "secret"})
        if request.url.path == ASSET:
            return httpx.Response(200, json=self.asset)
        if request.method == "GET":
            return httpx.Response(200, json=self.rows)
        if request.method == "POST":
            body = json.loads(request.content)
            assert body["user"] == SERVER + "/api/v2/users/collector_1/"
            assert body["permission"] in {
                SERVER + "/api/v2/permissions/add_submissions/",
                SERVER + "/api/v2/permissions/view_asset/",
            }
            if self.apply:
                code = body["permission"].rstrip("/").rsplit("/", 1)[-1]
                self.rows.append(self.permission(code))
            return httpx.Response(201, json={})
        if request.method == "DELETE":
            if self.apply:
                self.rows = [p for p in self.rows if p["url"] != str(request.url)]
            return httpx.Response(204)
        raise AssertionError(request)


def test_provider_grant_verify_revoke_idempotent_and_preserves_other_permissions(monkeypatch):
    provider = Provider(monkeypatch)
    provider.rows.append(provider.permission("view_submissions"))
    assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "grant") == "verified_granted"
    assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "grant") == "verified_granted"
    assert sum(method == "POST" for method, _ in provider.calls) == 2
    assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "verify") == "verified_granted"
    assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "revoke") == "revoked"
    assert any(p["permission"].endswith("/view_submissions/") for p in provider.rows)
    assert any(p["permission"].endswith("/view_asset/") for p in provider.rows)


def test_collection_only_access_is_repaired_with_explicit_view_assignment(monkeypatch):
    provider = Provider(monkeypatch)
    provider.rows.append(provider.permission("add_submissions"))
    assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "verify") == "not_configured"
    assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "grant") == "verified_granted"
    assert sum(method == "POST" for method, _ in provider.calls) == 1


def test_view_form_alone_does_not_verify_collection_permission(monkeypatch):
    provider = Provider(monkeypatch)
    provider.rows.append(provider.permission("view_asset"))
    assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "verify") == "not_configured"


@pytest.mark.parametrize("failure", ["timeout", 401, 403, 404, 500])
def test_provider_errors_are_sanitized(monkeypatch, failure):
    provider = Provider(monkeypatch)
    provider.fail = failure
    with pytest.raises(ValueError) as exc:
        reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "grant")
    assert "secret" not in str(exc.value)


def test_provider_success_without_change_and_failed_revoke_are_not_verified(monkeypatch):
    provider = Provider(monkeypatch)
    provider.apply = False
    with pytest.raises(ValueError, match="not confirmed"):
        reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "grant")
    provider.rows.append(provider.permission("add_submissions"))
    with pytest.raises(ValueError, match="still reports"):
        reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "revoke")


@pytest.mark.parametrize("case", ["owner", "anonymous", "manager", "unsupported", "unsafe_url", "no_manage"])
def test_provider_refuses_ambiguous_or_unsafe_permissions(monkeypatch, case):
    provider = Provider(monkeypatch)
    if case == "owner":
        provider.asset["owner"] = SERVER + "/api/v2/users/collector_1/"
    elif case == "anonymous":
        provider.rows.append(provider.permission("add_submissions", "AnonymousUser"))
    elif case == "manager":
        provider.rows.append(provider.permission("manage_asset"))
    elif case == "unsupported":
        provider.asset["assignable_permissions"] = []
    elif case == "no_manage":
        provider.asset["effective_permissions"] = []
    else:
        row = provider.permission("add_submissions")
        row["url"] = "https://attacker.example/permission/"
        provider.rows.append(row)
    with pytest.raises(ValueError):
        reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "revoke")
    assert not any(method in {"POST", "DELETE"} for method, _ in provider.calls)


def assigned(fixture):
    client, engine, project, headers = fixture
    root = f"/projects/{project}/enumerators"
    form = client.get(root, headers=headers).json()["connected_forms"][0]
    item = client.post(
        root, headers=headers, json=payload(forms=[dict(connection_id=form["connection_id"], form_id=form["form_id"])])
    ).json()
    return client, engine, project, headers, root, item, f"{root}/{item['id']}/forms/{item['forms'][0]['id']}/access"


def test_api_failed_grant_retry_revocation_and_audit(sync_client, monkeypatch):
    client, engine, project, headers, root, item, path = assigned(sync_client)
    monkeypatch.setattr("app.routes.project_enumerators.decrypt_kobo_token", lambda *args: "secret")
    provider = Provider(monkeypatch)
    provider.fail = "timeout"
    failed = client.post(path, headers=headers, json={"action": "grant"})
    assert failed.status_code == 200, failed.text
    assert failed.json()["forms"][0]["state"] == "failed"
    assert failed.json()["is_active"]
    assert "secret" not in failed.text
    provider.fail = None
    granted = client.post(path, headers=headers, json={"action": "grant"}).json()
    assert granted["forms"][0]["state"] == "verified_granted"
    assert granted["forms"][0]["last_checked_at"]
    assert client.patch(f"{root}/{item['id']}", headers=headers, json={"kobo_username": "changed"}).status_code == 409
    provider.apply = False
    failed_revoke = client.post(path, headers=headers, json={"action": "revoke"}).json()
    assert failed_revoke["forms"][0]["state"] == "failed" and failed_revoke["is_active"]
    provider.apply = True
    assert client.post(path, headers=headers, json={"action": "revoke"}).json()["forms"][0]["state"] == "revoked"
    assert client.post(path, headers=headers, json={"action": "verify"}).json()["forms"][0]["state"] == "revoked"
    assert client.patch(f"{root}/{item['id']}", headers=headers, json={"kobo_username": "changed"}).status_code == 200
    with Session(engine) as db:
        assert db.get(FieldAssignment, UUID(item["id"])).is_enabled
        assert any("kobo_grant:verified_granted" in e.action for e in db.exec(select(OrganizationAdminEvent)).all())


def test_api_stale_and_nested_ids_and_pending_operations(sync_client, monkeypatch):
    client, engine, project, headers, root, item, path = assigned(sync_client)
    monkeypatch.setattr("app.routes.project_enumerators.decrypt_kobo_token", lambda *args: "secret")
    provider = Provider(monkeypatch)
    wrong_path = path.replace(item["forms"][0]["id"], str(uuid4()))
    assert client.post(wrong_path, headers=headers, json={"action": "grant"}).status_code == 404
    with Session(engine) as db:
        form = db.get(CollectorFormAccess, UUID(item["forms"][0]["id"]))
        form.state, form.operation_id = "pending", "active"
        db.add(form)
        db.commit()
    assert client.post(path, headers=headers, json={"action": "grant"}).status_code == 409
    assert client.delete(f"{root}/{item['id']}", headers=headers).status_code == 409
    with Session(engine) as db:
        form = db.get(CollectorFormAccess, UUID(item["forms"][0]["id"]))
        form.state = "failed"
        project_row = db.get(Project, UUID(project))
        project_row.kobo_form_id = "replacement"
        db.add_all([form, project_row])
        db.commit()
    assert client.post(path, headers=headers, json={"action": "grant"}).status_code == 409
    assert provider.calls == []
    assert client.post(path, headers=headers, json={"action": "revoke"}).json()["forms"][0]["state"] == "revoked"


def test_api_denies_foreign_projects_and_non_admins_before_provider_calls(sync_client, monkeypatch):
    client, engine, project, headers, root, item, path = assigned(sync_client)
    provider = Provider(monkeypatch)
    with Session(engine) as db:
        original = db.get(Project, UUID(project))
        org = Organization(name="Other", slug="other-sharing")
        db.add(org)
        db.flush()
        other = Project(
            organization_id=org.id,
            organization_sector_id=original.organization_sector_id,
            name="Other",
            created_by_id=original.created_by_id,
        )
        db.add(other)
        db.commit()
        foreign_id = str(other.id)
    for action in ("grant", "verify", "revoke"):
        assert (
            client.post(path.replace(project, foreign_id), headers=headers, json={"action": action}).status_code == 404
        )
    with Session(engine) as db:
        member = db.exec(select(OrganizationMembership)).one()
        member.role = Role.ENUMERATOR
        db.add(member)
        db.commit()
    for action in ("grant", "verify", "revoke"):
        assert client.post(path, headers=headers, json={"action": action}).status_code == 403
    assert provider.calls == []


def test_provider_timeout_after_grant_is_reconciled_without_duplicate_mutation(monkeypatch):
    provider = Provider(monkeypatch)
    original = provider.handle
    interrupted = False

    def handle(request):
        nonlocal interrupted
        response = original(request)
        if request.method == "POST" and not interrupted:
            interrupted = True
            provider.fail = "timeout"
        return response

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(provider, "handle", handle)
        with pytest.raises(ValueError, match="may have completed"):
            reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "grant")
        provider.fail = None
        assert reconcile_collection_access(SERVER, "secret", "form-1", "collector_1", "grant") == "verified_granted"
    # View succeeds, the first Add request times out, then only Add is retried.
    assert sum(method == "POST" for method, _ in provider.calls) == 3
    assert len(provider.rows) == 2


def test_permission_migration_preserves_reports_and_refuses_losing_provider_identity(sync_client, monkeypatch):
    from alembic.config import Config
    from sqlalchemy import text

    from alembic import command
    from app.core.config import get_settings

    client, engine, project, headers, root, item, path = assigned(sync_client)
    access_id = item["forms"][0]["id"]
    # Recreate the actual 0031 shape; the baseline imports current model metadata.
    with engine.begin() as connection:
        for column in ("permission_username", "last_error", "operation_id", "requested_action", "last_checked_at"):
            connection.execute(text(f"ALTER TABLE collector_form_access DROP COLUMN {column}"))
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "development")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", str(engine.url))
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "0031_project_enumerators")
        command.upgrade(config, "head")
        with Session(engine) as db:
            row = db.get(CollectorFormAccess, UUID(access_id))
            assert row.form_id == "form-1" and row.permission_username is None
            row.permission_username = "collector_1"
            db.add(row)
            db.commit()
        with pytest.raises(RuntimeError, match="Downgrade refused"):
            command.downgrade(config, "0031_project_enumerators")
    finally:
        get_settings.cache_clear()
