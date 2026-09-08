"""Persist the selected Kobo form on each connection.

Revision ID: 0006_kobo_selected_form
Revises: 0005_kobo_connections
"""

import sqlalchemy as sa

from alembic import op

revision = "0006_kobo_selected_form"
down_revision = "0005_kobo_connections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("kobo_connections")}
    if "selected_form_id" not in existing:
        op.add_column("kobo_connections", sa.Column("selected_form_id", sa.String(length=255), nullable=True))
    if "selected_form_name" not in existing:
        op.add_column("kobo_connections", sa.Column("selected_form_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("kobo_connections", "selected_form_name")
    op.drop_column("kobo_connections", "selected_form_id")
