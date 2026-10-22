"""Add 15 synthetic enumerators to the local demo organization, without duplicates."""

import secrets
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import password_hasher
from app.db.session import get_engine
from app.models.identity import Organization, OrganizationMembership, Role, User
from app.models.operations import FieldAssignment, Project


def main() -> None:
    settings = get_settings()
    if settings.environment != "development" or not settings.database_url.startswith("sqlite:///"):
        raise RuntimeError("Only local development SQLite is supported.")
    source = Path(settings.database_url.removeprefix("sqlite:///"))
    backups = Path("../outputs/demo-enumerators-backup")
    backups.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source) as original, sqlite3.connect(
        backups / f"before-{datetime.now():%Y%m%d-%H%M%S}.db"
    ) as backup:
        original.backup(backup)
    names = ["Amelia", "Benjamin", "Charlotte", "Daniel", "Evelyn", "Felix", "Grace", "Henry",
             "Isabel", "James", "Katherine", "Leo", "Maya", "Noah", "Olivia"]
    created = 0
    with Session(get_engine()) as db:
        org = db.exec(select(Organization).where(Organization.slug == "demo-organization")).one()
        projects = db.exec(select(Project).where(Project.organization_id == org.id).order_by(Project.name)).all()
        for index, name in enumerate(names, 1):
            email = f"demo.enumerator.{index:02d}@example.com"
            user = db.exec(select(User).where(User.email == email)).first()
            if user is not None:
                continue
            user = User(email=email, full_name=f"{name} Demo", username=f"demo_field_{index:02d}",
                        employee_id=f"DEMO-FIELD-{index:03d}", address=f"Demo training site {index:02d}",
                        notes="Synthetic demo profile for UI review. No real person or contact details.",
                        password_hash=password_hasher.hash(secrets.token_urlsafe(32)))
            db.add(user)
            db.flush()
            member = OrganizationMembership(organization_id=org.id, user_id=user.id, role=Role.ENUMERATOR)
            db.add(member)
            db.flush()
            if projects:
                db.add(FieldAssignment(organization_id=org.id, membership_id=member.id,
                                       project_id=projects[(index - 1) % len(projects)].id))
            created += 1
        db.commit()
        verified = db.exec(select(User).join(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            User.email.in_([f"demo.enumerator.{i:02d}@example.com" for i in range(1, 16)]),
        )).all()
        assert len(verified) == 15
        print(f"Created {created} demo enumerators; verified 15 active sample profiles. Existing members preserved.")


if __name__ == "__main__":
    main()
