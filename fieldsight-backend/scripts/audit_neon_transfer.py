"""Read-only comparison of the current local database with the Neon target."""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import dotenv_values
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel

from app.models import identity, operations, workspace  # noqa: F401

root = Path(__file__).resolve().parents[1]
url = make_url(dotenv_values(root / '.env.neon-migration')['NEON_MIGRATION_DATABASE_URL'])
url = url.set(drivername='postgresql+psycopg', host=url.host.replace('-pooler', ''))
source = create_engine('sqlite:///' + (root / 'Database/fieldsight.db').as_posix())
target = create_engine(url, hide_parameters=True, connect_args={'connect_timeout': 15})
with source.connect() as s, target.connect() as d:
    inspector = inspect(d)
    existing = set(inspector.get_table_names())
    for table in SQLModel.metadata.sorted_tables:
        if table.name not in existing:
            print(table.name, 'new table')
            continue
        available = {c['name'] for c in inspector.get_columns(table.name)}
        columns = [c for c in table.c if c.name in available]
        keys = [c.name for c in table.primary_key]
        local = {tuple(r[k] for k in keys): dict(r) for r in s.execute(select(*columns)).mappings()}
        remote = {tuple(r[k] for k in keys): dict(r) for r in d.execute(select(*columns)).mappings()}
        shared = local.keys() & remote.keys()
        differing = Counter()
        for key in shared:
            for name in local[key]:
                a, b = local[key][name], remote[key][name]
                if hasattr(a, 'tzinfo') and hasattr(b, 'tzinfo'):
                    a, b = a.replace(tzinfo=None), b.replace(tzinfo=None)
                if a != b:
                    differing[name] += 1
        print(table.name, 'local', len(local), 'neon', len(remote), 'shared IDs', len(shared),
              'differing fields', dict(differing))
        constraints = inspector.get_unique_constraints(table.name)
        constraints += [i for i in inspector.get_indexes(table.name) if i.get('unique')]
        for constraint in constraints:
            names = constraint['column_names']
            if not set(names) <= available:
                continue
            lookup = {tuple(str(r[n]) for n in names): k for k, r in remote.items()
                      if all(r[n] is not None for n in names)}
            collisions = sum(1 for k, r in local.items() if all(r[n] is not None for n in names)
                             and tuple(str(r[n]) for n in names) in lookup
                             and lookup[tuple(str(r[n]) for n in names)] != k)
            if collisions:
                print('UNIQUE KEY COLLISIONS', table.name, names, collisions)
