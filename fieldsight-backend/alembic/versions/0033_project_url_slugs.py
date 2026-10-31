"""Add stable readable project URL names without changing project identities."""

import sqlalchemy as sa

from alembic import op
from app.core.project_urls import available_project_slug

revision = "0033_project_url_slugs"
down_revision = "0032_kobo_collection_access"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if "slug" not in {c["name"] for c in inspector.get_columns("projects")}:
        op.add_column("projects", sa.Column("slug", sa.String(160), nullable=True))
    rows = connection.execute(sa.text("SELECT id, name, slug FROM projects ORDER BY created_at, id")).mappings().all()
    used = {row["slug"] for row in rows if row["slug"]}
    for row in rows:
        if not row["slug"]:
            slug = available_project_slug(row["name"], used)
            connection.execute(sa.text("UPDATE projects SET slug = :slug WHERE id = :id"),
                               {"slug": slug, "id": row["id"]})
            used.add(slug)
    if "ix_projects_slug" not in {i["name"] for i in sa.inspect(connection).get_indexes("projects")}:
        op.create_index("ix_projects_slug", "projects", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_projects_slug", table_name="projects")
    op.drop_column("projects", "slug")
