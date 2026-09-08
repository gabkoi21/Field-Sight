"""Initialize a Neon database and create FieldSight's first administrator.

The database URL and administrator password are prompted for and are never
written to disk or printed to the terminal.
"""

from __future__ import annotations

import argparse
import os
import sys
from getpass import getpass
from pathlib import Path

from alembic.config import Config
from dotenv import dotenv_values
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

from alembic import command

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Initialize FieldSight on Neon.")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--username", required=True, help="Administrator username")
    parser.add_argument("--full-name", default=None, help="Administrator full name")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    env_values = dotenv_values(PROJECT_ROOT / ".env")
    stored_database_url = env_values.get("FIELDSIGHT_DATABASE_URL") or env_values.get("DATABASE_URL")
    if stored_database_url:
        raw_database_url = stored_database_url.strip()
        print("Using the Neon connection URL from .env.")
    else:
        raise SystemExit("FIELDSIGHT_DATABASE_URL is missing from the .env file.")
    if not raw_database_url:
        raise SystemExit("A Neon connection URL is required.")

    if raw_database_url.startswith("postgresql://"):
        raw_database_url = "postgresql+psycopg://" + raw_database_url.removeprefix("postgresql://")

    try:
        parsed_url = make_url(raw_database_url)
    except Exception as exc:
        raise SystemExit("The supplied value is not a valid database URL.") from exc
    if parsed_url.get_backend_name() != "postgresql":
        raise SystemExit("The supplied URL is not a PostgreSQL/Neon connection URL.")
    for key, value in parsed_url.query.items():
        if isinstance(value, tuple):
            raise SystemExit(f"The Neon URL contains the query parameter {key!r} more than once.")
        if "://" in value or "postgresql" in value:
            raise SystemExit(f"The Neon URL has an invalid value for query parameter {key!r}.")
    channel_binding = parsed_url.query.get("channel_binding")
    if channel_binding not in {None, "disable", "prefer", "require"}:
        raise SystemExit("The Neon URL has an invalid channel_binding value.")

    # Set these before importing FieldSight modules so their cached settings and
    # engine cannot silently use the local SQLite development default.
    os.environ["FIELDSIGHT_ENVIRONMENT"] = "development"
    os.environ["FIELDSIGHT_DATABASE_URL"] = raw_database_url

    from app.core.config import get_settings
    from app.db.session import get_engine

    get_settings.cache_clear()
    get_engine.cache_clear()
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        raise SystemExit("Refusing to initialize a non-PostgreSQL database.")

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise SystemExit(f"Neon connection failed: {exc}") from exc

    print(f"Connected to Neon database {parsed_url.database!r} on {parsed_url.host!r}.")
    alembic_config = Config(str(PROJECT_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "head")
    print("Database migrations completed.")

    from scripts.create_super_admin import create_super_admin

    password = getpass("Administrator password: ")
    confirmation = getpass("Confirm administrator password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match; no administrator was created.")
    try:
        user = create_super_admin(args.email, args.username, args.full_name, password)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"Created super administrator {user.username} ({user.email}).")


if __name__ == "__main__":
    main()
