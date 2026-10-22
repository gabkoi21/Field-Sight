"""Editable workspace metadata survives reload and preserves lifecycle fields."""

from uuid import UUID

import pytest
from sqlmodel import Session
from test_kobo_sync import sync_client as sync_client

from app.models.operations import Project


def test_details_roundtrip_and_partial_updates(sync_client):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        org = str(project.organization_id)
        original_status = project.status
    details = dict(
        code="HEALTH-01",
        stage="Implementation",
        countries=["Liberia", "Kenya"],
        topics=["Health"],
        group="Regional/State Level",
        cost_unit="Health operations",
        funding="Community grant",
        health_status="red",
    )
    url = f"/organizations/{org}/projects/{project_id}"
    response = client.patch(url, headers=headers, json={"workspace_details": details, "description": "Project scope"})
    assert response.status_code == 200, response.text
    assert response.json()["workspace_details"] == details
    assert response.json()["status"] == original_status
    assert client.get(url, headers=headers).json()["workspace_details"] == details
    assert client.patch(url, headers=headers, json={"name": "Renamed project"}).status_code == 200
    assert client.get(url, headers=headers).json()["workspace_details"] == details
    with Session(engine) as db:
        assert db.get(Project, UUID(project_id)).workspace_details == details


@pytest.mark.parametrize(
    "details",
    [
        None,
        {"health_status": "blue"},
        {"countries": ["x" * 101]},
        {"topics": ["x"] * 31},
        {"funding": "x" * 301},
        {"unexpected": "value"},
    ],
)
def test_invalid_metadata_is_rejected(sync_client, details):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        org = str(db.get(Project, UUID(project_id)).organization_id)
    response = client.patch(
        f"/organizations/{org}/projects/{project_id}", headers=headers, json={"workspace_details": details}
    )
    assert response.status_code == 422, response.text
