"""Saved dashboard persistence, provenance, authorization and live data regressions."""

from pathlib import Path
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from alembic.config import Config
from sqlmodel import Session, select
from test_analysis import analysis_client as analysis_client
from test_kobo_sync import page
from test_kobo_sync import sync_client as sync_client
from test_workspace import indicator

from alembic import command
from app.core.config import get_settings
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role
from app.models.operations import Project, SavedAnalysis
from app.models.workspace import AnalyticalDashboard


def widget(kind="text", source_id=None, **changes):
    return {
        "id": str(uuid4()),
        "kind": kind,
        "source_id": source_id,
        "title": "Results",
        "text": "Context",
        "width": 1,
        **changes,
    }


def create(fixture, widgets=None, **changes):
    client, _, project, headers = fixture
    payload = {"title": "Project evidence", "project_id": project, "widgets": widgets or [], **changes}
    response = client.post("/dashboards", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def endpoint(dashboard, index=0):
    return f"/dashboards/{dashboard['id']}/widgets/{dashboard['widgets'][index]['id']}/results"


def test_layout_filters_reload_duplicate_delete_and_conflict(sync_client):
    client, engine, _, headers = sync_client
    first, second = widget(), widget(title="Notes", height=480, width=2)
    dashboard = create(sync_client, [first, second], date_from="2026-10-01", date_to="2026-10-31")
    assert dashboard["widgets"][0]["height"] == 360  # Legacy width-only payload.
    saved = {**dashboard, "widgets": [dashboard["widgets"][1], {**dashboard["widgets"][0], "height": 600}]}
    saved["title"] = "Updated evidence"
    response = client.put(f"/dashboards/{dashboard['id']}", headers=headers, json=saved)
    assert response.status_code == 200, response.text
    current = response.json()
    assert current["version"] == dashboard["version"] + 1
    loaded = client.get(f"/dashboards/{dashboard['id']}", headers=headers).json()
    assert loaded == current
    with Session(engine) as db:
        row = db.get(AnalyticalDashboard, UUID(dashboard["id"]))
        assert row.widgets[0]["id"] == second["id"] and row.widgets[1]["height"] == 600
        assert row.date_to.isoformat() == "2026-10-31"
    assert client.put(f"/dashboards/{dashboard['id']}", headers=headers, json=saved).status_code == 409
    copy = create(sync_client, [{**w, "id": str(uuid4())} for w in loaded["widgets"]])
    assert copy["id"] != current["id"] and len(copy["widgets"]) == 2
    assert client.delete(f"/dashboards/{dashboard['id']}", headers=headers).status_code == 204
    assert client.get(f"/dashboards/{dashboard['id']}", headers=headers).status_code == 404
    assert len(client.get("/dashboards", headers=headers).json()) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"height": 239},
        {"height": 901},
        {"width": 3},
        {"kind": "other"},
        {"source_id": str(uuid4())},
        {"kind": "indicator", "source_id": None},
    ],
)
def test_invalid_layout_or_source_is_rejected(sync_client, changes):
    client, _, project, headers = sync_client
    response = client.post(
        "/dashboards", headers=headers, json={"title": "Invalid", "project_id": project, "widgets": [widget(**changes)]}
    )
    assert response.status_code == 422
    assert client.get("/dashboards", headers=headers).json() == []


def test_duplicate_ids_and_invalid_dates_are_rejected(sync_client):
    client, _, project, headers = sync_client
    w = widget()
    base = {"title": "Invalid", "project_id": project}
    assert client.post("/dashboards", headers=headers, json={**base, "widgets": [w, w]}).status_code == 422
    assert (
        client.post(
            "/dashboards", headers=headers, json={**base, "date_from": "2026-12-01", "date_to": "2026-01-01"}
        ).status_code
        == 422
    )


def test_indicator_data_reuses_engine_dates_and_keeps_targets(sync_client):
    client, _, project, headers = sync_client
    item = indicator(client, project, headers, target_value=100)
    for date, value in [("2026-09-01", 20), ("2026-10-02", 35)]:
        assert (
            client.post(
                f"/indicators/{item['id']}/collected-results",
                headers=headers,
                json={"result_date": date, "value": value},
            ).status_code
            == 201
        )
    dashboard = create(sync_client, [widget("indicator", item["id"])], date_from="2026-10-01")
    result = client.get(endpoint(dashboard), headers=headers).json()["indicator"]
    direct = client.get(f"/indicators/{item['id']}?date_from=2026-10-01", headers=headers).json()
    assert result == direct and result["current_value"] == 35 and result["target_value"] == 100
    all_dates = client.get(endpoint(dashboard) + "?use_saved_filters=false", headers=headers).json()["indicator"]
    assert all_dates["current_value"] == 55 and all_dates["target_value"] == 100
    assert (
        client.get(endpoint(dashboard) + "?date_from=2026-12-01&date_to=2026-01-01", headers=headers).status_code == 422
    )


def test_saved_analysis_filters_source_and_successful_sync_update(analysis_client):
    client, _, project, headers = analysis_client
    query = {
        "project_id": project,
        "form_id": "form-1",
        "source_field": "score",
        "measure": "sum",
        "filters": {"review_status": "ready", "location": "North", "date_from": "2026-10-01"},
    }
    response = client.post(
        "/analysis/saved", headers=headers, json={"title": "North scores", "chart": "table", "query": query}
    )
    assert response.status_code == 201, response.text
    saved = response.json()
    linked = indicator(client, project, headers, target_value=50)
    assert (
        client.put(
            f"/indicators/{linked['id']}/mapping",
            headers=headers,
            json={"source_field": "score", "source_form_id": "form-1", "calculation": "sum"},
        ).status_code
        == 200
    )
    dashboard = create(analysis_client, [widget("analysis", saved["id"]), widget("indicator", linked["id"])])
    assert client.get(endpoint(dashboard, 1), headers=headers).json()["indicator"]["current_value"] == 10
    result = client.get(endpoint(dashboard), headers=headers).json()
    direct = client.post("/analysis/query", headers=headers, json=saved["query"]).json()
    assert result["analysis"]["value"] == direct["value"] == 10
    assert result["analysis"]["filters"]["location"] == "North" and result["chart"] == "table"
    # Dashboard bound replaces the saved bound while preserving location and review status.
    filtered = client.get(endpoint(dashboard) + "?date_from=2026-10-03", headers=headers).json()["analysis"]
    assert filtered["value"] is None and filtered["filters"]["location"] == "North"
    with patch(
        "app.core.kobo.httpx.get",
        return_value=page(
            [
                {"_id": "new-live-record", "score": 7, "location": "North", "_submission_time": "2026-10-05T12:00:00Z"},
            ],
            count=1,
        ),
    ):
        assert client.post(f"/projects/{project}/sync", headers=headers).status_code == 200
    latest = client.get(endpoint(dashboard), headers=headers).json()["analysis"]
    assert latest["value"] == 17
    assert client.get(endpoint(dashboard, 1), headers=headers).json()["indicator"]["current_value"] == 17
    with patch("app.routes.collection.list_kobo_submissions", side_effect=ValueError("Provider unavailable")):
        assert client.post(f"/projects/{project}/sync", headers=headers).status_code == 422
    assert client.get(endpoint(dashboard), headers=headers).json()["analysis"]["value"] == 17
    assert client.get(endpoint(dashboard, 1), headers=headers).json()["indicator"]["current_value"] == 17


def test_removed_source_is_unavailable_but_dashboard_remains_editable(sync_client):
    client, _, project, headers = sync_client
    item = indicator(client, project, headers)
    dashboard = create(sync_client, [widget("indicator", item["id"])])
    assert client.delete(f"/indicators/{item['id']}", headers=headers).status_code == 204
    assert client.get(endpoint(dashboard), headers=headers).status_code == 404
    dashboard["widgets"][0]["height"] = 480
    response = client.put(f"/dashboards/{dashboard['id']}", headers=headers, json=dashboard)
    assert response.status_code == 200, response.text
    dashboard = response.json()
    dashboard["widgets"] = []
    assert client.put(f"/dashboards/{dashboard['id']}", headers=headers, json=dashboard).status_code == 200


def test_cross_project_cross_org_and_query_tampering_cannot_leak(sync_client):
    client, engine, project, headers = sync_client
    item = indicator(client, project, headers)
    dashboard = create(sync_client, [widget("indicator", item["id"])])
    with Session(engine) as db:
        original = db.get(Project, UUID(project))
        same_org = Project(
            organization_id=original.organization_id,
            organization_sector_id=original.organization_sector_id,
            created_by_id=original.created_by_id,
            name="Other workspace",
        )
        org = Organization(name="Other tenant", slug="dashboard-other")
        db.add_all([same_org, org])
        db.flush()
        sector = db.get(OrganizationSector, original.organization_sector_id)
        org_sector = OrganizationSector(organization_id=org.id, sector_id=sector.sector_id)
        db.add(org_sector)
        db.flush()
        foreign = Project(
            organization_id=org.id,
            organization_sector_id=org_sector.id,
            created_by_id=original.created_by_id,
            name="Foreign workspace",
        )
        db.add(foreign)
        db.flush()
        foreign_dashboard = AnalyticalDashboard(
            organization_id=org.id,
            project_id=foreign.id,
            created_by_id=original.created_by_id,
            title="Foreign",
            widgets=dashboard["widgets"],
        )
        db.add(foreign_dashboard)
        corrupt = SavedAnalysis(
            organization_id=original.organization_id,
            project_id=original.id,
            created_by_id=original.created_by_id,
            title="Invalid provenance",
            query_json={"project_id": str(foreign.id), "source_field": "score"},
        )
        db.add(corrupt)
        db.commit()
        same_id, foreign_id, corrupt_id = str(same_org.id), str(foreign_dashboard.id), str(corrupt.id)
    for route in (
        f"/dashboards/{foreign_id}",
        f"/dashboards/{foreign_id}/widgets/{dashboard['widgets'][0]['id']}/results",
    ):
        assert client.get(route, headers=headers).status_code == 404
    assert client.put(f"/dashboards/{foreign_id}", headers=headers, json=dashboard).status_code == 404
    assert client.delete(f"/dashboards/{foreign_id}", headers=headers).status_code == 404
    assert all(d["id"] != foreign_id for d in client.get("/dashboards", headers=headers).json())
    for project_id, w in [(same_id, widget("indicator", item["id"])), (project, widget("analysis", corrupt_id))]:
        assert (
            client.post(
                "/dashboards", headers=headers, json={"title": "Invalid", "project_id": project_id, "widgets": [w]}
            ).status_code
            == 422
        )


def test_dashboard_routes_require_active_admin(sync_client):
    client, engine, project, headers = sync_client
    dashboard = create(sync_client, [widget()])
    assert client.get(endpoint(dashboard)).status_code == 401
    with Session(engine) as db:
        member = db.exec(select(OrganizationMembership)).one()
        member.role = Role.ENUMERATOR
        db.add(member)
        db.commit()
    for method, route, body in [
        ("get", "/dashboards", None),
        ("get", f"/dashboards/{dashboard['id']}", None),
        ("get", endpoint(dashboard), None),
        ("post", "/dashboards", dashboard),
        ("put", f"/dashboards/{dashboard['id']}", dashboard),
        ("delete", f"/dashboards/{dashboard['id']}", None),
    ]:
        kwargs = {"headers": headers}
        if body:
            kwargs["json"] = body
        assert getattr(client, method)(route, **kwargs).status_code == 403


def test_populated_dashboard_migration_preserves_legacy_layout(sync_client, monkeypatch):
    client, engine, _, headers = sync_client
    dashboard = create(sync_client, [widget()])
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{Path(engine.url.database).as_posix()}")
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "0020_dashboard_filters")
        command.downgrade(config, "0019_sync_seconds")
        command.upgrade(config, "head")
        loaded = client.get(f"/dashboards/{dashboard['id']}", headers=headers).json()
        assert loaded["widgets"] == dashboard["widgets"] and loaded["version"] == 1
    finally:
        get_settings.cache_clear()
