"""Seed ten synthetic local datasets. Existing records and account credentials are preserved."""

import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlmodel import Session, select

from app.core.config import get_settings
from app.db.session import get_engine
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, User
from app.models.operations import (
    Indicator,
    IndicatorMapping,
    IndicatorPeriodTarget,
    KoboConnection,
    Project,
    ResultFrameworkNode,
    SavedAnalysis,
    Submission,
    SurveySchema,
)
from app.schemas.analysis import AnalysisQuery, Choice, SurveyField

DATASETS = (
    "Community health visits",
    "School attendance",
    "Clean water access",
    "Farmer training",
    "Child nutrition",
    "Livelihood support",
    "Community feedback",
    "Hygiene promotion",
    "Shelter assistance",
    "Youth outreach",
)


def seed() -> None:
    settings = get_settings()
    url = make_url(settings.database_url)
    if settings.environment != "development" or url.get_backend_name() != "sqlite":
        raise RuntimeError("Sample data is restricted to the local development SQLite database.")
    now = datetime.now(UTC)
    database = Path(url.database or "").resolve()
    backup = database.with_name(f"fieldsight-before-demo-datasets-{now:%Y%m%d-%H%M%S-%f}.db")
    with sqlite3.connect(database) as source, sqlite3.connect(backup) as destination:
        source.backup(destination)
    created = 0
    with Session(get_engine()) as db:
        org = db.exec(select(Organization).where(Organization.slug == "demo-organization")).one()
        user = db.exec(select(User).where(User.email == "org@gmail.com")).one()
        db.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == org.id,
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.is_active,
            )
        ).one()
        sector = db.exec(
            select(OrganizationSector).where(
                OrganizationSector.organization_id == org.id,
                OrganizationSector.is_active,
            )
        ).first()
        if sector is None:
            raise RuntimeError("Enable a sector for Demo Organization before seeding.")
        connection = db.exec(
            select(KoboConnection).where(
                KoboConnection.organization_id == org.id,
                KoboConnection.name == "DEMO offline samples (no remote connection)",
            )
        ).first()
        if connection is None:
            connection = KoboConnection(
                organization_id=org.id,
                created_by_id=user.id,
                name="DEMO offline samples (no remote connection)",
                server_url="https://example.invalid",
                token_encrypted="DEMO-NO-REMOTE-CREDENTIALS",
                is_verified=False,
            )
            db.add(connection)
            db.flush()
        for index, title in enumerate(DATASETS, 1):
            name = f"DEMO {index:02d} — {title}"
            existing = db.exec(
                select(Project).where(
                    Project.organization_id == org.id,
                    Project.name == name,
                )
            ).first()
            if existing:
                continue
            form = f"demo-ui-{index:02d}"
            project = Project(
                organization_id=org.id,
                organization_sector_id=sector.id,
                created_by_id=user.id,
                name=name,
                description="Synthetic sample dataset for UI review; no real people or Kobo sync.",
                country="Liberia",
                status="active",
                target_sample_size=40,
                start_date=(now - timedelta(days=90)).date(),
                end_date=(now + timedelta(days=60)).date(),
                kobo_form_id=form,
                kobo_form_name=f"DEMO {title} survey",
            )
            db.add(project)
            db.flush()
            scope = dict(organization_id=org.id, project_id=project.id)
            fields = [
                SurveyField(
                    source_field="gender",
                    label="Respondent gender",
                    type="select_one",
                    source="mapping",
                    choices=[Choice(value=v, label=v.title()) for v in ("female", "male", "other")],
                ),
                SurveyField(
                    source_field="received_support",
                    label="Received project support",
                    type="select_one",
                    source="mapping",
                    choices=[Choice(value=v, label=v.title()) for v in ("yes", "no")],
                ),
                SurveyField(source_field="participants", label="People reached", type="number", source="mapping"),
                SurveyField(
                    source_field="satisfaction", label="Satisfaction score (1–5)", type="number", source="mapping"
                ),
                SurveyField(
                    source_field="services",
                    label="Services requested",
                    type="select_multiple",
                    source="mapping",
                    choices=[Choice(value=v, label=v.title()) for v in ("training", "supplies", "referral")],
                ),
                SurveyField(source_field="visit_date", label="Visit date", type="date", source="mapping"),
                SurveyField(source_field="notes", label="Sample field notes", type="text", source="mapping"),
            ]
            db.add(
                SurveySchema(
                    **scope,
                    form_id=form,
                    version="synthetic-demo-v1",
                    fields_json=[field.model_dump() for field in fields],
                )
            )
            for row in range(30):
                submitted = now - timedelta(days=row * 2, hours=index)
                db.add(
                    Submission(
                        **scope,
                        kobo_connection_id=connection.id,
                        kobo_form_id=form,
                        external_id=f"demo-{index:02d}-{row + 1:03d}",
                        submitted_at=submitted,
                        enumerator=f"Demo collector {row % 3 + 1}",
                        location=("Montserrado", "Bong", "Nimba", "Margibi")[row % 4],
                        review_status="needs_review" if row in (8, 19) else "ready",
                        raw_answers={
                            "gender": ("female", "male", "female", "other")[row % 4],
                            "received_support": "yes" if (row + index) % 5 else "no",
                            "participants": 2 + (row * 3 + index) % 12,
                            "satisfaction": 1 + (row + index) % 5,
                            "services": "training supplies" if row % 2 else "referral",
                            "visit_date": submitted.date().isoformat(),
                            "notes": f"Synthetic {title.lower()} observation {row + 1}; UI sample only.",
                        },
                    )
                )
            parent = None
            nodes = []
            for order, (kind, label) in enumerate(
                (
                    ("goal", f"Improve {title.lower()}"),
                    ("outcome", "Increase equitable access to support"),
                    ("output", "Deliver community services"),
                    ("activity", "Conduct field visits and follow-up"),
                )
            ):
                node = ResultFrameworkNode(**scope, parent_id=parent, node_type=kind, title=label, sort_order=order)
                db.add(node)
                db.flush()
                nodes.append(node)
                parent = node.id
            definitions = (
                ("VISITS", "Completed field visits", "number", "count_records", "participants", None, 40, 2),
                ("REACHED", "People reached through services", "number", "sum", "participants", None, 200, 2),
                (
                    "ACCESS",
                    "Respondents receiving support",
                    "percentage",
                    "percentage_matching",
                    "received_support",
                    "yes",
                    85,
                    1,
                ),
                ("SATISFACTION", "Average satisfaction score", "number", "average", "satisfaction", None, 4, 0),
            )
            for code, label, unit, calculation, field, match, target, node_index in definitions:
                indicator = Indicator(
                    **scope,
                    created_by_id=user.id,
                    code=f"DEMO-{code}",
                    name=label,
                    unit=unit,
                    description="Calculated from synthetic demo responses; ready records only.",
                    baseline_value=0,
                    target_value=target,
                    target_date=(now + timedelta(days=30)).date(),
                    reporting_frequency="monthly",
                    framework_node_id=nodes[node_index].id,
                )
                db.add(indicator)
                db.flush()
                db.add(
                    IndicatorMapping(
                        **scope,
                        indicator_id=indicator.id,
                        source_form_id=form,
                        source_field=field,
                        calculation=calculation,
                        match_value=match,
                    )
                )
                for offset in (0, 31, 62):
                    period = (now - timedelta(days=offset)).strftime("%Y-%m")
                    db.add(
                        IndicatorPeriodTarget(
                            indicator_id=indicator.id,
                            period=period,
                            target_value=target if unit == "percentage" or calculation == "average" else target / 3,
                        )
                    )
            query = AnalysisQuery(project_id=project.id, form_id=form, source_field="gender", measure="count")
            db.add(
                SavedAnalysis(
                    **scope,
                    created_by_id=user.id,
                    title="DEMO — Respondent gender",
                    query_json=query.model_dump(mode="json"),
                    chart="donut",
                )
            )
            created += 1
        db.commit()
    print(
        f"Created {created} datasets ({created * 30} records, {created * 4} indicators). Existing datasets preserved."
    )
    print(f"Database backup: {backup.name}")


if __name__ == "__main__":
    seed()
