"""Quick-start flows persist real data and preserve tenant and source boundaries."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.core.config import Settings
from app.core.security import create_access_token, password_hasher
from app.models.identity import Organization, OrganizationSector, RefreshSession, User
from app.models.operations import Project, Submission
from app.models.workspace import WorkspaceInvitation


def context(fixture):
    client, engine, project_id, headers = fixture
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        return client, engine, project_id, headers, str(project.organization_id)


def indicator(client, project, headers, **values):
    unit = values.get("unit", "number")
    values.setdefault(
        "manual_aggregation", "unweighted_mean" if unit == "percentage" else "latest" if unit == "text" else "sum"
    )
    response = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={"name": "Sample indicator", "code": str(uuid4()), **values},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_invite_accept_role_assignment_and_revocation(sync_client):
    client, engine, project, headers, org = context(sync_client)
    response = client.post(
        f"/organizations/{org}/invitations",
        headers=headers,
        json={"email": "new-person@example.com", "role": "enumerator"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["token"]
    assert response.json()["delivery"] == "copy_link"
    listed = client.get(f"/organizations/{org}/invitations", headers=headers).json()
    assert "token" not in listed[0] and "token_hash" not in listed[0]
    with Session(engine) as db:
        assert db.exec(select(WorkspaceInvitation)).one().token_hash != token
    payload = {"token": token, "full_name": "New colleague", "password": "Strong-test-password"}
    assert client.post("/auth/accept-invitation", json=payload).status_code == 201
    assert client.post("/auth/accept-invitation", json=payload).status_code == 422
    member = next(
        m
        for m in client.get(f"/organizations/{org}/team", headers=headers).json()
        if m["email"] == "new-person@example.com"
    )
    for _ in range(2):
        assert (
            client.post(f"/projects/{project}/team", headers=headers, json={"membership_id": member["id"]}).status_code
            == 201
        )
    assignments = client.get(f"/projects/{project}/team", headers=headers).json()
    assert len(assignments) == 1
    assert (
        client.delete(f"/projects/{project}/team/{assignments[0]['assignment_id']}", headers=headers).status_code == 204
    )
    assert client.get(f"/projects/{project}/team", headers=headers).json() == []
    assert (
        client.patch(
            f"/organizations/{org}/team/{member['id']}",
            headers=headers,
            json={"role": "enumerator", "is_active": False},
        ).status_code
        == 200
    )
    assert (
        client.post(f"/projects/{project}/team", headers=headers, json={"membership_id": member["id"]}).status_code
        == 422
    )


def test_invitation_reissue_expiry_and_existing_account_protection(sync_client):
    client, engine, _, headers, org = context(sync_client)

    def invite():
        return client.post(
            f"/organizations/{org}/invitations", headers=headers, json={"email": "pending@example.com"}
        ).json()

    first, second = invite(), invite()

    def accept(token):
        return client.post(
            "/auth/accept-invitation", json={"token": token, "full_name": "Test Person", "password": "test-password"}
        )

    assert accept(first["token"]).status_code == 422
    with Session(engine) as db:
        item = db.get(WorkspaceInvitation, UUID(second["id"]))
        item.expires_at = datetime.now(UTC) - timedelta(days=1)
        db.add(item)
        db.commit()
    assert accept(second["token"]).status_code == 422
    third = invite()
    assert client.delete(f"/organizations/{org}/invitations/{third['id']}", headers=headers).status_code == 204
    assert accept(third["token"]).status_code == 422
    assert (
        client.post(
            f"/organizations/{org}/invitations", headers=headers, json={"email": "sync@example.com"}
        ).status_code
        == 409
    )
    self_member = client.get(f"/organizations/{org}/team", headers=headers).json()[0]
    assert (
        client.patch(
            f"/organizations/{org}/team/{self_member['id']}",
            headers=headers,
            json={"role": "enumerator", "is_active": True},
        ).status_code
        == 422
    )


def test_csv_import_catalogue_rows_duplicate_and_quality(sync_client):
    client, engine, project, headers, _ = context(sync_client)
    payload = {
        "title": "Training attendance",
        "csv_text": 'date,region,participants,notes\n2026-10-01,North,12,"A, B"\n2026-10-02,South,8,example\n',
        "date_column": "date",
        "location_column": "region",
    }
    response = client.post(f"/projects/{project}/tables/import", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    form = response.json()["form_id"]
    assert response.json()["review_status"] == "needs_review"
    assert client.post(f"/projects/{project}/tables/import", headers=headers, json=payload).status_code == 409
    tables = client.get(f"/projects/{project}/tables", headers=headers).json()
    assert tables[0]["title"] == "Training attendance" and tables[0]["records"] == 2
    rows = client.get(f"/projects/{project}/tables/{form}", headers=headers).json()
    assert rows["total"] == 2
    assert next(f for f in rows["fields"] if f["source_field"] == "participants")["type"] == "number"
    item = indicator(client, project, headers)
    mapping = {"source_form_id": form, "source_field": "participants", "calculation": "sum"}
    assert client.put(f"/indicators/{item['id']}/mapping", headers=headers, json=mapping).status_code == 200
    result = client.get(f"/indicators/{item['id']}", headers=headers).json()
    assert result["current_value"] is None and result["quality_excluded_records"] == 2
    for row in rows["rows"]:
        assert (
            client.patch(
                f"/submissions/{row['id']}/review-status", headers=headers, json={"status": "ready"}
            ).status_code
            == 200
        )
    result = client.get(f"/indicators/{item['id']}", headers=headers).json()
    assert result["current_value"] == 20 and result["result_source"] == "table"
    with Session(engine) as db:
        assert len(db.exec(select(Submission).where(Submission.project_id == UUID(project))).all()) == 2


@pytest.mark.parametrize(
    "csv_text,date_column",
    [
        ("x,x\n1,2", None),
        ("x,y\n1", None),
        ("x\n", None),
        ("date\nnot-a-date", "date"),
        ("x\n1", "missing"),
        ('x\n"unclosed', None),
    ],
)
def test_csv_errors_are_atomic(sync_client, csv_text, date_column):
    client, engine, project, headers, _ = context(sync_client)
    result = client.post(
        f"/projects/{project}/tables/import",
        headers=headers,
        json={"title": "Bad input", "csv_text": csv_text, "date_column": date_column},
    )
    assert result.status_code == 422, result.text
    with Session(engine) as db:
        assert db.exec(select(Submission)).all() == []


def test_manual_results_sum_average_narrative_and_dates(sync_client):
    client, _, project, headers, _ = context(sync_client)
    for unit, expected in (("number", 70), ("percentage", 35), ("text", None)):
        item = indicator(client, project, headers, unit=unit)
        for day, value in (("2026-09-01", 20), ("2026-10-01", 50)):
            payload = (
                {"result_date": day, "value": value}
                if unit != "text"
                else {
                    "result_date": day,
                    "narrative": "Latest progress " + day,
                }
            )
            response = client.post(f"/indicators/{item['id']}/collected-results", headers=headers, json=payload)
            assert response.status_code == 201, response.text
        result = client.get(f"/indicators/{item['id']}", headers=headers).json()
        assert result["current_value"] == expected and result["manual_result_count"] == 2
        assert result["result_source"] == "manual" and result["mapping"] is None
        if unit == "text":
            assert result["qualitative_value"] == "Latest progress 2026-10-01"
        window = client.get(f"/indicators/{item['id']}?date_from=2026-10-01", headers=headers).json()
        assert window["manual_result_count"] == 1
        assert window["current_value"] == (None if unit == "text" else 50)
        assert client.put(
            f"/indicators/{item['id']}/mapping",
            headers=headers,
            json={"source_field": "x", "calculation": "count_records"},
        ).status_code in (409, 422)
        results = client.get(f"/indicators/{item['id']}/collected-results", headers=headers).json()
        assert (
            client.delete(f"/indicators/{item['id']}/collected-results/{results[0]['id']}", headers=headers).status_code
            == 204
        )


def test_percent_and_qualitative_validation(sync_client):
    client, _, project, headers, _ = context(sync_client)
    for unit, payload in (
        ("percentage", {"value": 101}),
        ("number", {"narrative": "wrong type"}),
        ("text", {"value": 10}),
        ("number", {}),
    ):
        item = indicator(client, project, headers, unit=unit)
        assert (
            client.post(
                f"/indicators/{item['id']}/collected-results",
                headers=headers,
                json={"result_date": "2026-10-01", **payload},
            ).status_code
            == 422
        )


def test_dashboard_persistence_and_source_boundaries(sync_client):
    client, engine, project, headers, org = context(sync_client)
    item = indicator(client, project, headers)
    payload = {
        "title": "Programme progress",
        "project_id": project,
        "widgets": [
            {"id": str(uuid4()), "title": "Progress", "kind": "indicator", "source_id": item["id"], "width": 2},
        ],
    }
    created = client.post("/dashboards", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    dashboard = created.json()
    assert dashboard["widgets"][0]["width"] == 2
    assert client.get("/dashboards", headers=headers).json()[0]["title"] == payload["title"]
    payload["title"] = "Renamed dashboard"
    assert client.put(f"/dashboards/{dashboard['id']}", headers=headers, json=payload).status_code == 200
    payload["widgets"][0]["source_id"] = str(uuid4())
    assert client.put(f"/dashboards/{dashboard['id']}", headers=headers, json=payload).status_code == 422
    with Session(engine) as db:
        original = db.get(Project, UUID(project))
        other_org = Organization(name="Other", slug="other")
        db.add(other_org)
        db.flush()
        sector = db.get(OrganizationSector, original.organization_sector_id)
        other_sector = OrganizationSector(organization_id=other_org.id, sector_id=sector.sector_id)
        db.add(other_sector)
        db.flush()
        foreign = Project(
            organization_id=other_org.id,
            organization_sector_id=other_sector.id,
            created_by_id=original.created_by_id,
            name="Other project",
        )
        db.add(foreign)
        db.commit()
        foreign_id, foreign_org = str(foreign.id), str(other_org.id)
    for endpoint in (
        f"/organizations/{foreign_org}/team",
        f"/organizations/{foreign_org}/invitations",
        f"/projects/{foreign_id}/tables",
        f"/projects/{foreign_id}/team",
    ):
        assert client.get(endpoint, headers=headers).status_code == 404
    assert client.delete(f"/dashboards/{dashboard['id']}", headers=headers).status_code == 204


def test_profile_landing_validation_and_anonymous_denial(sync_client):
    client, _, project, headers, org = context(sync_client)
    response = client.put(
        "/auth/profile", headers=headers, json={"full_name": "Workspace admin", "landing_page": "/dashboards"}
    )
    assert response.status_code == 200
    assert client.get("/auth/profile", headers=headers).json()["landing_page"] == "/dashboards"
    assert (
        client.put("/auth/profile", headers=headers, json={"landing_page": "https://evil.example"}).status_code == 422
    )
    for route in ("/dashboards", "/auth/profile", f"/projects/{project}/tables", f"/organizations/{org}/team"):
        assert client.get(route).status_code == 401


def test_password_change_requires_current_secret_and_revokes_sessions(sync_client):
    client, engine, _, headers, _ = context(sync_client)
    with Session(engine) as db:
        user = db.exec(select(User).where(User.email == "sync@example.com")).one()
        user.password_hash = password_hasher.hash("original-test-password")
        db.add(user)
        db.commit()
    assert (
        client.post(
            "/auth/change-password",
            headers=headers,
            json={
                "current_password": "incorrect",
                "new_password": "replacement-password",
            },
        ).status_code
        == 422
    )
    assert client.get("/auth/profile", headers=headers).status_code == 200
    assert (
        client.post(
            "/auth/change-password",
            headers=headers,
            json={
                "current_password": "original-test-password",
                "new_password": "replacement-password",
            },
        ).status_code
        == 200
    )
    assert client.get("/auth/profile", headers=headers).status_code == 401
    assert (
        client.post("/auth/login", json={"login": "sync@example.com", "password": "original-test-password"}).status_code
        == 401
    )
    assert (
        client.post("/auth/login", json={"login": "sync@example.com", "password": "replacement-password"}).status_code
        == 200
    )


def test_invited_field_member_cannot_use_administrative_workflows(sync_client):
    client, engine, project, headers, org = context(sync_client)
    invited = client.post(
        f"/organizations/{org}/invitations", headers=headers, json={"email": "collector@example.com"}
    ).json()
    assert (
        client.post(
            "/auth/accept-invitation",
            json={"token": invited["token"], "full_name": "Collector", "password": "field-test-password"},
        ).status_code
        == 201
    )
    login = client.post("/auth/login", json={"login": "collector@example.com", "password": "field-test-password"})
    assert login.status_code == 403
    # Even a server-signed session cannot bypass the existing admin-only portal policy.
    with Session(engine) as db:
        user = db.exec(select(User).where(User.email == "collector@example.com")).one()
        refresh = RefreshSession(
            user_id=user.id, token_hash="field-session-test", expires_at=datetime.now(UTC) + timedelta(days=1)
        )
        db.add(refresh)
        db.commit()
        token = create_access_token(user.id, refresh.id, Settings(environment="test"))
    field_headers = {"Authorization": "Bearer " + token}
    for endpoint in (f"/organizations/{org}/team", f"/projects/{project}/tables", "/dashboards"):
        assert client.get(endpoint, headers=field_headers).status_code == 403
    assert client.get("/auth/profile", headers=field_headers).status_code == 403


def test_manual_source_changes_and_indicator_delete_cascade(sync_client):
    client, _, project, headers, _ = context(sync_client)
    item = indicator(client, project, headers)
    assert (
        client.post(
            f"/indicators/{item['id']}/collected-results",
            headers=headers,
            json={"result_date": "2026-10-01", "value": 200},
        ).status_code
        == 201
    )
    rejected = client.patch(f"/indicators/{item['id']}", headers=headers, json={"unit": "percentage"})
    assert rejected.status_code == 422  # Sum cannot produce percentage units.
    assert client.get(f"/indicators/{item['id']}", headers=headers).json()["unit"] == "number"
    assert client.delete(f"/indicators/{item['id']}", headers=headers).status_code == 204
    assert client.get(f"/indicators/{item['id']}/collected-results", headers=headers).status_code == 404
