from pathlib import Path
from sqlite3 import connect

from alembic.config import Config

from alembic import command
from app.core.config import get_settings


def test_empty_database_upgrades_to_head(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "migration-test.db"
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "development")
    monkeypatch.setenv(
        "FIELDSIGHT_DATABASE_URL", f"sqlite:///{database_path.as_posix()}"
    )
    get_settings.cache_clear()

    config = Config("alembic.ini")
    command.upgrade(config, "head")

    with connect(database_path) as connection:
        revision = connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone()
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }

    assert revision == ("0010_dashboard_query_indexes",)
    assert {"users", "projects", "sync_runs", "submissions"} <= tables
    get_settings.cache_clear()
