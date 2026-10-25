from pathlib import Path
p=Path('fieldsight-backend/app/routes/indicators.py');s=p.read_text().replace('    # Legacy mappings without provenance', '    if mapping is None:\n        return read_result(indicator, None, [], None, None, "unmapped", date_from, date_to)\n    # Legacy mappings without provenance',1);p.write_text(s)
