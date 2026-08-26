"""Add flexible Kobo submission storage and synchronization history.

Revision ID: 0008_collection_sync
Revises: 0007_project_kobo_form
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_collection_sync"
down_revision = "0007_project_kobo_form"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("kobo_connection_id", sa.Uuid(), sa.ForeignKey("kobo_connections.id"), nullable=False),
        sa.Column("kobo_form_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("received_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.String(length=1000)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_sync_runs_organization_id", "sync_runs", ["organization_id"])
    op.create_index("ix_sync_runs_project_id", "sync_runs", ["project_id"])
    op.create_table(
        "submissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("kobo_connection_id", sa.Uuid(), sa.ForeignKey("kobo_connections.id"), nullable=False),
        sa.Column("kobo_form_id", sa.String(length=255), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("enumerator", sa.String(length=255)),
        sa.Column("location", sa.String(length=255)),
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default="ready"),
        sa.Column("raw_answers", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "external_id", name="uq_submission_project_external_id"),
    )
    op.create_index("ix_submissions_organization_id", "submissions", ["organization_id"])
    op.create_index("ix_submissions_project_id", "submissions", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_submissions_project_id", table_name="submissions")
    op.drop_index("ix_submissions_organization_id", table_name="submissions")
    op.drop_table("submissions")
    op.drop_index("ix_sync_runs_project_id", table_name="sync_runs")
    op.drop_index("ix_sync_runs_organization_id", table_name="sync_runs")
    op.drop_table("sync_runs")