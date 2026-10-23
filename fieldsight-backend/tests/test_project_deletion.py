"""Project deletion removes the entire local graph and respects tenant boundaries."""

from datetime import date
from unittest.mock import patch
from uuid import UUID, uuid4

from sqlalchemy import event
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client

from app.models.identity import OrganizationMembership, Role
from app.models.operations import (
    Indicator,
    IndicatorPeriodTarget,
    Project,
    ResultFrameworkNode,
    SavedAnalysis,
    SurveySchema,
)
from app.models.workspace import AnalyticalDashboard, CollectedResult


def populate(engine, project_id):
    # Exercise the actual foreign-key constraints, including self-referencing framework nodes.
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    engine.dispose()
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        other = Project(
            organization_id=project.organization_id,
            organization_sector_id=project.organization_sector_id,
            created_by_id=project.created_by_id,
            name="Keep this project",
        )
        db.add(other)
        db.flush()
        for target in [project, other]:
            scope = dict(project_id=target.id, organization_id=target.organization_id)
            parent = ResultFrameworkNode(**scope, title="Outcome")
            db.add(parent)
            db.flush()
            child = ResultFrameworkNode(**scope, title="Output", parent_id=parent.id)
            db.add(child)
            db.flush()
            indicator = Indicator(
                **scope, name="Visits", code="VISITS", framework_node_id=child.id, created_by_id=target.created_by_id
            )
            db.add(indicator)
            db.flush()
            db.add_all(
                [
                    IndicatorPeriodTarget(indicator_id=indicator.id, period="2026-10", target_value=100),
                    CollectedResult(
                        indicator_id=indicator.id,
                        organization_id=target.organization_id,
                        result_date=date(2026, 10, 23),
                        value=10,
                        created_by_id=target.created_by_id,
                    ),
                    SurveySchema(**scope, form_id="form-1"),
                    SavedAnalysis(**scope, title="Visits", created_by_id=target.created_by_id),
                    AnalyticalDashboard(
                        **scope,
                        title="Dashboard",
                        created_by_id=target.created_by_id,
                        widgets=[{"source_id": str(indicator.id), "kind": "indicator"}],
                    ),
                ]
            )
        db.commit()
        return str(project.organization_id), other.id


def test_complete_deletion_preserves_other_project(sync_client):
    client, engine, project_id, headers = sync_client
    org, other = populate(engine, project_id)
    with (
        patch("app.routes.organizations.decrypt_kobo_token", return_value="token"),
        patch("app.routes.organizations.delete_kobo_form") as remote,
    ):
        response = client.delete(f"/organizations/{org}/projects/{project_id}", headers=headers)
    assert response.status_code == 204, response.text
    remote.assert_called_once()
    with Session(engine) as db:
        assert db.get(Project, UUID(project_id)) is None
        assert db.get(Project, other) is not None
        for model in [Indicator, ResultFrameworkNode, SurveySchema, SavedAnalysis, AnalyticalDashboard]:
            rows = db.exec(select(model)).all()
            assert rows and all(row.project_id == other for row in rows)
        assert len(db.exec(select(CollectedResult)).all()) == 1
        assert len(db.exec(select(IndicatorPeriodTarget)).all()) == 1


def test_permission_and_remote_failure_preserve_project(sync_client):
    client, engine, project_id, headers = sync_client
    org, _ = populate(engine, project_id)
    path = f"/organizations/{org}/projects/{project_id}"
    with patch("app.routes.organizations.delete_kobo_form") as remote:
        assert client.delete(path).status_code == 401
        assert client.delete(f"/organizations/{uuid4()}/projects/{project_id}", headers=headers).status_code == 404
        with Session(engine) as db:
            membership = db.exec(select(OrganizationMembership)).one()
            membership.role = Role.ENUMERATOR
            db.add(membership)
            db.commit()
        assert client.delete(path, headers=headers).status_code == 403
        remote.assert_not_called()
    with Session(engine) as db:
        membership = db.exec(select(OrganizationMembership)).one()
        membership.role = Role.ORGANIZATION_ADMIN
        db.add(membership)
        db.commit()
    with (
        patch("app.routes.organizations.decrypt_kobo_token", return_value="token"),
        patch("app.routes.organizations.delete_kobo_form", side_effect=ValueError("Kobo unavailable. Try again.")),
    ):
        response = client.delete(path, headers=headers)
    assert response.status_code == 422
    assert "Kobo unavailable" in response.text
    with Session(engine) as db:
        assert db.get(Project, UUID(project_id)) is not None
        assert len(db.exec(select(AnalyticalDashboard)).all()) == 2


def test_shared_form_cannot_be_deleted(sync_client):
    client, engine, project_id, headers = sync_client
    org, other = populate(engine, project_id)
    with Session(engine) as db:
        original = db.get(Project, UUID(project_id))
        shared = db.get(Project, other)
        shared.kobo_form_id = original.kobo_form_id
        shared.kobo_connection_id = original.kobo_connection_id
        db.add(shared)
        db.commit()
    with patch("app.routes.organizations.delete_kobo_form") as remote:
        response = client.delete(f"/organizations/{org}/projects/{project_id}", headers=headers)
    assert response.status_code == 409
    remote.assert_not_called()


def test_local_cleanup_failure_rolls_back_all_local_changes(sync_client):
    client, engine, project_id, headers = sync_client
    org, _ = populate(engine, project_id)
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        project.kobo_form_id = None
        db.add(project)
        db.commit()

    @event.listens_for(engine, "before_cursor_execute")
    def fail_cleanup(connection, cursor, statement, parameters, context, many):
        if statement.startswith("DELETE FROM survey_schemas"):
            raise RuntimeError("Simulated storage failure")

    try:
        response = client.delete(f"/organizations/{org}/projects/{project_id}", headers=headers)
    finally:
        event.remove(engine, "before_cursor_execute", fail_cleanup)
    assert response.status_code == 500
    assert "rolled back" in response.text
    with Session(engine) as db:
        assert db.get(Project, UUID(project_id)) is not None
        assert len(db.exec(select(AnalyticalDashboard)).all()) == 2
        assert len(db.exec(select(SavedAnalysis)).all()) == 2
        assert len(db.exec(select(Indicator)).all()) == 2


def test_form_reference_without_connection_allows_local_cleanup(sync_client):
    client, engine, project_id, headers = sync_client
    org, other = populate(engine, project_id)
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        project.kobo_connection_id = None
        db.add(project)
        db.commit()
    with patch("app.routes.organizations.delete_kobo_form") as remote:
        response = client.delete(f"/organizations/{org}/projects/{project_id}", headers=headers)
    assert response.status_code == 204, response.text
    remote.assert_not_called()
    with Session(engine) as db:
        assert db.get(Project, UUID(project_id)) is None
        assert db.get(Project, other) is not None
        assert all(row.project_id == other for row in db.exec(select(AnalyticalDashboard)).all())
        assert all(row.project_id == other for row in db.exec(select(Indicator)).all())
