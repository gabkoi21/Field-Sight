"""Workspace onboarding, manual results, preferences and dashboards."""

import sqlalchemy as sa

from alembic import op

revision = "0016_workspace_quick_start"
down_revision = "0015_indicator_framework"
branch_labels = None
depends_on = None


def upgrade() -> None:
    def create_table(name, *columns):
        # The legacy baseline uses metadata.create_all; some upgraded databases
        # already contain current model tables before reaching this revision.
        if name not in sa.inspect(op.get_bind()).get_table_names():
            op.create_table(name, *columns)

    def create_index(name, table, columns):
        if name not in {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}:
            op.create_index(name, table, columns)

    create_table(
        "workspace_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("revoked", sa.Boolean(), nullable=False),
    )
    create_table(
        "user_preferences",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("landing_page", sa.String(), nullable=False),
    )
    create_table(
        "collected_results",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("indicator_id", sa.Uuid(), sa.ForeignKey("indicators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("result_date", sa.Date(), nullable=False),
        sa.Column("value", sa.Float()),
        sa.Column("narrative", sa.String()),
        sa.Column("location", sa.String()),
        sa.Column("notes", sa.String()),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    create_index("ix_collected_results_indicator_id", "collected_results", ["indicator_id"])
    create_table(
        "analytical_dashboards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("widgets", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    create_index("ix_analytical_dashboards_organization_id", "analytical_dashboards", ["organization_id"])


def downgrade() -> None:
    for table in ("analytical_dashboards", "collected_results", "user_preferences", "workspace_invitations"):
        op.drop_table(table)
