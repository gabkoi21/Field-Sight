from pathlib import Path
from uuid import uuid4

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.core.project_urls import available_project_slug, project_slug_base
from app.models import workspace  # noqa: F401
from app.models.identity import Organization, OrganizationSector, Sector, User
from app.models.operations import Project


def test_url_names_normalize_and_disambiguate() -> None:
    assert project_slug_base("  École / School Feeding! ") == "ecole-school-feeding"
    assert available_project_slug("School feeding", {"school-feeding", "school-feeding-2"}) == "school-feeding-3"
    assert project_slug_base("!!!") == "project"
    assert project_slug_base(str(uuid4())).startswith("project-")


def test_project_slugs_survive_renames_and_legacy_backfill(tmp_path: Path, monkeypatch) -> None:
    from alembic.config import Config

    from alembic import command
    from app.core.config import get_settings

    path = tmp_path / "readable-projects.db"
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        org = Organization(name="Projects", slug="projects")
        user = User(email="urls@example.org", password_hash="unused")
        sector = Sector(name="Education", code="url-education")
        db.add_all([org, user, sector])
        db.flush()
        link = OrganizationSector(organization_id=org.id, sector_id=sector.id)
        db.add(link)
        db.flush()
        first = Project(name="School Feeding", organization_id=org.id,
                        organization_sector_id=link.id, created_by_id=user.id)
        second = Project(name="School / Feeding", organization_id=org.id,
                         organization_sector_id=link.id, created_by_id=user.id)
        db.add(first)
        db.commit()
        db.add(second)
        db.commit()
        assert first.slug == "school-feeding" and second.slug == "school-feeding-2"
        third = Project(name="School + Feeding", organization_id=org.id,
                        organization_sector_id=link.id, created_by_id=user.id)
        fourth = Project(name="School & Feeding", organization_id=org.id,
                         organization_sector_id=link.id, created_by_id=user.id)
        db.add_all([third, fourth])
        db.commit()
        assert {third.slug, fourth.slug} == {"school-feeding-3", "school-feeding-4"}
        first.name = "Renamed education project"
        db.add(first)
        db.commit()
        assert first.slug == "school-feeding"
    # Reproduce the actual old schema, then verify the additive upgrade preserves records.
    with engine.begin() as c:
        c.execute(text("DROP INDEX ix_projects_slug"))
        c.execute(text("ALTER TABLE projects DROP COLUMN slug"))
        before = c.execute(text("SELECT id, name, created_at FROM projects ORDER BY id")).all()
        c.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(64) NOT NULL PRIMARY KEY)"))
        c.execute(text("INSERT INTO alembic_version VALUES ('0032_kobo_collection_access')"))
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", f"sqlite:///{path.as_posix()}")
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.upgrade(config, "head")
        command.upgrade(config, "head")
        with engine.connect() as c:
            assert c.execute(text("SELECT id, name, created_at FROM projects ORDER BY id")).all() == before
            assert c.execute(text("SELECT count(DISTINCT slug) FROM projects")).scalar_one() == 4
    finally:
        get_settings.cache_clear()
        engine.dispose()
