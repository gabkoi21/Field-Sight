"""Durable synchronization queue and per-project schedule."""

import sqlalchemy as sa

from alembic import op

revision = "0018_automatic_sync"
down_revision = "0017_workspace_details"
branch_labels = None
depends_on = None


def upgrade():
    from app.models.operations import SyncJob, SyncSchedule, SyncSettingsChange

    bind = op.get_bind()
    SyncSchedule.__table__.create(bind, checkfirst=True)
    SyncJob.__table__.create(bind, checkfirst=True)
    SyncSettingsChange.__table__.create(bind, checkfirst=True)
    existing = {c["name"] for c in sa.inspect(bind).get_columns("sync_runs")}
    columns = [
        sa.Column("trigger", sa.String(), nullable=False, server_default="manual"),
        sa.Column("requested_by_id", sa.Uuid(), nullable=True),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
    ]
    for column in columns:
        if column.name not in existing:
            op.add_column("sync_runs", column)


def downgrade():
    op.drop_table("sync_settings_changes")
    op.drop_table("sync_jobs")
    op.drop_table("sync_schedules")
    with op.batch_alter_table("sync_runs") as batch:
        for name in ("trigger", "requested_by_id", "attempt", "failed_count"):
            batch.drop_column(name)
