"""Resolve county coverage at submission time from the assignment audit trail."""

import json
from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import Session, col, select

from app.models.operations import CollectorProfile, FieldAssignment, OrganizationAdminEvent, Project, Submission


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def submission_counties(
    db: Session, project: Project, records: list[Submission]
) -> dict[UUID, tuple[bool, list[str] | None]]:
    """Never substitute today's assignment for a historical submission's coverage."""
    assignments = db.exec(
        select(FieldAssignment, CollectorProfile)
        .join(CollectorProfile, FieldAssignment.collector_id == CollectorProfile.id)
        .where(
            FieldAssignment.project_id == project.id,
            FieldAssignment.organization_id == project.organization_id,
            CollectorProfile.organization_id == project.organization_id,
        )
    ).all()
    ids = [str(assignment.id) for assignment, _ in assignments]
    events = (
        db.exec(
            select(OrganizationAdminEvent)
            .where(
                OrganizationAdminEvent.organization_id == project.organization_id,
                col(OrganizationAdminEvent.resource_id).in_(ids),
            )
            .order_by(col(OrganizationAdminEvent.occurred_at), col(OrganizationAdminEvent.id))
        ).all()
        if ids
        else []
    )
    by_assignment: dict[str, list[OrganizationAdminEvent]] = {}
    for event in events:
        by_assignment.setdefault(event.resource_id, []).append(event)
    timelines = []
    for assignment, profile in assignments:
        history = by_assignment.get(str(assignment.id), [])
        # County restrictions did not exist before the first county audit event.
        # Legacy assignments therefore started with unrestricted county coverage.
        username = profile.kobo_username
        for event in history:
            if event.action.startswith(("enumerator.counties:", "enumerator.coverage:")):
                payload = json.loads(event.action.split(":", 1)[1])
                if "kobo_username" in payload:
                    username = payload["kobo_username"]
                    break
        timeline = [(_utc(assignment.created_at), username, True, None)]
        counties = None
        for event in history:
            if event.action.startswith("enumerator.counties:"):
                payload = json.loads(event.action.split(":", 1)[1])
                counties = payload["counties"]
                username = payload.get("kobo_username", username)
                timeline.append((_utc(event.occurred_at), username, True, counties))
            elif event.action == "enumerator.removed_kobo_revocation_required":
                timeline.append((_utc(event.occurred_at), username, False, counties))
            elif event.action.startswith("enumerator.coverage:"):
                payload = json.loads(event.action.split(":", 1)[1])
                username, counties = payload["kobo_username"], payload["counties"]
                timeline.append((_utc(event.occurred_at), username, payload["active"], counties))
        timelines.append(timeline)
    result = {}
    for record in records:
        at = _utc(record.submitted_at or record.created_at)
        username = (record.enumerator or "").strip()
        matches = []
        for timeline in timelines:
            eligible = [entry for entry in timeline if entry[0] <= at and entry[1] == username and username]
            if eligible:
                matches.append(max(eligible, key=lambda entry: entry[0]))
        latest = max(matches, key=lambda entry: entry[0]) if matches else None
        result[record.id] = (True, latest[3]) if latest and latest[2] else (False, None)
    return result
