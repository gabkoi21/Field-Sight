"""Support sub-minute synchronization without changing existing schedules."""

import sqlalchemy as sa

from alembic import op

revision = "0019_sync_seconds"
down_revision = "0018_automatic_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("sync_schedules", "sync_settings_changes"):
        if "interval_seconds" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}:
            op.add_column(table, sa.Column("interval_seconds", sa.Float(), nullable=True))


def downgrade() -> None:
    for table in ("sync_settings_changes", "sync_schedules"):
        with op.batch_alter_table(table) as batch:
            batch.drop_column("interval_seconds")
