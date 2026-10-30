"""Back up, rehearse, and transactionally merge FieldSight SQLite into Neon.

Dry-run is the default: schema changes and inserts are rolled back together.
An existing user matched by email needs an explicit account conflict policy.
No target records are deleted. Credentials and record contents are never logged.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import UUID

from alembic.config import Config
from alembic.script import ScriptDirectory
from dotenv import dotenv_values
from sqlalchemy import create_engine, inspect, select, text, update
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel

from alembic import command

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import identity, operations, workspace  # noqa: E402, F401


def normalized(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=UTC).isoformat() if value.tzinfo is None else value.astimezone(UTC).isoformat()
    if isinstance(value, (UUID, date)):
        return str(value)
    if isinstance(value, dict):
        return {k: normalized(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalized(v) for v in value]
    return value


def fingerprint(rows):
    serialized = sorted(json.dumps(normalized(r), sort_keys=True, ensure_ascii=False) for r in rows)
    return hashlib.sha256('\n'.join(serialized).encode()).hexdigest()


def row_key(table, row):
    return tuple(row[c.name] for c in table.primary_key)


def read_tables(connection):
    return {t.name: [dict(r) for r in connection.execute(select(t)).mappings()]
            for t in SQLModel.metadata.sorted_tables}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Commit after verification; otherwise roll back.')
    parser.add_argument('--account-policy', choices=['sqlite', 'neon'], default=None)
    args = parser.parse_args()
    os.chdir(ROOT)
    raw_url = dotenv_values(ROOT / '.env.neon-migration').get('NEON_MIGRATION_DATABASE_URL')
    if not raw_url:
        raise RuntimeError('Missing NEON_MIGRATION_DATABASE_URL in .env.neon-migration.')
    url = make_url(raw_url)
    if url.get_backend_name() != 'postgresql' or not url.host or not url.host.endswith('.neon.tech'):
        raise RuntimeError('Target must be a Neon PostgreSQL connection.')
    url = url.set(drivername='postgresql+psycopg', host=url.host.replace('-pooler', ''))
    os.environ['FIELDSIGHT_DATABASE_URL'] = url.render_as_string(hide_password=False)
    stamp = datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')
    folder = ROOT / 'backups' / ('neon-transfer-' + stamp)
    folder.mkdir(parents=True)
    source_path = ROOT / 'Database/fieldsight.db'
    backup_path = folder / 'fieldsight.sqlite3'
    with sqlite3.connect(source_path.as_uri() + '?mode=ro', uri=True) as original:
        with sqlite3.connect(backup_path) as backup:
            original.backup(backup)
            if backup.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('SQLite integrity check failed.')
            if backup.execute('PRAGMA foreign_key_check').fetchone():
                raise RuntimeError('SQLite has invalid foreign keys.')
    source = create_engine('sqlite:///' + backup_path.as_posix())
    live = create_engine('sqlite:///' + source_path.as_posix())
    target = create_engine(url, hide_parameters=True, connect_args={'connect_timeout': 15})
    config = Config(str(ROOT / 'alembic.ini'))
    head = ScriptDirectory.from_config(config).get_current_head()
    with source.connect() as s:
        if s.execute(text('SELECT version_num FROM alembic_version')).scalar_one() != head:
            raise RuntimeError('SQLite must be at the current Alembic head before transfer.')
        names = set(inspect(s).get_table_names()) - {'alembic_version'}
        if names != set(SQLModel.metadata.tables):
            raise RuntimeError('SQLite has unrecognized or missing application tables; refusing an incomplete copy.')
        local = read_tables(s)
    report = {'mode': 'apply' if args.apply else 'rehearsal', 'tables': {}, 'account_policy': args.account_policy}
    with target.connect() as d:
        transaction = d.begin()
        try:
            d.execute(text("SET LOCAL lock_timeout = '10s'"))
            d.execute(text("SET LOCAL statement_timeout = '120s'"))
            d.execute(text('SELECT pg_advisory_xact_lock(736284915)'))
            existing = inspect(d).get_table_names(schema='public')
            quoted = ', '.join(d.dialect.identifier_preparer.quote(t) for t in existing)
            if quoted:
                d.execute(text('LOCK TABLE ' + quoted + ' IN ACCESS EXCLUSIVE MODE'))
            # Backup all pre-upgrade public data as well as the provider snapshot.
            old = {}
            for name in existing:
                q = d.dialect.identifier_preparer.quote(name)
                old[name] = [dict(r) for r in d.execute(text('SELECT * FROM ' + q)).mappings()]
            (folder / 'neon-before.json').write_text(json.dumps(normalized(old), ensure_ascii=False), encoding='utf-8')
            config.attributes['connection'] = d
            command.upgrade(config, 'head')
            if not transaction.is_active:
                raise RuntimeError('Alembic unexpectedly ended the enclosing transaction.')
            baseline = read_tables(d)
            remap = {}
            for table_name, natural_key in [('sectors', 'code'), ('users', 'email')]:
                lookup = {r[natural_key]: r for r in baseline[table_name]}
                for row in local[table_name]:
                    other = lookup.get(row[natural_key])
                    if other and other['id'] != row['id']:
                        if table_name == 'users' and args.account_policy is None:
                            raise RuntimeError('Duplicate user email found; specify --account-policy sqlite or neon.')
                        if table_name == 'sectors' and other['name'] != row['name']:
                            raise RuntimeError('Sector codes match but names differ; manual resolution required.')
                        remap[row['id']] = other['id']
            def mapped(value):
                if isinstance(value, UUID):
                    return remap.get(value, value)
                return value
            expected = {}
            allowed_updates = set()
            for table in SQLModel.metadata.sorted_tables:
                rows = [{k: mapped(v) for k, v in r.items()} for r in local[table.name]]
                remote = {row_key(table, r): r for r in baseline[table.name]}
                inserts = []
                expectations = []
                updated = 0
                for row in rows:
                    key = row_key(table, row)
                    other = remote.get(key)
                    if other is None:
                        inserts.append(row)
                        expectations.append(row)
                    elif normalized(row) == normalized(other):
                        expectations.append(row)
                    elif table.name == 'sectors':
                        expectations.append(other)
                    elif table.name == 'users' and args.account_policy in {'sqlite', 'neon'}:
                        if args.account_policy == 'sqlite':
                            condition = table.c.id == row['id']
                            d.execute(update(table).where(condition).values(**row))
                            allowed_updates.add((table.name, key))
                            updated += 1
                            expectations.append(row)
                        else:
                            expectations.append(other)
                    else:
                        raise RuntimeError('Conflicting existing primary key in ' + table.name)
                if inserts:
                    d.execute(table.insert(), inserts)
                expected[table.name] = expectations
                report['tables'][table.name] = {
                    'sqlite': len(rows), 'neon_before': len(remote), 'inserted': len(inserts),
                    'updated': updated, 'neon_after': len(remote) + len(inserts),
                }
                print(table.name, report['tables'][table.name], flush=True)
            actual = read_tables(d)
            for table in SQLModel.metadata.sorted_tables:
                values = {row_key(table, r): r for r in actual[table.name]}
                if len(values) != report['tables'][table.name]['neon_after']:
                    raise RuntimeError('Unexpected row count in ' + table.name)
                for row in expected[table.name]:
                    if normalized(values.get(row_key(table, row))) != normalized(row):
                        raise RuntimeError('Source record verification failed in ' + table.name)
                for row in baseline[table.name]:
                    key = row_key(table, row)
                    if (table.name, key) not in allowed_updates and normalized(values.get(key)) != normalized(row):
                        raise RuntimeError('Existing Neon record was changed in ' + table.name)
            # PostgreSQL enforced all FKs, unique constraints, and required columns on insertion.
            d.execute(text('SET CONSTRAINTS ALL IMMEDIATE'))
            with live.connect() as current:
                current_rows = read_tables(current)
                if any(fingerprint(current_rows[n]) != fingerprint(local[n]) for n in local):
                    raise RuntimeError('SQLite changed during transfer. Pause the local API/worker and retry.')
            report['source_sha256'] = {n: fingerprint(local[n]) for n in local}
            report['verified'] = True
            report['sector_ids_remapped'] = sum(1 for r in local['sectors'] if r['id'] in remap)
            report['user_ids_remapped'] = sum(1 for r in local['users'] if r['id'] in remap)
            if args.apply:
                transaction.commit()
                report['committed'] = True
            else:
                transaction.rollback()
                report['committed'] = False
        except BaseException:
            if transaction.is_active:
                transaction.rollback()
            raise
    (folder / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('Verified and ' + ('committed.' if args.apply else 'rolled back (rehearsal).'))
    print('Backup/report directory:', folder)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # SQLAlchemy/driver exceptions can include row values; never dump them.
        message = str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__
        print('Transfer stopped safely:', message, file=sys.stderr)
        sys.exit(1)
