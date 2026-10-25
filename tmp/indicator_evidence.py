from pathlib import Path
p=Path('fieldsight-backend/app/routes/indicators.py');s=p.read_text();pos=s.index('\ndef _validate_mapping')
s=s[:pos]+'''

@router.get("/indicators/{indicator_id}/evidence")
def indicator_evidence(indicator_id: UUID, user: CurrentUser, db: Database,
                       offset: int = 0, limit: int = 25,
                       date_from: date | None = None, date_to: date | None = None) -> dict:
    from sqlalchemy import func
    from app.core.indicator_results import calculate
    from app.core.review_evidence import eligible
    from app.core.survey import build_catalogue
    from app.models.operations import Submission, SurveySchema, FieldMapping
    from app.schemas.analysis import SurveyField
    indicator = _indicator(indicator_id, user, db)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Start date must be on or before end date.")
    mapping = _mapping(indicator, db)
    limit, offset = max(1, min(limit, 100)), max(0, offset)
    if mapping:
        project = db.get(Project, indicator.project_id)
        form_id = mapping.source_form_id or project.kobo_form_id
        # Never guess a legacy mapping's provenance when multiple forms exist.
        forms = list(db.exec(select(Submission.kobo_form_id).where(
            Submission.project_id == indicator.project_id,
            Submission.organization_id == indicator.organization_id).distinct()).all())
        if not mapping.source_form_id and len(set(forms) | ({project.kobo_form_id} if project.kobo_form_id else set())) > 1:
            return {"source": "table", "health": "broken_mapping", "items": [], "total": 0}
        form_id = form_id or (forms[0] if len(forms) == 1 else None)
        filters = [Submission.organization_id == indicator.organization_id,
                   Submission.project_id == indicator.project_id, Submission.kobo_form_id == form_id]
        if date_from:
            filters.append(Submission.submitted_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            from datetime import timedelta
            filters.append(Submission.submitted_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time()))
        total = db.exec(select(func.count()).select_from(Submission).where(*filters)).one()
        rows = list(db.exec(select(Submission).where(*filters).order_by(
            col(Submission.submitted_at).desc(), col(Submission.created_at).desc(), col(Submission.id).desc()
        ).offset(offset).limit(limit)).all())
        cache = db.exec(select(SurveySchema).where(SurveySchema.project_id == indicator.project_id,
            SurveySchema.organization_id == indicator.organization_id, SurveySchema.form_id == form_id)).first()
        mappings = list(db.exec(select(FieldMapping).where(FieldMapping.project_id == indicator.project_id,
            FieldMapping.organization_id == indicator.organization_id)).all())
        fields = build_catalogue(rows, mappings, [SurveyField.model_validate(f) for f in cache.fields_json] if cache else [])
        field = next((f for f in fields if f.source_field == mapping.source_field), None)
        items = []
        for row in rows:
            result = calculate(mapping, [row], field)
            reason = ("quality_excluded" if not eligible(row) else "broken_mapping" if not field
                      else "missing_answer" if result.missing_records else "invalid_answer" if result.invalid_answers else None)
            included = eligible(row) and field is not None and (mapping.calculation == "count_records" or reason is None)
            items.append({"id": str(row.id), "date": row.submitted_at, "updated_at": row.updated_at,
                          "author": row.enumerator, "location": row.location,
                          "answer": flatten_answers(row.raw_answers).get(mapping.source_field),
                          "included": included, "reason": None if included else reason})
        source = "table"
    else:
        filters = [CollectedResult.indicator_id == indicator.id,
                   CollectedResult.organization_id == indicator.organization_id]
        if date_from:
            filters.append(CollectedResult.result_date >= date_from)
        if date_to:
            filters.append(CollectedResult.result_date <= date_to)
        total = db.exec(select(func.count()).select_from(CollectedResult).where(*filters)).one()
        rows = list(db.exec(select(CollectedResult).where(*filters).order_by(
            col(CollectedResult.result_date).desc(), col(CollectedResult.created_at).desc(), col(CollectedResult.id).desc()
        ).offset(offset).limit(limit)).all())
        items = [{**row.model_dump(mode="json"), "included": True, "reason": None} for row in rows]
        source = "manual" if total or indicator.manual_aggregation != "legacy" else "unconfigured"
    return {"source": source, "method": mapping.calculation if mapping else indicator.manual_aggregation,
            "form": mapping.source_form_id if mapping else None, "question": mapping.source_field if mapping else None,
            "definition_version": indicator.definition_version, "date_from": date_from, "date_to": date_to,
            "total": total, "offset": offset, "limit": limit, "items": items,
            "notice": "Live evidence under the current definition; definition history does not freeze source data."}
''' +s[pos:];p.write_text(s)
