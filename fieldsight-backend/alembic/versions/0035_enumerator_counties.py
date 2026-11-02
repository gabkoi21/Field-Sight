"""Persist project enumerator county coverage; NULL retains unrestricted coverage."""

import sqlalchemy as sa

from alembic import op

revision = "0035_enumerator_counties"
down_revision = "0034_table_exports"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("field_assignments")}
    if "counties" not in columns:
        op.add_column("field_assignments", sa.Column("counties", sa.JSON(), nullable=True))


def downgrade():
    if op.get_bind().execute(sa.text("SELECT count(*) FROM field_assignments WHERE counties IS NOT NULL")).scalar():
        raise RuntimeError("County assignments exist. Retain them before rolling back.")
    op.drop_column("field_assignments", "counties")
