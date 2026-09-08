"""Store a separate Kobo form assignment for every FieldSight project.

Revision ID: 0007_project_kobo_form
Revises: 0006_kobo_selected_form
"""

import sqlalchemy as sa

from alembic import op

revision = "0007_project_kobo_form"
down_revision = "0006_kobo_selected_form"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {column["name"] for column in inspector.get_columns("projects")}
    columns = [
        sa.Column("kobo_connection_id", sa.Uuid(), nullable=True),
        sa.Column("kobo_form_id", sa.String(length=255), nullable=True),
        sa.Column("kobo_form_name", sa.String(length=255), nullable=True),
    ]
    missing = [column for column in columns if column.name not in existing]
    has_connection_fk = any(
        foreign_key.get("constrained_columns") == ["kobo_connection_id"]
        for foreign_key in inspector.get_foreign_keys("projects")
    )
    if not missing and has_connection_fk:
        return
    with op.batch_alter_table("projects") as batch_op:
        for column in missing:
            batch_op.add_column(column)
        if not has_connection_fk:
            batch_op.create_foreign_key(
                "fk_projects_kobo_connection",
                "kobo_connections",
                ["kobo_connection_id"],
                ["id"],
            )


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_constraint("fk_projects_kobo_connection", type_="foreignkey")
        batch_op.drop_column("kobo_form_name")
        batch_op.drop_column("kobo_form_id")
        batch_op.drop_column("kobo_connection_id")
