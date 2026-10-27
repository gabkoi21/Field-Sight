"""Reset safety and complete project graph deletion on disposable SQLite databases only."""

import shutil
import sqlite3
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlmodel import Session, create_engine, select

from app.models.identity import Organization, OrganizationSector, RefreshSession, Role, Sector, User
from app.models.operations import (
    FieldMapping,
    Indicator,
    IndicatorDefinitionVersion,
    IndicatorPeriodTarget,
    OrganizationAdminEvent,
    OrganizationSettings,
    Project,
    ProjectAction,
    ProjectActionEvent,
    ProjectTarget,
    ResultFrameworkNode,
    SavedAnalysis,
    Submission,
    SubmissionReviewEvent,
    SyncJob,
    SyncRun,
    SyncSchedule,
    SyncSettingsChange,
    SyncWorkerHeartbeat,
)
from app.models.workspace import AnalyticalDashboard, CollectedResult, UserPreference, WorkspaceInvitation
from scripts import reset_dev_projects as reset
from scripts import school_feeding_pilot as pilot


@pytest.fixture
def reset_fixture(tmp_path, monkeypatch):
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", "sqlite:///unused-reset-test.db")
    monkeypatch.setenv("FIELDSIGHT_JWT_SECRET", pilot.TEST_SECRET)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setattr(pilot, "PILOT_ROOT", tmp_path)
    monkeypatch.setattr(reset, "branch", lambda: "dev")
    monkeypatch.setattr(reset, "dotenv_values", lambda *_: {})
    path = (tmp_path / "development.db").resolve()
    seeded = pilot.seed_database(path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    with Session(engine) as db:
        project = db.get(Project, UUID(seeded["project_id"]))
        actor = db.get(User, project.created_by_id)
        scope = {"organization_id": project.organization_id, "project_id": project.id}
        submission = db.exec(select(Submission).where(Submission.project_id == project.id)).first()
        indicator = db.exec(select(Indicator).where(Indicator.project_id == project.id)).first()
        parent = ResultFrameworkNode(**scope, title="Outcome")
        db.add(parent)
        db.flush()
        child = ResultFrameworkNode(**scope, title="Output", parent_id=parent.id)
        db.add(child)
        db.flush()
        indicator.framework_node_id = child.id
        db.add(indicator)
        field = FieldMapping(**scope, source_field="portions", display_name="Portions")
        db.add(field)
        db.flush()
        action = ProjectAction(
            **scope, title="Investigate", created_by_id=actor.id, submission_id=submission.id, indicator_id=indicator.id
        )
        db.add(action)
        db.flush()
        super_admin = User(email="super@reset.example", password_hash="synthetic", platform_role=Role.SUPER_ADMIN)
        foreign = Organization(name="Other organization", slug="other-reset")
        db.add_all([super_admin, foreign])
        db.flush()
        sector = db.exec(select(Sector)).first()
        foreign_sector = OrganizationSector(organization_id=foreign.id, sector_id=sector.id)
        db.add(foreign_sector)
        db.flush()
        db.add(
            Project(
                organization_id=foreign.id,
                organization_sector_id=foreign_sector.id,
                created_by_id=super_admin.id,
                name="Foreign organization project",
            )
        )
        db.add_all(
            [
                ProjectTarget(**scope, field_mapping_id=field.id, name="Portion target", target_value=100),
                IndicatorPeriodTarget(indicator_id=indicator.id, period="2026-10", target_value=100),
                IndicatorDefinitionVersion(
                    indicator_id=indicator.id,
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    version=1,
                    reason="Fixture",
                    previous_definition={},
                    new_definition={},
                    preview={},
                ),
                ProjectActionEvent(
                    **scope, action_id=action.id, actor_id=actor.id, event_type="created", new_values={}
                ),
                SubmissionReviewEvent(
                    submission_id=submission.id,
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    action="status",
                    status="ready",
                ),
                CollectedResult(
                    indicator_id=indicator.id,
                    organization_id=project.organization_id,
                    result_date=date(2026, 10, 27),
                    value=2,
                    created_by_id=actor.id,
                ),
                SavedAnalysis(**scope, created_by_id=actor.id, title="Analysis"),
                AnalyticalDashboard(**scope, created_by_id=actor.id, title="Dashboard"),
                SyncSchedule(project_id=project.id),
                SyncJob(project_id=project.id),
                SyncSettingsChange(project_id=project.id, changed_by_id=actor.id, mode="manual", interval_minutes=60),
                SyncRun(**scope, kobo_connection_id=project.kobo_connection_id, kobo_form_id=project.kobo_form_id),
                OrganizationSettings(organization_id=project.organization_id, timezone="Africa/Monrovia"),
                SyncWorkerHeartbeat(worker_id="fixture-worker"),
                UserPreference(user_id=actor.id, landing_page=f"/projects/{project.id}/overview"),
                WorkspaceInvitation(
                    organization_id=project.organization_id,
                    email="invite@reset.example",
                    role="enumerator",
                    token_hash="synthetic-invite",
                    created_by_id=actor.id,
                    expires_at=datetime.now(UTC) + timedelta(days=1),
                ),
                RefreshSession(
                    user_id=super_admin.id,
                    token_hash="synthetic-refresh",
                    expires_at=datetime.now(UTC) + timedelta(days=1),
                ),
                OrganizationAdminEvent(
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    action="project_status:active",
                    resource_id=str(project.id),
                ),
                OrganizationAdminEvent(
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    action="submission_review:ready",
                    resource_id=str(submission.id),
                ),
                OrganizationAdminEvent(
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    action="custom_project_event",
                    resource_id=str(indicator.id),
                ),
                OrganizationAdminEvent(
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    action="project_status:archived",
                    resource_id=str(uuid4()),
                ),
                OrganizationAdminEvent(
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    action="submissions_export",
                    resource_id=str(project.organization_id),
                ),
                OrganizationAdminEvent(
                    organization_id=project.organization_id,
                    actor_id=actor.id,
                    action="organization_settings_updated",
                    resource_id=str(project.organization_id),
                ),
            ]
        )
        db.commit()
    engine.dispose()
    return path, tmp_path / "backup.sqlite3", tmp_path / "reset.json"


def snapshot(path):
    with reset.connect(path) as db:
        return reset.state(db)


def run(fixture, **overrides):
    path, _, manifest = fixture
    arguments = dict(
        path=path,
        environment="development",
        manifest=manifest,
        confirm_database=str(path),
        confirm_delete=reset.PHRASE,
        writers_stopped=True,
        verify=True,
    )
    return reset.execute(**(arguments | overrides))


def prepare(fixture):
    path, backup, manifest = fixture
    return reset.prepare(path, "development", backup, manifest)


def test_preview_backup_preserves_source_and_covers_every_owned_table(reset_fixture):
    path, backup, _ = reset_fixture
    before = snapshot(path)
    plan = prepare(reset_fixture)
    assert snapshot(path) == before == snapshot(backup)
    assert plan["backup_verified"] and plan["status"] == "PREPARED_ONLY_NOT_EXECUTED"
    assert set(plan["preview"]["delete_counts"]) == reset.OWNED | {reset.SHARED_AUDIT}
    assert all(plan["preview"]["delete_counts"][name] > 0 for name in reset.OWNED)
    assert plan["preview"]["super_admin_accounts"] == 1
    assert len(plan["preview"]["projects"]) == 3
    assert plan["preview"]["delete_counts"][reset.SHARED_AUDIT] == 5
    assert plan["preview"]["preserved_admin_events"] == 1
    with pytest.raises(reset.ResetRefused, match="already exists"):
        prepare(reset_fixture)


def test_execute_clears_all_projects_preserves_configuration_and_other_database(reset_fixture):
    path, backup, _ = reset_fixture
    prepare(reset_fixture)
    before = snapshot(path)
    neighbor = path.with_name("unselected.db")
    shutil.copyfile(backup, neighbor)
    neighbor_before = snapshot(neighbor)
    result = run(reset_fixture)
    assert result["status"] == "COMMITTED" and not any(result["remaining"].values())
    after = snapshot(path)
    assert after["schema"] == before["schema"]
    assert all(after["tables"][table] == before["tables"][table] for table in reset.PRESERVED)
    assert after["tables"][reset.SHARED_AUDIT]["count"] == 1
    assert snapshot(backup) == before and snapshot(neighbor) == neighbor_before
    with pytest.raises(reset.ResetRefused, match="one-time"):
        run(reset_fixture)


@pytest.mark.parametrize(
    "overrides",
    [
        {"confirm_database": "wrong.db"},
        {"confirm_delete": "yes"},
        {"writers_stopped": False},
        {"environment": "production"},
    ],
)
def test_execution_requires_every_confirmation(reset_fixture, overrides):
    prepare(reset_fixture)
    before = snapshot(reset_fixture[0])
    with pytest.raises(reset.ResetRefused):
        run(reset_fixture, **overrides)
    assert snapshot(reset_fixture[0]) == before


def test_refuses_production_configuration_and_wrong_branch(reset_fixture, monkeypatch):
    before = snapshot(reset_fixture[0])
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "production")
    with pytest.raises(reset.ResetRefused, match="Production"):
        prepare(reset_fixture)
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    monkeypatch.setattr(reset, "branch", lambda: "main")
    with pytest.raises(reset.ResetRefused, match="dev branch"):
        prepare(reset_fixture)
    assert snapshot(reset_fixture[0]) == before


def test_changed_source_or_changed_backup_refuses_without_deletion(reset_fixture):
    path, backup, _ = reset_fixture
    prepare(reset_fixture)
    with sqlite3.connect(path) as db:
        db.execute("UPDATE projects SET name='Changed after preview' WHERE name='SYNTHETIC other project'")
    before = snapshot(path)
    with pytest.raises(reset.ResetRefused, match="changed since preview"):
        run(reset_fixture)
    assert snapshot(path) == before
    with backup.open("ab") as file:
        file.write(b"tamper")
    with pytest.raises(reset.ResetRefused, match="backup is missing, changed"):
        run(reset_fixture)
    assert snapshot(path) == before


def test_failure_after_deletion_rolls_back_entire_graph(reset_fixture, monkeypatch):
    prepare(reset_fixture)
    before = snapshot(reset_fixture[0])

    def fail(_):
        raise reset.ResetRefused("Injected verification failure")

    monkeypatch.setattr(reset, "verify_empty", fail)
    with pytest.raises(reset.ResetRefused, match="Injected"):
        run(reset_fixture)
    assert snapshot(reset_fixture[0]) == before
    assert not reset_fixture[2].with_name(reset_fixture[2].name + ".executed.json").exists()


def test_preserved_configuration_invariant_rolls_back(reset_fixture, monkeypatch):
    prepare(reset_fixture)
    before = snapshot(reset_fixture[0])
    original = reset.verify_empty

    def mutate(db):
        db.execute("UPDATE users SET full_name='Unexpected change'")
        return original(db)

    monkeypatch.setattr(reset, "verify_empty", mutate)
    with pytest.raises(reset.ResetRefused, match="configuration/audit/schema changed"):
        run(reset_fixture)
    assert snapshot(reset_fixture[0]) == before


def test_unknown_schema_and_missing_database_refused(reset_fixture):
    path, _, _ = reset_fixture
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE unreviewed (project_id REFERENCES projects(id))")
    before = snapshot(path)
    with pytest.raises(reset.ResetRefused, match="Unidentified schema"):
        prepare(reset_fixture)
    assert snapshot(path) == before
    missing = path.with_name("missing.db")
    with pytest.raises(reset.ResetRefused, match="existing"):
        reset.select_database(missing, "development")
    assert not missing.exists()


def test_default_cli_is_read_only_preview(reset_fixture, monkeypatch, capsys):
    path, _, _ = reset_fixture
    before = snapshot(path)
    monkeypatch.setattr("sys.argv", ["reset_dev_projects", "--database", str(path), "--environment", "development"])
    assert reset.main() == 0
    assert "delete_counts" in capsys.readouterr().out
    assert snapshot(path) == before


def test_revision_29_without_action_tables_is_supported_without_migration(reset_fixture):
    path, _, _ = reset_fixture
    with sqlite3.connect(path) as db:
        db.execute("DELETE FROM project_action_events")
        db.execute("DELETE FROM project_actions")
        db.execute("DROP TABLE project_action_events")
        db.execute("DROP TABLE project_actions")
        db.execute("UPDATE alembic_version SET version_num='0029_auth_lifecycle'")
    plan = prepare(reset_fixture)
    assert plan["preview"]["absent_project_tables"] == sorted(reset.OPTIONAL_29)
    assert run(reset_fixture)["status"] == "COMMITTED"
    with reset.connect(path) as db:
        assert db.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "0029_auth_lifecycle"
        assert reset.OPTIONAL_29.isdisjoint(reset.tables(db))
