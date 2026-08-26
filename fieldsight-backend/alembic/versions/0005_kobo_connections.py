"""Add encrypted organization KoboToolbox connections.

Revision ID: 0005_kobo_connections
Revises: 0004_enumerator_profile
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_kobo_connections"
down_revision = "0004_enumerator_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "kobo_connections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("server_url", sa.String(length=255), nullable=False),
        sa.Column("token_encrypted", sa.Text(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_kobo_connection_org_name"),
    )
    op.create_index("ix_kobo_connections_organization_id", "kobo_connections", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_kobo_connections_organization_id", table_name="kobo_connections")
    op.drop_table("kobo_connections")
