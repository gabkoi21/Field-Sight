"""Tenant-scoped question catalogue, aggregate analysis and saved views."""

from datetime import UTC, datetime
from io import StringIO
from typing import Annotated, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, col, select

from app.core.config import Settings, get_settings
from app.core.kobo import decrypt_kobo_token
from app.core.survey import aggregate, build_catalogue, read_kobo_schema
from app.db.session import get_session
from app.models.identity import User
from app.models.operations import FieldMapping, KoboConnection, Project, SavedAnalysis, Submission, SurveySchema
from app.routes.auth import get_current_user
from app.routes.intelligence import _project
from app.routes.kobo import _organization_admin_id
from app.schemas.analysis import (
    AnalysisQuery,
    AnalysisResult,
    SavedAnalysisInput,
    SavedAnalysisRead,
    SurveyCatalogue,
    SurveyField,
)

router = APIRouter(tags=["Survey analysis"])
Database = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Configuration = Annotated[Settings, Depends(get_settings)]


def _records(project: Project, form_id: str | None, db: Session) -> list[Submission]:
    statement = select(Submission).where(
        Submission.project_id == project.id,
        Submission.organization_id == project.organization_id,
    )
    if form_id:
        statement = statement.where(Submission.kobo_form_id == form_id)
    return list(db.exec(statement).all())


def _catalogue(
    project: Project,
    form_id: str | None,
    db: Session,
    *,
    current_only: bool = False,
) -> tuple[SurveyCatalogue, list[Submission], SurveySchema | None]:
    if current_only:
        selected_form = project.kobo_form_id
        forms = [selected_form] if selected_form else []
        if form_id and form_id != selected_form:
            raise HTTPException(status_code=422, detail="Choose the current Kobo form assigned to this project.")
        records = _records(project, selected_form, db) if selected_form else []
    else:
        stored_forms = db.exec(
            select(Submission.kobo_form_id).where(
                Submission.project_id == project.id,
                Submission.organization_id == project.organization_id,
            ).distinct()
        ).all()
        forms = sorted(set(stored_forms) | ({project.kobo_form_id} if project.kobo_form_id else set()))
        selected_form = form_id or project.kobo_form_id or (forms[0] if forms else None)
        if selected_form and selected_form not in forms:
            raise HTTPException(status_code=422, detail="Choose a form belonging to this project.")
        records = _records(project, selected_form, db) if selected_form else []
    cache = (
        db.exec(
            select(SurveySchema).where(
                SurveySchema.project_id == project.id,
                SurveySchema.form_id == selected_form,
                SurveySchema.organization_id == project.organization_id,
            )
        ).first()
        if selected_form
        else None
    )
    mappings = list(db.exec(select(FieldMapping).where(FieldMapping.project_id == project.id)).all())
    schema_fields = [SurveyField.model_validate(item) for item in cache.fields_json] if cache else []
    catalogue = SurveyCatalogue(
        project_id=project.id,
        form_id=selected_form,
        form_name=project.kobo_form_name if selected_form == project.kobo_form_id else None,
        form_version=cache.version if cache else None,
        forms=forms,
        schema_updated_at=cache.updated_at if cache else None,
        fields=schema_fields if current_only else build_catalogue(records, mappings, schema_fields),
        locations=sorted({record.location for record in records if record.location}),
        enumerators=sorted({record.enumerator for record in records if record.enumerator}),
        warning=None
        if cache
        else "Refresh Kobo fields to load the questions from the current assigned form."
        if current_only
        else "Question types use field mappings or stored answers. Refresh Kobo fields to verify metadata.",
    )
    return catalogue, records, cache


@router.get("/projects/{project_id}/survey-fields", response_model=SurveyCatalogue)
def survey_fields(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    settings: Configuration,
    form_id: str | None = None,
    refresh_schema: bool = False,
) -> SurveyCatalogue:
    project = _project(project_id, user, db)
    catalogue, _, cache = _catalogue(project, form_id, db, current_only=True)
    if not refresh_schema or not catalogue.form_id:
        return catalogue
    # Only the current assigned form has a verified connection provenance.
    if catalogue.form_id != project.kobo_form_id or not project.kobo_connection_id:
        raise HTTPException(status_code=422, detail="Only the currently assigned Kobo form can refresh its schema.")
    connection = db.get(KoboConnection, project.kobo_connection_id)
    if not connection or connection.organization_id != project.organization_id or not connection.is_verified:
        raise HTTPException(status_code=422, detail="A verified project Kobo connection is required.")
    try:
        version, fields = read_kobo_schema(
            connection.server_url,
            decrypt_kobo_token(connection.token_encrypted, settings),
            catalogue.form_id,
        )
    except ValueError:
        catalogue.warning = "Kobo metadata refresh failed. Previous metadata or inferred fields are shown. Try again."
        return catalogue
    if cache is None:
        cache = SurveySchema(
            organization_id=project.organization_id,
            project_id=project.id,
            form_id=catalogue.form_id,
        )
    cache.version = version
    cache.fields_json = [field.model_dump() for field in fields]
    cache.updated_at = datetime.now(UTC)
    db.add(cache)
    db.commit()
    return _catalogue(project, catalogue.form_id, db, current_only=True)[0]


def _execute(payload: AnalysisQuery, user: User, db: Session) -> AnalysisResult:
    project = _project(payload.project_id, user, db)
    catalogue, records, _ = _catalogue(project, payload.form_id, db, current_only=True)
    query = payload.model_copy(update={"form_id": catalogue.form_id})
    try:
        return aggregate(query, records, catalogue.fields)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/analysis/query", response_model=AnalysisResult)
def query_analysis(payload: AnalysisQuery, user: CurrentUser, db: Database) -> AnalysisResult:
    return _execute(payload, user, db)


@router.post("/analysis/export")
def export_analysis(payload: AnalysisQuery, user: CurrentUser, db: Database) -> Response:
    import csv

    result = _execute(payload, user, db)
    output = StringIO()
    writer = csv.writer(output)

    def safe(value: object) -> object:
        return "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value

    writer.writerow(["question", "category", "group", "value", "count", "percent", "denominator", "missing", "invalid"])
    for point in result.series:
        writer.writerow(
            [
                safe(result.field.label),
                safe(point.name),
                safe(point.group),
                point.value,
                point.count,
                point.percent,
                result.denominator,
                result.missing_records,
                result.invalid_answers,
            ]
        )
    writer.writerow(["eligible_records", result.eligible_records])
    writer.writerow(["review_status", result.filters.review_status])
    writer.writerow(["date_from", result.filters.date_from, "date_to", result.filters.date_to])
    writer.writerow(["note", result.note])
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="fieldsight-analysis.csv"'},
    )


def _saved_read(saved: SavedAnalysis) -> SavedAnalysisRead:
    return SavedAnalysisRead(
        id=saved.id,
        title=saved.title,
        query=AnalysisQuery.model_validate(saved.query_json),
        chart=cast(Literal["bar", "line", "donut", "pie", "table"], saved.chart),
        created_at=saved.created_at,
    )


@router.get("/analysis/saved", response_model=list[SavedAnalysisRead])
def saved_analyses(user: CurrentUser, db: Database, project_id: UUID) -> list[SavedAnalysisRead]:
    project = _project(project_id, user, db)
    saved = db.exec(
        select(SavedAnalysis)
        .where(
            SavedAnalysis.project_id == project.id,
            SavedAnalysis.organization_id == project.organization_id,
        )
        .order_by(col(SavedAnalysis.created_at).desc())
    ).all()
    catalogue, _, _ = _catalogue(project, None, db, current_only=True)
    current_fields = {field.source_field for field in catalogue.fields}
    return [
        _saved_read(item)
        for item in saved
        if project.kobo_form_id
        and item.query_json.get("form_id") == project.kobo_form_id
        and item.query_json.get("source_field") in current_fields
        and (not item.query_json.get("group_by") or item.query_json.get("group_by") in current_fields)
    ]


@router.post("/analysis/saved", response_model=SavedAnalysisRead, status_code=201)
def save_analysis(payload: SavedAnalysisInput, user: CurrentUser, db: Database) -> SavedAnalysisRead:
    result = _execute(payload.query, user, db)
    project = _project(payload.query.project_id, user, db)
    saved = SavedAnalysis(
        organization_id=project.organization_id,
        project_id=project.id,
        created_by_id=user.id,
        title=payload.title,
        query_json=payload.query.model_copy(update={"form_id": result.form_id}).model_dump(mode="json"),
        chart=payload.chart,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return _saved_read(saved)


@router.delete("/analysis/saved/{analysis_id}", status_code=204)
def delete_saved_analysis(analysis_id: UUID, user: CurrentUser, db: Database) -> Response:
    organization_id = _organization_admin_id(user, db)
    saved = db.get(SavedAnalysis, analysis_id)
    if saved is None or saved.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Saved visualization was not found.")
    _project(saved.project_id, user, db)
    db.delete(saved)
    db.commit()
    return Response(status_code=204)
