from pathlib import Path
p=Path('fieldsight-backend/app/routes/indicators.py');s=p.read_text()
s=s.replace('            "mapping": mapping.model_dump', '            "period_targets": {row.period: row.target_value for row in db.exec(select(IndicatorPeriodTarget).where(IndicatorPeriodTarget.indicator_id == indicator.id)).all()},\n            "mapping": mapping.model_dump',1)
s=s.replace('    db: Database,\n) -> list[IndicatorPeriodTargetInput]:\n    import re','    db: Database,\n    confirm_change: bool = False, change_reason: str | None = None, expected_version: int | None = None,\n) -> list[IndicatorPeriodTargetInput]:\n    import re',1)
s=s.replace('    for stored_target in db.exec(', '    previous = _definition(indicator, db)\n    preview = _change_preview(indicator, {}, db)\n    for stored_target in db.exec(',1)
s=s.replace('        db.add(IndicatorPeriodTarget(indicator_id=indicator.id, **item.model_dump()))\n    db.commit()', '''        db.add(IndicatorPeriodTarget(indicator_id=indicator.id, **item.model_dump()))
    db.flush()
    preview["after"] = _read(indicator, db).model_dump(mode="json")
    _record_change(indicator, user, db, previous, {"confirm_change": confirm_change,
        "change_reason": change_reason, "expected_version": expected_version}, preview)
    db.add(indicator)
    db.commit()''',1)
pos=s.index('@router.put("/indicators/{indicator_id}/period-targets"')
s=s[:pos]+'''@router.post("/indicators/{indicator_id}/period-targets-preview")
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


''' +s[pos:]
s=s.replace('    confirm_change: bool = False, change_reason: str | None = None, expected_version: int | None = None,\n) -> list', '    confirm_change: bool = False, change_reason: str | None = None, expected_version: int | None = None,\n    _commit: bool = True,\n) -> list',1)
s=s.replace('    db.commit()\n    return sorted(payload, key=lambda item: item.period)','    if _commit:\n        db.commit()\n    return sorted(payload, key=lambda item: item.period)',1)
# no direct deletion of history FKs on deleting indicator required
s=s.replace('    mapping = _mapping(indicator, db)\n    for target in db.exec(', '    mapping = _mapping(indicator, db)\n    for version in db.exec(select(IndicatorDefinitionVersion).where(IndicatorDefinitionVersion.indicator_id == indicator.id)).all():\n        db.delete(version)\n    for target in db.exec(',1)
p.write_text(s)
p=Path('fieldsight-frontend/src/services/apiClient.ts');s=p.read_text(encoding='utf-8');s=s.replace('    targets: Array<{ period: string; target_value: number }>,\n  ) =>','    targets: Array<{ period: string; target_value: number }>,\n    controls?: {confirm_change: boolean; change_reason: string; expected_version: number},\n  ) =>',1)
s=s.replace('`/indicators/${id}/period-targets`,\n      { method: "PUT"','`/indicators/${id}/period-targets${controls ? `?confirm_change=true&change_reason=${encodeURIComponent(controls.change_reason)}&expected_version=${controls.expected_version}` : ""}`,\n      { method: "PUT"',1)
s=s.replace('  indicatorMappingPreview:', '  indicatorTargetsPreview: (id: string, input: Array<{period: string; target_value: number}>) => request<{ expected_version: number; affected_periods: string[]; before: Indicator; after: Indicator; notice: string }>(`/indicators/${id}/period-targets-preview`, { method: "POST", body: JSON.stringify(input) }),\n  indicatorMappingPreview:',1)
p.write_text(s,encoding='utf-8')
