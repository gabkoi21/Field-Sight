"""Authorized indicator definitions, explicit source mappings and result frameworks."""

from datetime import UTC, date, datetime
from typing import Annotated, Any, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.core.indicator_policy import LINKED_METHODS, MANUAL_METHODS, incompatibility
from app.core.indicator_results import read_result
from app.core.survey import flatten_answers, number
from app.db.session import get_session
from app.models.identity import User
from app.models.operations import (
    Indicator,
    IndicatorDefinitionVersion,
    IndicatorMapping,
    IndicatorPeriodTarget,
    Project,
    ResultFrameworkNode,
)
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


def _read_raw(
    indicator: Indicator, db: Session, date_from: date | None = None, date_to: date | None = None
) -> IndicatorRead:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    mapping = _mapping(indicator, db)
    project = db.get(Project, indicator.project_id)
    assert project is not None
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
    if mapping is None:
        return read_result(indicator, None, [], None, None, "unmapped", date_from, date_to)
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


def _read(
    indicator: Indicator, db: Session, date_from: date | None = None, date_to: date | None = None
) -> IndicatorRead:
    result = _read_raw(indicator, db, date_from, date_to)
    mapping = _mapping(indicator, db)
    warning = incompatibility(indicator.unit, mapping.calculation) if mapping else None
    result.legacy_definition = indicator.reliability_policy == 0 or bool(warning)
    if warning:
        result.definition_warnings.append("Legacy definition retained: " + warning)
    if indicator.reliability_policy == 0:
        result.definition_warnings.append("Legacy definition; original selection and approval are unknown.")
    result.setup_complete = bool(
        mapping
        and not warning
        and result.mapping_health == "healthy"
        or not mapping
        and indicator.manual_aggregation in MANUAL_METHODS[indicator.unit]
    )
    if mapping:
        result.result_source = "table"
    if not mapping:
        result.result_source = (
            "manual" if indicator.manual_aggregation != "legacy" or result.manual_result_count else "unconfigured"
        )
    if indicator.baseline_value is not None and indicator.target_value is not None:
        delta = indicator.target_value - indicator.baseline_value
        if delta == 0 or (delta > 0) != (indicator.direction == "increase"):
            result.definition_warnings.append(
                "Baseline, target and desired direction conflict; "
                "explain any deliberate exception in the change reason."
            )
    if indicator.definition_version:
        result.calculation_note += (
            f" Current data recalculated under definition v{indicator.definition_version}. "
            "Retained definitions are not frozen source-data snapshots."
        )
    return result


DEFINITION_FIELDS = {
    "unit",
    "manual_aggregation",
    "manual_rate_multiplier",
    "baseline_value",
    "target_value",
    "target_date",
    "direction",
    "reporting_frequency",
    "is_active",
}
CONTROL_FIELDS = {"change_reason", "confirm_change", "expected_version"}


def _definition(indicator: Indicator, db: Session) -> dict:
    from fastapi.encoders import jsonable_encoder

    mapping = _mapping(indicator, db)
    return cast(
        dict,
        jsonable_encoder(
            {
                **{key: getattr(indicator, key) for key in DEFINITION_FIELDS},
                "period_targets": {row.period: row.target_value for row in db.exec(select(IndicatorPeriodTarget).where(IndicatorPeriodTarget.indicator_id == indicator.id)).all()},
            "mapping": mapping.model_dump(exclude={"id", "created_at", "updated_at"}) if mapping else None,
            }
        ),
    )


def _change_preview(indicator: Indicator, changes: dict, db: Session) -> dict:
    before = _read(indicator, db)
    candidate = Indicator.model_validate(indicator.model_dump())
    for key, value in changes.items():
        if key in DEFINITION_FIELDS:
            setattr(candidate, key, value)
    after = _read(candidate, db)
    return {
        "expected_version": indicator.definition_version,
        "affected_periods": [point.period for point in before.history],
        "before": before.model_dump(mode="json"),
        "after": after.model_dump(mode="json"),
        "notice": "Current data recalculated under each definition; this is not a frozen historical data snapshot.",
        "effective_scope": "current_definition_all_periods",
    }


def _record_change(
    indicator: Indicator, user: User, db: Session, previous: dict, controls: dict, preview: dict
) -> None:
    if previous == _definition(indicator, db):
        return
    if controls.get("expected_version") is not None and controls["expected_version"] != indicator.definition_version:
        raise HTTPException(409, "Definition changed since preview. Refresh the preview before saving.")
    has_results = bool(
        preview["before"]["history"]
        or preview["before"]["eligible_records"]
        or preview["before"]["manual_result_count"]
        or preview["before"]["quality_excluded_records"]
    )
    if has_results and (
        not controls.get("confirm_change")
        or not (controls.get("change_reason") or "").strip()
        or controls.get("expected_version") != indicator.definition_version
    ):
        raise HTTPException(409, "Preview this definition change, then confirm with a reason and expected_version.")
    indicator.definition_version += 1
    db.add(
        IndicatorDefinitionVersion(
            indicator_id=indicator.id,
            organization_id=indicator.organization_id,
            actor_id=user.id,
            version=indicator.definition_version,
            previous_definition=previous,
            new_definition=_definition(indicator, db),
            reason=controls.get("change_reason") or "Initial configuration without results",
            preview=preview,
        )
    )


@router.get("/indicator-calculation-policy")
def calculation_policy(user: CurrentUser, db: Database) -> dict:
    _organization_admin_id(user, db)
    return {"linked": LINKED_METHODS, "manual": MANUAL_METHODS}


@router.post("/indicators/{indicator_id}/definition-preview")
def definition_preview(indicator_id: UUID, payload: IndicatorUpdate, user: CurrentUser, db: Database) -> dict:
    return _change_preview(_indicator(indicator_id, user, db), payload.model_dump(exclude_unset=True), db)


@router.post("/indicators/{indicator_id}/mapping-preview")
def mapping_preview(indicator_id: UUID, payload: IndicatorMappingWrite, user: CurrentUser, db: Database) -> dict:
    indicator = _indicator(indicator_id, user, db)
    if error := incompatibility(indicator.unit, payload.calculation):
        raise HTTPException(422, error)
    project = db.get(Project, indicator.project_id)
    assert project is not None
    values = _validate_mapping(project, payload, db)
    preview = _change_preview(indicator, {}, db)
    with db.begin_nested() as transaction:
        mapping = _mapping(indicator, db)
        if mapping:
            for key, value in values.items():
                setattr(mapping, key, value)
        else:
            mapping = IndicatorMapping(
                organization_id=indicator.organization_id,
                project_id=indicator.project_id,
                indicator_id=indicator.id,
                **values,
            )
        db.add(mapping)
        db.flush()
        preview["after"] = _read(indicator, db).model_dump(mode="json")
        transaction.rollback()
    return preview


@router.get("/indicators/{indicator_id}/versions")
def definition_versions(
    indicator_id: UUID, user: CurrentUser, db: Database, offset: int = 0, limit: int = 25
) -> list[IndicatorDefinitionVersion]:
    indicator = _indicator(indicator_id, user, db)
    return list(
        db.exec(
            select(IndicatorDefinitionVersion)
            .where(
                IndicatorDefinitionVersion.indicator_id == indicator.id,
                IndicatorDefinitionVersion.organization_id == indicator.organization_id,
            )
            .order_by(col(IndicatorDefinitionVersion.version).desc())
            .offset(max(0, offset))
            .limit(max(1, min(limit, 100)))
        ).all()
    )


@router.get("/indicators/{indicator_id}/evidence")
def indicator_evidence(
    indicator_id: UUID,
    user: CurrentUser,
    db: Database,
    offset: int = 0,
    limit: int = 25,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    from sqlalchemy import func

    from app.core.indicator_results import calculate
    from app.core.review_evidence import eligible
    from app.core.survey import build_catalogue
    from app.models.operations import FieldMapping, Submission, SurveySchema
    from app.schemas.analysis import SurveyField

    indicator = _indicator(indicator_id, user, db)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Start date must be on or before end date.")
    mapping = _mapping(indicator, db)
    limit, offset = max(1, min(limit, 100)), max(0, offset)
    if mapping:
        project = db.get(Project, indicator.project_id)
        assert project is not None
        form_id = mapping.source_form_id or project.kobo_form_id
        # Never guess a legacy mapping's provenance when multiple forms exist.
        forms = list(
            db.exec(
                select(Submission.kobo_form_id)
                .where(
                    Submission.project_id == indicator.project_id,
                    Submission.organization_id == indicator.organization_id,
                )
                .distinct()
            ).all()
        )
        if (
            not mapping.source_form_id
            and len(set(forms) | ({project.kobo_form_id} if project.kobo_form_id else set())) > 1
        ):
            return {"source": "table", "health": "broken_mapping", "items": [], "total": 0}
        form_id = form_id or (forms[0] if len(forms) == 1 else None)
        filters: list[Any] = [
            Submission.organization_id == indicator.organization_id,
            Submission.project_id == indicator.project_id,
            Submission.kobo_form_id == form_id,
        ]
        if date_from:
            filters.append(col(Submission.submitted_at) >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            from datetime import timedelta

            filters.append(
                col(Submission.submitted_at) < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
            )
        total = db.exec(select(func.count()).select_from(Submission).where(*filters)).one()
        rows = list(
            db.exec(
                select(Submission)
                .where(*filters)
                .order_by(
                    col(Submission.submitted_at).desc(), col(Submission.created_at).desc(), col(Submission.id).desc()
                )
                .offset(offset)
                .limit(limit)
            ).all()
        )
        cache = db.exec(
            select(SurveySchema).where(
                SurveySchema.project_id == indicator.project_id,
                SurveySchema.organization_id == indicator.organization_id,
                SurveySchema.form_id == form_id,
            )
        ).first()
        mappings = list(
            db.exec(
                select(FieldMapping).where(
                    FieldMapping.project_id == indicator.project_id,
                    FieldMapping.organization_id == indicator.organization_id,
                )
            ).all()
        )
        fields = build_catalogue(
            rows, mappings, [SurveyField.model_validate(f) for f in cache.fields_json] if cache else []
        )
        field = next((f for f in fields if f.source_field == mapping.source_field), None)
        items = []
        for row in rows:
            result = calculate(mapping, [row], field, unit=indicator.unit if indicator.reliability_policy else None)
            reason = (
                "quality_excluded"
                if not eligible(row)
                else "broken_mapping"
                if not field
                else "missing_answer"
                if result.missing_records
                else "invalid_answer"
                if result.invalid_answers
                else None
            )
            included = (
                eligible(row) and field is not None and (mapping.calculation == "count_records" or reason is None)
            )
            items.append(
                {
                    "id": str(row.id),
                    "date": row.submitted_at,
                    "updated_at": row.updated_at,
                    "author": row.enumerator,
                    "location": row.location,
                    "answer": flatten_answers(row.raw_answers).get(mapping.source_field),
                    "included": included,
                    "reason": None if included else reason,
                }
            )
        source = "table"
    else:
        filters = [
            CollectedResult.indicator_id == indicator.id,
            CollectedResult.organization_id == indicator.organization_id,
        ]
        if date_from:
            filters.append(CollectedResult.result_date >= date_from)
        if date_to:
            filters.append(CollectedResult.result_date <= date_to)
        total = db.exec(select(func.count()).select_from(CollectedResult).where(*filters)).one()
        manual_rows = list(
            db.exec(
                select(CollectedResult)
                .where(*filters)
                .order_by(
                    col(CollectedResult.result_date).desc(),
                    col(CollectedResult.created_at).desc(),
                    col(CollectedResult.id).desc(),
                )
                .offset(offset)
                .limit(limit)
            ).all()
        )
        items = [{**row.model_dump(mode="json"), "included": True, "reason": None} for row in manual_rows]
        source = "manual" if total or indicator.manual_aggregation != "legacy" else "unconfigured"
    return {
        "source": source,
        "method": mapping.calculation if mapping else indicator.manual_aggregation,
        "form": mapping.source_form_id if mapping else None,
        "question": mapping.source_field if mapping else None,
        "definition_version": indicator.definition_version,
        "date_from": date_from,
        "date_to": date_to,
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": items,
        "notice": "Live evidence under the current definition; definition history does not freeze source data.",
    }


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
    return {**payload.model_dump(exclude=CONTROL_FIELDS), "source_form_id": catalogue.form_id}


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
    if payload.manual_aggregation != "legacy" and payload.manual_aggregation not in MANUAL_METHODS[payload.unit]:
        raise HTTPException(422, "Choose a manual method compatible with the indicator unit.")
    mapping_values = _validate_mapping(project, payload.mapping, db) if payload.mapping else None
    if mapping_values and (error := incompatibility(payload.unit, mapping_values["calculation"])):
        raise HTTPException(422, error)
    if payload.is_active and not mapping_values and payload.manual_aggregation == "legacy":
        raise HTTPException(422, "Choose an explicit manual aggregation before activation.")
    if payload.unit == "text" and mapping_values:
        raise HTTPException(422, "Use manual narratives for qualitative indicators.")
    indicator = Indicator(
        organization_id=project.organization_id,
        project_id=project.id,
        created_by_id=user.id,
        reliability_policy=1,
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
    controls = payload.model_dump()
    changes = payload.model_dump(exclude_unset=True, exclude=CONTROL_FIELDS)
    previous = _definition(indicator, db)
    preview = _change_preview(indicator, changes, db)
    method = changes.get("manual_aggregation", indicator.manual_aggregation)
    unit = changes.get("unit", indicator.unit)
    if method != "legacy" and method not in MANUAL_METHODS[unit]:
        raise HTTPException(422, "Choose a manual method compatible with the indicator unit.")
    mapping = _mapping(indicator, db)
    if mapping and unit != indicator.unit and (error := incompatibility(unit, mapping.calculation)):
        raise HTTPException(422, error)
    if changes.get("is_active") and indicator.reliability_policy and not mapping and method == "legacy":
        raise HTTPException(422, "Choose an explicit manual aggregation before activation.")
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
    with db.no_autoflush:
        _record_change(indicator, user, db, previous, controls, preview)
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
    if error := incompatibility(indicator.unit, payload.calculation):
        raise HTTPException(422, error)
    previous = _definition(indicator, db)
    preview = _change_preview(indicator, {}, db)
    project = db.get(Project, indicator.project_id)
    assert project
    assert project is not None
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
    db.flush()
    preview["after"] = _read(indicator, db).model_dump(mode="json")
    _record_change(indicator, user, db, previous, payload.model_dump(), preview)
    db.add(indicator)
    db.commit()
    return IndicatorMappingRead.model_validate(mapping, from_attributes=True)


@router.delete("/indicators/{indicator_id}/mapping", status_code=204)
def delete_mapping(
    indicator_id: UUID,
    user: CurrentUser,
    db: Database,
    confirm_change: bool = False,
    change_reason: str | None = None,
    expected_version: int | None = None,
) -> Response:
    indicator = _indicator(indicator_id, user, db)
    mapping = _mapping(indicator, db)
    if mapping:
        previous = _definition(indicator, db)
        preview = _change_preview(indicator, {}, db)
        db.delete(mapping)
        db.flush()
        preview["after"] = _read(indicator, db).model_dump(mode="json")
        _record_change(
            indicator,
            user,
            db,
            previous,
            {"confirm_change": confirm_change, "change_reason": change_reason, "expected_version": expected_version},
            preview,
        )
        db.add(indicator)
        db.commit()
    return Response(status_code=204)


@router.delete("/indicators/{indicator_id}", status_code=204)
def delete_indicator(indicator_id: UUID, user: CurrentUser, db: Database) -> Response:
    indicator = _indicator(indicator_id, user, db)
    mapping = _mapping(indicator, db)
    for version in db.exec(select(IndicatorDefinitionVersion).where(IndicatorDefinitionVersion.indicator_id == indicator.id)).all():
        db.delete(version)
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


@router.post("/indicators/{indicator_id}/period-targets-preview")
def period_targets_preview(indicator_id: UUID, payload: list[IndicatorPeriodTargetInput],
                           user: CurrentUser, db: Database) -> dict:
    indicator = _indicator(indicator_id, user, db)
    preview = _change_preview(indicator, {}, db)
    with db.begin_nested() as transaction:
        replace_period_targets(indicator_id, payload, user, db, True, "Preview only", indicator.definition_version,
                               _commit=False)
        preview["after"] = _read(indicator, db).model_dump(mode="json")
        transaction.rollback()
    return preview


@router.put("/indicators/{indicator_id}/period-targets", response_model=list[IndicatorPeriodTargetInput])
def replace_period_targets(
    indicator_id: UUID,
    payload: list[IndicatorPeriodTargetInput],
    user: CurrentUser,
    db: Database,
    confirm_change: bool = False, change_reason: str | None = None, expected_version: int | None = None,
    _commit: bool = True,
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
    previous = _definition(indicator, db)
    preview = _change_preview(indicator, {}, db)
    for stored_target in db.exec(
        select(IndicatorPeriodTarget).where(IndicatorPeriodTarget.indicator_id == indicator.id)
    ).all():
        db.delete(stored_target)
    db.flush()
    for item in payload:
        db.add(IndicatorPeriodTarget(indicator_id=indicator.id, **item.model_dump()))
    db.flush()
    preview["after"] = _read(indicator, db).model_dump(mode="json")
    _record_change(indicator, user, db, previous, {"confirm_change": confirm_change,
        "change_reason": change_reason, "expected_version": expected_version}, preview)
    db.add(indicator)
    if _commit:
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
