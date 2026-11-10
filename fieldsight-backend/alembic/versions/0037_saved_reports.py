"""Add saved reports and durable historical PDF artifacts; preserve all existing data."""

import sqlalchemy as sa

from alembic import op

revision = "0037_saved_reports"
down_revision = "0036_username_only_enumerators"
branch_labels = None
depends_on = None


def upgrade():
    # The initial baseline creates current metadata on a clean database.
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("reports"):
        op.create_table(
            "reports",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
            sa.Column("template_key", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=False),
            sa.Column("reporting_period_start", sa.Date(), nullable=False),
            sa.Column("reporting_period_end", sa.Date(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("content", sa.JSON(), nullable=False),
            sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("updated_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("published_at", sa.DateTime()),
            sa.Column("published_by_id", sa.Uuid(), sa.ForeignKey("users.id")),
            sa.Column("revision_number", sa.Integer(), nullable=False),
        )
    existing_indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("reports")}
    for name, columns in (
        ("ix_reports_tenant_project", ["organization_id", "project_id"]),
        ("ix_reports_project_status", ["project_id", "status"]),
        ("ix_reports_created_at", ["created_at"]),
    ):
        if name not in existing_indexes:
            op.create_index(name, "reports", columns)
    if not inspector.has_table("report_snapshots"):
        op.create_table(
            "report_snapshots",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("report_id", sa.Uuid(), sa.ForeignKey("reports.id"), nullable=False, unique=True),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
            sa.Column("snapshot_version", sa.Integer(), nullable=False),
            sa.Column("snapshot_data", sa.JSON(), nullable=False),
            sa.Column("generated_at", sa.DateTime(), nullable=False),
            sa.Column("generated_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("content_hash", sa.String(), nullable=False),
            sa.Column("pdf_data", sa.LargeBinary(), nullable=False),
            sa.UniqueConstraint("report_id", "snapshot_version"),
        )


def downgrade():
    # Never silently discard draft or publication history on rollback.
    if op.get_bind().execute(sa.text("SELECT count(*) FROM reports")).scalar():
        raise RuntimeError("Downgrade refused: saved reports must be retained or explicitly archived externally.")
    op.drop_table("report_snapshots")
    op.drop_table("reports")
