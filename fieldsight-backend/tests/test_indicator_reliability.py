"""Reliability boundaries exercised with synthetic tenant-scoped databases."""

from uuid import UUID

import pytest
from sqlmodel import Session
from test_analysis import analysis_client as analysis_client
from test_kobo_sync import sync_client as sync_client

from app.models.operations import Indicator


def create(client, project, headers, **changes):
    response = client.post(
        f"/projects/{project}/indicators", headers=headers, json={"name": "Reliability", "code": "REL", **changes}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_draft_requires_method_and_server_rejects_percentage_sum(analysis_client):
    client, _, project, headers = analysis_client
    indicator = create(client, project, headers)
    path = f"/indicators/{indicator}"
    assert (
        client.post(
            path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 0}
        ).status_code
        == 422
    )
    assert client.patch(path, headers=headers, json={"is_active": True}).status_code == 422
    bad = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={
            "name": "Bad percentage",
            "code": "BAD",
            "unit": "percentage",
            "mapping": {"source_field": "score", "calculation": "sum", "source_form_id": "form-1"},
        },
    )
    assert bad.status_code == 422
    assert client.patch(path, headers=headers, json={"manual_aggregation": "sum"}).status_code == 200
    assert (
        client.post(
            path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 0}
        ).status_code
        == 201
    )
    assert client.get(path, headers=headers).json()["current_value"] == 0


@pytest.mark.parametrize(("method", "expected"), [("sum", 100), ("unweighted_mean", 50), ("latest", 80)])
def test_manual_benchmarks_and_change_review(sync_client, method, expected):
    client, _, project, headers = sync_client
    indicator = create(client, project, headers, manual_aggregation=method)
    path = f"/indicators/{indicator}"
    for value in [20, 80]:
        assert (
            client.post(
                path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": value}
            ).status_code
            == 201
        )
    assert client.get(path, headers=headers).json()["current_value"] == expected
    assert client.patch(path, headers=headers, json={"target_value": 200}).status_code == 409
    preview = client.post(path + "/definition-preview", headers=headers, json={"target_value": 200})
    assert preview.status_code == 200, preview.text
    assert preview.json()["affected_periods"] == ["2026-10"]
    changed = client.patch(
        path,
        headers=headers,
        json={
            "target_value": 200,
            "confirm_change": True,
            "change_reason": "Revised target after review",
            "expected_version": preview.json()["expected_version"],
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["current_value"] == expected
    versions = client.get(path + "/versions", headers=headers).json()
    assert versions[0]["previous_definition"]["target_value"] is None
    assert versions[0]["new_definition"]["target_value"] == 200
    page = client.get(path + "/evidence?limit=1", headers=headers).json()
    assert page["total"] == 2 and len(page["items"]) == 1


def test_legacy_mean_is_retained_without_inventing_approval(sync_client):
    client, engine, project, headers = sync_client
    indicator = create(client, project, headers, unit="percentage")
    with Session(engine) as db:
        row = db.get(Indicator, UUID(indicator))
        row.reliability_policy = 0
        db.add(row)
        db.commit()
    path = f"/indicators/{indicator}"
    for value in [0, 80]:
        assert (
            client.post(
                path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": value}
            ).status_code
            == 201
        )
    result = client.get(path, headers=headers).json()
    assert result["current_value"] == 40
    assert result["legacy_definition"] and not result["manual_mean_confirmed"]
    assert client.get(path + "/versions", headers=headers).json() == []


def test_evidence_reconciles_linked_exclusions(analysis_client):
    client, _, project, headers = analysis_client
    indicator = create(
        client,
        project,
        headers,
        unit="percentage",
        mapping={
            "source_field": "services",
            "source_form_id": "form-1",
            "calculation": "percentage_matching",
            "match_value": "a",
        },
    )
    path = f"/indicators/{indicator}"
    result = client.get(path, headers=headers).json()
    evidence = client.get(path + "/evidence", headers=headers).json()
    assert sum(item["included"] for item in evidence["items"]) == result["mapped_records"]
    assert sum(item["reason"] == "quality_excluded" for item in evidence["items"]) == result["quality_excluded_records"]
    assert sum(item["reason"] == "missing_answer" for item in evidence["items"]) == result["missing_records"]
