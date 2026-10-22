"""Persist workspace detail form metadata without replacing existing project fields."""

import sqlalchemy as sa

from alembic import op

revision = "0017_workspace_details"
down_revision = "0016_workspace_quick_start"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "workspace_details" not in {column["name"] for column in sa.inspect(op.get_bind()).get_columns("projects")}:
        op.add_column(
            "projects", sa.Column("workspace_details", sa.JSON(), nullable=False, server_default=sa.text("'{}'"))
        )


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.drop_column("workspace_details")
