"""Collection-only registration, reuse, tenant boundaries and honest sharing reports."""

from unittest.mock import Mock
from uuid import UUID

import pytest
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client
from test_workspace import context

from app.models.identity import Organization, OrganizationMembership, Role, User
from app.models.operations import (
    CollectorFormAccess,
    CollectorProfile,
    FieldAssignment,
    OrganizationAdminEvent,
    Project,
)


def payload(**kwargs):
    return dict(full_name="Field Collector", email="collector@example.com", kobo_username="collector_1", **kwargs)


@pytest.mark.parametrize("operation", ["new", "reassign", "edit"])
def test_duplicate_optional_email_returns_clear_conflict_without_changing_records(sync_client, operation):
    client, engine, project, headers, org = context(sync_client)
    with Session(engine) as db:
        profile = CollectorProfile(
            organization_id=UUID(org), full_name="Original Name", email="original@example.com", kobo_username="original"
        )
        other = CollectorProfile(
            organization_id=UUID(org), full_name="Other Person", email="taken@example.com", kobo_username="other"
        )
        db.add_all([profile, other])
        db.flush()
        profile_id = profile.id
        assignment = None
        if operation != "new":
            assignment = FieldAssignment(
                organization_id=UUID(org),
                project_id=UUID(project),
                collector_id=profile.id,
                is_enabled=operation == "edit",
            )
            db.add(assignment)
        db.commit()
        assignment_id = assignment.id if assignment else None
    root = f"/projects/{project}/enumerators"
    body = {
        "kobo_username": "new_user" if operation == "new" else "original",
        "full_name": "Changed Name",
        "email": "taken@example.com",
    }
    result = (
        client.patch(f"{root}/{assignment_id}", headers=headers, json=body)
        if operation == "edit"
        else client.post(root, headers=headers, json=body)
    )
    assert result.status_code == 409, result.text
    assert "email is already used by another enumerator" in result.json()["message"]
    with Session(engine) as db:
        assert len(db.exec(select(CollectorProfile).where(CollectorProfile.organization_id == UUID(org))).all()) == 2
        original = db.get(CollectorProfile, profile_id)
        assert original.email == "original@example.com" and original.full_name == "Original Name"
        if operation == "reassign":
            assert db.get(FieldAssignment, assignment_id).is_enabled is False
        if operation == "new":
            assert db.exec(select(FieldAssignment).where(FieldAssignment.project_id == UUID(project))).all() == []


@pytest.mark.parametrize(
    "details",
    [
        {},
        {"full_name": "Gabriel Akoi"},
        {"email": "gabriel@example.com"},
        {"full_name": "Gabriel Akoi", "email": "gabriel@example.com"},
    ],
)
def test_creation_requires_only_username_with_independent_optional_details(sync_client, monkeypatch, details):
    client, engine, project, headers, _ = context(sync_client)
    monkeypatch.setattr("app.routes.project_enumerators.verify_kobo_username", Mock())
    monkeypatch.setattr("app.routes.project_enumerators.decrypt_kobo_token", lambda *_: "test-token")
    root = f"/projects/{project}/enumerators"
    result = client.post(root, headers=headers, json={"kobo_username": "gabakoi_1", **details})
    assert result.status_code == 201, result.text
    assert result.json()["kobo_username"] == "gabakoi_1"
    assert result.json()["full_name"] == details.get("full_name")
    assert result.json()["email"] == details.get("email")
    assert client.post(root, headers=headers, json=details).status_code == 422


@pytest.mark.parametrize("legacy_flag", [False, True])
def test_creation_never_grants_kobo_access_even_with_legacy_activation_flag(sync_client, monkeypatch, legacy_flag):
    client, engine, project, headers, _ = context(sync_client)
    provider = Mock(return_value="verified_granted")
    monkeypatch.setattr("app.routes.project_enumerators.reconcile_collection_access", provider)
    created = client.post(f"/projects/{project}/enumerators", headers=headers, json=payload(grant_access=legacy_flag))
    assert created.status_code == 201, created.text
    form = created.json()["forms"][0]
    assert form["state"] == "not_configured"
    assert form["last_checked_at"] is None
    assert form["requested_action"] is None
    provider.assert_not_called()


def test_backend_assigns_connected_form_without_granting_or_resetting_access(sync_client, monkeypatch):
    client, engine, project, headers, _ = context(sync_client)
    provider = Mock()
    monkeypatch.setattr("app.routes.project_enumerators.reconcile_collection_access", provider)
    root = f"/projects/{project}/enumerators"
    response = client.post(root, headers=headers, json=payload())
    assert response.status_code == 201, response.text
    item = response.json()
    assert len(item["forms"]) == 1
    assert item["forms"][0]["is_selected"] is True
    assert item["forms"][0]["state"] == "not_configured"
    assert item["forms"][0]["form_id"] == "form-1"
    with Session(engine) as db:
        access = db.get(CollectorFormAccess, UUID(item["forms"][0]["id"]))
        access.state, access.permission_username = "verified_granted", "collector_1"
        db.add(access)
        db.commit()
    edited = client.patch(
        f"{root}/{item['id']}", headers=headers, json={"kobo_username": "collector_1", "counties": ["Bong"]}
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["forms"][0]["state"] == "verified_granted"
    with Session(engine) as db:
        current = db.get(Project, UUID(project))
        current.kobo_form_id = "form-2"
        db.add(current)
        db.commit()
    remapped = client.patch(f"{root}/{item['id']}", headers=headers, json={"kobo_username": "collector_1"})
    assert remapped.status_code == 200, remapped.text
    forms = {f["form_id"]: f for f in remapped.json()["forms"]}
    assert forms["form-1"]["is_selected"] is False
    assert forms["form-1"]["state"] == "verified_granted"
    assert forms["form-2"]["is_selected"] is True
    assert forms["form-2"]["state"] == "not_configured"
    provider.assert_not_called()


def test_manual_grant_confirmation_is_persisted_and_reassignment_requires_new_confirmation(sync_client, monkeypatch):
    from datetime import UTC, datetime

    client, engine, project, headers, _ = context(sync_client)
    root = f"/projects/{project}/enumerators"
    created = client.post(root, headers=headers, json=payload()).json()
    access_id = created["forms"][0]["id"]
    with Session(engine) as db:
        access = db.get(CollectorFormAccess, UUID(access_id))
        access.state, access.last_checked_at = "verified_granted", datetime.now(UTC)
        db.add(access)
        db.commit()
    assert client.get(root, headers=headers).json()["items"][0]["forms"][0]["grant_confirmed"] is False
    monkeypatch.setattr(
        "app.routes.project_enumerators.reconcile_collection_access", Mock(return_value="verified_granted")
    )
    granted = client.post(f"{root}/{created['id']}/forms/{access_id}/access", headers=headers, json={"action": "grant"})
    assert granted.status_code == 200, granted.text
    assert granted.json()["forms"][0]["grant_confirmed"] is True
    assert client.get(root, headers=headers).json()["items"][0]["forms"][0]["grant_confirmed"] is True
    assert client.delete(f"{root}/{created['id']}", headers=headers).status_code == 204
    reassigned = client.post(root, headers=headers, json={"kobo_username": "collector_1"})
    assert reassigned.status_code == 201, reassigned.text
    form = reassigned.json()["forms"][0]
    assert form["state"] == "not_configured"
    assert form["grant_confirmed"] is False
    assert form["last_checked_at"] is None


def test_username_only_add_reuses_profile_and_preserves_missing_private_details(sync_client, monkeypatch):
    client, engine, project, headers, org = context(sync_client)
    verify = Mock()
    monkeypatch.setattr("app.routes.project_enumerators.verify_kobo_username", verify)
    monkeypatch.setattr("app.routes.project_enumerators.decrypt_kobo_token", lambda *_: "test-token")
    root = f"/projects/{project}/enumerators"
    created = client.post(root, headers=headers, json={"kobo_username": "username_only", "counties": ["Bong"]})
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["full_name"] is None and item["email"] is None
    assert item["kobo_username"] == "username_only"
    verify.assert_called_once_with("https://kf.kobotoolbox.org", "test-token", "username_only")
    assert client.post(root, headers=headers, json={"kobo_username": "username_only"}).status_code == 409
    assert client.delete(f"{root}/{item['id']}", headers=headers).status_code == 204
    again = client.post(root, headers=headers, json={"kobo_username": "username_only"})
    assert again.status_code == 201, again.text
    assert again.json()["collector_id"] == item["collector_id"]
    path = f"{root}/{item['id']}"
    named = client.patch(path, headers=headers, json={"kobo_username": "username_only", "full_name": "Gabriel Akoi"})
    assert named.status_code == 200, named.text
    assert named.json()["full_name"] == "Gabriel Akoi"
    assert client.get(root, headers=headers).json()["items"][0]["full_name"] == "Gabriel Akoi"
    invalid_name = client.patch(path, headers=headers, json={"kobo_username": "username_only", "full_name": "   "})
    assert invalid_name.status_code == 422
    updated = client.patch(path, headers=headers, json={"kobo_username": "username_only", "email": "Real@Example.com"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["email"] == "real@example.com"
    assert client.get(root, headers=headers).json()["items"][0]["email"] == "real@example.com"
    invalid = client.patch(path, headers=headers, json={"kobo_username": "username_only", "email": "not-an-email"})
    assert invalid.status_code == 422
    unchanged = client.patch(path, headers=headers, json={"kobo_username": "username_only"})
    assert unchanged.json()["email"] == "real@example.com"
    cleared = client.patch(path, headers=headers, json={"kobo_username": "username_only", "email": None})
    assert cleared.status_code == 200
    assert cleared.json()["email"] is None
    with Session(engine) as db:
        assert len(db.exec(select(CollectorProfile).where(CollectorProfile.organization_id == UUID(org))).all()) == 1


def test_username_only_reuses_known_contact_details(sync_client, monkeypatch):
    client, engine, project, headers, org = context(sync_client)
    with Session(engine) as db:
        profile = CollectorProfile(
            organization_id=UUID(org),
            full_name="Known Collector",
            email="known@example.com",
            kobo_username="known_user",
        )
        db.add(profile)
        db.commit()
    verify = Mock()
    monkeypatch.setattr("app.routes.project_enumerators.verify_kobo_username", verify)
    result = client.post(f"/projects/{project}/enumerators", headers=headers, json={"kobo_username": "known_user"})
    assert result.status_code == 201, result.text
    assert result.json()["full_name"] == "Known Collector"
    assert result.json()["email"] == "known@example.com"
    verify.assert_called_once_with("https://kf.kobotoolbox.org", "private-token", "known_user")


@pytest.mark.parametrize("details", [{}, {"full_name": "Missing Person", "email": "missing@example.com"}])
def test_username_lookup_failure_does_not_create_contact(sync_client, monkeypatch, details):
    client, engine, project, headers, org = context(sync_client)
    monkeypatch.setattr("app.routes.project_enumerators.decrypt_kobo_token", lambda *_: "test-token")
    monkeypatch.setattr(
        "app.routes.project_enumerators.verify_kobo_username", Mock(side_effect=ValueError("Username not found."))
    )
    result = client.post(
        f"/projects/{project}/enumerators", headers=headers, json={"kobo_username": "missing", **details}
    )
    assert result.status_code == 422
    assert "Username not found" in result.text
    with Session(engine) as db:
        assert db.exec(select(CollectorProfile).where(CollectorProfile.organization_id == UUID(org))).all() == []
        assert db.exec(select(FieldAssignment).where(FieldAssignment.project_id == UUID(project))).all() == []
        assert (
            db.exec(select(OrganizationAdminEvent).where(OrganizationAdminEvent.organization_id == UUID(org))).all()
            == []
        )


def test_cached_contact_is_not_assigned_when_kobo_no_longer_has_the_username(sync_client, monkeypatch):
    client, engine, project, headers, org = context(sync_client)
    with Session(engine) as db:
        db.add(CollectorProfile(organization_id=UUID(org), kobo_username="removed_from_kobo"))
        db.commit()
    monkeypatch.setattr(
        "app.routes.project_enumerators.verify_kobo_username", Mock(side_effect=ValueError("Username not found."))
    )
    result = client.post(
        f"/projects/{project}/enumerators", headers=headers, json={"kobo_username": "removed_from_kobo"}
    )
    assert result.status_code == 422
    with Session(engine) as db:
        assert db.exec(select(FieldAssignment).where(FieldAssignment.project_id == UUID(project))).all() == []
        assert len(db.exec(select(CollectorProfile).where(CollectorProfile.organization_id == UUID(org))).all()) == 1


def test_county_coverage_create_edit_all_and_validation(sync_client):
    client, engine, project, headers, org = context(sync_client)
    root = f"/projects/{project}/enumerators"
    created = client.post(root, headers=headers, json=payload(counties=["Nimba", "Bong"]))
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["counties"] == ["Bong", "Nimba"]
    assert client.get(root, headers=headers).json()["items"][0]["counties"] == ["Bong", "Nimba"]
    path = f"{root}/{item['id']}"
    legacy = client.patch(path, headers=headers, json={"kobo_username": "collector_1"})
    assert legacy.json()["counties"] == ["Bong", "Nimba"]
    for invalid in ([], ["Bong", "Bong"], ["Unknown county"]):
        assert (
            client.patch(path, headers=headers, json={"kobo_username": "collector_1", "counties": invalid}).status_code
            == 422
        )
    all_counties = client.patch(path, headers=headers, json={"kobo_username": "collector_1", "counties": None})
    assert all_counties.status_code == 200, all_counties.text
    assert all_counties.json()["counties"] is None
    with Session(engine) as db:
        assert db.get(FieldAssignment, UUID(item["id"])).counties is None


def test_collection_only_forms_remove_reassign_and_audit(sync_client):
    client, engine, project, headers, org = context(sync_client)
    root = f"/projects/{project}/enumerators"
    initial = client.get(root, headers=headers).json()
    assert initial["items"] == []
    form = initial["connected_forms"][0]
    body = payload(
        forms=[
            dict(connection_id=form["connection_id"], form_id=form["form_id"], state="reported_configured_unverified")
        ]
    )
    response = client.post(root, headers=headers, json=body)
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["forms"][0]["state"] == "reported_configured_unverified"
    assert item["membership_id"] is None
    with Session(engine) as db:
        assert db.exec(select(User).where(User.email == body["email"])).first() is None
        assert db.exec(select(OrganizationAdminEvent)).all()
    assert client.post(root, headers=headers, json=body).status_code == 409
    assert (
        client.post(
            root, headers=headers, json={"collector_id": item["collector_id"], "kobo_username": "collector_1"}
        ).status_code
        == 409
    )
    assert client.delete(f"{root}/{item['id']}", headers=headers).status_code == 204
    removed = client.get(root, headers=headers).json()["items"][0]
    assert not removed["is_active"] and removed["forms"][0]["state"] == "reported_configured_unverified"
    assert (
        client.post(
            root, headers=headers, json={"collector_id": item["collector_id"], "kobo_username": "collector_1"}
        ).json()["id"]
        == item["id"]
    )
    with Session(engine) as db:
        assert len(db.exec(select(FieldAssignment)).all()) == 1
        actions = [e.action for e in db.exec(select(OrganizationAdminEvent)).all()]
        assert "enumerator.removed_kobo_revocation_required" in actions


def test_existing_member_reuse_multiple_projects_and_legacy_assignment(sync_client):
    client, engine, project, headers, org = context(sync_client)
    with Session(engine) as db:
        person = User(email="member@example.com", full_name="Existing Member", password_hash="unused")
        db.add(person)
        db.flush()
        member = OrganizationMembership(organization_id=UUID(org), user_id=person.id, role=Role.ENUMERATOR)
        db.add(member)
        db.flush()
        old = FieldAssignment(
            organization_id=UUID(org), membership_id=member.id, project_id=UUID(project), is_enabled=False
        )
        first = db.get(Project, UUID(project))
        other = Project(
            organization_id=first.organization_id,
            organization_sector_id=first.organization_sector_id,
            name="Other",
            created_by_id=first.created_by_id,
        )
        db.add_all([old, other])
        db.commit()
        member_id, old_id, other_id = str(member.id), str(old.id), str(other.id)
    root = f"/projects/{project}/enumerators"
    assert any(r["membership_id"] == member_id for r in client.get(root + "/eligible", headers=headers).json())
    first = client.post(root, headers=headers, json={"membership_id": member_id, "kobo_username": "member_kobo"}).json()
    assert first["id"] == old_id
    second = client.post(
        f"/projects/{other_id}/enumerators",
        headers=headers,
        json={"collector_id": first["collector_id"], "kobo_username": "member_kobo"},
    )
    assert second.status_code == 422
    with Session(engine) as db:
        target = db.get(Project, UUID(other_id))
        source = db.get(Project, UUID(project))
        target.kobo_connection_id = source.kobo_connection_id
        target.kobo_form_id = source.kobo_form_id
        db.add(target)
        db.commit()
    second = client.post(
        f"/projects/{other_id}/enumerators",
        headers=headers,
        json={"collector_id": first["collector_id"], "kobo_username": "member_kobo"},
    )
    assert second.status_code == 201, second.text
    assert second.json()["collector_id"] == first["collector_id"]
    with Session(engine) as db:
        assert len(db.exec(select(CollectorProfile)).all()) == 1


def test_invalid_forms_identity_and_unverified_state(sync_client):
    client, _, project, headers, _ = context(sync_client)
    root = f"/projects/{project}/enumerators"
    form = client.get(root, headers=headers).json()["connected_forms"][0]
    for bad in [
        {key: value for key, value in payload().items() if key != "kobo_username"},
        dict(payload(), kobo_username="   "),
        dict(payload(), forms=[dict(connection_id=form["connection_id"], form_id="foreign")]),
        dict(payload(), kobo_username="https://invalid/user"),
        dict(
            payload(),
            forms=[dict(connection_id=form["connection_id"], form_id=form["form_id"], state="verified_granted")],
        ),
        dict(
            payload(),
            kobo_username=None,
            forms=[
                dict(
                    connection_id=form["connection_id"], form_id=form["form_id"], state="reported_configured_unverified"
                )
            ],
        ),
    ]:
        assert client.post(root, headers=headers, json=bad).status_code == 422
    assert client.get(root, headers=headers).json()["items"] == []
    item = client.post(root, headers=headers, json=payload()).json()
    changed = client.patch(
        f"{root}/{item['id']}",
        headers=headers,
        json={
            "kobo_username": "new_name",
            "forms": [dict(connection_id=form["connection_id"], form_id=form["form_id"], state="pending")],
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["forms"][0]["state"] == "pending"


def test_cross_tenant_and_unauthorized_roles(sync_client):
    client, engine, project, headers, org = context(sync_client)
    root = f"/projects/{project}/enumerators"
    item = client.post(root, headers=headers, json=payload()).json()
    with Session(engine) as db:
        original = db.get(Project, UUID(project))
        other_org = Organization(name="Foreign", slug="foreign")
        db.add(other_org)
        db.flush()
        foreign = Project(
            organization_id=other_org.id,
            organization_sector_id=original.organization_sector_id,
            name="Foreign",
            created_by_id=original.created_by_id,
        )
        db.add(foreign)
        db.commit()
        foreign_id = str(foreign.id)
    foreign_root = f"/projects/{foreign_id}/enumerators"
    for method, path, body in [
        ("get", foreign_root, None),
        ("get", foreign_root + "/eligible", None),
        ("post", foreign_root, payload()),
        ("patch", f"{foreign_root}/{item['id']}", {"kobo_username": "collector_1"}),
        ("delete", f"{foreign_root}/{item['id']}", None),
    ]:
        response = client.request(method, path, headers=headers, **({"json": body} if body is not None else {}))
        assert response.status_code == 404
    with Session(engine) as db:
        member = db.exec(
            select(OrganizationMembership).where(OrganizationMembership.organization_id == UUID(org))
        ).one()
        member.role = Role.ENUMERATOR
        db.add(member)
        db.commit()
    for method, path, body in [
        ("get", root, None),
        ("get", root + "/eligible", None),
        ("post", root, payload()),
        ("patch", f"{root}/{item['id']}", {"kobo_username": "collector_1"}),
        ("delete", f"{root}/{item['id']}", None),
    ]:
        response = client.request(method, path, headers=headers, **({"json": body} if body is not None else {}))
        assert response.status_code == 403


def test_identity_change_resets_other_projects_and_stale_mapping_is_visible(sync_client):
    client, engine, project, headers, org = context(sync_client)
    root = f"/projects/{project}/enumerators"
    form = client.get(root, headers=headers).json()["connected_forms"][0]
    forms = [dict(connection_id=form["connection_id"], form_id=form["form_id"], state="reported_configured_unverified")]
    first = client.post(root, headers=headers, json=payload(forms=forms)).json()
    with Session(engine) as db:
        original = db.get(Project, UUID(project))
        other = Project(
            organization_id=original.organization_id,
            organization_sector_id=original.organization_sector_id,
            created_by_id=original.created_by_id,
            name="Second collection",
            kobo_connection_id=original.kobo_connection_id,
            kobo_form_id=original.kobo_form_id,
        )
        db.add(other)
        db.commit()
        other_id = str(other.id)
    second_root = f"/projects/{other_id}/enumerators"
    assert (
        client.post(
            second_root,
            headers=headers,
            json={"collector_id": first["collector_id"], "kobo_username": "collector_1", "forms": forms},
        ).status_code
        == 201
    )
    assert (
        client.patch(f"{root}/{first['id']}", headers=headers, json={"kobo_username": "different"}).status_code == 200
    )
    assert client.get(second_root, headers=headers).json()["items"][0]["forms"][0]["state"] == "not_configured"
    with Session(engine) as db:
        other = db.get(Project, UUID(other_id))
        other.kobo_form_id = "replacement"
        db.add(other)
        db.commit()
    assert not client.get(second_root, headers=headers).json()["items"][0]["forms"][0]["mapping_current"]


def test_real_migration_roundtrip_preserves_legacy_assignments(sync_client, monkeypatch):
    import pytest
    from alembic.config import Config

    from alembic import command
    from app.core.config import get_settings

    client, engine, project, headers, org = context(sync_client)
    with Session(engine) as db:
        admin = db.exec(select(OrganizationMembership)).one()
        assignment = FieldAssignment(organization_id=UUID(org), membership_id=admin.id, project_id=UUID(project))
        db.add(assignment)
        db.commit()
        identifier = assignment.id
        admin_id = admin.id
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "development")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", str(engine.url))
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "head")
        command.downgrade(config, "0030_project_actions")
        command.upgrade(config, "head")
        with Session(engine) as db:
            assert db.get(FieldAssignment, identifier).membership_id == admin_id
            assert db.get(Project, UUID(project)).kobo_form_id == "form-1"
        assert client.post(f"/projects/{project}/enumerators", headers=headers, json=payload()).status_code == 201
        with pytest.raises(RuntimeError, match="Downgrade refused"):
            command.downgrade(config, "0030_project_actions")
    finally:
        get_settings.cache_clear()
