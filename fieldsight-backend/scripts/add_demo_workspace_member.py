"""Add one synthetic enumerator to the local Community health visits workspace."""

import secrets

from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import password_hasher
from app.db.session import get_engine
from app.models.identity import Organization, OrganizationMembership, Role, User
from app.models.operations import FieldAssignment, Project


def main() -> None:
    settings = get_settings()
    if settings.environment != "development" or not settings.database_url.startswith("sqlite:"):
        raise RuntimeError("Demo members are only available in local development SQLite.")
    with Session(get_engine()) as db:
        org = db.exec(select(Organization).where(Organization.slug == "demo-organization")).one()
        project = db.exec(select(Project).where(
            Project.organization_id == org.id, Project.name == "Community health visits"
        )).one()
        user = db.exec(select(User).where(User.email == "demo.enumerator@example.com")).first()
        if user is None:
            user = User(
                email="demo.enumerator@example.com",
                full_name="Alex Demo",
                username="demo_enumerator_alex",
                employee_id="DEMO-ENUM-001",
                notes="Synthetic demo enumerator for workspace UI review; no real person.",
                password_hash=password_hasher.hash(secrets.token_urlsafe(32)),
            )
            db.add(user)
            db.flush()
        member = db.exec(select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.user_id == user.id,
        )).first()
        if member is None:
            member = OrganizationMembership(organization_id=org.id, user_id=user.id, role=Role.ENUMERATOR)
            db.add(member)
            db.flush()
        assignment = db.exec(select(FieldAssignment).where(
            FieldAssignment.project_id == project.id,
            FieldAssignment.membership_id == member.id,
            FieldAssignment.location_id == None,  # noqa: E711
        )).first()
        if assignment is None:
            db.add(FieldAssignment(organization_id=org.id, membership_id=member.id, project_id=project.id))
        else:
            assignment.is_enabled = True
            db.add(assignment)
        db.commit()
        print(f"Verified: {user.full_name} | {user.email} | {member.role.value} | {project.name}")


if __name__ == "__main__":
    main()
