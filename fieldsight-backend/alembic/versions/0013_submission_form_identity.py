"""Scope submission identities to the project and source form.

Revision ID: 0013_submission_form_identity
Revises: 0012_indicator_mappings
"""

import sqlalchemy as sa

from alembic import op

revision = "0013_submission_form_identity"
down_revision = "0012_indicator_mappings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The legacy baseline creates current SQLModel metadata on fresh installs.
    constraints = sa.inspect(op.get_bind()).get_unique_constraints("submissions")
    if any(item["name"] == "uq_submission_project_form_external_id" for item in constraints):
        return
    with op.batch_alter_table("submissions") as batch:
        batch.drop_constraint("uq_submission_project_external_id", type_="unique")
        batch.create_unique_constraint(
            "uq_submission_project_form_external_id", ["project_id", "kobo_form_id", "external_id"],
        )


def downgrade() -> None:
    # A downgrade must fail visibly rather than discard records when forms
    # have reused the same external ID since this revision was installed.
    duplicates = op.get_bind().execute(sa.text(
        "SELECT 1 FROM submissions GROUP BY project_id, external_id HAVING COUNT(*) > 1 LIMIT 1"
    )).first()
    if duplicates:
        raise ValueError("Cannot downgrade: submission IDs overlap across forms. Resolve the conflicts first.")
    with op.batch_alter_table("submissions") as batch:
        batch.drop_constraint("uq_submission_project_form_external_id", type_="unique")
        batch.create_unique_constraint("uq_submission_project_external_id", ["project_id", "external_id"])
