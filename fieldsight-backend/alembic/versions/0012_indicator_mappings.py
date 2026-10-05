"""Add Kobo mappings for M&E indicators.

Revision ID: 0012_indicator_mappings
Revises: 0011_indicators
"""

import sqlalchemy as sa

from alembic import op

revision = "0012_indicator_mappings"
down_revision = "0011_indicators"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "indicator_mappings" in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        "indicator_mappings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("indicator_id", sa.Uuid(), sa.ForeignKey("indicators.id"), nullable=False),
        sa.Column("source_field", sa.String(length=255), nullable=False),
        sa.Column("calculation", sa.String(length=32), nullable=False),
        sa.Column("match_value", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("indicator_id", name="uq_indicator_mapping_indicator"),
    )
    op.create_index("ix_indicator_mappings_organization_id", "indicator_mappings", ["organization_id"])
    op.create_index("ix_indicator_mappings_project_id", "indicator_mappings", ["project_id"])
    op.create_index("ix_indicator_mappings_indicator_id", "indicator_mappings", ["indicator_id"])


def downgrade() -> None:
    op.drop_index("ix_indicator_mappings_indicator_id", table_name="indicator_mappings")
    op.drop_index("ix_indicator_mappings_project_id", table_name="indicator_mappings")
    op.drop_index("ix_indicator_mappings_organization_id", table_name="indicator_mappings")
    op.drop_table("indicator_mappings")
