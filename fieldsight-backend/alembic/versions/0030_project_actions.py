"""Add project actions and immutable-through-API audit history without changing evidence."""

import sqlalchemy as sa

from alembic import op

revision = "0030_project_actions"
down_revision = "0029_auth_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "project_actions" not in existing:
        op.create_table(
            "project_actions",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("description", sa.String(), nullable=False),
            sa.Column("priority", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("assigned_user_id", sa.Uuid(), sa.ForeignKey("users.id")),
            sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("due_date", sa.Date()),
            sa.Column("submission_id", sa.Uuid(), sa.ForeignKey("submissions.id", ondelete="SET NULL")),
            sa.Column("indicator_id", sa.Uuid(), sa.ForeignKey("indicators.id", ondelete="SET NULL")),
            sa.Column("resolution_summary", sa.String()),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("resolved_at", sa.DateTime(timezone=True)),
            sa.Column("closed_at", sa.DateTime(timezone=True)),
        )
        for name in ("organization_id", "project_id", "priority", "status", "assigned_user_id", "due_date"):
            op.create_index(f"ix_project_actions_{name}", "project_actions", [name])
    if "project_action_events" not in existing:
        op.create_table(
            "project_action_events",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
            sa.Column("action_id", sa.Uuid(), sa.ForeignKey("project_actions.id"), nullable=False),
            sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("previous_values", sa.JSON(), nullable=False),
            sa.Column("new_values", sa.JSON(), nullable=False),
            sa.Column("note", sa.String()),
            sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        )
        for name in ("organization_id", "project_id", "action_id"):
            op.create_index(f"ix_project_action_events_{name}", "project_action_events", [name])


def downgrade() -> None:
    # A rollback must not silently destroy a user's action audit trail.
    for table in ("project_action_events", "project_actions"):
        if op.get_bind().execute(sa.text(f"SELECT count(*) FROM {table}")).scalar():
            raise RuntimeError("Downgrade refused: action history exists. Retain/export it before planning rollback.")
    op.drop_table("project_action_events")
    op.drop_table("project_actions")
