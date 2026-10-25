"""Review persistence, database pagination and tenant protection."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.models.identity import Organization, OrganizationMembership, Role, User
from app.models.operations import Project, Submission


def seed(engine, project_id, count=1):
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        for index in range(count):
            db.add(Submission(project_id=project.id, organization_id=project.organization_id,
                kobo_connection_id=project.kobo_connection_id, kobo_form_id="form-1", external_id=str(index),
                submitted_at=datetime(2026, 10, 1, tzinfo=UTC), raw_answers={"_duration": 10, "number": index}))
        db.commit()
        return db.exec(select(Submission).order_by(Submission.external_id)).first().id


def test_validation_queue_pages_and_saved_review_activity(sync_client):
    client, engine, project, headers = sync_client
    submission = seed(engine, project, 23)
    response = client.post(f"/quality/run?project_id={project}", headers=headers)
    assert response.status_code == 200, response.text
    first = client.get(f"/quality/queue?project_id={project}&limit=10", headers=headers).json()
    second = client.get(f"/quality/queue?project_id={project}&limit=10&offset=10", headers=headers).json()
    assert first["total"] == 23 and first["counts"]["needs_review"] == 23
    assert len(first["items"]) == len(second["items"]) == 10
    assert not {item["id"] for item in first["items"]} & {item["id"] for item in second["items"]}
    path = f"/submissions/{submission}"
    detail = client.get(path + "/review", headers=headers).json()
    reviewer = detail["reviewers"][0]["id"]
    assert client.patch(path + "/reviewer", headers=headers, json={"reviewer_id": reviewer}).status_code == 200
    response = client.post(path + "/review-notes", headers=headers, json={"note": "Checked interview context."})
    assert response.status_code == 201
    assert client.patch(path + "/review-status", headers=headers,
                        json={"status": "ready", "note": "Verified with collector."}).status_code == 200
    persisted = client.get(path + "/review", headers=headers).json()
    assert persisted["reviewer_id"] == reviewer and persisted["submission"]["review_status"] == "ready"
    assert {event["action"] for event in persisted["events"]} == {"validation", "assignment", "note", "status"}
    assert any(event["note"] == "Verified with collector." for event in persisted["events"])
    assert all(event["occurred_at"].endswith("Z") for event in persisted["events"])
    assert client.get(f"/quality/queue?project_id={project}", headers=headers).json()["total"] == 22
    response = client.get(f"/quality/queue?project_id={project}&include_reviewed=true", headers=headers)
    assert response.json()["total"] == 23


def test_review_rejects_cross_tenant_and_inactive_reviewers(sync_client):
    client, engine, project, headers = sync_client
    submission = seed(engine, project)
    path = f"/submissions/{submission}"
    assert client.patch(path + "/reviewer", headers=headers, json={"reviewer_id": str(uuid4())}).status_code == 422
    assert client.post(path + "/review-notes", headers=headers, json={"note": "   "}).status_code == 422
    with Session(engine) as db:
        org = Organization(name="Other", slug="other")
        other = User(email="other@example.com", password_hash="unused")
        db.add_all([org, other])
        db.flush()
        db.add(OrganizationMembership(organization_id=org.id, user_id=other.id, role=Role.ORGANIZATION_ADMIN))
        db.commit()
        foreign_reviewer = str(other.id)
        other_org_id = org.id
    assert client.patch(path + "/reviewer", headers=headers, json={"reviewer_id": foreign_reviewer}).status_code == 422
    with Session(engine) as db:
        item = db.get(Submission, submission)
        item.organization_id = other_org_id
        db.add(item)
        db.commit()
    assert client.get(path + "/review", headers=headers).status_code == 404
    assert client.patch(path + "/review-status", headers=headers, json={"status": "ready"}).status_code == 404
    assert client.post(path + "/review-notes", headers=headers, json={"note": "Blocked"}).status_code == 404
    assert client.get(f"/quality/queue?project_id={project}", headers=headers).json()["total"] == 0
