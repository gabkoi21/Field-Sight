"""Sprint A reuses these APIs; exercise their combined contract on disposable data."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.models.identity import Organization, OrganizationMembership, Role
from app.models.operations import (
    Indicator,
    IndicatorCalculation,
    IndicatorMapping,
    Project,
    QualityFinding,
    Submission,
    SurveySchema,
    SyncRun,
)
from app.schemas.analysis import SurveyField


def seed_overview(engine, project_id):
    """School Feeding is a fixture, never a production field-name convention."""
    now = datetime.now(UTC)
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        project.name = "Daily School Feeding Monitoring Form"
        db.add(project)
        schema = SurveySchema(
            organization_id=project.organization_id, project_id=project.id, form_id="form-1",
            fields_json=[SurveyField(source_field=name, label=name, type=kind, source="kobo").model_dump()
                         for name, kind in [("students", "number"), ("shortage", "text")]],
        )
        db.add(schema)
        rows = []
        # Include old and undated data: operational totals must not silently mean "last 30 days".
        for index, (status, submitted) in enumerate([
            ("ready", now - timedelta(days=90)), ("ready", now), ("needs_review", None), ("invalid", now),
        ]):
            row = Submission(
                organization_id=project.organization_id, project_id=project.id,
                kobo_connection_id=project.kobo_connection_id, kobo_form_id="form-1",
                external_id=f"school-{index}", submitted_at=submitted, review_status=status,
                raw_answers={"students": 100 + index, "shortage": "yes" if index == 0 else "no"},
            )
            db.add(row)
            rows.append(row)
        db.flush()
        db.add(QualityFinding(
            id="school-finding", organization_id=project.organization_id, project_id=project.id,
            submission_id=rows[2].id, severity="High", rule="missing_date", detail="Date requires review.",
        ))
        for name, code, field, method, match in [
            ("Feeding sessions completed", "FEED", "students", IndicatorCalculation.COUNT_RECORDS, None),
            ("Students fed", "STUD", "students", IndicatorCalculation.SUM, None),
            ("Food shortage incidents", "SHORT", "shortage", IndicatorCalculation.COUNT_MATCHING, "yes"),
        ]:
            indicator = Indicator(
                organization_id=project.organization_id, project_id=project.id,
                created_by_id=project.created_by_id, name=name, code=code, reliability_policy=1,
            )
            db.add(indicator)
            db.flush()
            db.add(IndicatorMapping(
                organization_id=project.organization_id, project_id=project.id, indicator_id=indicator.id,
                source_field=field, source_form_id="form-1", calculation=method, match_value=match,
            ))
        successful_at = now - timedelta(hours=2)
        for status, started, completed in [
            ("completed", successful_at - timedelta(minutes=1), successful_at),
            ("failed", now - timedelta(minutes=1), now),
        ]:
            db.add(SyncRun(
                organization_id=project.organization_id, project_id=project.id,
                kobo_connection_id=project.kobo_connection_id, kobo_form_id="form-1", status=status,
                started_at=started, completed_at=completed,
            ))
        # Another project and tenant must not contaminate project metrics or findings.
        other_org = Organization(name="Other tenant", slug="overview-other")
        db.add(other_org)
        db.flush()
        foreign = Project(
            organization_id=other_org.id, organization_sector_id=project.organization_sector_id,
            created_by_id=project.created_by_id, name="Foreign project",
        )
        sibling = Project(
            organization_id=project.organization_id, organization_sector_id=project.organization_sector_id,
            created_by_id=project.created_by_id, name="Sibling project",
        )
        db.add_all([foreign, sibling])
        db.flush()
        for other in [foreign, sibling]:
            row = Submission(
                organization_id=other.organization_id, project_id=other.id,
                kobo_connection_id=project.kobo_connection_id, kobo_form_id="form-1",
                external_id="not-in-overview", review_status="needs_review", raw_answers={"students": 9999},
            )
            db.add(row)
            db.flush()
            db.add(QualityFinding(
                id=f"finding-{other.id}", organization_id=other.organization_id, project_id=other.id,
                submission_id=row.id, severity="High", rule="test", detail="Not in project overview.",
            ))
        db.commit()
        return str(foreign.id), str(sibling.id), successful_at


def test_reused_overview_contract_preserves_operational_and_me_scopes(sync_client):
    client, engine, project, headers = sync_client
    _, _, success = seed_overview(engine, project)
    records = client.get(f"/submissions/page?project_id={project}&limit=1", headers=headers)
    assert records.status_code == 200
    assert records.json()["total"] == 4
    assert records.json()["counts"] == {"ready": 2, "needs_review": 1, "invalid": 1}
    assert len(records.json()["items"]) == 1
    quality = client.get(f"/quality/queue?project_id={project}&limit=1", headers=headers).json()
    assert quality["total"] == 1
    assert quality["items"][0]["id"] == "school-finding"
    sync = client.get(f"/projects/{project}/sync-settings", headers=headers).json()
    assert sync["latest_status"] == "failed"
    assert datetime.fromisoformat(sync["last_successful_sync"]) == success
    response = client.get(f"/projects/{project}/indicators", headers=headers)
    assert response.status_code == 200, response.text
    results = {item["name"]: item for item in response.json()}
    assert results["Feeding sessions completed"]["current_value"] == 2
    assert results["Students fed"]["current_value"] == 201
    assert results["Food shortage incidents"]["current_value"] == 1
    assert all(item["quality_excluded_records"] == 2 for item in results.values())
    assert all(item["setup_complete"] for item in results.values())


def test_foreign_tenant_and_empty_project_overview_contract(sync_client):
    client, engine, project, headers = sync_client
    foreign, sibling, _ = seed_overview(engine, project)
    for endpoint in [f"/projects/{foreign}/indicators", f"/projects/{foreign}/sync-settings"]:
        assert client.get(endpoint, headers=headers).status_code == 404
    for endpoint in [f"/submissions/page?project_id={foreign}", f"/quality/queue?project_id={foreign}"]:
        response = client.get(endpoint, headers=headers)
        assert response.status_code == 200
        assert response.json()["total"] == 0 and response.json()["items"] == []
    assert client.get(f"/projects/{sibling}/indicators", headers=headers).json() == []
    sync = client.get(f"/projects/{sibling}/sync-settings", headers=headers).json()
    assert sync["last_successful_sync"] is None


@pytest.mark.parametrize("role,active", [(Role.ENUMERATOR, True), (Role.ORGANIZATION_ADMIN, False)])
def test_overview_apis_keep_existing_membership_permissions(sync_client, role, active):
    client, engine, project, headers = sync_client
    with Session(engine) as db:
        member = db.exec(select(OrganizationMembership)).one()
        member.role = role
        member.is_active = active
        db.add(member)
        db.commit()
    for endpoint in [f"/submissions/page?project_id={project}", f"/quality/queue?project_id={project}",
                     f"/projects/{project}/indicators", f"/projects/{project}/sync-settings"]:
        assert client.get(endpoint, headers=headers).status_code == 403


def test_overview_apis_require_authentication(sync_client):
    client, _, project, _ = sync_client
    for endpoint in [f"/submissions/page?project_id={project}", f"/quality/queue?project_id={project}",
                     f"/projects/{project}/indicators", f"/projects/{project}/sync-settings"]:
        assert client.get(endpoint).status_code == 401
