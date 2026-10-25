"""Persist real organization administrative events."""

import sqlalchemy as sa

from alembic import op

revision = "0024_admin_events"
down_revision = "0023_manual_mean_choice"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "organization_admin_events" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "organization_admin_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_organization_admin_events_organization_id", "organization_admin_events", ["organization_id"])


def downgrade() -> None:
    op.drop_table("organization_admin_events")
