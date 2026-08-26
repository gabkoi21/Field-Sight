"""Store a separate Kobo form assignment for every FieldSight project.

Revision ID: 0007_project_kobo_form
Revises: 0006_kobo_selected_form
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_project_kobo_form"
down_revision = "0006_kobo_selected_form"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(sa.Column("kobo_connection_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("kobo_form_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("kobo_form_name", sa.String(length=255), nullable=True))
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
