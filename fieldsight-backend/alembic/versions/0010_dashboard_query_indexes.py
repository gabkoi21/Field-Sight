"""Add composite indexes for dashboard aggregate queries.

Revision ID: 0010_dashboard_query_indexes
Revises: 0009_project_intelligence
"""

from alembic import op

revision = "0010_dashboard_query_indexes"
down_revision = "0009_project_intelligence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_submissions_org_submitted_at",
        "submissions",
        ["organization_id", "submitted_at"],
    )
    op.create_index(
        "ix_submissions_org_project_submitted_at",
        "submissions",
        ["organization_id", "project_id", "submitted_at"],
    )
    op.create_index(
        "ix_submissions_org_review_submitted_at",
        "submissions",
        ["organization_id", "review_status", "submitted_at"],
    )
    op.create_index(
        "ix_sync_runs_org_project_started_at",
        "sync_runs",
        ["organization_id", "project_id", "started_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_sync_runs_org_project_started_at", table_name="sync_runs")
    op.drop_index("ix_submissions_org_review_submitted_at", table_name="submissions")
    op.drop_index("ix_submissions_org_project_submitted_at", table_name="submissions")
    op.drop_index("ix_submissions_org_submitted_at", table_name="submissions")
