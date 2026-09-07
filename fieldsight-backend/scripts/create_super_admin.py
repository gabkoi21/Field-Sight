"""Create the first FieldSight super administrator.

Run after applying Alembic migrations. The password is prompted for and never
written to the database in plaintext, command history, or program output.
"""

from __future__ import annotations

import argparse
import sys
from getpass import getpass
from pathlib import Path

from sqlmodel import Session, select

# Allow direct execution with `python scripts/create_super_admin.py`.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.security import password_hasher  # noqa: E402
from app.db.session import get_engine  # noqa: E402
from app.models.identity import Role, User  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a FieldSight super administrator.")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--username", required=True, help="Administrator username")
    parser.add_argument("--full-name", default=None, help="Administrator full name")
    return parser.parse_args()


def create_super_admin(email: str, username: str, full_name: str | None, password: str) -> User:
    """Insert one new platform administrator, refusing to overwrite an account."""
    normalized_email = email.strip().lower()
    normalized_username = username.strip()
    if not normalized_email or not normalized_username:
        raise ValueError("Email and username must not be empty.")
    if not password:
        raise ValueError("A password is required.")

    with Session(get_engine()) as session:
        existing_email = session.exec(select(User).where(User.email == normalized_email)).first()
        existing_username = session.exec(select(User).where(User.username == normalized_username)).first()
        if existing_email or existing_username:
            raise ValueError("A user with that email address or username already exists; no changes were made.")
        user = User(
            email=normalized_email,
            username=normalized_username,
            full_name=full_name.strip() if full_name else None,
            password_hash=password_hasher.hash(password),
            platform_role=Role.SUPER_ADMIN,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user


def main() -> None:
    args = parse_args()
    password = getpass("Password: ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match; no user was created.")
    try:
        user = create_super_admin(args.email, args.username, args.full_name, password)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"Created super administrator {user.username} ({user.email}).")


if __name__ == "__main__":
    main()
