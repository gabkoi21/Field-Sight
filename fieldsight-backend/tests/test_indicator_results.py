"""Independent benchmark results, result frameworks and indicator provenance."""

from pathlib import Path
from uuid import UUID

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, select
from test_analysis import analysis_client as analysis_client
from test_kobo_sync import sync_client as sync_client

from alembic import command
from app.core.config import get_settings
from app.models.identity import Organization, OrganizationMembership, Role
from app.models.operations import IndicatorMapping, Project, Submission

Client = tuple[TestClient, Engine, str, dict[str, str]]


def create_indicator(client: Client, **changes: object) -> dict:
    api, _, project_id, headers = client
    payload = {
        "name": "Service access",
        "code": "ACCESS-01",
        "unit": "percentage",
        "baseline_value": 0,
        "target_value": 90,
        "target_date": "2030-12-31",
        "reporting_frequency": "monthly",
        "mapping": {
            "source_field": "services",
            "source_form_id": "form-1",
            "calculation": "percentage_matching",
            "match_value": "a",
        },
        **changes,
    }
    result = api.post(f"/projects/{project_id}/indicators", headers=headers, json=payload)
    assert result.status_code == 201, result.text
    return result.json()


def test_multiselect_percentage_benchmark_and_quality_context(analysis_client: Client) -> None:
    result = create_indicator(analysis_client)
    # Ready records: [a,b,a], [b], missing, [a] => 2 / 3, not 2 / 4 or 3 / 4.
    assert result["current_value"] == 66.67
    assert result["numerator"] == 2
    assert result["denominator"] == result["mapped_records"] == 3
    assert result["eligible_records"] == 4
    assert result["missing_records"] == 1
    assert result["quality_excluded_records"] == 2
    assert result["status"] == "in_progress" and result["schedule_status"] == "not_due"
    assert result["target_achieved"] is False
    assert result["history"][0]["period"] == "2026-10"
    assert result["history"][0]["value"] == 50
    assert result["undated_records"] == 1
    assert result["mapping"]["match_value"] == "a"
    assert result["source_form_id"] == "form-1"


@pytest.mark.parametrize(("calculation", "expected"), [("sum", 10), ("average", 5)])
def test_numeric_benchmark_zero_missing_bad_answer(analysis_client: Client, calculation: str, expected: float) -> None:
    result = create_indicator(
        analysis_client,
        unit="number",
        mapping={
            "source_field": "score",
            "source_form_id": "form-1",
            "calculation": calculation,
        },
    )
    assert result["current_value"] == expected
    assert result["numerator"] == 10
    assert result["denominator"] == 2
    assert result["missing_records"] == result["invalid_answers"] == 1
    assert (
        result["eligible_records"] == result["mapped_records"] + result["missing_records"] + result["invalid_answers"]
    )


@pytest.mark.parametrize(("calculation", "expected"), [("count_records", 4), ("count_matching", 2)])
def test_explicit_count_operations(analysis_client: Client, calculation: str, expected: float) -> None:
    result = create_indicator(
        analysis_client,
        unit="number",
        mapping={
            "source_field": "services",
            "calculation": calculation,
            "match_value": "a" if calculation == "count_matching" else None,
        },
    )
    assert result["current_value"] == expected
    assert result["denominator"] == (4 if calculation == "count_records" else 3)


def test_target_dates_direction_and_missing_deadline(analysis_client: Client) -> None:
    api, _, _, headers = analysis_client
    result = create_indicator(
        analysis_client,
        unit="number",
        baseline_value=20,
        target_value=2,
        direction="decrease",
        mapping={
            "source_field": "score",
            "calculation": "average",
        },
    )
    assert result["progress_percent"] == 83.33
    assert result["target_achieved"] is False
    assert result["schedule_status"] == "not_due"
    result = api.patch(f"/indicators/{result['id']}", headers=headers, json={"target_date": "2000-01-01"}).json()
    assert result["status"] == "needs_attention" and result["schedule_status"] == "overdue"
    result = api.patch(f"/indicators/{result['id']}", headers=headers, json={"target_value": 6}).json()
    assert result["target_achieved"] is True and result["schedule_status"] == "achieved"
    result = api.patch(
        f"/indicators/{result['id']}", headers=headers, json={"target_value": 2, "target_date": None}
    ).json()
    assert result["status"] == "in_progress" and result["schedule_status"] == "no_deadline"


def test_mapping_stays_on_original_form_and_nested_values_work(analysis_client: Client) -> None:
    api, engine, project_id, headers = analysis_client
    result = create_indicator(analysis_client, unit="number", mapping={"source_field": "group/n", "calculation": "sum"})
    assert result["current_value"] == 6
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        assert project
        project.kobo_form_id = "other-form"
        db.add(project)
        db.commit()
    result = api.get(f"/indicators/{result['id']}", headers=headers).json()
    assert result["source_form_id"] == "form-1"
    assert result["current_value"] == 6


def test_date_filtering_and_empty_results_do_not_achieve_zero_targets(analysis_client: Client) -> None:
    api, _, project_id, headers = analysis_client
    item = create_indicator(
        analysis_client,
        unit="number",
        target_value=0,
        direction="decrease",
        mapping={"source_field": "score", "calculation": "average"},
    )
    filtered = api.get(f"/indicators/{item['id']}?date_from=2026-10-02&date_to=2026-10-02", headers=headers).json()
    assert filtered["current_value"] == 10 and filtered["denominator"] == 1
    assert filtered["target_value"] == 0
    empty = api.get(f"/indicators/{item['id']}?date_from=2040-01-01", headers=headers).json()
    assert empty["current_value"] is None and empty["target_achieved"] is None
    assert empty["schedule_status"] == "no_data"
    assert (
        api.get(
            f"/projects/{project_id}/indicators?date_from=2026-10-03&date_to=2026-10-01", headers=headers
        ).status_code
        == 422
    )


def test_period_targets_are_explicit_and_missing_period_actuals_remain_null(analysis_client: Client) -> None:
    api, _, _, headers = analysis_client
    item = create_indicator(analysis_client)
    response = api.put(
        f"/indicators/{item['id']}/period-targets",
        headers=headers,
        json=[
            {"period": "2026-10", "target_value": 40},
            {"period": "2026-11", "target_value": 80},
        ],
    )
    assert response.status_code == 200, response.text
    result = api.get(f"/indicators/{item['id']}", headers=headers).json()
    october, november = result["history"]
    assert october["target_value"] == 40 and october["target_achieved"] is True
    assert november["value"] is None and november["target_achieved"] is None
    assert result["target_value"] == 90
    filtered = api.get(f"/indicators/{item['id']}?date_from=2026-10-01&date_to=2026-10-31", headers=headers).json()
    assert len(filtered["history"]) == 1
    assert len(api.get(f"/indicators/{item['id']}/period-targets", headers=headers).json()) == 2
    assert (
        api.patch(f"/indicators/{item['id']}", headers=headers, json={"reporting_frequency": "quarterly"}).status_code
        == 409
    )
    assert api.put(f"/indicators/{item['id']}/period-targets", headers=headers, json=[]).status_code == 200
    assert (
        api.patch(f"/indicators/{item['id']}", headers=headers, json={"reporting_frequency": "quarterly"}).status_code
        == 200
    )


@pytest.mark.parametrize(
    "targets",
    [
        [{"period": "2026-13", "target_value": 1}],
        [{"period": "2026-Q1", "target_value": 1}],
        [{"period": "2026-10", "target_value": 101}],
        [{"period": "2026-10", "target_value": 1}, {"period": "2026-10", "target_value": 2}],
    ],
)
def test_invalid_period_targets_are_rejected(analysis_client: Client, targets: list) -> None:
    api, _, _, headers = analysis_client
    item = create_indicator(analysis_client)
    assert api.put(f"/indicators/{item['id']}/period-targets", headers=headers, json=targets).status_code == 422


@pytest.mark.parametrize(
    "mapping",
    [
        {"source_field": "services", "calculation": "percentage_matching"},
        {"source_field": "services", "calculation": "percentage_matching", "match_value": "Yes"},
        {"source_field": "gender", "calculation": "sum"},
        {"source_field": "_id", "calculation": "count_records"},
        {"source_field": "services", "source_form_id": "not-owned", "calculation": "count_records"},
    ],
)
def test_mapping_rejects_assumptions_and_unapproved_fields(analysis_client: Client, mapping: dict) -> None:
    api, _, project_id, headers = analysis_client
    result = api.post(
        f"/projects/{project_id}/indicators",
        headers=headers,
        json={"name": "Bad mapping", "code": "BAD-01", "mapping": mapping},
    )
    assert result.status_code == 422


def test_framework_crud_links_and_cycle_protection(analysis_client: Client) -> None:
    api, _, project_id, headers = analysis_client
    base = f"/projects/{project_id}/results-framework"
    goal = api.post(base, headers=headers, json={"title": "Improved wellbeing", "node_type": "goal"}).json()
    outcome = api.post(
        base, headers=headers, json={"title": "Services accessed", "node_type": "outcome", "parent_id": goal["id"]}
    ).json()
    item = create_indicator(analysis_client, framework_node_id=outcome["id"])
    assert api.get(base, headers=headers).status_code == 200
    assert len(api.get(base, headers=headers).json()) == 2
    assert (
        api.put(
            f"{base}/{goal['id']}",
            headers=headers,
            json={"title": "Cycle", "node_type": "goal", "parent_id": outcome["id"]},
        ).status_code
        == 422
    )
    assert (
        api.put(
            f"{base}/{outcome['id']}",
            headers=headers,
            json={"title": "Self", "node_type": "outcome", "parent_id": outcome["id"]},
        ).status_code
        == 422
    )
    assert api.delete(f"{base}/{goal['id']}", headers=headers).status_code == 409
    assert api.delete(f"{base}/{outcome['id']}", headers=headers).status_code == 409
    assert api.patch(f"/indicators/{item['id']}", headers=headers, json={"framework_node_id": None}).status_code == 200
    assert api.delete(f"{base}/{outcome['id']}", headers=headers).status_code == 204
    assert api.delete(f"{base}/{goal['id']}", headers=headers).status_code == 204


def test_cross_project_framework_links_are_hidden(analysis_client: Client) -> None:
    api, engine, project_id, headers = analysis_client
    node = api.post(
        f"/projects/{project_id}/results-framework", headers=headers, json={"title": "Own result", "node_type": "goal"}
    ).json()
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        assert project
        other = Project(
            organization_id=project.organization_id,
            organization_sector_id=project.organization_sector_id,
            created_by_id=project.created_by_id,
            name="Another project",
        )
        db.add(other)
        db.commit()
        other_id = str(other.id)
    response = api.post(
        f"/projects/{other_id}/indicators",
        headers=headers,
        json={"name": "Wrong link", "code": "WRONG", "framework_node_id": node["id"]},
    )
    assert response.status_code == 404


def test_legacy_schema_upgrade_preserves_mapping_identity(
    analysis_client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    api, engine, _, headers = analysis_client
    item = create_indicator(analysis_client)
    with Session(engine) as db:
        for row in db.exec(select(Submission).where(Submission.kobo_form_id == "other-form")).all():
            db.delete(row)
        db.commit()
    assert engine.url.database
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{Path(engine.url.database).as_posix()}")
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "0015_indicator_framework")
        command.downgrade(config, "0014_survey_analysis")
        command.upgrade(config, "head")
        result = api.get(f"/indicators/{item['id']}", headers=headers)
        assert result.status_code == 200, result.text
        assert result.json()["current_value"] == 66.67
        assert result.json()["mapping"]["source_form_id"] == "form-1"
        with Session(engine) as db:
            assert len(db.exec(select(Submission)).all()) == 6
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize(
    ("frequency", "period"),
    [
        ("weekly", "2026-W40"),
        ("monthly", "2026-10"),
        ("quarterly", "2026-Q4"),
        ("semi_annual", "2026-H2"),
        ("annual", "2026"),
    ],
)
def test_reporting_periods_match_frequency(analysis_client: Client, frequency: str, period: str) -> None:
    item = create_indicator(analysis_client, reporting_frequency=frequency)
    assert item["history"][0]["period"] == period
    assert item["history"][0]["denominator"] == 2


def test_ambiguous_legacy_form_mapping_requires_explicit_repair(analysis_client: Client) -> None:
    api, engine, _, headers = analysis_client
    item = create_indicator(analysis_client)
    with Session(engine) as db:
        mapping = db.exec(select(IndicatorMapping)).one()
        mapping.source_form_id = None
        db.add(mapping)
        db.commit()
    result = api.get(f"/indicators/{item['id']}", headers=headers).json()
    assert result["mapping_health"] == "form_missing"
    assert result["current_value"] is None


def test_no_ready_records_does_not_achieve_a_zero_count_target(analysis_client: Client) -> None:
    api, engine, _, headers = analysis_client
    item = create_indicator(
        analysis_client,
        unit="number",
        target_value=0,
        direction="decrease",
        mapping={
            "source_field": "services",
            "calculation": "count_records",
        },
    )
    with Session(engine) as db:
        for row in db.exec(select(Submission)).all():
            row.review_status = "invalid"
            db.add(row)
        db.commit()
    result = api.get(f"/indicators/{item['id']}", headers=headers).json()
    assert result["current_value"] is None and result["target_achieved"] is None
    assert result["quality_excluded_records"] == 6


def test_cross_tenant_and_role_checks_cover_frameworks_mappings_and_targets(analysis_client: Client) -> None:
    api, engine, project_id, headers = analysis_client
    item = create_indicator(analysis_client)
    node = api.post(
        f"/projects/{project_id}/results-framework", headers=headers, json={"title": "Own goal", "node_type": "goal"}
    ).json()
    with Session(engine) as db:
        organization = Organization(name="Other tenant", slug="other-tenant")
        db.add(organization)
        db.flush()
        membership = db.exec(select(OrganizationMembership)).one()
        original = membership.organization_id
        membership.organization_id = organization.id
        db.add(membership)
        db.commit()
    assert api.get(f"/projects/{project_id}/results-framework", headers=headers).status_code == 404
    assert api.get(f"/indicators/{item['id']}/period-targets", headers=headers).status_code == 404
    assert api.put(f"/indicators/{item['id']}/period-targets", headers=headers, json=[]).status_code == 404
    assert (
        api.put(
            f"/indicators/{item['id']}/mapping",
            headers=headers,
            json={"source_field": "services", "calculation": "count_records"},
        ).status_code
        == 404
    )
    assert api.delete(f"/projects/{project_id}/results-framework/{node['id']}", headers=headers).status_code == 404
    assert api.delete(f"/indicators/{item['id']}", headers=headers).status_code == 404
    with Session(engine) as db:
        membership = db.exec(select(OrganizationMembership)).one()
        membership.organization_id = original
        membership.role = Role.ENUMERATOR
        db.add(membership)
        db.commit()
    assert api.get(f"/projects/{project_id}/indicators", headers=headers).status_code == 403
    assert api.get(f"/projects/{project_id}/results-framework", headers=headers).status_code == 403
