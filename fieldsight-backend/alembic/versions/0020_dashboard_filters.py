"""Persist dashboard filters and protect concurrent layout saves."""

import sqlalchemy as sa

from alembic import op

revision = "0020_dashboard_filters"
down_revision = "0019_sync_seconds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("analytical_dashboards")}
    for column in (
        sa.Column("date_from", sa.Date(), nullable=True),
        sa.Column("date_to", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    ):
        if column.name not in existing:
            op.add_column("analytical_dashboards", column)


def downgrade() -> None:
    with op.batch_alter_table("analytical_dashboards") as batch:
        batch.drop_column("version")
        batch.drop_column("date_to")
        batch.drop_column("date_from")
