"""Persist validation findings and real review decisions and assignments."""

import sqlalchemy as sa

from alembic import op

revision = "0026_quality_review"
down_revision = "0025_manual_pooled_results"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "reviewer_id" not in {column["name"] for column in sa.inspect(op.get_bind()).get_columns("submissions")}:
        with op.batch_alter_table("submissions") as batch:
            batch.add_column(sa.Column("reviewer_id", sa.Uuid(), nullable=True))
            batch.create_foreign_key("fk_submission_reviewer", "users", ["reviewer_id"], ["id"])
    tables = sa.inspect(op.get_bind()).get_table_names()
    if "quality_findings" not in tables:
        op.create_table(
            "quality_findings", sa.Column("id", sa.String(), primary_key=True),
            sa.Column("submission_id", sa.Uuid(), sa.ForeignKey("submissions.id", ondelete="CASCADE")),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id")),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE")),
            sa.Column("severity", sa.String(), nullable=False), sa.Column("rule", sa.String(), nullable=False),
            sa.Column("detail", sa.String(), nullable=False), sa.Column("field", sa.String()),
            sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        )
        for name in ["submission_id", "organization_id", "project_id", "severity"]:
            op.create_index(f"ix_quality_findings_{name}", "quality_findings", [name])
    if "submission_review_events" not in tables:
        op.create_table(
            "submission_review_events", sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("submission_id", sa.Uuid(), sa.ForeignKey("submissions.id", ondelete="CASCADE")),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id")),
            sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id")),
            sa.Column("action", sa.String(), nullable=False), sa.Column("previous_status", sa.String()),
            sa.Column("status", sa.String()), sa.Column("reviewer_id", sa.Uuid(), sa.ForeignKey("users.id")),
            sa.Column("note", sa.String()), sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        )
        for name in ["submission_id", "organization_id"]:
            op.create_index(f"ix_submission_review_events_{name}", "submission_review_events", [name])


def downgrade() -> None:
    op.drop_table("submission_review_events")
    op.drop_table("quality_findings")
    with op.batch_alter_table("submissions") as batch:
        batch.drop_column("reviewer_id")
