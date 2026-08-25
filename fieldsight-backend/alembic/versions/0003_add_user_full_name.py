"""Add optional full names to user accounts.

Revision ID: 0003_add_user_full_name
Revises: 0002_identity_tenancy_projects
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_add_user_full_name"
down_revision: str | None = "0002_identity_tenancy_projects"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("full_name", sa.String(length=200), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("full_name")