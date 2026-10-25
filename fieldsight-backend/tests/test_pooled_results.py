"""Pooled manual fractions must agree across every result consumer."""

import pytest
from test_kobo_sync import sync_client as sync_client


@pytest.mark.parametrize(("unit", "scale", "expected"), [("percentage", 1, 10), ("rate", 1000, 100), ("ratio", 1, 0.1)])
def test_pooled_values_periods_locations_dashboard_and_dates(sync_client, unit, scale, expected):
    client, _, project, headers = sync_client
    definition = {
        "name": "Pooled coverage",
        "code": "POOL",
        "unit": unit,
        "manual_aggregation": "pooled",
        "manual_rate_multiplier": scale,
    }
    created = client.post(f"/projects/{project}/indicators", headers=headers, json=definition)
    assert created.status_code == 201, created.text
    indicator = created.json()["id"]
    for numerator, denominator, day, location in [(9, 10, "2026-09-10", "A"), (1, 90, "2026-10-10", "B")]:
        response = client.post(
            f"/indicators/{indicator}/collected-results",
            headers=headers,
            json={"result_date": day, "numerator": numerator, "denominator": denominator, "location": location},
        )
        assert response.status_code == 201, response.text
    result = client.get(f"/indicators/{indicator}", headers=headers).json()
    assert result["current_value"] == expected
    assert result["numerator"] == 10 and result["denominator"] == 100
    assert result["history"][0]["denominator"] == 10 and result["history"][1]["denominator"] == 90
    assert {row["location"] for row in result["location_breakdown"]} == {"A", "B"}
    assert "Pooled manual results" in result["calculation_note"]
    widget = "11111111-1111-4111-8111-111111111111"
    dashboard = client.post(
        "/dashboards",
        headers=headers,
        json={
            "project_id": project,
            "title": "Pooled results",
            "widgets": [{"id": widget, "title": "Coverage", "kind": "indicator", "source_id": indicator}],
        },
    ).json()
    output = client.get(f"/dashboards/{dashboard['id']}/widgets/{widget}/results", headers=headers).json()
    assert output["indicator"]["current_value"] == expected
    filtered = client.get(f"/indicators/{indicator}?date_from=2027-01-01", headers=headers).json()
    assert filtered["current_value"] is None and filtered["manual_result_count"] == 0


def test_legacy_results_are_not_silently_reinterpreted_and_fraction_validation(sync_client):
    client, engine, project, headers = sync_client
    definition = {"name": "Legacy percentage", "code": "LEGACY", "unit": "percentage"}
    indicator = client.post(f"/projects/{project}/indicators", headers=headers, json=definition).json()["id"]
    from uuid import UUID
    from sqlmodel import Session
    from app.models.operations import Indicator

    with Session(engine) as db:
        row = db.get(Indicator, UUID(indicator))
        row.reliability_policy = 0
        db.add(row)
        db.commit()
    path = f"/indicators/{indicator}"
    client.post(path + "/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 0})
    assert client.patch(path, headers=headers, json={"manual_aggregation": "pooled"}).status_code == 409
    assert client.get(path, headers=headers).json()["current_value"] == 0
    assert (
        client.patch(
            path,
            headers=headers,
            json={
                "manual_aggregation": "unweighted_mean",
                "confirm_change": True,
                "change_reason": "Confirm legacy mean",
                "expected_version": 0,
            },
        ).status_code
        == 200
    )
    pooled = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={**definition, "code": "POOL", "manual_aggregation": "pooled"},
    ).json()["id"]
    for values in [
        {"numerator": 1, "denominator": 0},
        {"numerator": -1, "denominator": 10},
        {"numerator": 11, "denominator": 10},
        {"numerator": 1},
        {"value": 5},
    ]:
        response = client.post(
            f"/indicators/{pooled}/collected-results", headers=headers, json={"result_date": "2026-10-01", **values}
        )
        assert response.status_code == 422, response.text
    assert (
        client.post(
            f"/indicators/{pooled}/collected-results",
            headers=headers,
            json={"result_date": "2026-10-01", "numerator": 0, "denominator": 50},
        ).status_code
        == 201
    )
    assert client.get(f"/indicators/{pooled}", headers=headers).json()["current_value"] == 0


def test_manual_indicator_does_not_load_survey_dataset(sync_client):
    from sqlalchemy import event

    client, engine, project, headers = sync_client
    identifier = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={"name": "Manual only", "code": "MANUAL", "manual_aggregation": "sum"},
    ).json()["id"]
    client.post(
        f"/indicators/{identifier}/collected-results", headers=headers, json={"result_date": "2026-10-01", "value": 12}
    )
    statements = []

    def capture(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement.lower())

    event.listen(engine, "before_cursor_execute", capture)
    try:
        response = client.get(f"/indicators/{identifier}", headers=headers)
        assert response.status_code == 200 and response.json()["current_value"] == 12
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert not any("from submissions" in statement for statement in statements)
