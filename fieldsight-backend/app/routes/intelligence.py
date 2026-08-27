"""Project field mapping, targets, and decision-oriented intelligence APIs."""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import median
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.identity import User
from app.models.phase3 import FieldMapping, Project, ProjectTarget, Submission
from app.routes.auth import get_current_user
from app.routes.kobo import _organization_admin_id
from app.schemas.intelligence import (
    FieldMappingOverview,
    FieldMappingRead,
    FieldMappingWrite,
    ProjectTargetCreate,
    ProjectTargetRead,
    ProjectTargetUpdate,
)

router = APIRouter(prefix="/projects")
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
_METADATA = {
    "_id",
    "_uuid",
    "_submission_time",
    "_submitted_by",
    "_attachments",
    "_geolocation",
    "_status",
    "_tags",
    "_notes",
    "_validation_status",
    "meta",
}


def _project(project_id: UUID, user: User, db: Session) -> Project:
    organization_id = _organization_admin_id(user, db)
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Project was not found.")
    return project


def _mapping_read(mapping: FieldMapping) -> FieldMappingRead:
    return FieldMappingRead.model_validate(mapping, from_attributes=True)


def _target_read(target: ProjectTarget) -> ProjectTargetRead:
    return ProjectTargetRead.model_validate(target, from_attributes=True)


@router.get("/{project_id}/field-mappings", response_model=FieldMappingOverview, tags=["Project intelligence"])
def get_field_mappings(project_id: UUID, user: CurrentUser, db: Database) -> FieldMappingOverview:
    project = _project(project_id, user, db)
    mappings = db.exec(
        select(FieldMapping).where(FieldMapping.project_id == project.id).order_by(FieldMapping.source_field)
    ).all()
    submissions = db.exec(select(Submission).where(Submission.project_id == project.id)).all()
    fields = sorted(
        {key for item in submissions for key in item.raw_answers if key not in _METADATA and not key.startswith("_")}
    )
    return FieldMappingOverview(mappings=[_mapping_read(item) for item in mappings], source_fields=fields)


@router.put("/{project_id}/field-mappings", response_model=list[FieldMappingRead], tags=["Project intelligence"])
def replace_field_mappings(
    project_id: UUID, payload: list[FieldMappingWrite], user: CurrentUser, db: Database
) -> list[FieldMappingRead]:
    project = _project(project_id, user, db)
    source_fields = [item.source_field for item in payload]
    if len(source_fields) != len(set(source_fields)):
        raise HTTPException(status_code=422, detail="Each Kobo field can only be mapped once.")
    existing = db.exec(select(FieldMapping).where(FieldMapping.project_id == project.id)).all()
    existing_by_source = {item.source_field: item for item in existing}
    requested = set(source_fields)
    for mapping in existing:
        if mapping.source_field not in requested:
            db.delete(mapping)
    result: list[FieldMapping] = []
    for item in payload:
        mapping = existing_by_source.get(item.source_field) or FieldMapping(
            organization_id=project.organization_id, project_id=project.id, **item.model_dump()
        )
        for field, value in item.model_dump().items():
            setattr(mapping, field, value)
        mapping.updated_at = datetime.now(UTC)
        db.add(mapping)
        result.append(mapping)
    db.commit()
    for mapping in result:
        db.refresh(mapping)
    return [_mapping_read(item) for item in result]


@router.get("/{project_id}/targets", response_model=list[ProjectTargetRead], tags=["Project intelligence"])
def list_targets(project_id: UUID, user: CurrentUser, db: Database) -> list[ProjectTargetRead]:
    project = _project(project_id, user, db)
    targets = db.exec(
        select(ProjectTarget).where(ProjectTarget.project_id == project.id).order_by(ProjectTarget.created_at)
    ).all()
    return [_target_read(item) for item in targets]


def _validate_mapping(project: Project, mapping_id: UUID | None, db: Session) -> None:
    if mapping_id is None:
        return
    mapping = db.get(FieldMapping, mapping_id)
    if mapping is None or mapping.project_id != project.id:
        raise HTTPException(status_code=422, detail="Target field mapping does not belong to this project.")


@router.post(
    "/{project_id}/targets",
    response_model=ProjectTargetRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Project intelligence"],
)
def create_target(project_id: UUID, payload: ProjectTargetCreate, user: CurrentUser, db: Database) -> ProjectTargetRead:
    project = _project(project_id, user, db)
    _validate_mapping(project, payload.field_mapping_id, db)
    target = ProjectTarget(organization_id=project.organization_id, project_id=project.id, **payload.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return _target_read(target)


@router.put("/{project_id}/targets/{target_id}", response_model=ProjectTargetRead, tags=["Project intelligence"])
def update_target(
    project_id: UUID, target_id: UUID, payload: ProjectTargetUpdate, user: CurrentUser, db: Database
) -> ProjectTargetRead:
    project = _project(project_id, user, db)
    target = db.get(ProjectTarget, target_id)
    if target is None or target.project_id != project.id:
        raise HTTPException(status_code=404, detail="Project target was not found.")
    changes = payload.model_dump(exclude_unset=True)
    _validate_mapping(project, changes.get("field_mapping_id", target.field_mapping_id), db)
    for field, value in changes.items():
        setattr(target, field, value)
    target.updated_at = datetime.now(UTC)
    db.add(target)
    db.commit()
    db.refresh(target)
    return _target_read(target)


@router.delete(
    "/{project_id}/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Project intelligence"]
)
def delete_target(project_id: UUID, target_id: UUID, user: CurrentUser, db: Database) -> Response:
    project = _project(project_id, user, db)
    target = db.get(ProjectTarget, target_id)
    if target is None or target.project_id != project.id:
        raise HTTPException(status_code=404, detail="Project target was not found.")
    db.delete(target)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _numbers(values: list[object]) -> list[float]:
    numbers: list[float] = []
    for value in values:
        try:
            if value not in (None, ""):
                numbers.append(float(value))
        except (TypeError, ValueError):
            continue
    return numbers


@router.get("/{project_id}/intelligence", tags=["Project intelligence"])
def project_intelligence(project_id: UUID, user: CurrentUser, db: Database) -> dict[str, object]:
    project = _project(project_id, user, db)
    submissions = db.exec(select(Submission).where(Submission.project_id == project.id)).all()
    mappings = db.exec(select(FieldMapping).where(FieldMapping.project_id == project.id)).all()
    targets = db.exec(select(ProjectTarget).where(ProjectTarget.project_id == project.id)).all()
    ready = sum(item.review_status == "ready" for item in submissions)
    blocked = len(submissions) - ready
    indicators: list[dict[str, object]] = []
    mapping_by_id = {item.id: item for item in mappings}
    for mapping in mappings:
        values = [
            item.raw_answers.get(mapping.source_field)
            for item in submissions
            if item.raw_answers.get(mapping.source_field) not in (None, "")
        ]
        if mapping.data_type == "number":
            numbers = _numbers(values)
            if numbers:
                indicators.append(
                    {
                        "mapping_id": str(mapping.id),
                        "name": mapping.display_name,
                        "value": round(sum(numbers) / len(numbers), 2),
                        "summary": (
                            f"Average {mapping.display_name.lower()} is {sum(numbers) / len(numbers):.1f}; "
                            f"median is {median(numbers):.1f}."
                        ),
                    }
                )
        elif mapping.data_type in {"boolean", "single_select", "location"} and values:
            counts: dict[str, int] = {}
            for value in values:
                key = str(value)
                counts[key] = counts.get(key, 0) + 1
            top, count = max(counts.items(), key=lambda item: item[1])
            indicators.append(
                {
                    "mapping_id": str(mapping.id),
                    "name": mapping.display_name,
                    "value": round(count / len(values) * 100, 1),
                    "summary": f"{top} is the most common response at {count / len(values) * 100:.1f}%.",
                }
            )
    target_results: list[dict[str, object]] = []
    for target in targets:
        mapping = mapping_by_id.get(target.field_mapping_id) if target.field_mapping_id else None
        if mapping:
            values = [item.raw_answers.get(mapping.source_field) for item in submissions]
            actual = (
                sum(_numbers(values))
                if mapping.data_type == "number"
                else sum(value not in (None, "") for value in values)
            )
        else:
            actual = len(submissions)
        progress = min(100.0, actual / target.target_value * 100) if target.target_value else 0.0
        on_track = actual <= target.target_value if target.direction == "at_most" else actual >= target.target_value
        target_results.append(
            {
                "id": str(target.id),
                "name": target.name,
                "target": target.target_value,
                "actual": actual,
                "unit": target.unit,
                "progress": round(progress, 1),
                "remaining": max(0, target.target_value - actual),
                "status": "Completed" if on_track else "Needs attention",
            }
        )
    overall = (
        round(sum(item["progress"] for item in target_results) / len(target_results), 1)
        if target_results
        else (round(len(submissions) / project.target_sample_size * 100, 1) if project.target_sample_size else 0)
    )
    pulse = [
        {
            "name": "Data collection",
            "status": "On track" if submissions else "Needs attention",
            "detail": f"{len(submissions)} submissions imported",
        },
        {
            "name": "Data quality",
            "status": "On track" if blocked == 0 else "Needs attention",
            "detail": f"{blocked} submissions need review",
        },
        {
            "name": "Target progress",
            "status": "On track" if overall >= 75 else "Needs attention",
            "detail": f"{overall:.0f}% overall progress",
        },
    ]
    return {
        "overall_progress": overall,
        "project_status": "On Track" if all(item["status"] == "On track" for item in pulse) else "Needs Attention",
        "pulse": pulse,
        "indicators": indicators[:4],
        "targets": target_results,
    }
