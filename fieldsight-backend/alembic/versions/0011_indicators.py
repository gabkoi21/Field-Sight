"""Add the project-level M&E indicator register.

Revision ID: 0011_indicators
Revises: 0010_dashboard_query_indexes
"""

import sqlalchemy as sa

from alembic import op

revision = "0011_indicators"
down_revision = "0010_dashboard_query_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "indicators" in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        "indicators",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=1000)),
        sa.Column("unit", sa.String(length=32), nullable=False, server_default="number"),
        sa.Column("direction", sa.String(length=32), nullable=False, server_default="increase"),
        sa.Column("baseline_value", sa.Float()),
        sa.Column("target_value", sa.Float()),
        sa.Column("target_date", sa.Date()),
        sa.Column("reporting_frequency", sa.String(length=32), nullable=False, server_default="monthly"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="not_started"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "code", name="uq_indicator_project_code"),
    )
    op.create_index("ix_indicators_organization_id", "indicators", ["organization_id"])
    op.create_index("ix_indicators_project_id", "indicators", ["project_id"])
    op.create_index("ix_indicators_org_project_active", "indicators", ["organization_id", "project_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_indicators_org_project_active", table_name="indicators")
    op.drop_index("ix_indicators_project_id", table_name="indicators")
    op.drop_index("ix_indicators_organization_id", table_name="indicators")
    op.drop_table("indicators")
