"""Collection-only contacts extend existing field assignments; no account creation."""

import sqlalchemy as sa

from alembic import op

revision = "0031_project_enumerators"
down_revision = "0030_project_actions"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "collector_profiles" not in tables:
        op.create_table(
            "collector_profiles",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("membership_id", sa.Uuid(), sa.ForeignKey("organization_memberships.id"), unique=True),
            sa.Column("full_name", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("kobo_username", sa.String()),
            sa.UniqueConstraint("organization_id", "email", name="uq_collector_org_email"),
        )
        op.create_index("ix_collector_profiles_organization_id", "collector_profiles", ["organization_id"])
    if "collector_id" not in {c["name"] for c in inspector.get_columns("field_assignments")}:
        with op.batch_alter_table("field_assignments") as batch:
            batch.alter_column("membership_id", existing_type=sa.Uuid(), nullable=True)
            batch.add_column(sa.Column("collector_id", sa.Uuid()))
            batch.create_foreign_key("fk_assignment_collector", "collector_profiles", ["collector_id"], ["id"])
            batch.create_unique_constraint("uq_assignment_project_collector", ["project_id", "collector_id"])
    if "collector_form_access" not in tables:
        op.create_table(
            "collector_form_access",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "assignment_id", sa.Uuid(), sa.ForeignKey("field_assignments.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("connection_id", sa.Uuid(), sa.ForeignKey("kobo_connections.id"), nullable=False),
            sa.Column("form_id", sa.String(), nullable=False),
            sa.Column("is_selected", sa.Boolean(), nullable=False),
            sa.Column("state", sa.String(), nullable=False),
            sa.Column("updated_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("assignment_id", "connection_id", "form_id", name="uq_collector_form"),
        )
        op.create_index("ix_collector_form_access_assignment_id", "collector_form_access", ["assignment_id"])


def downgrade():
    bind = op.get_bind()
    if bind.execute(sa.text("SELECT count(*) FROM collector_profiles")).scalar():
        raise RuntimeError("Downgrade refused: collector profiles exist. Export and plan data retention first.")
    op.drop_table("collector_form_access")
    with op.batch_alter_table("field_assignments") as batch:
        batch.drop_constraint("uq_assignment_project_collector", type_="unique")
        batch.drop_constraint("fk_assignment_collector", type_="foreignkey")
        batch.drop_column("collector_id")
        batch.alter_column("membership_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_table("collector_profiles")
