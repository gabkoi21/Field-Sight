"""Create a new offline School Feeding pilot DB under workspace tmp; never seed an existing DB."""

import argparse
import os
from collections.abc import Iterator
from datetime import date, datetime
from pathlib import Path

from alembic.config import Config
from sqlalchemy import Engine
from sqlmodel import Session, create_engine, select

from alembic import command
from app.core.config import Settings, get_settings
from app.core.review_evidence import evidence_fingerprint
from app.core.security import password_hasher
from app.db.session import get_session
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role, Sector, User
from app.models.operations import (
    Indicator,
    IndicatorMapping,
    KoboConnection,
    Project,
    QualityFinding,
    Submission,
    SurveySchema,
)
from app.schemas.analysis import SurveyField

PILOT_PASSWORD = "SyntheticPilot123!"
TEST_SECRET = "synthetic-pilot-only-never-production-0123456789abcdefghijklmnopqrstuvwxyz"
WORKSPACE = Path(__file__).resolve().parents[2]
PILOT_ROOT = WORKSPACE / "tmp"

SCENARIOS = [
    {
        "school": "Synthetic A",
        "date": "2026-10-20",
        "present": 260,
        "fed": 215,
        "portions": 215,
        "served": "yes",
        "shortage": "yes",
        "follow_up": "yes",
    },
    {
        "school": "Synthetic B",
        "date": "2026-10-20",
        "present": 100,
        "fed": 100,
        "portions": 100,
        "served": "yes",
        "shortage": "no",
        "follow_up": "no",
    },
    {
        "school": "Synthetic A",
        "date": "2026-10-21",
        "present": 250,
        "fed": 0,
        "portions": 0,
        "served": "no",
        "shortage": "yes",
        "follow_up": "yes",
    },
    {
        "school": "Synthetic B",
        "date": "2026-10-21",
        "present": 90,
        "fed": 80,
        "served": "yes",
        "shortage": "yes",
        "follow_up": "yes",
    },
    {
        "school": "Synthetic C",
        "date": "2026-10-21",
        "present": 80,
        "fed": 70,
        "portions": "invalid-number",
        "served": "yes",
        "shortage": "no",
        "follow_up": "no",
    },
    {
        "school": "Synthetic C",
        "date": "2026-10-22",
        "present": 50,
        "fed": 50,
        "portions": 50,
        "served": "yes",
        "shortage": "no",
        "follow_up": "no",
    },
]


def pilot_settings(path: Path) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite:///{path.as_posix()}",
        jwt_secret=TEST_SECRET,
        cors_origins="http://127.0.0.1:5174,http://localhost:5174",
    )


def seed_database(path: Path) -> dict[str, str]:
    if os.environ.get("FIELDSIGHT_ENVIRONMENT") != "test":
        raise ValueError("Refusing seed: FIELDSIGHT_ENVIRONMENT must be exactly test.")
    path = path.resolve()
    if not path.is_relative_to(PILOT_ROOT.resolve()) or path.suffix != ".db":
        raise ValueError("Refusing seed: choose a new .db path under workspace tmp/.")
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation also refuses empty existing files and closes the check/create race.
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValueError("Refusing seed: the database already exists. Choose a fresh path.") from exc
    os.close(descriptor)
    settings = pilot_settings(path)
    os.environ["FIELDSIGHT_DATABASE_URL"] = settings.database_url
    os.environ["FIELDSIGHT_JWT_SECRET"] = TEST_SECRET
    get_settings.cache_clear()
    config = Config(str(WORKSPACE / "fieldsight-backend" / "alembic.ini"))
    config.set_main_option("script_location", str(WORKSPACE / "fieldsight-backend" / "alembic"))
    command.upgrade(config, "head")
    engine = create_engine(settings.database_url)
    try:
        with Session(engine) as db:
            org = Organization(name="SYNTHETIC pilot NGO", slug="synthetic-pilot-ngo")
            officer = User(
                email="officer@pilot.example",
                full_name="Synthetic project officer",
                password_hash=password_hasher.hash(PILOT_PASSWORD),
            )
            reviewer = User(
                email="reviewer@pilot.example",
                full_name="Synthetic M&E reviewer",
                password_hash=password_hasher.hash(PILOT_PASSWORD),
            )
            collector = User(
                email="collector@pilot.example",
                full_name="Synthetic collector",
                password_hash=password_hasher.hash(PILOT_PASSWORD),
            )
            db.add_all([org, officer, reviewer, collector])
            db.flush()
            sector = db.exec(select(Sector).where(Sector.code == "education")).first()
            if sector is None:
                sector = Sector(code="education-pilot", name="Education")
                db.add(sector)
                db.flush()
            link = OrganizationSector(organization_id=org.id, sector_id=sector.id)
            db.add(link)
            db.flush()
            for account, role in (
                (officer, Role.ORGANIZATION_ADMIN),
                (reviewer, Role.ORGANIZATION_ADMIN),
                (collector, Role.ENUMERATOR),
            ):
                db.add(OrganizationMembership(organization_id=org.id, user_id=account.id, role=role))
            connection = KoboConnection(
                organization_id=org.id,
                created_by_id=officer.id,
                name="SYNTHETIC offline source (unverified)",
                server_url="https://kf.kobotoolbox.org",
                token_encrypted="not-a-real-token",
                is_verified=False,
            )
            db.add(connection)
            db.flush()
            project = Project(
                organization_id=org.id,
                organization_sector_id=link.id,
                created_by_id=officer.id,
                name="SYNTHETIC — Daily School Feeding Monitoring Form",
                country="Liberia",
                status="active",
                start_date=date(2026, 10, 1),
                end_date=date(2026, 12, 31),
                kobo_connection_id=connection.id,
                kobo_form_id="synthetic-school-feeding",
                kobo_form_name="Synthetic School Feeding Form",
            )
            db.add(project)
            db.flush()
            from app.models.operations import FieldAssignment

            member = db.exec(select(OrganizationMembership).where(OrganizationMembership.user_id == collector.id)).one()
            db.add(FieldAssignment(organization_id=org.id, project_id=project.id, membership_id=member.id))
            fields = [
                SurveyField(source_field=name, label=label, type=kind).model_dump(mode="json")
                for name, label, kind in (
                    ("school", "School", "text"),
                    ("date", "Monitoring date", "date"),
                    ("present", "Attendance", "number"),
                    ("fed", "Student-meal instances", "number"),
                    ("portions", "Meal portions", "number"),
                    ("served", "Meals served", "text"),
                    ("shortage", "Food shortage", "text"),
                    ("follow_up", "Follow-up required", "text"),
                )
            ]
            db.add(
                SurveySchema(
                    organization_id=org.id,
                    project_id=project.id,
                    form_id=project.kobo_form_id,
                    fields_json=fields,
                    version="synthetic-v1",
                )
            )
            for index, answers in enumerate(SCENARIOS, 1):
                raw = {**answers, "_id": index, "_submission_time": answers["date"] + "T12:00:00Z"}
                record = Submission(
                    organization_id=org.id,
                    project_id=project.id,
                    kobo_connection_id=connection.id,
                    kobo_form_id=project.kobo_form_id,
                    external_id=f"SYNTHETIC-{index}",
                    submitted_at=datetime.fromisoformat(str(raw["_submission_time"])),
                    enumerator="Synthetic collector",
                    location=str(answers["school"]),
                    raw_answers=raw,
                    review_status="needs_review",
                    review_required=True,
                    evidence_fingerprint=evidence_fingerprint(raw),
                )
                db.add(record)
                db.flush()
                if index == 5:
                    db.add(
                        QualityFinding(
                            id=f"synthetic-{record.id}",
                            submission_id=record.id,
                            project_id=project.id,
                            organization_id=org.id,
                            severity="high",
                            rule="numeric",
                            field="portions",
                            detail="Synthetic invalid numeric value: inspect before reviewing.",
                        )
                    )
            for code, name, field, calculation, match in (
                ("PORTIONS", "Meal portions served", "portions", "sum", None),
                ("SESSIONS", "School-day records reporting meals served", "served", "count_matching", "yes"),
                ("MEALS", "Student-meal instances (not unique beneficiaries)", "fed", "sum", None),
            ):
                indicator = Indicator(
                    organization_id=org.id,
                    project_id=project.id,
                    created_by_id=officer.id,
                    name=name,
                    code=code,
                    unit="number",
                    reliability_policy=1,
                    target_value=None,
                    manual_aggregation="sum",
                )
                db.add(indicator)
                db.flush()
                db.add(
                    IndicatorMapping(
                        organization_id=org.id,
                        project_id=project.id,
                        indicator_id=indicator.id,
                        source_form_id=project.kobo_form_id,
                        source_field=field,
                        calculation=calculation,
                        match_value=match,
                    )
                )
            other = Project(
                organization_id=org.id,
                organization_sector_id=link.id,
                created_by_id=officer.id,
                name="SYNTHETIC other project",
                status="active",
            )
            db.add(other)
            db.commit()
            return {
                "database": str(path),
                "project_id": str(project.id),
                "other_project_id": str(other.id),
                "officer": officer.email,
                "reviewer": reviewer.email,
            }
    finally:
        engine.dispose()
        get_settings.cache_clear()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument(
        "--serve", action="store_true", help="Serve this newly created disposable DB on loopback port 8001"
    )
    args = parser.parse_args()
    result = seed_database(args.database)
    import json

    print(json.dumps(result), flush=True)
    if args.serve:
        import uvicorn

        from app.main import create_app

        engine: Engine = create_engine(
            pilot_settings(args.database.resolve()).database_url, connect_args={"check_same_thread": False}
        )

        def session() -> Iterator[Session]:
            with Session(engine) as db:
                yield db

        app = create_app(pilot_settings(args.database.resolve()))
        app.dependency_overrides[get_session] = session
        uvicorn.run(app, host="127.0.0.1", port=8001)


if __name__ == "__main__":
    main()
