"""Disposable local browser fixture. Never opens the configured user database."""
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "fieldsight-backend"), str(ROOT / "fieldsight-backend" / "tests")]
from test_kobo_sync import sync_client
from sqlmodel import Session, select
from app.models.identity import User
from app.core.security import password_hasher
from app.core.config import Settings, get_settings
from app.main import create_app
from app.db.session import get_session
from app.schemas.analysis import SurveyField
from app.models.operations import SurveySchema, Project, Submission
from datetime import UTC, datetime
import uvicorn

fixture_path = ROOT / "tmp" / "indicator-browser-isolated-20261026"
fixture_path.mkdir(exist_ok=True)
assert not (fixture_path / "sync.db").exists(), "Use a new disposable fixture directory"
fixture = sync_client.__wrapped__(fixture_path)
client, engine, project_id, headers = next(fixture)
with Session(engine) as db:
    user = db.exec(select(User)).one()
    user.password_hash = password_hasher.hash("IndicatorTest-2026-only!")
    user.full_name = "Synthetic Indicator Administrator"
    db.add(user)
    project = db.get(Project, __import__('uuid').UUID(project_id))
    field = SurveyField(source_field="score", label="Synthetic score", type="number", source="kobo")
    db.add(SurveySchema(organization_id=project.organization_id, project_id=project.id,
                        form_id="form-1", fields_json=[field.model_dump()]))
    for i, value in enumerate([20, 80]):
        db.add(Submission(organization_id=project.organization_id, project_id=project.id,
                          kobo_connection_id=project.kobo_connection_id, kobo_form_id="form-1",
                          external_id=str(i), submitted_at=datetime(2026, 10, i+1, tzinfo=UTC),
                          raw_answers={"score": value}, review_status="ready"))
    db.commit()
settings = Settings(environment="test", cors_origins="http://127.0.0.1:5198,http://localhost:5198")
app = create_app(settings)
def isolated_session():
    with Session(engine) as db:
        yield db
app.dependency_overrides[get_session] = isolated_session
app.dependency_overrides[get_settings] = lambda: settings
(ROOT / "tmp" / "indicator-browser-project.txt").write_text(project_id)
with patch("app.routes.analysis.read_kobo_schema", return_value=("synthetic-v1", [field])), \
     patch("app.routes.analysis.decrypt_kobo_token", return_value="synthetic-provider-token"), \
     patch("app.routes.collection.list_kobo_submissions", return_value=[]):
    uvicorn.run(app, host="127.0.0.1", port=8198, log_level="warning")
