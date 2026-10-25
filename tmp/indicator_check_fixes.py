from pathlib import Path
p=Path('fieldsight-backend/app/core/collected_results.py');s=p.read_text().replace('result.value = float(chosen.raw_answers["value"])','from app.core.survey import number\n            result.value = number(chosen.raw_answers["value"])');p.write_text(s)
p=Path('fieldsight-backend/app/core/indicator_results.py');s=p.read_text().replace('        def calculator(mapping, records, field):','        def calculator(mapping: IndicatorMapping | None, records: list[Submission],\n                       field: SurveyField | None) -> Calculation:');p.write_text(s)
p=Path('fieldsight-backend/app/routes/indicators.py');s=p.read_text().replace('from typing import Annotated, Literal','from typing import Annotated, Literal, cast')
s=s.replace('    return jsonable_encoder(\n','    return cast(dict, jsonable_encoder(\n',1).replace('\n\n\ndef _change_preview','\n\n\ndef _change_preview',1)
a=s.index('    return cast(dict, jsonable_encoder(');b=s.index('\n\n\ndef _change_preview',a);s=s[:b].rstrip()+')'+s[b:]
s=s.replace('    values = _validate_mapping(project, payload, db)','    assert project is not None\n    values = _validate_mapping(project, payload, db)')
s=s.replace('        form_id = mapping.source_form_id or project.kobo_form_id','        assert project is not None\n        form_id = mapping.source_form_id or project.kobo_form_id')
s=s.replace('filters.append(Submission.submitted_at >=','filters.append(col(Submission.submitted_at) >=').replace('filters.append(Submission.submitted_at <','filters.append(col(Submission.submitted_at) <')
s=s.replace('        rows = list(\n            db.exec(\n                select(CollectedResult)','        manual_rows = list(\n            db.exec(\n                select(CollectedResult)',1)
s=s.replace('for row in rows]\n        source = "manual"','for row in manual_rows]\n        source = "manual"')
p.write_text(s)
# Adjust old regression scenarios to intentionally configure new indicators and confirm material edits.
p=Path('fieldsight-backend/tests/test_indicator_results.py');s=p.read_text()
s=s.replace('json={"target_date": "2000-01-01"}', 'json={"target_date": "2000-01-01", "confirm_change": True, "change_reason": "Review deadline", "expected_version": result["definition_version"]}')
s=s.replace('json={"target_value": 6}', 'json={"target_value": 6, "confirm_change": True, "change_reason": "Review target", "expected_version": result["definition_version"]}')
s=s.replace('json={"target_value": 2, "target_date": None}', 'json={"target_value": 2, "target_date": None, "confirm_change": True, "change_reason": "Review deadline", "expected_version": result["definition_version"]}')
s=s.replace('json={"reporting_frequency": "quarterly"}', 'json={"reporting_frequency": "quarterly", "confirm_change": True, "change_reason": "Review frequency", "expected_version": api.get(f"/indicators/{item[\'id\']}", headers=headers).json()["definition_version"]}')
p.write_text(s)
p=Path('fieldsight-backend/tests/test_pooled_results.py');s=p.read_text().replace('client, _, project, headers = sync_client\n    definition = {"name": "Legacy percentage"','client, engine, project, headers = sync_client\n    definition = {"name": "Legacy percentage"',1)
s=s.replace('    path = f"/indicators/{indicator}"\n    client.post', '''    from uuid import UUID
    from sqlmodel import Session
    from app.models.operations import Indicator
    with Session(engine) as db:
        row = db.get(Indicator, UUID(indicator))
        row.reliability_policy = 0
        db.add(row)
        db.commit()
    path = f"/indicators/{indicator}"
    client.post''',1)
s=s.replace('json={"manual_aggregation": "unweighted_mean"}', 'json={"manual_aggregation": "unweighted_mean", "confirm_change": True, "change_reason": "Confirm legacy mean", "expected_version": 0}')
s=s.replace('json={"name": "Manual only", "code": "MANUAL"}', 'json={"name": "Manual only", "code": "MANUAL", "manual_aggregation": "sum"}')
p.write_text(s)
p=Path('fieldsight-backend/tests/test_report_exports.py');s=p.read_text().replace('"pooled" if pooled else "legacy"','"pooled" if pooled else "sum"').replace('"code": "TEXT", "unit": "text"','"code": "TEXT", "unit": "text", "manual_aggregation": "latest"');p.write_text(s)
