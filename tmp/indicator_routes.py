from pathlib import Path
p=Path('fieldsight-backend/app/routes/indicators.py');s=p.read_text()
s=s.replace('from app.core.indicator_results import read_result','from app.core.indicator_policy import LINKED_METHODS, MANUAL_METHODS, incompatibility\nfrom app.core.indicator_results import read_result')
s=s.replace('Indicator, IndicatorMapping, IndicatorPeriodTarget, Project, ResultFrameworkNode','Indicator, IndicatorDefinitionVersion, IndicatorMapping, IndicatorPeriodTarget, Project, ResultFrameworkNode')
s=s.replace('def _read(\n','def _read_raw(\n',1)
pos=s.index('\ndef _validate_mapping')
s=s[:pos]+'''

def _read(indicator: Indicator, db: Session, date_from: date | None = None,
          date_to: date | None = None) -> IndicatorRead:
    result = _read_raw(indicator, db, date_from, date_to)
    mapping = _mapping(indicator, db)
    warning = incompatibility(indicator.unit, mapping.calculation) if mapping else None
    result.legacy_definition = indicator.reliability_policy == 0 or bool(warning)
    if warning:
        result.definition_warnings.append("Legacy definition retained: " + warning)
    if indicator.reliability_policy == 0:
        result.definition_warnings.append("Legacy definition; original selection and approval are unknown.")
    result.setup_complete = bool(
        mapping and not warning and result.mapping_health == "healthy"
        or not mapping and indicator.manual_aggregation in MANUAL_METHODS[indicator.unit]
    )
    if not mapping:
        result.result_source = "manual" if indicator.manual_aggregation != "legacy" or result.manual_result_count else "unconfigured"
    if indicator.baseline_value is not None and indicator.target_value is not None:
        delta = indicator.target_value - indicator.baseline_value
        if delta == 0 or (delta > 0) != (indicator.direction == "increase"):
            result.definition_warnings.append("Baseline, target and desired direction conflict; explain any deliberate exception in the change reason.")
    return result


DEFINITION_FIELDS = {"unit", "manual_aggregation", "manual_rate_multiplier", "baseline_value",
                     "target_value", "target_date", "direction", "reporting_frequency"}
CONTROL_FIELDS = {"change_reason", "confirm_change", "expected_version"}


def _definition(indicator: Indicator, db: Session) -> dict:
    from fastapi.encoders import jsonable_encoder
    mapping = _mapping(indicator, db)
    return jsonable_encoder({**{key: getattr(indicator, key) for key in DEFINITION_FIELDS},
                             "mapping": mapping.model_dump(exclude={"id", "created_at", "updated_at"}) if mapping else None})


def _change_preview(indicator: Indicator, changes: dict, db: Session) -> dict:
    before = _read(indicator, db)
    candidate = Indicator.model_validate(indicator.model_dump())
    for key, value in changes.items():
        if key in DEFINITION_FIELDS:
            setattr(candidate, key, value)
    after = _read(candidate, db)
    return {"expected_version": indicator.definition_version,
            "affected_periods": [point.period for point in before.history],
            "before": before.model_dump(mode="json"), "after": after.model_dump(mode="json"),
            "notice": "Current data recalculated under each definition; this is not a frozen historical data snapshot.",
            "effective_scope": "current_definition_all_periods"}


def _record_change(indicator: Indicator, user: User, db: Session, previous: dict,
                   controls: dict, preview: dict) -> None:
    if previous == _definition(indicator, db):
        return
    has_results = bool(preview["before"]["history"] or preview["before"]["eligible_records"]
                       or preview["before"]["manual_result_count"])
    if has_results and (not controls.get("confirm_change") or not (controls.get("change_reason") or "").strip()
                        or controls.get("expected_version") != indicator.definition_version):
        raise HTTPException(409, "Preview this definition change, then confirm with a reason and expected_version.")
    indicator.definition_version += 1
    db.add(IndicatorDefinitionVersion(
        indicator_id=indicator.id, organization_id=indicator.organization_id, actor_id=user.id,
        version=indicator.definition_version, previous_definition=previous,
        new_definition=_definition(indicator, db), reason=controls.get("change_reason") or "Initial configuration without results",
        preview=preview,
    ))


@router.get("/indicator-calculation-policy")
def calculation_policy(user: CurrentUser, db: Database) -> dict:
    _organization_admin_id(user, db)
    return {"linked": LINKED_METHODS, "manual": MANUAL_METHODS}


@router.post("/indicators/{indicator_id}/definition-preview")
def definition_preview(indicator_id: UUID, payload: IndicatorUpdate, user: CurrentUser, db: Database) -> dict:
    return _change_preview(_indicator(indicator_id, user, db), payload.model_dump(exclude_unset=True), db)


@router.get("/indicators/{indicator_id}/versions")
def definition_versions(indicator_id: UUID, user: CurrentUser, db: Database,
                        offset: int = 0, limit: int = 25) -> list[IndicatorDefinitionVersion]:
    indicator = _indicator(indicator_id, user, db)
    return list(db.exec(select(IndicatorDefinitionVersion).where(
        IndicatorDefinitionVersion.indicator_id == indicator.id,
        IndicatorDefinitionVersion.organization_id == indicator.organization_id,
    ).order_by(col(IndicatorDefinitionVersion.version).desc()).offset(max(0, offset)).limit(max(1, min(limit, 100)))).all())
''' +s[pos:]
s=s.replace('return {**payload.model_dump(), "source_form_id": catalogue.form_id}','return {**payload.model_dump(exclude=CONTROL_FIELDS), "source_form_id": catalogue.form_id}')
s=s.replace('    if payload.manual_aggregation != "legacy" and payload.unit not in {"percentage", "rate", "ratio"}:\n        raise HTTPException(422, "Manual mean and pooling apply only to percentages, rates and ratios.")','    if payload.manual_aggregation != "legacy" and payload.manual_aggregation not in MANUAL_METHODS[payload.unit]:\n        raise HTTPException(422, "Choose a manual method compatible with the indicator unit.")')
s=s.replace('    if payload.unit == "text" and mapping_values:','    if mapping_values and (error := incompatibility(payload.unit, mapping_values["calculation"])):\n        raise HTTPException(422, error)\n    if payload.is_active and not mapping_values and payload.manual_aggregation == "legacy":\n        raise HTTPException(422, "Choose an explicit manual aggregation before activation.")\n    if payload.unit == "text" and mapping_values:')
s=s.replace('        created_by_id=user.id,\n        **payload.model_dump', '        created_by_id=user.id,\n        reliability_policy=1,\n        **payload.model_dump',1)
s=s.replace('    changes = payload.model_dump(exclude_unset=True)\n    method', '    controls = payload.model_dump()\n    changes = payload.model_dump(exclude_unset=True, exclude=CONTROL_FIELDS)\n    previous = _definition(indicator, db)\n    preview = _change_preview(indicator, changes, db)\n    method',1)
a=s.index('    if method != "legacy"');b=s.index('    period_targets =',a)
s=s[:a]+'''    unit = changes.get("unit", indicator.unit)
    if method != "legacy" and method not in MANUAL_METHODS[unit]:
        raise HTTPException(422, "Choose a manual method compatible with the indicator unit.")
    mapping = _mapping(indicator, db)
    if mapping and unit != indicator.unit and (error := incompatibility(unit, mapping.calculation)):
        raise HTTPException(422, error)
    if changes.get("is_active") and indicator.reliability_policy and not mapping and method == "legacy":
        raise HTTPException(422, "Choose an explicit manual aggregation before activation.")
''' +s[b:]
s=s.replace('    indicator.updated_at = datetime.now(UTC)\n    db.add(indicator)','    _record_change(indicator, user, db, previous, controls, preview)\n    indicator.updated_at = datetime.now(UTC)\n    db.add(indicator)',1)
s=s.replace('    if db.exec(select(CollectedResult).where(CollectedResult.indicator_id == indicator.id)).first():\n        raise HTTPException(409, "Remove manual results before switching this indicator to a linked table source.")','    if error := incompatibility(indicator.unit, payload.calculation):\n        raise HTTPException(422, error)\n    previous = _definition(indicator, db)\n    preview = _change_preview(indicator, {}, db)')
s=s.replace('    db.add(mapping)\n    db.commit()','    db.add(mapping)\n    db.flush()\n    preview["after"] = _read(indicator, db).model_dump(mode="json")\n    _record_change(indicator, user, db, previous, payload.model_dump(), preview)\n    db.add(indicator)\n    db.commit()',1)
p.write_text(s)
