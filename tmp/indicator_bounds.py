from pathlib import Path
p=Path('fieldsight-backend/app/core/indicator_results.py');s=p.read_text().replace('def calculate(mapping: IndicatorMapping | None, records: list[Submission], field: SurveyField | None) -> Calculation:', 'def calculate(mapping: IndicatorMapping | None, records: list[Submission], field: SurveyField | None,\n              unit: str | None = None) -> Calculation:')
s=s.replace('            if value is None:\n','            if value is None or (unit == "percentage" and not 0 <= value <= 100):\n',1)
s=s.replace('    filtered = []\n','    if calculator is calculate and indicator.reliability_policy:\n        def calculator(mapping, records, field):\n            return calculate(mapping, records, field, unit=indicator.unit)\n    filtered = []\n',1)
p.write_text(s)
p=Path('fieldsight-backend/app/routes/indicators.py');s=p.read_text().replace('result = calculate(mapping, [row], field)','result = calculate(mapping, [row], field, unit=indicator.unit if indicator.reliability_policy else None)')
s=s.replace('    has_results = bool(\n', '    if controls.get("expected_version") is not None and controls["expected_version"] != indicator.definition_version:\n        raise HTTPException(409, "Definition changed since preview. Refresh the preview before saving.")\n    has_results = bool(\n',1)
s=s.replace('or preview["before"]["manual_result_count"]','or preview["before"]["manual_result_count"]\n        or preview["before"]["quality_excluded_records"]')
p.write_text(s)
