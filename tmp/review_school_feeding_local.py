import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from sqlalchemy.engine import make_url
from sqlmodel import Session, select
from app.core.config import get_settings
from app.core.review_evidence import evidence_fingerprint, eligible
from app.db.session import get_engine
from app.models.identity import User, OrganizationMembership, Role
from app.models.operations import Project, Submission
from app.routes.collection import ReviewStatusUpdate, update_submission_review_status
settings = get_settings()
url = make_url(settings.database_url)
path = Path(url.database).resolve()
assert settings.environment == "development" and url.get_backend_name() == "sqlite"
assert path == Path("fieldsight.db").resolve()
with Session(get_engine()) as db:
    project = db.exec(select(Project).where(Project.name == "Daily School Feeding Monitoring Form")).one()
    member = db.exec(select(OrganizationMembership).where(OrganizationMembership.organization_id == project.organization_id, OrganizationMembership.user_id == project.created_by_id, OrganizationMembership.role == Role.ORGANIZATION_ADMIN, OrganizationMembership.is_active)).one()
    actor = db.get(User, member.user_id)
    assert actor and actor.is_active
    records = db.exec(select(Submission).where(Submission.project_id == project.id, Submission.organization_id == project.organization_id)).all()
    assert len(records) == 31
    backup = path.parent / "backups" / f"before-school-review-{datetime.now(UTC):%Y%m%d-%H%M%S-%f}.db"
    backup.parent.mkdir(exist_ok=True)
    with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as source, sqlite3.connect(backup) as target:
        source.backup(target)
    changed = 0
    for record in records:
        if not eligible(record):
            update_submission_review_status(record.id, ReviewStatusUpdate(status="ready", evidence_fingerprint=evidence_fingerprint(record.raw_answers), note="Bulk marked ready at the user request through local assistant; no independent field verification performed."), actor, db)
            changed += 1
    verified = db.exec(select(Submission).where(Submission.project_id == project.id)).all()
    assert all(eligible(record) and record.decision_fingerprint == evidence_fingerprint(record.raw_answers) for record in verified)
    print(json.dumps({"marked_ready":changed,"total_ready":len(verified),"project":project.name,"backup":str(backup)},indent=2))
