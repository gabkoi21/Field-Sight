"""Preserve legacy manual averages and allow an explicit administrator choice."""

import sqlalchemy as sa

from alembic import op

revision = "0023_manual_mean_choice"
down_revision = "0022_worker_heartbeat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "manual_mean_confirmed" in {column["name"] for column in sa.inspect(op.get_bind()).get_columns("indicators")}:
        return
    op.add_column("indicators", sa.Column(
        "manual_mean_confirmed", sa.Boolean(), nullable=False, server_default=sa.false(),
    ))


def downgrade() -> None:
    op.drop_column("indicators", "manual_mean_confirmed")
