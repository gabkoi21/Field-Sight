"""Add observed definition history without inventing legacy approval evidence."""

import sqlalchemy as sa

from alembic import op

revision = "0028_indicator_reliability"
down_revision = "0027_review_evidence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("indicators")}
    for name in ("definition_version", "reliability_policy"):
        if name not in columns:
            op.add_column("indicators", sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
    if "indicator_definition_versions" in inspector.get_table_names():
        return
    op.create_table(
        "indicator_definition_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("indicator_id", sa.Uuid(), sa.ForeignKey("indicators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("effective_scope", sa.String(), nullable=False),
        sa.Column("previous_definition", sa.JSON(), nullable=False),
        sa.Column("new_definition", sa.JSON(), nullable=False),
        sa.Column("preview", sa.JSON(), nullable=False),
    )
    op.create_index("ix_indicator_definition_versions_indicator_id", "indicator_definition_versions", ["indicator_id"])
    op.create_index(
        "ix_indicator_definition_versions_organization_id", "indicator_definition_versions", ["organization_id"]
    )


def downgrade() -> None:
    op.drop_table("indicator_definition_versions")
    op.drop_column("indicators", "reliability_policy")
    op.drop_column("indicators", "definition_version")
