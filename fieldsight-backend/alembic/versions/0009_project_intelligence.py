"""Add project field mappings and multiple monitoring targets.

Revision ID: 0009_project_intelligence
Revises: 0008_collection_sync
"""

import sqlalchemy as sa

from alembic import op

revision = "0009_project_intelligence"
down_revision = "0008_collection_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "field_mappings" not in tables:
        op.create_table(
        "field_mappings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("source_field", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("meaning", sa.String(length=200)),
        sa.Column("data_type", sa.String(length=32), nullable=False, server_default="text"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_location", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "source_field", name="uq_field_mapping_project_source"),
    )
        op.create_index("ix_field_mappings_organization_id", "field_mappings", ["organization_id"])
        op.create_index("ix_field_mappings_project_id", "field_mappings", ["project_id"])
    if "project_targets" not in tables:
        op.create_table(
        "project_targets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("field_mapping_id", sa.Uuid(), sa.ForeignKey("field_mappings.id")),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("target_value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=80), nullable=False, server_default="records"),
        sa.Column("direction", sa.String(length=20), nullable=False, server_default="at_least"),
        sa.Column("due_date", sa.Date()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
        op.create_index("ix_project_targets_organization_id", "project_targets", ["organization_id"])
        op.create_index("ix_project_targets_project_id", "project_targets", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_project_targets_project_id", table_name="project_targets")
    op.drop_index("ix_project_targets_organization_id", table_name="project_targets")
    op.drop_table("project_targets")
    op.drop_index("ix_field_mappings_project_id", table_name="field_mappings")
    op.drop_index("ix_field_mappings_organization_id", table_name="field_mappings")
    op.drop_table("field_mappings")
