"""Explicit pooled manual results; retain all legacy calculations."""

import sqlalchemy as sa

from alembic import op

revision = "0025_manual_pooled_results"
down_revision = "0024_admin_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, columns in {
        "indicators": [
            sa.Column("manual_aggregation", sa.String(), nullable=False, server_default="legacy"),
            sa.Column("manual_rate_multiplier", sa.Float(), nullable=False, server_default="1"),
        ],
        "collected_results": [sa.Column("numerator", sa.Float()), sa.Column("denominator", sa.Float())],
    }.items():
        existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}
        for column in columns:
            if column.name not in existing:
                op.add_column(table, column)


def downgrade() -> None:
    for table, columns in {"collected_results": ["denominator", "numerator"],
                           "indicators": ["manual_rate_multiplier", "manual_aggregation"]}.items():
        for column in columns:
            op.drop_column(table, column)
