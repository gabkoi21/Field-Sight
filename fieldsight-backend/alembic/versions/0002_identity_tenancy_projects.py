"""Create identity, tenancy, project, team, and settings tables.

Revision ID: 0002_identity_tenancy_projects
Revises: 0001_phase_1_baseline
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from sqlmodel import SQLModel

from alembic import op
from app.models import identity, operations  # noqa: F401

revision: str = "0002_identity_tenancy_projects"
down_revision: str | None = "0001_phase_1_baseline"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    SQLModel.metadata.create_all(bind=bind)
    sectors = sa.table(
        "sectors",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        sectors,
        [
            {"id": uuid4(), "code": "health", "name": "Health", "is_active": True},
            {"id": uuid4(), "code": "education", "name": "Education", "is_active": True},
            {"id": uuid4(), "code": "agriculture", "name": "Agriculture", "is_active": True},
            {"id": uuid4(), "code": "wash", "name": "WASH", "is_active": True},
            {"id": uuid4(), "code": "humanitarian_response", "name": "Humanitarian response", "is_active": True},
        ],
    )


def downgrade() -> None:
    bind = op.get_bind()
    SQLModel.metadata.drop_all(bind=bind)
