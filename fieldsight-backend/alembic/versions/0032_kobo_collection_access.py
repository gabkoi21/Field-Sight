"""Persist provider reconciliation separately from membership and manual reports."""

import sqlalchemy as sa

from alembic import op

revision = "0032_kobo_collection_access"
down_revision = "0031_project_enumerators"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("collector_form_access")}
    for name in ("permission_username", "last_error", "operation_id", "requested_action"):
        if name not in existing:
            op.add_column("collector_form_access", sa.Column(name, sa.String()))
    if "last_checked_at" not in existing:
        op.add_column("collector_form_access", sa.Column("last_checked_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(sa.text("SELECT count(*) FROM collector_form_access WHERE permission_username IS NOT NULL"))
        .scalar()
    ):
        raise RuntimeError("Downgrade refused: Kobo reconciliation history exists. Plan retention first.")
    with op.batch_alter_table("collector_form_access") as batch:
        for name in ("permission_username", "last_error", "operation_id", "requested_action", "last_checked_at"):
            batch.drop_column(name)
