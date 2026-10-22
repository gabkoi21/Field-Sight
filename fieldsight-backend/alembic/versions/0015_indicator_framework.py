"""Add result frameworks and source form provenance to indicators.

Revision ID: 0015_indicator_framework
Revises: 0014_survey_analysis
"""

import sqlalchemy as sa

from alembic import op

revision = "0015_indicator_framework"
down_revision = "0014_survey_analysis"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "indicator_period_targets" not in inspector.get_table_names():
        op.create_table(
            "indicator_period_targets",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("indicator_id", sa.Uuid(), sa.ForeignKey("indicators.id"), nullable=False),
            sa.Column("period", sa.String(16), nullable=False),
            sa.Column("target_value", sa.Float(), nullable=False),
            sa.UniqueConstraint("indicator_id", "period", name="uq_indicator_period_target"),
        )
        op.create_index("ix_indicator_period_targets_indicator_id", "indicator_period_targets", ["indicator_id"])
    if "result_framework_nodes" not in inspector.get_table_names():
        op.create_table(
            "result_framework_nodes",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
            sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("result_framework_nodes.id")),
            sa.Column("title", sa.String(300), nullable=False),
            sa.Column("node_type", sa.String(32), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        for column in ("organization_id", "project_id"):
            op.create_index(f"ix_result_framework_nodes_{column}", "result_framework_nodes", [column])
    if "framework_node_id" not in {column["name"] for column in inspector.get_columns("indicators")}:
        if op.get_bind().dialect.name == "sqlite":
            # Rebuilding a referenced table would break existing mapping FKs.
            op.execute(
                sa.text(
                    "ALTER TABLE indicators ADD COLUMN framework_node_id CHAR(32) "
                    "CONSTRAINT fk_indicator_framework_node REFERENCES result_framework_nodes(id)"
                )
            )
        else:
            with op.batch_alter_table("indicators") as batch:
                batch.add_column(sa.Column("framework_node_id", sa.Uuid()))
                batch.create_foreign_key(
                    "fk_indicator_framework_node",
                    "result_framework_nodes",
                    ["framework_node_id"],
                    ["id"],
                )
    if "source_form_id" not in {column["name"] for column in inspector.get_columns("indicator_mappings")}:
        op.add_column("indicator_mappings", sa.Column("source_form_id", sa.String(255)))
    op.execute(
        sa.text(
            "UPDATE indicator_mappings SET source_form_id = "
            "(SELECT kobo_form_id FROM projects WHERE projects.id = indicator_mappings.project_id) "
            "WHERE source_form_id IS NULL AND NOT EXISTS "
            "(SELECT 1 FROM submissions WHERE submissions.project_id = indicator_mappings.project_id)"
        )
    )
    op.execute(
        sa.text(
            "UPDATE indicator_mappings SET source_form_id = "
            "(SELECT MIN(kobo_form_id) FROM submissions WHERE submissions.project_id = indicator_mappings.project_id "
            "HAVING COUNT(DISTINCT kobo_form_id) = 1) WHERE source_form_id IS NULL"
        )
    )


def downgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        # SQLite needs a table rebuild to remove a table-level FK created by a
        # fresh SQLModel install. Keep existing mapping rows and validate every
        # relationship before restoring FK enforcement on this connection.
        with op.get_context().autocommit_block():
            op.execute(sa.text("PRAGMA foreign_keys=OFF"))
            try:
                op.drop_table("indicator_period_targets")
                op.execute(sa.text("ALTER TABLE indicator_mappings DROP COLUMN source_form_id"))
                with op.batch_alter_table("indicators") as batch:
                    batch.drop_constraint("fk_indicator_framework_node", type_="foreignkey")
                    batch.drop_column("framework_node_id")
                op.drop_table("result_framework_nodes")
                if op.get_bind().execute(sa.text("PRAGMA foreign_key_check")).first():
                    raise RuntimeError("Foreign key integrity check failed during the framework downgrade.")
            finally:
                op.execute(sa.text("PRAGMA foreign_keys=ON"))
    else:
        op.drop_table("indicator_period_targets")
        with op.batch_alter_table("indicator_mappings") as batch:
            batch.drop_column("source_form_id")
        with op.batch_alter_table("indicators") as batch:
            batch.drop_constraint("fk_indicator_framework_node", type_="foreignkey")
            batch.drop_column("framework_node_id")
        op.drop_table("result_framework_nodes")
