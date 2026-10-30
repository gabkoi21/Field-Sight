"""Collection-only registration, reuse, tenant boundaries and honest sharing reports."""

from uuid import UUID

from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client
from test_workspace import context

from app.models.identity import Organization, OrganizationMembership, Role, User
from app.models.operations import CollectorProfile, FieldAssignment, OrganizationAdminEvent, Project


def payload(**kwargs):
    return dict(full_name="Field Collector", email="collector@example.com", kobo_username="collector_1", **kwargs)


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
