from pathlib import Path
from sqlite3 import connect

from alembic.config import Config
from alembic.script import ScriptDirectory

from alembic import command
from app.core.config import get_settings


def test_empty_database_upgrades_to_head(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "migration-test.db"
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "development")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    get_settings.cache_clear()

    config = Config("alembic.ini")
    command.upgrade(config, "head")

    with connect(database_path) as connection:
        revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}

    assert revision == (ScriptDirectory.from_config(config).get_current_head(),)
    assert {"users", "projects", "sync_runs", "submissions"} <= tables
    get_settings.cache_clear()


def test_existing_database_upgrade_preserves_records(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "existing-migration.db"
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "development")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    get_settings.cache_clear()
    config = Config("alembic.ini")
    command.upgrade(config, "0021_deleted_connections")
    # The old baseline imports current metadata. Recreate the pre-change shape
    # so this exercises real additive DDL, not just the baseline guards.
    with connect(database_path) as connection:
        connection.execute("DROP TABLE IF EXISTS sync_worker_heartbeats")
        connection.execute("DROP TABLE IF EXISTS organization_admin_events")
        connection.execute("ALTER TABLE indicators DROP COLUMN manual_mean_confirmed")
        before = connection.execute("SELECT id, code, name FROM sectors ORDER BY code").fetchall()
    command.upgrade(config, "head")
    with connect(database_path) as connection:
        assert connection.execute("SELECT id, code, name FROM sectors ORDER BY code").fetchall() == before
        assert "manual_mean_confirmed" in {row[1] for row in connection.execute("PRAGMA table_info(indicators)")}
        assert connection.execute("SELECT count(*) FROM organization_admin_events").fetchone() == (0,)
    get_settings.cache_clear()


def test_followup_migrations_preserve_legacy_results(tmp_path: Path, monkeypatch) -> None:
    from datetime import date

    from sqlmodel import Session, create_engine, select

    from app.models.identity import Organization, OrganizationSector, Sector, User
    from app.models.operations import Indicator, Project
    from app.models.workspace import CollectedResult

    path = tmp_path / "followup-migrations.db"
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "development")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{path.as_posix()}")
    get_settings.cache_clear()
    config = Config("alembic.ini")
    command.upgrade(config, "head")
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    with Session(engine) as db:
        user = User(email="migration@example.com", password_hash="unused")
        org = Organization(name="Migration QA", slug="migration-qa")
        db.add_all([user, org])
        db.flush()
        sector = db.exec(select(Sector)).first()
        link = OrganizationSector(organization_id=org.id, sector_id=sector.id)
        db.add(link)
        db.flush()
        project = Project(organization_id=org.id, organization_sector_id=link.id, created_by_id=user.id, name="Legacy")
        db.add(project)
        db.flush()
        indicator = Indicator(
            organization_id=org.id,
            project_id=project.id,
            created_by_id=user.id,
            name="Legacy coverage",
            code="LEG",
            unit="percentage",
        )
        db.add(indicator)
        db.flush()
        db.add(
            CollectedResult(
                indicator_id=indicator.id,
                organization_id=org.id,
                created_by_id=user.id,
                result_date=date(2026, 10, 1),
                value=25,
            )
        )
        db.commit()
        identifier = indicator.id
    engine.dispose()
    command.downgrade(config, "0024_admin_events")
    command.upgrade(config, "head")
    with Session(engine) as db:
        indicator = db.get(Indicator, identifier)
        assert indicator.manual_aggregation == "legacy" and indicator.manual_rate_multiplier == 1
        result = db.exec(select(CollectedResult)).one()
        assert result.value == 25 and result.numerator is None and result.denominator is None
    engine.dispose()
    get_settings.cache_clear()


def test_auth_migration_preserves_legacy_users_and_sessions(tmp_path: Path, monkeypatch) -> None:
    from datetime import UTC, datetime, timedelta
    from sqlmodel import Session, create_engine
    from app.models.identity import RefreshSession, User

    path = tmp_path / "legacy-auth.db"
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "development")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{path.as_posix()}")
    get_settings.cache_clear()
    config = Config("alembic.ini")
    command.upgrade(config, "0028_indicator_reliability")
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    with Session(engine) as db:
        user = User(email="legacy@example.com", password_hash="synthetic-unchanged")
        db.add(user); db.flush()
        session = RefreshSession(user_id=user.id, token_hash="synthetic-legacy-hash",
                                 expires_at=datetime.now(UTC) + timedelta(days=3))
        db.add(session); db.commit()
    engine.dispose()
    with connect(path) as db:
        db.execute("DROP INDEX IF EXISTS ix_refresh_sessions_family_id")
        for column in ["family_id", "remembered", "rotated_at"]:
            db.execute(f"ALTER TABLE refresh_sessions DROP COLUMN {column}")
        before_users = db.execute("SELECT * FROM users").fetchall()
        before_sessions = db.execute("SELECT id,user_id,token_hash,expires_at,revoked_at,replaced_by_id,created_at FROM refresh_sessions").fetchall()
    command.upgrade(config, "head")
    with connect(path) as db:
        assert db.execute("SELECT * FROM users").fetchall() == before_users
        assert db.execute("SELECT id,user_id,token_hash,expires_at,revoked_at,replaced_by_id,created_at FROM refresh_sessions").fetchall() == before_sessions
        assert db.execute("SELECT family_id,remembered,rotated_at FROM refresh_sessions").fetchone() == (None, 1, None)
    get_settings.cache_clear()
