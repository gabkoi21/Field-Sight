"""Add enumerator profile fields to users.

Revision ID: 0004_enumerator_profile
Revises: 0003_add_user_full_name
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_enumerator_profile"
down_revision = "0003_add_user_full_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("phone_number", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("employee_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("gender", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("date_of_birth", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("address", sa.String(length=300), nullable=True))
        batch_op.add_column(sa.Column("emergency_contact_name", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("emergency_contact_phone", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("notes")
        batch_op.drop_column("emergency_contact_phone")
        batch_op.drop_column("emergency_contact_name")
        batch_op.drop_column("address")
        batch_op.drop_column("date_of_birth")
        batch_op.drop_column("gender")
        batch_op.drop_column("employee_id")
        batch_op.drop_column("phone_number")