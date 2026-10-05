"""Organization-admin APIs for indicators, Kobo mappings, and calculated results."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.kobo import decrypt_kobo_token, list_kobo_form_questions
from app.db.session import get_session
from app.models.identity import User
from app.models.operations import Indicator, IndicatorMapping, KoboConnection, Project, Submission
from app.routes.auth import get_current_user
from app.routes.kobo import _organization_admin_id
from app.schemas.indicators import (
    IndicatorCreate,
    IndicatorFieldRead,
    IndicatorLocationResult,
    IndicatorMappingRead,
    IndicatorMappingWrite,
    IndicatorRead,
    IndicatorResultPoint,
    IndicatorUpdate,
)

router = APIRouter()
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
_METADATA_FIELDS = {
    "_id",
    "_uuid",
    "_submission_time",
    "_submitted_by",
    "_attachments",
    "_geolocation",
    "_status",
    "meta",
}
_METADATA_PATHS = {
    "start",
    "end",
    "formhub/uuid",
    "meta/instanceID",
    "meta/rootUuid",
    "meta/instanceName",
    "meta/deprecatedID",
}


def _project_for_admin(project_id: UUID, user: User, db: Session) -> Project:
    organization_id = _organization_admin_id(user, db)
    project = db.get(Project, project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Project was not found.")
    return project


def _indicator_for_admin(indicator_id: UUID, user: User, db: Session) -> Indicator:
    organization_id = _organization_admin_id(user, db)
    indicator = db.get(Indicator, indicator_id)
    if indicator is None or indicator.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Indicator was not found.")
    return indicator


def _mapping_read(mapping: IndicatorMapping) -> IndicatorMappingRead:
    return IndicatorMappingRead.model_validate(mapping, from_attributes=True)


def _numeric_values(values: list[object]) -> list[float]:
    numbers: list[float] = []
    for value in values:
        try:
            if value not in (None, ""):
                numbers.append(float(value))
        except (TypeError, ValueError):
            continue
    return numbers


def _calculation(mapping: IndicatorMapping | None, submissions: list[Submission]) -> tuple[float | None, int, int]:
    eligible = [item for item in submissions if item.review_status == "ready"]
    if mapping is None:
        return None, len(eligible), 0
    values = [_answer_for_field(item.raw_answers, mapping.source_field) for item in eligible]
    present = [value for value in values if value not in (None, "")]
    if mapping.calculation == "count_records":
        return float(len(eligible)), len(eligible), len(eligible)
    if mapping.calculation == "count_matching":
        matches = sum(str(value).casefold() == (mapping.match_value or "").casefold() for value in present)
        return float(matches), len(eligible), len(present)
    if mapping.calculation == "percentage_matching":
        if not present:
            return None, len(eligible), 0
        matches = sum(str(value).casefold() == (mapping.match_value or "").casefold() for value in present)
        return round(matches / len(present) * 100, 2), len(eligible), len(present)
    numbers = _numeric_values(present)
    if not numbers:
        return None, len(eligible), 0
    if mapping.calculation == "sum":
        return round(sum(numbers), 2), len(eligible), len(numbers)
    return round(sum(numbers) / len(numbers), 2), len(eligible), len(numbers)


def _result_status(indicator: Indicator, current_value: float | None) -> str:
    """Return a transparent target-based status without overwriting the indicator definition."""
    if current_value is None or indicator.target_value is None:
        return "not_started"
    if indicator.direction == "increase":
        return "on_track" if current_value >= indicator.target_value else "needs_attention"
    return "on_track" if current_value <= indicator.target_value else "needs_attention"


def _history(mapping: IndicatorMapping | None, submissions: list[Submission]) -> list[IndicatorResultPoint]:
    periods: dict[str, list[Submission]] = {}
    for submission in submissions:
        if submission.submitted_at is None:
            continue
        period = submission.submitted_at.date().isoformat()
        periods.setdefault(period, []).append(submission)
    return [
        IndicatorResultPoint(
            period=period,
            value=_calculation(mapping, items)[0],
            eligible_records=_calculation(mapping, items)[1],
            mapped_records=_calculation(mapping, items)[2],
        )
        for period, items in sorted(periods.items())
    ]


def _location_breakdown(
    mapping: IndicatorMapping | None, submissions: list[Submission]
) -> list[IndicatorLocationResult]:
    locations: dict[str, list[Submission]] = {}
    for submission in submissions:
        locations.setdefault(submission.location or "Not captured", []).append(submission)
    results = [
        IndicatorLocationResult(
            location=location,
            value=_calculation(mapping, items)[0],
            eligible_records=_calculation(mapping, items)[1],
            mapped_records=_calculation(mapping, items)[2],
        )
        for location, items in locations.items()
    ]
    return sorted(results, key=lambda result: (-result.eligible_records, result.location))


def _read(
    indicator: Indicator,
    mapping: IndicatorMapping | None = None,
    submissions: list[Submission] | None = None,
) -> IndicatorRead:
    current_value, eligible_records, mapped_records = _calculation(mapping, submissions or [])
    values = IndicatorRead.model_validate(indicator, from_attributes=True).model_dump(
        exclude={"mapping", "current_value", "eligible_records", "mapped_records", "history", "location_breakdown"}
    )
    values["status"] = _result_status(indicator, current_value)
    return IndicatorRead(
        **values,
        mapping=_mapping_read(mapping) if mapping else None,
        current_value=current_value,
        eligible_records=eligible_records,
        mapped_records=mapped_records,
        history=_history(mapping, submissions or []),
        location_breakdown=_location_breakdown(mapping, submissions or []),
    )


def _project_submissions(project_id: UUID, db: Session) -> list[Submission]:
    return db.exec(select(Submission).where(Submission.project_id == project_id)).all()


def _source_fields(submissions: list[Submission]) -> list[str]:
    return sorted(
        {
            key
            for submission in submissions
            for key in submission.raw_answers
            if key not in _METADATA_FIELDS and key not in _METADATA_PATHS and not key.startswith("_")
        }
    )


def _answer_for_field(raw_answers: dict[str, object], source_field: str) -> object | None:
    if source_field in raw_answers:
        return raw_answers[source_field]
    current: object = raw_answers
    for segment in source_field.replace(".", "/").strip("/").split("/"):
        if not isinstance(current, dict):
            return None
        current = current.get(segment)
    return current


def _available_fields(
    project: Project,
    submissions: list[Submission],
    db: Session,
    settings: Settings,
) -> list[IndicatorFieldRead]:
    fields = {field: IndicatorFieldRead(source_field=field, label=field) for field in _source_fields(submissions)}
    if project.kobo_connection_id and project.kobo_form_id:
        connection = db.get(KoboConnection, project.kobo_connection_id)
        if connection and connection.organization_id == project.organization_id and connection.is_verified:
            try:
                token = decrypt_kobo_token(connection.token_encrypted, settings)
                for field in list_kobo_form_questions(connection.server_url, token, project.kobo_form_id):
                    fields[field["source_field"]] = IndicatorFieldRead(**field)
            except ValueError:
                # Already-synced fields remain useful when Kobo is temporarily unavailable.
                pass
    return sorted(fields.values(), key=lambda field: (field.label.casefold(), field.source_field))


@router.get("/projects/{project_id}/indicator-fields", response_model=list[IndicatorFieldRead], tags=["M&E indicators"])
def indicator_fields(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[IndicatorFieldRead]:
    project = _project_for_admin(project_id, user, db)
    return _available_fields(project, _project_submissions(project.id, db), db, settings)


@router.get("/projects/{project_id}/indicators", response_model=list[IndicatorRead], tags=["M&E indicators"])
def list_indicators(project_id: UUID, user: CurrentUser, db: Database) -> list[IndicatorRead]:
    project = _project_for_admin(project_id, user, db)
    indicators = db.exec(
        select(Indicator).where(Indicator.project_id == project.id).order_by(Indicator.is_active.desc(), Indicator.name)
    ).all()
    mappings = db.exec(select(IndicatorMapping).where(IndicatorMapping.project_id == project.id)).all()
    mapping_by_indicator = {mapping.indicator_id: mapping for mapping in mappings}
    submissions = _project_submissions(project.id, db)
    return [_read(indicator, mapping_by_indicator.get(indicator.id), submissions) for indicator in indicators]


@router.post(
    "/projects/{project_id}/indicators",
    response_model=IndicatorRead,
    status_code=status.HTTP_201_CREATED,
    tags=["M&E indicators"],
)
def create_indicator(
    project_id: UUID,
    payload: IndicatorCreate,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> IndicatorRead:
    project = _project_for_admin(project_id, user, db)
    submissions = _project_submissions(project.id, db)
    if payload.mapping:
        available = _available_fields(project, submissions, db, settings)
        if payload.mapping.source_field not in {field.source_field for field in available}:
            raise HTTPException(status_code=422, detail="The selected Kobo question is not available in this project.")
    indicator = Indicator(
        organization_id=project.organization_id,
        project_id=project.id,
        created_by_id=user.id,
        **payload.model_dump(exclude={"mapping"}),
    )
    db.add(indicator)
    try:
        db.flush()
        mapping = None
        if payload.mapping:
            mapping = IndicatorMapping(
                organization_id=project.organization_id,
                project_id=project.id,
                indicator_id=indicator.id,
                **payload.mapping.model_dump(),
            )
            db.add(mapping)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="An indicator with this code already exists in the project."
        ) from exc
    db.refresh(indicator)
    return _read(indicator, mapping, submissions)


@router.get("/indicators/{indicator_id}", response_model=IndicatorRead, tags=["M&E indicators"])
def get_indicator(indicator_id: UUID, user: CurrentUser, db: Database) -> IndicatorRead:
    indicator = _indicator_for_admin(indicator_id, user, db)
    mapping = db.exec(select(IndicatorMapping).where(IndicatorMapping.indicator_id == indicator.id)).first()
    return _read(indicator, mapping, _project_submissions(indicator.project_id, db))


@router.patch("/indicators/{indicator_id}", response_model=IndicatorRead, tags=["M&E indicators"])
def update_indicator(indicator_id: UUID, payload: IndicatorUpdate, user: CurrentUser, db: Database) -> IndicatorRead:
    indicator = _indicator_for_admin(indicator_id, user, db)
    changes = payload.model_dump(exclude_unset=True)
    target_value = changes.get("target_value", indicator.target_value)
    target_date = changes.get("target_date", indicator.target_date)
    if target_date is not None and target_value is None:
        raise HTTPException(status_code=422, detail="A target value is required when a target date is set.")
    for field, value in changes.items():
        setattr(indicator, field, value)
    indicator.updated_at = datetime.now(UTC)
    db.add(indicator)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="An indicator with this code already exists in the project."
        ) from exc
    db.refresh(indicator)
    mapping = db.exec(select(IndicatorMapping).where(IndicatorMapping.indicator_id == indicator.id)).first()
    return _read(indicator, mapping, _project_submissions(indicator.project_id, db))


@router.put("/indicators/{indicator_id}/mapping", response_model=IndicatorMappingRead, tags=["M&E indicators"])
def upsert_mapping(
    indicator_id: UUID,
    payload: IndicatorMappingWrite,
    user: CurrentUser,
    db: Database,
    settings: Annotated[Settings, Depends(get_settings)],
) -> IndicatorMappingRead:
    indicator = _indicator_for_admin(indicator_id, user, db)
    project = db.get(Project, indicator.project_id)
    available = (
        _available_fields(project, _project_submissions(indicator.project_id, db), db, settings) if project else []
    )
    if payload.source_field not in {field.source_field for field in available}:
        raise HTTPException(status_code=422, detail="The selected Kobo question is not available in this project.")
    mapping = db.exec(select(IndicatorMapping).where(IndicatorMapping.indicator_id == indicator.id)).first()
    if mapping is None:
        mapping = IndicatorMapping(
            organization_id=indicator.organization_id,
            project_id=indicator.project_id,
            indicator_id=indicator.id,
            **payload.model_dump(),
        )
    else:
        for field, value in payload.model_dump().items():
            setattr(mapping, field, value)
        mapping.updated_at = datetime.now(UTC)
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return _mapping_read(mapping)


@router.delete("/indicators/{indicator_id}/mapping", status_code=status.HTTP_204_NO_CONTENT, tags=["M&E indicators"])
def delete_mapping(indicator_id: UUID, user: CurrentUser, db: Database) -> Response:
    indicator = _indicator_for_admin(indicator_id, user, db)
    mapping = db.exec(select(IndicatorMapping).where(IndicatorMapping.indicator_id == indicator.id)).first()
    if mapping:
        db.delete(mapping)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/indicators/{indicator_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["M&E indicators"])
def delete_indicator(indicator_id: UUID, user: CurrentUser, db: Database) -> Response:
    indicator = _indicator_for_admin(indicator_id, user, db)
    mapping = db.exec(select(IndicatorMapping).where(IndicatorMapping.indicator_id == indicator.id)).first()
    if mapping:
        db.delete(mapping)
        db.flush()
    db.delete(indicator)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
