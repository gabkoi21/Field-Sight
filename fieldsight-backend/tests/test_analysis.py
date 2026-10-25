"""Benchmarked question analytics with real tenant authorization and storage."""

import csv
from datetime import UTC, datetime
from io import StringIO
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

import httpx
import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, inspect
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from alembic import command
from app.core.config import get_settings
from app.core.survey import read_kobo_schema
from app.models.identity import Organization, OrganizationMembership, Role
from app.models.operations import Project, SavedAnalysis, Submission, SurveySchema
from app.routes.collection import _submission_time
from app.schemas.analysis import SurveyField

Client = tuple[TestClient, Engine, str, dict[str, str]]


@pytest.fixture
def analysis_client(sync_client: Client) -> Client:
    _, engine, project_id, _ = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        assert project and project.kobo_connection_id
        questions = [
            SurveyField(
                source_field="gender",
                label="Gender",
                type="select_one",
                source="kobo",
                choices=[
                    {"value": "f", "label": "Female"},
                    {"value": "m", "label": "Male"},
                ],
            ),
            SurveyField(
                source_field="services",
                label="Services",
                type="select_multiple",
                source="kobo",
                choices=[
                    {"value": "a", "label": "Water"},
                    {"value": "b", "label": "Health"},
                ],
            ),
            SurveyField(source_field="score", label="Score", type="number", source="kobo"),
            SurveyField(source_field="visit", label="Visit date", type="date", source="kobo"),
            SurveyField(source_field="group/n", label="Nested number", type="number", source="kobo"),
        ]
        db.add(
            SurveySchema(
                project_id=project.id,
                organization_id=project.organization_id,
                form_id="form-1",
                version="v1",
                fields_json=[field.model_dump() for field in questions],
            )
        )
        rows = [
            (
                {"gender": "f", "services": "a b a", "score": 10, "visit": "2026-10-01", "group": {"n": 2}},
                "ready",
                "North",
                "A",
                "2026-10-01T23:30:00-02:00",
            ),
            (
                {"gender": "m", "services": ["b"], "score": 0, "visit": "2026-10-03", "group/n": 4},
                "ready",
                "South",
                "B",
                "2026-10-03T12:00:00+00:00",
            ),
            (
                {"gender": "", "services": [], "score": "bad", "visit": "bad"},
                "ready",
                "North",
                "A",
                "2026-10-04T12:00:00+00:00",
            ),
            ({"gender": None, "services": "a", "score": None}, "ready", None, None, None),
            ({"gender": "f", "score": 100}, "needs_review", "North", "A", "2026-10-03T12:00:00+00:00"),
            ({"gender": "m", "score": 200}, "invalid", "North", "A", "2026-10-03T12:00:00+00:00"),
        ]
        for index, (answers, status, location, enumerator, timestamp) in enumerate(rows):
            db.add(
                Submission(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    kobo_connection_id=project.kobo_connection_id,
                    kobo_form_id="form-1",
                    external_id=str(index),
                    raw_answers=answers,
                    review_status=status,
                    location=location,
                    enumerator=enumerator,
                    submitted_at=datetime.fromisoformat(timestamp).astimezone(UTC) if timestamp else None,
                )
            )
        db.add(
            Submission(
                organization_id=project.organization_id,
                project_id=project.id,
                kobo_connection_id=project.kobo_connection_id,
                kobo_form_id="other-form",
                external_id="0",
                raw_answers={"gender": "private-other-form", "score": 999},
            )
        )
        db.commit()
    return sync_client


def query(client: Client, source: str = "gender", **changes: object) -> dict:
    api, _, project_id, headers = client
    response = api.post(
        "/analysis/query",
        headers=headers,
        json={
            "project_id": project_id,
            "source_field": source,
            **changes,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_single_select_denominator_missing_and_form_isolation(analysis_client: Client) -> None:
    result = query(analysis_client)
    assert result["total_records"] == 6
    assert result["eligible_records"] == 4
    assert result["answered_records"] == result["denominator"] == 2
    assert result["missing_records"] == 2
    assert {point["name"]: point["percent"] for point in result["series"]} == {"Female": 50, "Male": 50}
    assert "raw_answers" not in str(result)
    assert "private-other-form" not in str(result)


def test_multi_select_string_and_array_count_each_option_once(analysis_client: Client) -> None:
    result = query(analysis_client, "services")
    assert result["answered_records"] == 3
    assert result["missing_records"] == 1
    assert {point["name"]: point["count"] for point in result["series"]} == {"Water": 2, "Health": 2}
    assert all(point["percent"] == 66.67 for point in result["series"])
    assert "more than 100%" in result["note"]


@pytest.mark.parametrize(
    ("measure", "expected"), [("auto", 5), ("sum", 10), ("average", 5), ("min", 0), ("max", 10), ("count", 2)]
)
def test_numeric_zero_missing_invalid_and_calculations(analysis_client: Client, measure: str, expected: float) -> None:
    result = query(analysis_client, "score", measure=measure)
    assert result["value"] == expected
    assert result["answered_records"] == 2
    assert result["missing_records"] == result["invalid_answers"] == 1
    assert (
        result["eligible_records"] == result["answered_records"] + result["missing_records"] + result["invalid_answers"]
    )


def test_nested_fields_grouping_and_date_trends(analysis_client: Client) -> None:
    assert query(analysis_client, "group/n")["value"] == 3
    result = query(analysis_client, group_by="group/n")
    assert {(point["name"], point["group"]): point["count"] for point in result["series"]} == {
        ("Female", "2"): 1,
        ("Male", "4"): 1,
    }
    result = query(analysis_client, "visit", time_grain="month")
    assert result["series"][0]["name"] == "2026-10"
    assert result["series"][0]["value"] == 2
    assert result["invalid_answers"] == 1


def test_filters_utc_date_boundaries_review_location_enumerator_and_categories(analysis_client: Client) -> None:
    result = query(
        analysis_client,
        filters={"date_from": "2026-10-02", "date_to": "2026-10-02", "location": "North", "enumerator": "A"},
    )
    assert result["eligible_records"] == 1
    assert result["series"][0]["name"] == "Female"
    result = query(analysis_client, "services", filters={"categories": ["a"]})
    assert result["eligible_records"] == result["answered_records"] == 2
    assert query(analysis_client, filters={"review_status": "all"})["eligible_records"] == 5
    assert query(analysis_client, filters={"review_status": "needs_review"})["eligible_records"] == 0
    assert query(analysis_client, filters={"review_status": "invalid"})["answered_records"] == 1


def test_empty_selection_has_no_fabricated_zero_average(analysis_client: Client) -> None:
    result = query(analysis_client, "score", filters={"location": "absent"})
    assert result["value"] is None
    assert result["denominator"] == 0
    assert result["series"] == []


@pytest.mark.parametrize(
    "changes",
    [
        {"source_field": "score); DROP TABLE submissions"},
        {"group_by": "unknown"},
        {"form_id": "unknown"},
        {"measure": "sum"},
        {"filters": {"date_from": "2026-10-02", "date_to": "2026-10-01"}},
        {"filters": {"sql": "select 1"}},
        {"arbitrary_sql": "select 1"},
    ],
)
def test_disallowed_queries_fail(analysis_client: Client, changes: dict) -> None:
    api, _, project_id, headers = analysis_client
    response = api.post(
        "/analysis/query", headers=headers, json={"project_id": project_id, "source_field": "gender", **changes}
    )
    assert response.status_code == 422


def test_saved_visualizations_reload_and_export(analysis_client: Client) -> None:
    api, _, project_id, headers = analysis_client
    payload = {"project_id": project_id, "source_field": "services"}
    saved = api.post(
        "/analysis/saved", headers=headers, json={"title": "Service access", "query": payload, "chart": "bar"}
    )
    assert saved.status_code == 201, saved.text
    listed = api.get(f"/analysis/saved?project_id={project_id}", headers=headers).json()
    assert listed[0]["query"]["form_id"] == "form-1"
    assert listed[0]["title"] == "Service access"
    restored = api.post("/analysis/query", headers=headers, json=listed[0]["query"])
    assert restored.json()["denominator"] == 3
    exported = api.post("/analysis/export", headers=headers, json=payload)
    assert exported.status_code == 200
    assert "text/csv" in exported.headers["content-type"]
    assert "denominator" in exported.text and "66.67" in exported.text
    assert "external_id" not in exported.text and "raw_answers" not in exported.text
    assert api.delete(f"/analysis/saved/{listed[0]['id']}", headers=headers).status_code == 204
    assert api.get(f"/analysis/saved?project_id={project_id}", headers=headers).json() == []


def test_catalogue_and_cached_metadata_refresh_failure(analysis_client: Client) -> None:
    api, _, project_id, headers = analysis_client
    with patch("app.routes.analysis.read_kobo_schema", side_effect=ValueError("secret")):
        fields = api.get(f"/projects/{project_id}/survey-fields?refresh_schema=true", headers=headers).json()
    assert fields["form_version"] == "v1"
    assert "secret" not in fields["warning"]
    assert "failed" in fields["warning"]
    assert fields["locations"] == ["North", "South"]


def test_metadata_parser_multilingual_groups_choices_and_repeats() -> None:
    payload = {
        "version": "v2",
        "content": {
            "survey": [
                {"type": "begin_group", "name": "group"},
                {
                    "type": "select_multiple",
                    "name": "services",
                    "label": {"en": "Services", "fr": "Services FR"},
                    "select_from_list_name": "options",
                },
                {"type": "end_group"},
                {"type": "begin_repeat", "name": "people"},
                {"type": "integer", "name": "age", "label": ["Age", "Age FR"]},
                {"type": "end_repeat"},
            ],
            "choices": [{"list_name": "options", "name": "a", "label": ["Water", "Eau"]}],
        },
    }
    with patch("app.core.survey.httpx.get", return_value=httpx.Response(200, json=payload)):
        version, fields = read_kobo_schema("https://kf.kobotoolbox.org", "private", "form-1")
    assert version == "v2"
    assert fields[0].source_field == "group/services"
    assert fields[0].choices[0].label == "Water"
    assert fields[1].source_field == "people/age" and not fields[1].supported


def test_cross_tenant_and_enumerator_access_blocked(analysis_client: Client) -> None:
    api, engine, project_id, headers = analysis_client
    saved = api.post(
        "/analysis/saved",
        headers=headers,
        json={
            "title": "Scoped view",
            "query": {"project_id": project_id, "source_field": "gender"},
        },
    ).json()
    with Session(engine) as db:
        other = Organization(name="Other", slug="other")
        db.add(other)
        db.flush()
        project = db.get(Project, UUID(project_id))
        assert project
        original_org = project.organization_id
        project.organization_id = other.id
        db.add(project)
        db.commit()
    for endpoint, payload in [
        ("/analysis/query", {"project_id": project_id, "source_field": "gender"}),
        ("/analysis/export", {"project_id": project_id, "source_field": "gender"}),
    ]:
        assert api.post(endpoint, headers=headers, json=payload).status_code == 404
    assert api.get(f"/projects/{project_id}/survey-fields", headers=headers).status_code == 404
    assert api.get(f"/analysis/saved?project_id={project_id}", headers=headers).status_code == 404
    assert api.delete(f"/analysis/saved/{saved['id']}", headers=headers).status_code == 404
    assert (
        api.post(
            "/analysis/saved",
            headers=headers,
            json={
                "title": "Forbidden",
                "query": {"project_id": project_id, "source_field": "gender"},
            },
        ).status_code
        == 404
    )
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        assert project
        project.organization_id = original_org
        membership = db.exec(select(OrganizationMembership)).one()
        membership.role = Role.ENUMERATOR
        db.add_all([project, membership])
        db.commit()
    assert (
        api.post(
            "/analysis/query", headers=headers, json={"project_id": project_id, "source_field": "gender"}
        ).status_code
        == 403
    )


def test_csv_formula_labels_are_escaped(analysis_client: Client) -> None:
    api, engine, project_id, headers = analysis_client
    with Session(engine) as db:
        row = db.exec(
            select(Submission).where(Submission.external_id == "0", Submission.kobo_form_id == "form-1")
        ).one()
        row.raw_answers = {"gender": "=HYPERLINK(secret)"}
        db.add(row)
        db.commit()
    response = api.post("/analysis/export", headers=headers, json={"project_id": project_id, "source_field": "gender"})
    rows = list(csv.reader(StringIO(response.text)))
    assert any(row[1] == "'=HYPERLINK(secret)" for row in rows if len(row) > 1)


def test_import_timestamp_normalizes_to_utc() -> None:
    assert _submission_time("2026-10-01T23:30:00-02:00") == datetime(2026, 10, 2, 1, 30, tzinfo=UTC)


def test_successful_schema_refresh_persists_new_version(analysis_client: Client) -> None:
    api, _, project_id, headers = analysis_client
    field = SurveyField(source_field="services", label="Updated services", type="select_multiple", source="kobo")
    with (
        patch("app.routes.analysis.decrypt_kobo_token", return_value="synthetic"),
        patch(
            "app.routes.analysis.read_kobo_schema",
            return_value=("v2", [field]),
        ),
    ):
        refreshed = api.get(f"/projects/{project_id}/survey-fields?refresh_schema=true", headers=headers)
    assert refreshed.status_code == 200
    assert refreshed.json()["form_version"] == "v2"
    restored = api.get(f"/projects/{project_id}/survey-fields", headers=headers).json()
    assert restored["form_version"] == "v2"
    assert restored["schema_updated_at"]
    assert (
        next(item for item in restored["fields"] if item["source_field"] == "services")["label"] == "Updated services"
    )


def test_repeat_groups_cannot_be_silently_counted(analysis_client: Client) -> None:
    api, engine, project_id, headers = analysis_client
    with Session(engine) as db:
        schema = db.exec(select(SurveySchema)).one()
        schema.fields_json = [
            *schema.fields_json,
            SurveyField(
                source_field="people/age",
                label="Household ages",
                type="repeat",
                supported=False,
                source="kobo",
            ).model_dump(),
        ]
        db.add(schema)
        db.commit()
    result = api.post("/analysis/query", headers=headers, json={"project_id": project_id, "source_field": "people/age"})
    assert result.status_code == 422
    assert "repeat" in result.json()["message"].lower()


def test_geopoints_group_by_location_without_returning_coordinates(analysis_client: Client) -> None:
    api, engine, project_id, headers = analysis_client
    with Session(engine) as db:
        schema = db.exec(select(SurveySchema)).one()
        schema.fields_json = [
            *schema.fields_json,
            SurveyField(
                source_field="gps",
                label="Location",
                type="geopoint",
                source="kobo",
            ).model_dump(),
        ]
        row = db.exec(
            select(Submission).where(Submission.external_id == "0", Submission.kobo_form_id == "form-1")
        ).one()
        row.raw_answers = {**row.raw_answers, "gps": "6.12345 -10.12345 0 5"}
        db.add_all([schema, row])
        db.commit()
    result = query(analysis_client, "gps")
    assert result["answered_records"] == 1
    assert result["series"][0]["name"] == "North"
    assert "6.12345" not in str(result)


def test_existing_database_upgrades_to_survey_schema_tables(
    analysis_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    api, engine, project_id, headers = analysis_client
    # Simulate the previous revision using only this fixture's temporary DB.
    SavedAnalysis.__table__.drop(engine)
    SurveySchema.__table__.drop(engine)
    assert engine.url.database
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{Path(engine.url.database).as_posix()}")
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.stamp(config, "0013_submission_form_identity")
        command.upgrade(config, "head")
        assert {"survey_schemas", "saved_analyses"} <= set(inspect(engine).get_table_names())
        with Session(engine) as db:
            assert len(db.exec(select(Submission)).all()) == 7
        saved = api.post(
            "/analysis/saved",
            headers=headers,
            json={
                "title": "After migration",
                "query": {"project_id": project_id, "source_field": "gender"},
            },
        )
        assert saved.status_code == 201, saved.text
    finally:
        get_settings.cache_clear()
