"""Add 30 identifiable sample reports to the local development School Feeding project."""

import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.review_evidence import evidence_fingerprint
from app.db.session import get_engine
from app.models.operations import Project, Submission, SurveySchema

BATCH = "school-preview-20261027"


def main():
    settings = get_settings()
    url = make_url(settings.database_url)
    expected = Path(__file__).resolve().parents[1] / "fieldsight.db"
    path = Path(url.database).resolve() if url.database else None
    if settings.environment != "development" or url.get_backend_name() != "sqlite" or path != expected:
        raise RuntimeError("This sample import is restricted to this workspace's development fieldsight.db.")
    with Session(get_engine()) as db:
        project = db.exec(select(Project).where(Project.name == "Daily School Feeding Monitoring Form")).one()
        if not project.kobo_form_id or not project.kobo_connection_id:
            raise RuntimeError("Connect the intended School Feeding form first.")
        schema = db.exec(select(SurveySchema).where(
            SurveySchema.project_id == project.id, SurveySchema.form_id == project.kobo_form_id,
        )).one()
        fields = {field["source_field"] for field in schema.fields_json}
        assert {"attendance/boys_present", "feeding/boys_fed", "feeding/meals_served_today"} <= fields
        existing = db.exec(select(Submission).where(Submission.project_id == project.id)).all()
        existing_ids = {row.external_id for row in existing}
        backup = path.parent / "backups" / f"before-school-preview-{datetime.now(UTC):%Y%m%d-%H%M%S-%f}.db"
        backup.parent.mkdir(exist_ok=True)
        with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as source, sqlite3.connect(backup) as destination:
            source.backup(destination)
        counties = [("montserrado", "Montserrado"), ("bong", "Bong"), ("nimba", "Nimba")]
        days = []
        day = datetime(2026, 10, 26, 14, tzinfo=UTC)
        while len(days) < 15:
            if day.weekday() < 5:
                days.append(day)
            day -= timedelta(days=1)
        created = []
        for index in range(30):
            external_id = f"{BATCH}-{index + 1:02d}"
            if external_id in existing_ids:
                continue
            submitted = days[index // 2] + timedelta(minutes=20 * (index % 2))
            school = index % 5 + 1
            county, location = counties[(school - 1) % 3]
            boys = 70 + (index * 7) % 55
            girls = 80 + (index * 9) % 60
            served = index % 11 != 0
            shortage = not served or index % 6 == 0
            boys_fed = max(0, boys - (12 if shortage else 0)) if served else 0
            girls_fed = max(0, girls - (15 if shortage else 0)) if served else 0
            answers = {
                "school_information/school_name": f"SYNTHETIC DEMO School {school}",
                "school_information/school_code": f"DEMO-SFP-{school:03d}",
                "school_information/county": county,
                "school_information/district": f"Demo district {school}",
                "school_information/reporting_date": submitted.date().isoformat(),
                "school_information/field_officer": f"DEMO-OFFICER-{index % 3 + 1:03d}",
                "attendance/boys_enrolled": boys + 20, "attendance/girls_enrolled": girls + 20,
                "attendance/total_enrolled": boys + girls + 40,
                "attendance/boys_present": boys, "attendance/girls_present": girls,
                "attendance/total_present": boys + girls,
                "feeding/meals_served_today": "yes" if served else "no",
                "feeding/boys_fed": boys_fed, "feeding/girls_fed": girls_fed,
                "feeding/students_fed_total": boys_fed + girls_fed,
                "feeding/meals_served_count": boys_fed + girls_fed,
                "feeding/food_sufficient": "no" if shortage else "yes",
                "feeding/food_shortage": "yes" if shortage else "no",
                "observation/additional_observations": "SYNTHETIC DEMO: local UI sample, not a real school report.",
                "observation/follow_up_needed": "yes" if shortage else "no",
                "_demo_batch": BATCH,
            }
            if served:
                answers["feeding/meal_type"] = ("rice_beans", "rice_soup", "porridge")[index % 3]
            else:
                answers["feeding/no_meals_reason"] = "food_unavailable"
            if shortage:
                answers["feeding/shortage_details"] = "SYNTHETIC DEMO: insufficient portions in sample scenario."
                answers["observation/follow_up_action"] = "SYNTHETIC DEMO: check sample food supply."
            assert boys_fed <= boys and girls_fed <= girls
            row = Submission(
                organization_id=project.organization_id, project_id=project.id,
                kobo_connection_id=project.kobo_connection_id, kobo_form_id=project.kobo_form_id,
                external_id=external_id, submitted_at=submitted,
                enumerator=f"Demo officer {index % 3 + 1}", location=location,
                review_status="needs_review", review_required=True,
                evidence_fingerprint=evidence_fingerprint(answers), raw_answers=answers,
            )
            db.add(row)
            created.append(row)
        db.flush()
        all_records = db.exec(select(Submission).where(Submission.project_id == project.id)).all()
        assert len([row for row in all_records if row.external_id.startswith(BATCH)]) == 30
        assert len(all_records) == len(existing) + len(created)
        assert all(row.review_status == "needs_review" and row.review_required for row in created)
        db.commit()
        print(json.dumps({"created": len(created), "before": len(existing), "after": len(all_records),
                          "review_status": "needs_review", "backup": str(backup)}, indent=2))


if __name__ == "__main__":
    main()
