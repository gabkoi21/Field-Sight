"""Add ten identifiable sample submissions to the local community health project."""

import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.indicator_results import calculate
from app.db.session import get_engine
from app.models.operations import Indicator, IndicatorMapping, Project, Submission, SurveySchema
from app.schemas.analysis import SurveyField


def main():
    settings = get_settings()
    url = make_url(settings.database_url)
    if settings.environment != "development" or url.get_backend_name() != "sqlite":
        raise RuntimeError("This sample import is restricted to local development SQLite.")
    now = datetime(2026, 10, 26, 12, tzinfo=UTC)
    path = Path(url.database).resolve()
    backup = path.parent / "backups" / f"before-community-preview-{datetime.now(UTC):%Y%m%d-%H%M%S-%f}.db"
    backup.parent.mkdir(exist_ok=True)
    with sqlite3.connect(path) as source, sqlite3.connect(backup) as destination:
        source.backup(destination)
    with Session(get_engine()) as db:
        project = db.exec(select(Project).where(Project.name == "Community health visits")).one()
        existing = db.exec(select(Submission).where(Submission.project_id == project.id)).all()
        template = next(s for s in existing if s.kobo_form_id == project.kobo_form_id)
        schema = db.exec(
            select(SurveySchema).where(
                SurveySchema.project_id == project.id, SurveySchema.form_id == project.kobo_form_id
            )
        ).one()
        fields = {f["source_field"]: SurveyField.model_validate(f) for f in schema.fields_json}
        indicators = db.exec(select(Indicator).where(Indicator.project_id == project.id)).all()

        def results(records):
            values = {}
            for indicator in indicators:
                mapping = db.exec(select(IndicatorMapping).where(IndicatorMapping.indicator_id == indicator.id)).first()
                if mapping:
                    values[indicator.name] = calculate(
                        mapping,
                        [s for s in records if s.kobo_form_id == mapping.source_form_id],
                        fields.get(mapping.source_field),
                        indicator.unit,
                    ).model_dump()
            return values

        before = results(existing)
        created = []
        for index in range(10):
            external_id = f"community-preview-20261026-{index + 1:02d}"
            if any(s.external_id == external_id for s in existing):
                continue
            submitted = now - timedelta(days=index * 7)
            record = Submission(
                organization_id=project.organization_id,
                project_id=project.id,
                kobo_connection_id=template.kobo_connection_id,
                kobo_form_id=project.kobo_form_id,
                external_id=external_id,
                submitted_at=submitted,
                enumerator=f"Demo collector {index % 3 + 1}",
                location=("Montserrado", "Bong", "Nimba", "Margibi")[index % 4],
                review_status="ready",
                raw_answers={
                    "gender": ("female", "male", "other")[index % 3],
                    "received_support": "no" if index in (3, 8) else "yes",
                    "participants": index + 3,
                    "satisfaction": (3, 4, 5, 4, 5)[index % 5],
                    "services": ("training supplies", "referral", "supplies")[index % 3],
                    "visit_date": submitted.date().isoformat(),
                    "notes": f"SYNTHETIC DEMO: community health visit {index + 1}; UI preview only.",
                    "seeded": True,
                    "source": "community-preview-20261026",
                },
            )
            db.add(record)
            created.append(record)
        db.flush()
        after = results(existing + created)
        for result in after.values():
            assert result["value"] is not None
        db.commit()
        print(json.dumps({"created": len(created), "backup": str(backup), "before": before, "after": after}, indent=2))


if __name__ == "__main__":
    main()
