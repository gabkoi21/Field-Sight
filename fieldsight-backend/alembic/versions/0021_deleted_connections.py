"""Retain token-free connection references for historical submissions."""

import sqlalchemy as sa

from alembic import op

revision = "0021_deleted_connections"
down_revision = "0020_dashboard_filters"
branch_labels = None
depends_on = None


def upgrade():
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("kobo_connections")}
    if "is_deleted" not in columns:
        op.add_column(
            "kobo_connections", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade():
    with op.batch_alter_table("kobo_connections") as batch:
        batch.drop_column("is_deleted")
