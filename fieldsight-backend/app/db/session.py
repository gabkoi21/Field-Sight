"""SQLite-aware SQLModel engine and session dependency."""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache
from sqlite3 import Connection
from typing import cast

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from app.core.config import get_settings


@event.listens_for(Engine, "connect")
def configure_sqlite_connection(dbapi_connection: object, connection_record: object) -> None:
    """Enable SQLite safeguards on each new connection and ignore other engines."""
    del connection_record
    if not dbapi_connection.__class__.__module__.startswith("sqlite3"):
        return
    cursor = cast(Connection, dbapi_connection).cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA busy_timeout = 5000")
    cursor.close()


@lru_cache
def get_engine() -> Engine:
    """Create the configured engine lazily so startup does not create a database file."""
    database_url = get_settings().database_url
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)


def get_session() -> Iterator[Session]:
    """Provide one database session per HTTP request."""
    with Session(get_engine()) as session:
        yield session
