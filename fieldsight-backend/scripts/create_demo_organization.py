"""Create the local demo organization and its administrator without duplicate accounts."""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import password_hasher
from app.db.session import get_engine
from app.models.identity import Organization, OrganizationMembership, OrganizationSector, Role, Sector, User
from app.models.operations import OrganizationSettings


def create_demo(password: str) -> None:
    settings = get_settings()
    if settings.environment != "development" or not settings.database_url.startswith("sqlite:"):
        raise RuntimeError("This demo setup is only available for the local development SQLite database.")
    if not password:
        raise ValueError("A demo password is required.")
    with Session(get_engine()) as db:
        organization = db.exec(select(Organization).where(Organization.slug == "demo-organization")).first()
        user = db.exec(select(User).where(User.email == "org@gmail.com")).first()
        if user is not None:
            membership = db.exec(
                select(OrganizationMembership).where(
                    OrganizationMembership.user_id == user.id,
                )
            ).all()
            if user.platform_role is not None or any(
                organization is None or item.organization_id != organization.id for item in membership
            ):
                raise RuntimeError("This email already belongs to another account. No account was changed.")
        if organization is None:
            organization = Organization(name="Demo Organization", slug="demo-organization")
            db.add(organization)
            db.flush()
        if user is None:
            user = User(email="org@gmail.com", full_name="Demo Organization Admin", password_hash="pending")
        user.password_hash = password_hasher.hash(password)
        user.is_active = True
        db.add(user)
        db.flush()
        membership = db.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization.id,
                OrganizationMembership.user_id == user.id,
            )
        ).first()
        if membership is None:
            membership = OrganizationMembership(
                organization_id=organization.id,
                user_id=user.id,
                role=Role.ORGANIZATION_ADMIN,
            )
        membership.role = Role.ORGANIZATION_ADMIN
        membership.is_active = True
        db.add(membership)
        if db.get(OrganizationSettings, organization.id) is None:
            db.add(OrganizationSettings(organization_id=organization.id))
        health = db.exec(select(Sector).where(Sector.code == "health", Sector.is_active)).first()
        if (
            health
            and db.exec(
                select(OrganizationSector).where(
                    OrganizationSector.organization_id == organization.id,
                    OrganizationSector.sector_id == health.id,
                )
            ).first()
            is None
        ):
            db.add(OrganizationSector(organization_id=organization.id, sector_id=health.id))
        db.commit()
    print("Demo Organization is ready. Administrator: org@gmail.com")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--password-stdin", action="store_true", help="Read the demo password from standard input.")
    args = parser.parse_args()
    create_demo(sys.stdin.readline().rstrip("\r\n") if args.password_stdin else getpass.getpass("Demo password: "))
