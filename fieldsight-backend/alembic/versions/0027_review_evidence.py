"""Bind review decisions to evidence; conservatively reopen legacy decisions."""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision = "0027_review_evidence"
down_revision = "0026_quality_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("submissions")}
    # Native additive DDL is essential: rebuilding submissions on SQLite can
    # cascade-delete its review history and findings while foreign keys are on.
    for name in ("evidence_fingerprint", "decision_fingerprint", "decision_status", "validation_status"):
        if name not in columns:
            op.add_column("submissions", sa.Column(name, sa.String(), nullable=True))
    if "review_required" not in columns:
        op.add_column("submissions", sa.Column(
            "review_required", sa.Boolean(), nullable=False, server_default=sa.false(),
        ))
    columns = {column["name"] for column in sa.inspect(bind).get_columns("submission_review_events")}
    for name in ("evidence_fingerprint", "previous_evidence_fingerprint"):
        if name not in columns:
            op.add_column("submission_review_events", sa.Column(name, sa.String(), nullable=True))
    if "source" not in columns:
        op.add_column("submission_review_events", sa.Column(
            "source", sa.String(), nullable=False, server_default="administrator",
        ))
    actor = next(column for column in sa.inspect(bind).get_columns("submission_review_events")
                 if column["name"] == "actor_id")
    if not actor["nullable"]:
        with op.batch_alter_table("submission_review_events") as batch:
            batch.alter_column("actor_id", existing_type=sa.Uuid(), nullable=True)
    metadata = sa.MetaData()
    submissions = sa.Table("submissions", metadata, autoload_with=bind)
    events = sa.Table("submission_review_events", metadata, autoload_with=bind)
    findings = sa.Table("quality_findings", metadata, autoload_with=bind)
    # Historical validation was initiated by an admin but was an automatic decision.
    bind.execute(events.update().where(events.c.action == "validation").values(actor_id=None, source="validation"))
    now = datetime.now(UTC)
    for item in bind.execute(sa.select(submissions).where(submissions.c.evidence_fingerprint.is_(None))).mappings():
        bind.execute(events.insert().values(
            id=uuid4().hex, submission_id=item["id"], organization_id=item["organization_id"],
            actor_id=None, action="legacy_review_required", source="migration",
            previous_status=item["review_status"], status="needs_review", occurred_at=now,
            note="Legacy decision has no recorded evidence fingerprint; current evidence requires review.",
        ))
        bind.execute(submissions.update().where(submissions.c.id == item["id"]).values(
            review_status="needs_review", review_required=True,
        ))
        finding_id = f"{str(item['id']).replace('-', '')}:legacy-review"
        bind.execute(findings.insert().values(
            id=finding_id, submission_id=item["id"], organization_id=item["organization_id"],
            project_id=item["project_id"], severity="Medium", rule="Legacy evidence requires review",
            detail="No evidence version was recorded for the previous decision. Review before reporting.",
            detected_at=now,
        ))


def downgrade() -> None:
    # Evidence and audit history must be exported before downgrading in production.
    with op.batch_alter_table("submission_review_events") as batch:
        for name in ("source", "evidence_fingerprint", "previous_evidence_fingerprint"):
            batch.drop_column(name)
    with op.batch_alter_table("submissions") as batch:
        for name in (
            "evidence_fingerprint", "decision_fingerprint", "decision_status", "validation_status", "review_required",
        ):
            batch.drop_column(name)
