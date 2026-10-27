"""Disposable School Feeding action workflow and authorization regression tests."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import func
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.models.identity import Organization, OrganizationMembership, Role, User
from app.models.operations import FieldAssignment, Indicator, Project, ProjectAction, ProjectActionEvent, Submission


def endpoint(project, action=None):
    return f"/projects/{project}/actions" + (f"/{action}" if action else "")


def create(fixture, **values):
    client, _, project, headers = fixture
    response = client.post(
        endpoint(project), headers=headers, json={"title": "Investigate school food shortage", **values}
    )
    assert response.status_code == 201, response.text
    return response.json()


def edit(fixture, action, **changes):
    client, _, project, headers = fixture
    return client.patch(
        endpoint(project, action["id"]), headers=headers, json={"expected_version": action["version"], **changes}
    )


def test_school_feeding_action_full_lifecycle_and_audit(sync_client):
    client, engine, project, headers = sync_client
    with Session(engine) as db:
        owner = db.get(Project, UUID(project))
        record = Submission(
            organization_id=owner.organization_id,
            project_id=owner.id,
            kobo_connection_id=owner.kobo_connection_id,
            kobo_form_id="form-1",
            external_id="synthetic-school-1",
            raw_answers={"school": "Synthetic school", "shortage": "yes", "portions": 215},
        )
        member = db.exec(select(OrganizationMembership)).one()
        actor = str(member.user_id)
        db.add(record)
        db.commit()
        submission = str(record.id)
    action = create(
        sync_client,
        submission_id=submission,
        assigned_user_id=actor,
        priority="high",
        due_date=(datetime.now(UTC).date() - timedelta(days=1)).isoformat(),
    )
    assert action["overdue"] and action["status"] == "open"
    assert edit(sync_client, action, status="resolved", resolution_summary="Done").status_code == 422
    action = edit(sync_client, action, status="in_progress", note="Calling the school").json()
    assert edit(sync_client, action, status="resolved").status_code == 422
    action = edit(
        sync_client, action, status="resolved", resolution_summary="Verified replacement food delivery"
    ).json()
    assert action["resolved_at"].endswith("+00:00") and not action["overdue"]
    assert edit(sync_client, action, status="closed").status_code == 422
    action = edit(sync_client, action, status="closed", note="Officer checked school delivery register").json()
    assert action["closed_at"] and action["resolution_summary"]
    detail = client.get(endpoint(project, action["id"]), headers=headers).json()
    assert detail["history_total"] == 4 and len(detail["history"]) == 4
    assert all(event["actor_id"] == actor and event["occurred_at"].endswith("+00:00") for event in detail["history"])
    assert detail["history"][0]["previous_values"]["status"] == "resolved"
    assert detail["history"][0]["new_values"]["status"] == "closed"
    assert edit(sync_client, action, title="Invisible closed edit").status_code == 409
    reopened = edit(sync_client, action, status="open", note="New shortage reported").json()
    assert reopened["resolved_at"] is None and reopened["closed_at"] is None and reopened["overdue"]
    assert reopened["resolution_summary"] is None


def test_assignment_requires_active_same_project_member(sync_client):
    client, engine, project, headers = sync_client
    with Session(engine) as db:
        owner = db.get(Project, UUID(project))
        account = User(email="field@example.test", password_hash="unused")
        db.add(account)
        db.flush()
        member = OrganizationMembership(organization_id=owner.organization_id, user_id=account.id, role=Role.ENUMERATOR)
        db.add(member)
        db.commit()
        identifier = str(account.id)
        member_id = member.id
        organization = owner.organization_id
    response = client.post(endpoint(project), headers=headers, json={"title": "Assign", "assigned_user_id": identifier})
    assert response.status_code == 422
    with Session(engine) as db:
        db.add(FieldAssignment(organization_id=organization, project_id=UUID(project), membership_id=member_id))
        db.commit()
    action = create(sync_client, assigned_user_id=identifier)
    with Session(engine) as db:
        member = db.get(OrganizationMembership, member_id)
        member.is_active = False
        db.add(member)
        db.commit()
    assert edit(sync_client, action, assigned_user_id=identifier).status_code == 422
    assert edit(sync_client, action, assigned_user_id=None).json()["assigned_user_id"] is None


def test_actions_reject_cross_project_and_tenant_links(sync_client):
    client, engine, project, headers = sync_client
    action = create(sync_client)
    with Session(engine) as db:
        owner = db.get(Project, UUID(project))
        other = Project(
            organization_id=owner.organization_id,
            organization_sector_id=owner.organization_sector_id,
            created_by_id=owner.created_by_id,
            name="Another project",
        )
        db.add(other)
        db.flush()
        evidence = Submission(
            organization_id=owner.organization_id,
            project_id=other.id,
            kobo_connection_id=owner.kobo_connection_id,
            kobo_form_id="other",
            external_id="other",
            raw_answers={},
        )
        indicator = Indicator(
            organization_id=owner.organization_id,
            project_id=other.id,
            created_by_id=owner.created_by_id,
            name="Other",
            code="OTHER",
            unit="number",
        )
        db.add_all([evidence, indicator])
        db.commit()
        other_id, submission_id, indicator_id = str(other.id), str(evidence.id), str(indicator.id)
    assert edit(sync_client, action, submission_id=submission_id).status_code == 422
    assert edit(sync_client, action, indicator_id=indicator_id).status_code == 422
    assert client.get(endpoint(other_id, action["id"]), headers=headers).status_code == 404
    assert client.get(endpoint(other_id), headers=headers).json()["total"] == 0
    with Session(engine) as db:
        foreign = Organization(name="Foreign", slug="foreign")
        db.add(foreign)
        db.flush()
        membership = db.exec(select(OrganizationMembership)).one()
        membership.organization_id = foreign.id
        db.add(membership)
        db.commit()
    assert client.get(endpoint(project), headers=headers).status_code == 404
    assert client.get(endpoint(project, action["id"]), headers=headers).status_code == 404
    assert edit(sync_client, action, title="Tenant attack").status_code == 404
    assert client.post(endpoint(project), headers=headers, json={"title": "Tenant attack"}).status_code == 404


def test_actions_deny_enumerators_and_forged_fields(sync_client):
    client, engine, project, headers = sync_client
    action = create(sync_client)
    assert edit(sync_client, action, version=100).status_code == 422
    assert edit(sync_client, action, organization_id=project).status_code == 422
    assert edit(sync_client, action, title=None).status_code == 422
    with Session(engine) as db:
        member = db.exec(select(OrganizationMembership)).one()
        member.role = Role.ENUMERATOR
        db.add(member)
        db.commit()
    assert client.get(endpoint(project), headers=headers).status_code == 403
    assert edit(sync_client, action, title="Role attack").status_code == 403
    assert client.post(endpoint(project), headers=headers, json={"title": "Role attack"}).status_code == 403


def test_actions_concurrency_notes_and_failed_transaction(sync_client):
    client, engine, project, headers = sync_client
    action = create(sync_client)
    changed = edit(sync_client, action, description="Checked supplier", note="Officer findings").json()
    assert changed["version"] == 2
    assert edit(sync_client, action, title="Stale edit").status_code == 409
    detail = client.get(endpoint(project, action["id"]), headers=headers).json()
    assert detail["history_total"] == 2
    assert detail["history"][0]["note"] == "Officer findings"
    with patch("app.routes.actions.record_event", side_effect=RuntimeError("Audit storage unavailable")):
        with pytest.raises(RuntimeError):
            client.post(endpoint(project), headers=headers, json={"title": "Must roll back"})
    with patch("app.routes.actions.record_event", side_effect=RuntimeError("Audit storage unavailable")):
        with pytest.raises(RuntimeError):
            edit(sync_client, changed, description="Must roll back")
    with Session(engine) as db:
        stored = db.get(ProjectAction, UUID(action["id"]))
        assert stored.description == "Checked supplier" and stored.version == 2
        assert db.exec(select(func.count()).select_from(ProjectAction)).one() == 1
        assert db.exec(select(func.count()).select_from(ProjectActionEvent)).one() == 2


def test_action_filters_pagination_overdue_and_archival(sync_client):
    client, engine, project, headers = sync_client
    today = datetime.now(UTC).date()
    first = create(
        sync_client, title="Urgent supplier", priority="high", due_date=(today - timedelta(days=1)).isoformat()
    )
    create(sync_client, title="Routine supplier", due_date=today.isoformat())
    create(sync_client, title="No due date")
    result = client.get(endpoint(project) + "?limit=1&offset=1", headers=headers).json()
    assert result["total"] == 3 and len(result["items"]) == 1
    assert result["summary"] == {"unresolved": 3, "overdue": 1, "high_priority": 1}
    assert client.get(endpoint(project) + "?overdue=true", headers=headers).json()["total"] == 1
    assert client.get(endpoint(project) + "?overdue=false", headers=headers).json()["total"] == 2
    assert (
        client.get(endpoint(project) + "?priority=high&search=Urgent&status=open", headers=headers).json()["total"] == 1
    )
    assert client.get(endpoint(project) + "?due_from=2026-10-30&due_to=2026-10-01", headers=headers).status_code == 422
    with Session(engine) as db:
        row = db.get(Project, UUID(project))
        organization = str(row.organization_id)
        row.status = "archived"
        db.add(row)
        db.commit()
    assert client.post(endpoint(project), headers=headers, json={"title": "Archived"}).status_code == 409
    assert edit(sync_client, first, title="Archived edit").status_code == 409
    assert client.get(endpoint(project, first["id"]), headers=headers).json()["history_total"] == 1
    assert client.delete(f"/organizations/{organization}/projects/{project}", headers=headers).status_code == 409
    assert client.get(endpoint(project) + "?limit=101", headers=headers).status_code == 422
