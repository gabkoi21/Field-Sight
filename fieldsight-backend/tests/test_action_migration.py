"""Explicit old-shape migration and data-preserving rollback safeguards."""

from uuid import UUID

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlmodel import Session, select
from test_kobo_sync import sync_client as sync_client
from test_project_actions import create
from test_review_evidence import payload, sync

from alembic import command
from app.core.config import get_settings
from app.models.operations import Submission


def test_action_migration_preserves_evidence_and_refuses_history_loss(sync_client, monkeypatch):
    client, engine, project, headers = sync_client
    assert sync(client, project, headers, [payload()]).status_code == 200
    with Session(engine) as db:
        original = db.exec(select(Submission)).one().model_dump(mode="json")
    with engine.begin() as db:
        db.execute(text("DROP TABLE project_action_events"))
        db.execute(text("DROP TABLE project_actions"))
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", str(engine.url))
    get_settings.cache_clear()
    config = Config("alembic.ini")
    try:
        command.stamp(config, "0029_auth_lifecycle")
        command.upgrade(config, "head")
        with Session(engine) as db:
            assert db.get(Submission, UUID(original["id"])).model_dump(mode="json") == original
        command.downgrade(config, "0029_auth_lifecycle")
        command.upgrade(config, "head")
        action = create(sync_client)
        with pytest.raises(RuntimeError, match="Downgrade refused"):
            command.downgrade(config, "0029_auth_lifecycle")
        detail = client.get(f"/projects/{project}/actions/{action['id']}", headers=headers).json()
        assert detail["history_total"] == 1 and detail["history"][0]["event_type"] == "created"
        with Session(engine) as db:
            assert db.get(Submission, UUID(original["id"])).raw_answers == original["raw_answers"]
    finally:
        get_settings.cache_clear()
