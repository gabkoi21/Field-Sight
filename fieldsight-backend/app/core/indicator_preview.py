"""Server-authenticated previews, bound to material state and proposed definition."""

import hashlib
import hmac
import json
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.review_evidence import evidence_fingerprint
from app.models.operations import FieldMapping, Indicator, Project, Submission, SurveySchema
from app.models.workspace import CollectedResult
from app.schemas.analysis import SurveyField


def material_fields(fields: list[dict[str, object]]) -> list[dict[str, object]]:
    """Provider labels and refresh/version timestamps do not affect calculations."""
    normalized = [SurveyField.model_validate(field) for field in fields]
    return sorted(
        [
            {
                **field.model_dump(include={"source_field", "type", "source", "supported"}),
                "choice_codes": sorted(choice.value for choice in field.choices),
            }
            for field in normalized
        ],
        key=lambda field: str(field["source_field"]),
    )


def protect_state(db: Session) -> None:
    """Serialize definition transactions with all source writers, including inserts.

    SQLite reserves its writer before reading; PostgreSQL table locks also protect
    against phantom inserts from sync/review routes which do not lock indicators.
    Locks last through commit/rollback. Keep these transactions short.
    """
    connection = db.connection()
    if connection.dialect.name == "sqlite":
        driver = connection.connection.driver_connection
        assert driver is not None
        if not driver.in_transaction:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
    elif connection.dialect.name == "postgresql":
        db.execute(
            text(
                "LOCK TABLE indicators, indicator_mappings, indicator_period_targets, "
                "submissions, collected_results, survey_schemas, field_mappings, projects "
                "IN SHARE ROW EXCLUSIVE MODE"
            )
        )
    else:
        raise RuntimeError("Preview transactions require SQLite or PostgreSQL")
    db.expire_all()


def state_digest(indicator: Indicator, definition: dict, db: Session) -> str:
    """Ignore transport/reviewer metadata; retain answers, eligibility and scope."""
    submissions = db.exec(
        select(Submission).where(
            Submission.project_id == indicator.project_id,
            Submission.organization_id == indicator.organization_id,
        )
    ).all()
    manual = db.exec(
        select(CollectedResult).where(
            CollectedResult.indicator_id == indicator.id,
            CollectedResult.organization_id == indicator.organization_id,
        )
    ).all()
    schemas = db.exec(
        select(SurveySchema).where(
            SurveySchema.project_id == indicator.project_id,
            SurveySchema.organization_id == indicator.organization_id,
        )
    ).all()
    mappings = db.exec(
        select(FieldMapping).where(
            FieldMapping.project_id == indicator.project_id,
            FieldMapping.organization_id == indicator.organization_id,
        )
    ).all()
    project = db.get(Project, indicator.project_id)
    payload: dict[str, Any] = {
        "indicator": str(indicator.id),
        "version": indicator.definition_version,
        "definition": definition,
        "project_form": project.kobo_form_id if project else None,
        "submissions": sorted(
            [
                {
                    "id": str(row.id),
                    "form": row.kobo_form_id,
                    "date": row.submitted_at,
                    "created": row.created_at,
                    "location": row.location,
                    "review": row.review_status,
                    "required": row.review_required,
                    "answers": evidence_fingerprint(row.raw_answers),
                }
                for row in submissions
            ],
            key=lambda row: row["id"],
        ),
        "manual": sorted([row.model_dump(exclude={"updated_at"}) for row in manual], key=lambda row: str(row["id"])),
        "schemas": sorted(
            [{"form": row.form_id, "fields": material_fields(row.fields_json)} for row in schemas],
            key=lambda row: row["form"],
        ),
        "fields": sorted(
            [{"field": row.source_field, "type": row.data_type} for row in mappings], key=lambda row: row["field"]
        ),
    }
    return hashlib.sha256(_encode(payload)).hexdigest()


def _encode(value: Any) -> bytes:
    return json.dumps(jsonable_encoder(value), sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def preview_token(state: str, proposed: dict) -> str:
    return hmac.new(
        get_settings().jwt_secret.encode(), _encode({"state": state, "proposed": proposed}), hashlib.sha256
    ).hexdigest()


def matches(token: str | None, state: str, proposed: dict) -> bool:
    return bool(token and hmac.compare_digest(token, preview_token(state, proposed)))
