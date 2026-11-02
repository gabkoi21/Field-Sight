"""Add durable table export schedules and generated reports."""

import sqlalchemy as sa

from alembic import op

revision = "0034_table_exports"
down_revision = "0033_project_url_slugs"
branch_labels = None
depends_on = None


def _create_table(name, *columns):
    # The baseline can create current SQLModel metadata on an empty database.
    if not sa.inspect(op.get_bind()).has_table(name):
        op.create_table(name, *columns)


def _create_index(name, table, columns):
    if name not in {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}:
        op.create_index(name, table, columns)


def upgrade():
    _create_table(
        "table_export_schedules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("form_id", sa.String(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_error", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("organization_id", "project_id", "next_run_at"):
        _create_index(f"ix_table_export_schedules_{column}", "table_export_schedules", [column])
    _create_table(
        "table_export_artifacts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("schedule_id", sa.Uuid(), sa.ForeignKey("table_export_schedules.id"), nullable=False),
        sa.Column("period_start", sa.String(), nullable=False),
        sa.Column("period_end", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("media_type", sa.String(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("schedule_id", "period_start", name="uq_table_report_period"),
    )
    _create_index("ix_table_export_artifacts_schedule_id", "table_export_artifacts", ["schedule_id"])


def downgrade():
    if op.get_bind().execute(sa.text("SELECT count(*) FROM table_export_artifacts")).scalar():
        raise RuntimeError("Export history exists. Retain it before rolling back.")
    op.drop_table("table_export_artifacts")
    op.drop_table("table_export_schedules")
