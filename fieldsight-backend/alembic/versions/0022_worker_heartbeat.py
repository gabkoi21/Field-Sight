"""Track actual synchronization worker polls."""

import sqlalchemy as sa

from alembic import op

revision = "0022_worker_heartbeat"
down_revision = "0021_deleted_connections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "sync_worker_heartbeats" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "sync_worker_heartbeats",
        sa.Column("worker_id", sa.String(), primary_key=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("sync_worker_heartbeats")
