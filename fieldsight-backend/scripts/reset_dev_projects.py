"""One-time, offline SQLite development reset. Default mode is read-only dry-run.

No application routes, provider clients or migration runners are imported.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import subprocess
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
PHRASE = "DELETE ALL DEVELOPMENT PROJECTS"
OWNED = {
    "projects",
    "submissions",
    "submission_review_events",
    "quality_findings",
    "field_mappings",
    "survey_schemas",
    "saved_analyses",
    "project_targets",
    "result_framework_nodes",
    "indicators",
    "indicator_period_targets",
    "indicator_mappings",
    "field_assignments",
    "indicator_definition_versions",
    "project_actions",
    "project_action_events",
    "sync_jobs",
    "sync_runs",
    "sync_schedules",
    "sync_settings_changes",
    "analytical_dashboards",
    "collected_results",
}
PRESERVED = {
    "users",
    "organizations",
    "organization_memberships",
    "organization_sectors",
    "sectors",
    "organization_settings",
    "locations",
    "kobo_connections",
    "refresh_sessions",
    "workspace_invitations",
    "user_preferences",
    "sync_worker_heartbeats",
    "alembic_version",
}
SHARED_AUDIT = "organization_admin_events"
OPTIONAL_29 = {"project_actions", "project_action_events"}
REVISIONS = {"0029_auth_lifecycle", "0030_project_actions"}


class ResetRefused(ValueError):
    """No reset is authorized when a guard fails."""


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def branch() -> str:
    return subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip()


def select_database(path: Path, environment: str) -> Path:
    if environment != "development" or branch() != "dev":
        raise ResetRefused("An explicitly identified development database and the dev branch are required.")
    # An explicit CLI assertion must never silently override production configuration.
    configured = dotenv_values(ROOT / "fieldsight-backend" / ".env").get("FIELDSIGHT_ENVIRONMENT")
    for value in (os.environ.get("FIELDSIGHT_ENVIRONMENT"), os.environ.get("ENVIRONMENT"), configured):
        if value and value.lower() not in {"development", "dev", "local", "test"}:
            raise ResetRefused("Production or unrecognized environment configuration; refusing database access.")
    if not path.is_absolute() or not path.is_file() or path.is_symlink():
        raise ResetRefused("Supply the absolute path of an existing, identified local SQLite database (no symlink).")
    resolved = path.resolve(strict=True)
    if any(part.lower() in {"production", "prod"} for part in resolved.parts):
        raise ResetRefused("Production path refused.")
    return resolved


@contextmanager
def connect(path: Path, *, writable: bool = False) -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(
        path.as_uri() + ("?mode=rw" if writable else "?mode=ro"), uri=True, timeout=5, isolation_level=None
    )
    connection.execute("PRAGMA foreign_keys=ON")
    if not writable:
        connection.execute("PRAGMA query_only=ON")
    try:
        yield connection
    finally:
        connection.close()


def integrity(db: sqlite3.Connection) -> None:
    if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
        raise ResetRefused("SQLite integrity check failed; repair/restore separately.")
    if db.execute("PRAGMA foreign_key_check").fetchall():
        raise ResetRefused("Existing foreign-key violations; refusing reset rather than masking them.")


def digest_rows(rows: Any) -> str:
    hashes = []
    for row in rows:
        serial = [item.hex() if isinstance(item, bytes) else item for item in row]
        hashes.append(hashlib.sha256(json.dumps(serial, ensure_ascii=True, separators=(",", ":")).encode()).hexdigest())
    return hashlib.sha256("\n".join(sorted(hashes)).encode()).hexdigest()


def tables(db: sqlite3.Connection) -> set[str]:
    return {
        row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    }


def schema_digest(db: sqlite3.Connection) -> str:
    return digest_rows(db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'"))


def inventory(db: sqlite3.Connection) -> tuple[set[str], list[str]]:
    present = tables(db)
    known = OWNED | PRESERVED | {SHARED_AUDIT}
    if present - known or (known - OPTIONAL_29) - present:
        raise ResetRefused("Unidentified schema: unknown or missing tables. Audit this schema before resetting.")
    revisions = {row[0] for row in db.execute("SELECT version_num FROM alembic_version")}
    if len(revisions) != 1 or not revisions <= REVISIONS:
        raise ResetRefused("Unrecognized Alembic revision; no migration/reset will be attempted.")
    if revisions == {"0030_project_actions"} and not OPTIONAL_29 <= present:
        raise ResetRefused("Action tables are missing from revision 0030.")
    if db.execute("SELECT 1 FROM sqlite_master WHERE type='trigger' LIMIT 1").fetchone():
        raise ResetRefused("Unreviewed database triggers could change preserved data; refusing reset.")
    foreign = {name: db.execute(f"PRAGMA foreign_key_list({quote(name)})").fetchall() for name in present}
    derived = {"projects"}
    while True:
        added = {name for name, keys in foreign.items() if any(key[2] in derived for key in keys)}
        if added <= derived:
            break
        derived |= added
    if derived != OWNED & present:
        raise ResetRefused("Project ownership graph differs from the audited allowlist.")
    pending = set(derived)
    order = []
    while pending:
        parents = {key[2] for name in pending for key in foreign[name] if key[2] != name and key[2] in pending}
        leaves = sorted(pending - parents)
        if not leaves:
            raise ResetRefused("Unexpected cyclic project dependencies; audit before resetting.")
        order.extend(leaves)
        pending -= set(leaves)
    return present, order


def audit_predicate(db: sqlite3.Connection, present: set[str]) -> str:
    # These event families are project/submission operations even if their old resource was already removed.
    parts = [
        "action LIKE 'project_status:%'",
        "action LIKE 'submission_review:%'",
        "action IN ('submissions_export','kobo_form_deleted')",
    ]
    for name in sorted(OWNED & present):
        columns = {row[1] for row in db.execute(f"PRAGMA table_info({quote(name)})")}
        if {"id", "organization_id"} <= columns:
            parts.append(
                f"EXISTS (SELECT 1 FROM {quote(name)} r WHERE "
                "lower(replace(r.id,'-',''))=lower(replace(organization_admin_events.resource_id,'-','')) "
                "AND lower(replace(r.organization_id,'-',''))="
                "lower(replace(organization_admin_events.organization_id,'-','')))"
            )
    return "(" + " OR ".join(parts) + ")"


def state(db: sqlite3.Connection) -> dict[str, Any]:
    return {
        "schema": schema_digest(db),
        "tables": {
            name: {
                "count": db.execute(f"SELECT count(*) FROM {quote(name)}").fetchone()[0],
                "digest": digest_rows(db.execute(f"SELECT * FROM {quote(name)}")),
            }
            for name in sorted(tables(db))
        },
    }


def preview(db: sqlite3.Connection, path: Path) -> dict[str, Any]:
    integrity(db)
    present, order = inventory(db)
    predicate = audit_predicate(db, present)
    projects = [
        {"id": row[0], "name": row[1], "status": row[2]}
        for row in db.execute("SELECT id,name,status FROM projects ORDER BY name,id")
    ]
    counts = {name: db.execute(f"SELECT count(*) FROM {quote(name)}").fetchone()[0] for name in order}
    counts[SHARED_AUDIT] = db.execute(f"SELECT count(*) FROM {SHARED_AUDIT} WHERE {predicate}").fetchone()[0]
    return {
        "database": str(path),
        "environment": "development",
        "projects": projects,
        "revision": db.execute("SELECT version_num FROM alembic_version").fetchone()[0],
        "delete_counts": counts,
        "absent_project_tables": sorted(OWNED - present),
        "preserved_counts": {
            name: db.execute(f"SELECT count(*) FROM {quote(name)}").fetchone()[0] for name in sorted(PRESERVED)
        },
        "preserved_admin_events": db.execute(f"SELECT count(*) FROM {SHARED_AUDIT} WHERE NOT {predicate}").fetchone()[
            0
        ],
        "super_admin_accounts": db.execute(
            "SELECT count(*) FROM users WHERE lower(platform_role)='super_admin'"
        ).fetchone()[0],
        "delete_order": [SHARED_AUDIT, *order],
    }


def reserve_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


def file_hash(path: Path) -> str:
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def prepare(path: Path, environment: str, backup: Path, manifest: Path) -> dict[str, Any]:
    path = select_database(path, environment)
    backup, manifest = backup.absolute(), manifest.absolute()
    if backup.resolve() == path or manifest.resolve() == path or backup.resolve() == manifest.resolve():
        raise ResetRefused("Source, backup and manifest must be different paths.")
    if backup.exists() or manifest.exists():
        raise ResetRefused("Backup/manifest already exists; choose fresh paths, never overwrite.")
    with connect(path) as source:
        source.execute("BEGIN")
        plan = preview(source, path)
        before = state(source)
        predicate = audit_predicate(source, tables(source))
        kept_audit = digest_rows(source.execute(f"SELECT * FROM {SHARED_AUDIT} WHERE NOT {predicate}"))
        backup.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(backup, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
        target = sqlite3.connect(backup)
        try:
            source.backup(target)
        finally:
            target.close()
        source.rollback()
    with connect(backup.resolve()) as copy:
        integrity(copy)
        if state(copy) != before:
            raise ResetRefused("Backup contents do not match the source snapshot. Reset is refused.")
    info = path.stat()
    result = {
        "format": 1,
        "prepared_at": datetime.now(UTC).isoformat(),
        "preview": plan,
        "source_file_identity": [info.st_dev, info.st_ino],
        "source_state": before,
        "preserved_admin_digest": kept_audit,
        "backup": str(backup.resolve()),
        "backup_sha256": file_hash(backup),
        "backup_verified": True,
        "manifest": str(manifest.resolve()),
        "confirmation_phrase": PHRASE,
        "status": "PREPARED_ONLY_NOT_EXECUTED",
    }
    reserve_json(manifest, result)
    return result


def verify_empty(db: sqlite3.Connection) -> dict[str, int]:
    present, _ = inventory(db)
    remaining = {
        name: db.execute(f"SELECT count(*) FROM {quote(name)}").fetchone()[0] for name in sorted(OWNED & present)
    }
    remaining[SHARED_AUDIT] = db.execute(
        f"SELECT count(*) FROM {SHARED_AUDIT} WHERE {audit_predicate(db, present)}"
    ).fetchone()[0]
    if any(remaining.values()):
        raise ResetRefused("Project-owned data remains; verification did not pass.")
    integrity(db)
    return remaining


def execute(
    path: Path,
    environment: str,
    manifest: Path,
    confirm_database: str,
    confirm_delete: str,
    *,
    writers_stopped: bool,
    verify: bool = False,
) -> dict[str, Any]:
    path = select_database(path, environment)
    if confirm_database != str(path) or confirm_delete != PHRASE or not writers_stopped:
        raise ResetRefused("Exact canonical database path, destructive phrase and --writers-stopped are required.")
    plan = json.loads(manifest.read_text(encoding="utf-8"))
    if plan.get("format") != 1 or not plan.get("backup_verified") or plan["preview"]["database"] != str(path):
        raise ResetRefused("Manifest does not identify this prepared development database.")
    backup = Path(plan["backup"])
    if not backup.is_file() or backup.resolve() == path or file_hash(backup) != plan["backup_sha256"]:
        raise ResetRefused("Verified backup is missing, changed, or aliases the selected database.")
    with connect(backup.resolve()) as copy:
        integrity(copy)
        if state(copy) != plan["source_state"]:
            raise ResetRefused("Backup logical contents differ from the authorized snapshot.")
    receipt = manifest.with_name(manifest.name + ".executed.json")
    if receipt.exists():
        raise ResetRefused("This one-time manifest has already been used/reserved. Inspect its receipt.")
    marker_created = False
    committed = False
    with connect(path, writable=True) as db:
        try:
            db.execute("BEGIN IMMEDIATE")
            info = path.stat()
            if [info.st_dev, info.st_ino] != plan["source_file_identity"] or state(db) != plan["source_state"]:
                raise ResetRefused(
                    "Database changed since preview/backup. Stop writers and prepare a fresh backup/manifest."
                )
            present, order = inventory(db)
            integrity(db)
            reserve_json(receipt, {"status": "RESERVED", "database": str(path), "backup": str(backup)})
            marker_created = True
            db.execute(f"DELETE FROM {SHARED_AUDIT} WHERE {audit_predicate(db, present)}")
            for name in order:
                for key in db.execute(f"PRAGMA foreign_key_list({quote(name)})").fetchall():
                    if key[2] == name:
                        column = next(
                            item for item in db.execute(f"PRAGMA table_info({quote(name)})") if item[1] == key[3]
                        )
                        if column[3]:
                            raise ResetRefused("Non-null self reference requires a separate audited deletion plan.")
                        db.execute(f"UPDATE {quote(name)} SET {quote(key[3])}=NULL")
                db.execute(f"DELETE FROM {quote(name)}")
            remaining = verify_empty(db)
            after = state(db)
            if (
                after["schema"] != plan["source_state"]["schema"]
                or any(after["tables"][name] != plan["source_state"]["tables"][name] for name in PRESERVED)
                or after["tables"][SHARED_AUDIT]["digest"] != plan["preserved_admin_digest"]
            ):
                raise ResetRefused("Preserved configuration/audit/schema changed; transaction will roll back.")
            db.commit()
            committed = True
        except BaseException:
            if not committed:
                db.rollback()
                if marker_created:
                    receipt.unlink()
            raise
    if verify:
        with connect(path) as check:
            verify_empty(check)
    result = {
        "status": "COMMITTED",
        "database": str(path),
        "backup": str(backup),
        "completed_at": datetime.now(UTC).isoformat(),
        "remaining": remaining,
        "configuration_preserved": True,
        "migration_history_preserved": True,
    }
    # A failure here must not be misreported as a rolled-back database reset.
    receipt.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--environment", required=True, choices=["development"])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--prepare", action="store_true", help="Create verified backup and dry-run manifest; never delete"
    )
    mode.add_argument(
        "--execute", action="store_true", help="Destructive; requires the prepared manifest and confirmations"
    )
    mode.add_argument("--dry-run", action="store_true", help="Read-only preview (default)")
    parser.add_argument("--backup", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--confirm-database", default="")
    parser.add_argument("--confirm-delete", default="")
    parser.add_argument("--writers-stopped", action="store_true")
    parser.add_argument(
        "--verify", action="store_true", help="Read-only empty check, or post-commit verification with --execute"
    )
    args = parser.parse_args()
    try:
        if args.prepare:
            if args.backup is None or args.manifest is None:
                raise ResetRefused("--prepare requires explicit --backup and --manifest paths.")
            result = prepare(args.database, args.environment, args.backup, args.manifest)
            print(json.dumps({key: value for key, value in result.items() if key != "source_state"}, indent=2))
        elif args.execute:
            if args.manifest is None:
                raise ResetRefused("Execution requires a verified --manifest.")
            print(
                json.dumps(
                    execute(
                        args.database,
                        args.environment,
                        args.manifest,
                        args.confirm_database,
                        args.confirm_delete,
                        writers_stopped=args.writers_stopped,
                        verify=args.verify,
                    ),
                    indent=2,
                )
            )
        else:
            path = select_database(args.database, args.environment)
            with connect(path) as db:
                db.execute("BEGIN")
                print(json.dumps({"remaining": verify_empty(db)} if args.verify else preview(db, path), indent=2))
                db.rollback()
        return 0
    except (ResetRefused, sqlite3.Error, OSError, KeyError, json.JSONDecodeError) as error:
        print(f"REFUSED: {error}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
