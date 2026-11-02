"""Allow verified Kobo collectors whose email is not publicly available."""

import sqlalchemy as sa

from alembic import op

revision = "0036_username_only_enumerators"
down_revision = "0035_enumerator_counties"
branch_labels = None
depends_on = None


def _alter(nullable):
    columns = {c["name"]: c for c in sa.inspect(op.get_bind()).get_columns("collector_profiles")}
    changes = [name for name in ("full_name", "email") if columns[name]["nullable"] != nullable]
    if not changes:
        return

    def apply():
        with op.batch_alter_table("collector_profiles") as batch:
            for name in changes:
                batch.alter_column(name, existing_type=sa.String(), nullable=nullable)

    if op.get_bind().dialect.name == "sqlite":
        # SQLite rebuilds this referenced table. Change FK enforcement outside a
        # transaction, retain all rows, and validate references after the rebuild.
        with op.get_context().autocommit_block():
            op.get_bind().exec_driver_sql("PRAGMA foreign_keys=OFF")
            try:
                apply()
                if op.get_bind().exec_driver_sql("PRAGMA foreign_key_check").first():
                    raise RuntimeError("Collector migration found invalid foreign keys.")
            finally:
                op.get_bind().exec_driver_sql("PRAGMA foreign_keys=ON")
    else:
        apply()


def upgrade():
    _alter(True)


def downgrade():
    if (
        op.get_bind()
        .execute(sa.text("SELECT count(*) FROM collector_profiles WHERE email IS NULL OR full_name IS NULL"))
        .scalar()
    ):
        raise RuntimeError("Downgrade refused: username-only collectors have no name or email to restore.")
    _alter(False)
