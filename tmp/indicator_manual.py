from pathlib import Path
p=Path('fieldsight-backend/app/core/collected_results.py');s=p.read_text().replace('    eligible = [r for r in rows','    rows = sorted(rows, key=lambda row: (row.result_date, row.created_at.replace(tzinfo=UTC), str(row.id)))\n    eligible = [r for r in rows')
s=s.replace('    operation = (\n        IndicatorCalculation.AVERAGE if indicator.unit in {"percentage", "rate", "ratio"} else IndicatorCalculation.SUM\n    )','''    operation = (
        IndicatorCalculation.AVERAGE
        if indicator.manual_aggregation == "unweighted_mean" or (
            indicator.manual_aggregation == "legacy" and indicator.unit in {"percentage", "rate", "ratio"})
        else IndicatorCalculation.SUM
    )''')
s=s.replace('            external_id=str(row.id),','            id=row.id,\n            created_at=row.created_at,\n            external_id=str(row.id),')
s=s.replace('    use_pool =', '''    def latest(mapping: IndicatorMapping | None, items: list[Submission], field: SurveyField | None) -> Calculation:
        result = calculate(mapping, items, field)
        valid = [item for item in items if isinstance(item.raw_answers.get("value"), (int, float))]
        if valid:
            chosen = max(valid, key=lambda item: (item.submitted_at, item.created_at.replace(tzinfo=UTC), str(item.id)))
            result.value = float(chosen.raw_answers["value"])
            result.numerator = result.value
            result.denominator = 1
        return result

    use_pool =''')
s=s.replace('calculator=pooled if use_pool else calculate','calculator=pooled if use_pool else latest if indicator.manual_aggregation == "latest" else calculate')
s=s.replace('    if indicator.unit == "text":','    if indicator.manual_aggregation == "latest":\n        result.calculation_note = "Latest observation ordered by result date, creation timestamp, then record UUID. Periods are independent; manual results only."\n    if indicator.unit == "text":')
p.write_text(s)
p=Path('fieldsight-backend/app/routes/workspace.py');s=p.read_text().replace('    values = payload.model_dump()\n    if indicator.manual_aggregation', '    if indicator.reliability_policy and indicator.manual_aggregation == "legacy":\n        raise HTTPException(422, "Select an explicit suitable manual aggregation before entering results.")\n    values = payload.model_dump()\n    if indicator.manual_aggregation',1);p.write_text(s)
