"""Cache form schemas and save scoped survey visualizations.

Revision ID: 0014_survey_analysis
Revises: 0013_submission_form_identity
"""

import sqlalchemy as sa

from alembic import op

revision = "0014_survey_analysis"
down_revision = "0013_submission_form_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    for name in ("survey_schemas", "saved_analyses"):
        if name in tables:
            continue
        common = [
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        ]
        if name == "survey_schemas":
            op.create_table(
                name,
                *common,
                sa.Column("form_id", sa.String(255), nullable=False),
                sa.Column("version", sa.String()),
                sa.Column("fields_json", sa.JSON(), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
                sa.UniqueConstraint("project_id", "form_id", name="uq_survey_schema_project_form"),
            )
        else:
            op.create_table(
                name,
                *common,
                sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
                sa.Column("title", sa.String(200), nullable=False),
                sa.Column("query_json", sa.JSON(), nullable=False),
                sa.Column("chart", sa.String(), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            )
        for column in ("organization_id", "project_id"):
            op.create_index(f"ix_{name}_{column}", name, [column])


def downgrade() -> None:
    op.drop_table("saved_analyses")
    op.drop_table("survey_schemas")
