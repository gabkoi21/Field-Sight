"""Keep refresh families revocable while rotating credentials atomically."""

import sqlalchemy as sa

from alembic import op

revision = "0029_auth_lifecycle"
down_revision = "0028_indicator_reliability"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {item["name"] for item in inspector.get_columns("refresh_sessions")}
    additions = (
        sa.Column("family_id", sa.Uuid(), nullable=True),
        sa.Column("remembered", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in additions:
        if column.name not in columns:
            op.add_column("refresh_sessions", column)
    if "ix_refresh_sessions_family_id" not in {item["name"] for item in inspector.get_indexes("refresh_sessions")}:
        op.create_index("ix_refresh_sessions_family_id", "refresh_sessions", ["family_id"])


def downgrade() -> None:
    op.drop_index("ix_refresh_sessions_family_id", "refresh_sessions")
    op.drop_column("refresh_sessions", "rotated_at")
    op.drop_column("refresh_sessions", "remembered")
    op.drop_column("refresh_sessions", "family_id")
