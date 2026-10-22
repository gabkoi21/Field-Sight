"""Authorized indicator definitions, explicit source mappings and result frameworks."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.core.indicator_results import read_result
from app.core.survey import flatten_answers, number
from app.db.session import get_session
from app.models.identity import User
from app.models.operations import Indicator, IndicatorMapping, IndicatorPeriodTarget, Project, ResultFrameworkNode
from app.models.workspace import CollectedResult
from app.routes.analysis import _catalogue
from app.routes.auth import get_current_user
from app.routes.intelligence import _project
from app.routes.kobo import _organization_admin_id
from app.schemas.indicators import (
    FrameworkNodeInput,
    FrameworkNodeRead,
    IndicatorCreate,
    IndicatorFieldRead,
    IndicatorMappingRead,
    IndicatorMappingWrite,
    IndicatorPeriodTargetInput,
    IndicatorRead,
    IndicatorUpdate,
)

router = APIRouter(tags=["M&E indicators"])
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
LEVELS = {"goal": 0, "objective": 1, "outcome": 2, "output": 3, "activity": 4}


def _indicator(indicator_id: UUID, user: User, db: Session) -> Indicator:
    organization_id = _organization_admin_id(user, db)
    indicator = db.get(Indicator, indicator_id)
    if indicator is None or indicator.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Indicator was not found.")
    _project(indicator.project_id, user, db)
    return indicator


def _node(node_id: UUID, project: Project, db: Session) -> ResultFrameworkNode:
    node = db.get(ResultFrameworkNode, node_id)
    if node is None or node.project_id != project.id or node.organization_id != project.organization_id:
        raise HTTPException(status_code=404, detail="Framework item was not found in this project.")
    return node


def _mapping(indicator: Indicator, db: Session) -> IndicatorMapping | None:
    return db.exec(select(IndicatorMapping).where(IndicatorMapping.indicator_id == indicator.id)).first()


def _read(
    indicator: Indicator, db: Session, date_from: date | None = None, date_to: date | None = None
) -> IndicatorRead:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    mapping = _mapping(indicator, db)
    project = db.get(Project, indicator.project_id)
    assert project is not None
    # Legacy mappings without provenance are usable only when the project has
    # a single known form. Never silently switch an existing mapping to a new form.
    try:
        catalogue, records, _ = _catalogue(project, mapping.source_form_id if mapping else None, db)
    except HTTPException as exc:
        if mapping and exc.status_code == 422:
            return read_result(indicator, mapping, [], None, mapping.source_form_id, "form_missing", date_from, date_to)
        raise
    health: Literal["unmapped", "healthy", "field_missing", "form_missing", "unsupported", "type_mismatch"] = "unmapped"
    field = next((item for item in catalogue.fields if mapping and item.source_field == mapping.source_field), None)
    if mapping:
        health = "healthy"
        if not mapping.source_form_id and len(catalogue.forms) > 1:
            health = "form_missing"
        elif field is None:
            health = "field_missing"
        elif not field.supported or field.type == "geopoint":
            health = "unsupported"
        elif mapping.calculation in {"sum", "average"} and field.type != "number" and field.source != "inferred":
            health = "type_mismatch"
    targets = {
        item.period: item.target_value
        for item in db.exec(
            select(IndicatorPeriodTarget).where(
                IndicatorPeriodTarget.indicator_id == indicator.id,
            )
        ).all()
    }
    manual = db.exec(
        select(CollectedResult)
        .where(CollectedResult.indicator_id == indicator.id)
        .order_by(col(CollectedResult.result_date), col(CollectedResult.created_at))
    ).all()
    if mapping is None and manual:
        from app.core.collected_results import manual_result

        return manual_result(indicator, manual, targets, date_from, date_to)
    result = read_result(
        indicator,
        mapping,
        records,
        field,
        catalogue.form_id,
        health,
        date_from,
        date_to,
        period_targets=targets,
    )
    result.result_source = "table" if mapping else "unconfigured"
    return result


def _validate_mapping(project: Project, payload: IndicatorMappingWrite, db: Session) -> dict:
    catalogue, records, _ = _catalogue(project, payload.source_form_id, db)
    field = next((item for item in catalogue.fields if item.source_field == payload.source_field), None)
    if field is None:
        raise HTTPException(status_code=422, detail="Choose a question from the selected form's field catalogue.")
    if not field.supported or field.type == "geopoint":
        raise HTTPException(
            status_code=422, detail="Repeat groups and coordinates cannot be used as scalar indicator answers."
        )
    if payload.calculation in {"sum", "average"} and field.type != "number":
        numeric_observed = field.source == "inferred" and any(
            number(flatten_answers(record.raw_answers).get(payload.source_field)) is not None for record in records
        )
        if not numeric_observed:
            raise HTTPException(status_code=422, detail="Sum and average require a numeric question.")
    if payload.calculation in {"count_matching", "percentage_matching"} and field.choices:
        if (payload.match_value or "").casefold() not in {choice.value.casefold() for choice in field.choices}:
            raise HTTPException(status_code=422, detail="Choose an expected answer code from this question's choices.")
    return {**payload.model_dump(), "source_form_id": catalogue.form_id}


def _validate_definition(unit: str, baseline: float | None, target: float | None) -> None:
    if unit == "text" and (baseline is not None or target is not None):
        raise HTTPException(422, "Qualitative indicators do not have numeric baselines or targets.")
    if unit == "percentage" and any(value is not None and not 0 <= value <= 100 for value in (baseline, target)):
        raise HTTPException(status_code=422, detail="Percentage baselines and targets must be between 0 and 100.")


@router.get("/projects/{project_id}/indicator-fields", response_model=list[IndicatorFieldRead])
def indicator_fields(
    project_id: UUID, user: CurrentUser, db: Database, form_id: str | None = None
) -> list[IndicatorFieldRead]:
    project = _project(project_id, user, db)
    catalogue, _, _ = _catalogue(project, form_id, db)
    return [
        IndicatorFieldRead(
            source_field=field.source_field,
            label=field.label,
            type=field.type,
            choices=field.choices,
            form_id=catalogue.form_id,
            supported=field.supported and field.type != "geopoint",
        )
        for field in catalogue.fields
    ]


@router.get("/projects/{project_id}/indicators", response_model=list[IndicatorRead])
def list_indicators(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[IndicatorRead]:
    project = _project(project_id, user, db)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    indicators = db.exec(
        select(Indicator)
        .where(Indicator.project_id == project.id)
        .order_by(
            col(Indicator.is_active).desc(),
            Indicator.name,
        )
    ).all()
    return [_read(indicator, db, date_from, date_to) for indicator in indicators]


@router.post("/projects/{project_id}/indicators", response_model=IndicatorRead, status_code=201)
def create_indicator(project_id: UUID, payload: IndicatorCreate, user: CurrentUser, db: Database) -> IndicatorRead:
    project = _project(project_id, user, db)
    if payload.framework_node_id:
        _node(payload.framework_node_id, project, db)
    _validate_definition(payload.unit, payload.baseline_value, payload.target_value)
    mapping_values = _validate_mapping(project, payload.mapping, db) if payload.mapping else None
    if payload.unit == "text" and mapping_values:
        raise HTTPException(422, "Use manual narratives for qualitative indicators.")
    indicator = Indicator(
        organization_id=project.organization_id,
        project_id=project.id,
        created_by_id=user.id,
        **payload.model_dump(exclude={"mapping"}),
    )
    db.add(indicator)
    try:
        db.flush()
        if mapping_values:
            db.add(
                IndicatorMapping(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    indicator_id=indicator.id,
                    **mapping_values,
                )
            )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="An indicator with this code already exists in the project."
        ) from exc
    db.refresh(indicator)
    return _read(indicator, db)


@router.get("/indicators/{indicator_id}", response_model=IndicatorRead)
def get_indicator(
    indicator_id: UUID,
    user: CurrentUser,
    db: Database,
    date_from: date | None = None,
    date_to: date | None = None,
) -> IndicatorRead:
    return _read(_indicator(indicator_id, user, db), db, date_from, date_to)


@router.patch("/indicators/{indicator_id}", response_model=IndicatorRead)
def update_indicator(indicator_id: UUID, payload: IndicatorUpdate, user: CurrentUser, db: Database) -> IndicatorRead:
    indicator = _indicator(indicator_id, user, db)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("unit", indicator.unit) != indicator.unit:
        if db.exec(select(CollectedResult).where(CollectedResult.indicator_id == indicator.id)).first():
            raise HTTPException(409, "Remove manual results before changing the indicator unit.")
        if changes["unit"] == "text" and _mapping(indicator, db):
            raise HTTPException(409, "Remove the table mapping before changing to a qualitative indicator.")
    period_targets = db.exec(
        select(IndicatorPeriodTarget).where(IndicatorPeriodTarget.indicator_id == indicator.id)
    ).all()
    if (
        period_targets
        and changes.get("reporting_frequency", indicator.reporting_frequency) != indicator.reporting_frequency
    ):
        raise HTTPException(status_code=409, detail="Clear periodic targets before changing the reporting frequency.")
    for period_target in period_targets:
        _validate_definition(changes.get("unit", indicator.unit), None, period_target.target_value)
    if changes.get("framework_node_id"):
        project = db.get(Project, indicator.project_id)
        assert project
        _node(changes["framework_node_id"], project, db)
    target = changes.get("target_value", indicator.target_value)
    if changes.get("target_date", indicator.target_date) is not None and target is None:
        raise HTTPException(status_code=422, detail="A target value is required when a target date is set.")
    _validate_definition(
        changes.get("unit", indicator.unit), changes.get("baseline_value", indicator.baseline_value), target
    )
    for key, value in changes.items():
        setattr(indicator, key, value)
    indicator.updated_at = datetime.now(UTC)
    db.add(indicator)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="An indicator with this code already exists in the project."
        ) from exc
    return _read(indicator, db)


@router.put("/indicators/{indicator_id}/mapping", response_model=IndicatorMappingRead)
def upsert_mapping(
    indicator_id: UUID, payload: IndicatorMappingWrite, user: CurrentUser, db: Database
) -> IndicatorMappingRead:
    indicator = _indicator(indicator_id, user, db)
    if indicator.unit == "text":
        raise HTTPException(422, "Use manual narratives for qualitative indicators.")
    if db.exec(select(CollectedResult).where(CollectedResult.indicator_id == indicator.id)).first():
        raise HTTPException(409, "Remove manual results before switching this indicator to a linked table source.")
    project = db.get(Project, indicator.project_id)
    assert project
    values = _validate_mapping(project, payload, db)
    mapping = _mapping(indicator, db)
    if mapping is None:
        mapping = IndicatorMapping(
            organization_id=indicator.organization_id,
            project_id=indicator.project_id,
            indicator_id=indicator.id,
            **values,
        )
    else:
        for key, value in values.items():
            setattr(mapping, key, value)
        mapping.updated_at = datetime.now(UTC)
    db.add(mapping)
    db.commit()
    return IndicatorMappingRead.model_validate(mapping, from_attributes=True)


@router.delete("/indicators/{indicator_id}/mapping", status_code=204)
def delete_mapping(indicator_id: UUID, user: CurrentUser, db: Database) -> Response:
    mapping = _mapping(_indicator(indicator_id, user, db), db)
    if mapping:
        db.delete(mapping)
        db.commit()
    return Response(status_code=204)


@router.delete("/indicators/{indicator_id}", status_code=204)
def delete_indicator(indicator_id: UUID, user: CurrentUser, db: Database) -> Response:
    indicator = _indicator(indicator_id, user, db)
    mapping = _mapping(indicator, db)
    for target in db.exec(
        select(IndicatorPeriodTarget).where(IndicatorPeriodTarget.indicator_id == indicator.id)
    ).all():
        db.delete(target)
    if mapping:
        db.delete(mapping)
        db.flush()
    db.delete(indicator)
    db.commit()
    return Response(status_code=204)


@router.get("/indicators/{indicator_id}/period-targets", response_model=list[IndicatorPeriodTargetInput])
def get_period_targets(indicator_id: UUID, user: CurrentUser, db: Database) -> list[IndicatorPeriodTargetInput]:
    indicator = _indicator(indicator_id, user, db)
    rows = db.exec(
        select(IndicatorPeriodTarget)
        .where(IndicatorPeriodTarget.indicator_id == indicator.id)
        .order_by(
            IndicatorPeriodTarget.period,
        )
    ).all()
    return [IndicatorPeriodTargetInput(period=row.period, target_value=row.target_value) for row in rows]


@router.put("/indicators/{indicator_id}/period-targets", response_model=list[IndicatorPeriodTargetInput])
def replace_period_targets(
    indicator_id: UUID,
    payload: list[IndicatorPeriodTargetInput],
    user: CurrentUser,
    db: Database,
) -> list[IndicatorPeriodTargetInput]:
    import re

    indicator = _indicator(indicator_id, user, db)
    patterns = {
        "annual": r"[1-9]\d{3}",
        "semi_annual": r"[1-9]\d{3}-H[12]",
        "quarterly": r"[1-9]\d{3}-Q[1-4]",
        "monthly": r"[1-9]\d{3}-(0[1-9]|1[0-2])",
        "weekly": r"[1-9]\d{3}-W(0[1-9]|[1-4]\d|5[0-3])",
    }
    if len(payload) > 240 or len({item.period for item in payload}) != len(payload):
        raise HTTPException(status_code=422, detail="Provide at most 240 unique period targets.")
    for item in payload:
        if not re.fullmatch(patterns[indicator.reporting_frequency], item.period):
            raise HTTPException(status_code=422, detail="A period does not match this indicator's reporting frequency.")
        if indicator.reporting_frequency == "weekly":
            try:
                date.fromisocalendar(int(item.period[:4]), int(item.period[-2:]), 1)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail="The ISO reporting week is invalid.") from exc
        _validate_definition(indicator.unit, None, item.target_value)
    for stored_target in db.exec(
        select(IndicatorPeriodTarget).where(IndicatorPeriodTarget.indicator_id == indicator.id)
    ).all():
        db.delete(stored_target)
    db.flush()
    for item in payload:
        db.add(IndicatorPeriodTarget(indicator_id=indicator.id, **item.model_dump()))
    db.commit()
    return sorted(payload, key=lambda item: item.period)


@router.get("/projects/{project_id}/results-framework", response_model=list[FrameworkNodeRead])
def get_framework(project_id: UUID, user: CurrentUser, db: Database) -> list[FrameworkNodeRead]:
    project = _project(project_id, user, db)
    nodes = db.exec(
        select(ResultFrameworkNode)
        .where(ResultFrameworkNode.project_id == project.id)
        .order_by(
            col(ResultFrameworkNode.sort_order),
            ResultFrameworkNode.title,
        )
    ).all()
    return [FrameworkNodeRead.model_validate(node, from_attributes=True) for node in nodes]


def _validate_node(
    payload: FrameworkNodeInput, project: Project, db: Session, node: ResultFrameworkNode | None = None
) -> None:
    if payload.parent_id:
        parent = _node(payload.parent_id, project, db)
        if (node and parent.id == node.id) or LEVELS[parent.node_type] >= LEVELS[payload.node_type]:
            raise HTTPException(
                status_code=422, detail="Choose a parent above this result level; cycles are not allowed."
            )
    if node:
        children = db.exec(select(ResultFrameworkNode).where(ResultFrameworkNode.parent_id == node.id)).all()
        if any(LEVELS[child.node_type] <= LEVELS[payload.node_type] for child in children):
            raise HTTPException(status_code=422, detail="This level must remain above all of its children.")


@router.post("/projects/{project_id}/results-framework", response_model=FrameworkNodeRead, status_code=201)
def create_framework_node(
    project_id: UUID, payload: FrameworkNodeInput, user: CurrentUser, db: Database
) -> FrameworkNodeRead:
    project = _project(project_id, user, db)
    _validate_node(payload, project, db)
    node = ResultFrameworkNode(organization_id=project.organization_id, project_id=project.id, **payload.model_dump())
    db.add(node)
    db.commit()
    return FrameworkNodeRead.model_validate(node, from_attributes=True)


@router.put("/projects/{project_id}/results-framework/{node_id}", response_model=FrameworkNodeRead)
def update_framework_node(
    project_id: UUID,
    node_id: UUID,
    payload: FrameworkNodeInput,
    user: CurrentUser,
    db: Database,
) -> FrameworkNodeRead:
    project = _project(project_id, user, db)
    node = _node(node_id, project, db)
    _validate_node(payload, project, db, node)
    for key, value in payload.model_dump().items():
        setattr(node, key, value)
    db.add(node)
    db.commit()
    return FrameworkNodeRead.model_validate(node, from_attributes=True)


@router.delete("/projects/{project_id}/results-framework/{node_id}", status_code=204)
def delete_framework_node(project_id: UUID, node_id: UUID, user: CurrentUser, db: Database) -> Response:
    project = _project(project_id, user, db)
    node = _node(node_id, project, db)
    if (
        db.exec(select(ResultFrameworkNode).where(ResultFrameworkNode.parent_id == node.id)).first()
        or db.exec(select(Indicator).where(Indicator.framework_node_id == node.id)).first()
    ):
        raise HTTPException(
            status_code=409, detail="Move or remove linked indicators and child results before deleting this item."
        )
    db.delete(node)
    db.commit()
    return Response(status_code=204)
