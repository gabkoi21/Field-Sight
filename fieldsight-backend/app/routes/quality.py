"""Bounded review queue and persisted administrator review activity."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.sync_telemetry import utc
from app.db.session import get_session
from app.models.identity import OrganizationMembership, Role, User
from app.models.operations import Project, QualityFinding, Submission, SubmissionReviewEvent, SurveySchema
from app.routes.auth import get_current_user
from app.routes.collection import _read_submission
from app.routes.kobo import _organization_admin_id

router = APIRouter(tags=["Data quality"])
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _submission(submission_id: UUID, user: User, db: Session) -> Submission:
    organization_id = _organization_admin_id(user, db)
    item = db.get(Submission, submission_id)
    if item is None or item.organization_id != organization_id:
        raise HTTPException(404, "Submission was not found.")
    return item


@router.get("/quality/queue")
def review_queue(
    user: CurrentUser, db: Database, project_id: UUID | None = None,
    severity: Literal["Blocking", "High", "Medium", "Low"] | None = None,
    include_reviewed: bool = False,
    offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, object]:
    organization_id = _organization_admin_id(user, db)
    scope = [col(Submission.organization_id) == organization_id]
    if project_id:
        scope.append(col(Submission.project_id) == project_id)
    counts = dict(db.exec(select(Submission.review_status, func.count()).where(*scope)
                         .group_by(Submission.review_status)).all())
    statement = select(QualityFinding, Submission, Project).join(
        Submission, col(QualityFinding.submission_id) == col(Submission.id),
    ).join(Project, col(Project.id) == col(Submission.project_id)).where(
        *scope, QualityFinding.organization_id == organization_id, Project.organization_id == organization_id,
    )
    if not include_reviewed:
        statement = statement.where(Submission.review_status != "ready")
    if severity:
        statement = statement.where(QualityFinding.severity == severity)
    total = db.exec(select(func.count()).select_from(statement.subquery())).one()
    rows = db.exec(statement.order_by(col(QualityFinding.detected_at).desc(), QualityFinding.id)
                   .offset(offset).limit(limit)).all()
    items = []
    for finding, submission, project in rows:
        items.append({**_read_submission(submission, project), "id": finding.id,
            "submission_id": str(submission.id), "severity": finding.severity, "rule": finding.rule,
            "detail": finding.detail, "field": finding.field,
            "state": "Reviewed" if submission.review_status == "ready" else "Open"})
    return {"items": items, "total": total, "counts": counts, "offset": offset,
            "snapshot_note": "Findings reflect the last validation. Run validation after synchronizing new data."}


@router.get("/submissions/{submission_id}/review")
def review_detail(submission_id: UUID, user: CurrentUser, db: Database) -> dict[str, object]:
    item = _submission(submission_id, user, db)
    project = db.get(Project, item.project_id)
    assert project is not None
    events = db.exec(select(SubmissionReviewEvent, User)
        .outerjoin(User, col(User.id) == col(SubmissionReviewEvent.actor_id))
        .where(SubmissionReviewEvent.submission_id == item.id,
               SubmissionReviewEvent.organization_id == item.organization_id)
        .order_by(col(SubmissionReviewEvent.occurred_at).desc(), col(SubmissionReviewEvent.id).desc()).limit(100)).all()
    reviewers = db.exec(select(User).join(OrganizationMembership).where(
        OrganizationMembership.organization_id == item.organization_id,
        OrganizationMembership.role == Role.ORGANIZATION_ADMIN, OrganizationMembership.is_active, User.is_active,
    )).all()
    schema = db.exec(select(SurveySchema).where(
        SurveySchema.organization_id == item.organization_id, SurveySchema.project_id == item.project_id,
        SurveySchema.form_id == item.kobo_form_id,
    )).first()
    return {"fields": schema.fields_json if schema else [], 
        "submission": _read_submission(item, project), "reviewer_id": item.reviewer_id,
        "reviewers": [{"id": row.id, "name": row.full_name or row.email} for row in reviewers],
        "events": [{"id": event.id, "action": event.action,
                    "actor": (actor.full_name or actor.email) if actor else "System",
                    "source": event.source, "evidence_fingerprint": event.evidence_fingerprint,
                    "previous_status": event.previous_status, "status": event.status,
                    "reviewer_id": event.reviewer_id, "note": event.note, "occurred_at": utc(event.occurred_at)}
                   for event, actor in events]}


class ReviewerInput(BaseModel):
    reviewer_id: UUID | None


@router.patch("/submissions/{submission_id}/reviewer")
def assign_reviewer(submission_id: UUID, payload: ReviewerInput, user: CurrentUser, db: Database) -> dict[str, object]:
    item = _submission(submission_id, user, db)
    if payload.reviewer_id is not None:
        member = db.exec(select(OrganizationMembership).where(
            OrganizationMembership.user_id == payload.reviewer_id,
            OrganizationMembership.organization_id == item.organization_id,
            OrganizationMembership.role == Role.ORGANIZATION_ADMIN, OrganizationMembership.is_active,
        )).first()
        reviewer = db.get(User, payload.reviewer_id)
        if member is None or reviewer is None or not reviewer.is_active:
            raise HTTPException(422, "Choose an active organization administrator as reviewer.")
    item.reviewer_id = payload.reviewer_id
    db.add(item)
    db.add(SubmissionReviewEvent(submission_id=item.id, organization_id=item.organization_id,
                                actor_id=user.id, action="assignment", reviewer_id=payload.reviewer_id))
    db.commit()
    return {"reviewer_id": item.reviewer_id}


class ReviewNoteInput(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


@router.post("/submissions/{submission_id}/review-notes", status_code=201)
def add_review_note(submission_id: UUID, payload: ReviewNoteInput, user: CurrentUser, db: Database) -> dict[str, str]:
    item = _submission(submission_id, user, db)
    if not payload.note.strip():
        raise HTTPException(422, "Enter a review note.")
    db.add(SubmissionReviewEvent(submission_id=item.id, organization_id=item.organization_id,
                                actor_id=user.id, action="note", note=payload.note.strip()))
    db.commit()
    return {"status": "saved"}
