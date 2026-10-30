# FieldSight backend

FastAPI backend for FieldSight using SQLModel and Neon PostgreSQL. Local development and the online
backend use the FieldSight project's `production` branch via `FIELDSIGHT_DATABASE_URL`.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
# Configure FIELDSIGHT_DATABASE_URL in the private .env before starting the app.
$env:FIELDSIGHT_ENVIRONMENT = "development"
$env:FIELDSIGHT_CORS_ORIGINS = "http://localhost:5173"
alembic upgrade head
python -m scripts.start_local
```

The local launcher starts **both the API and Kobo synchronization worker** and
stops both if either exits. Restart it after editing backend code. Starting only
Uvicorn leaves queued synchronizations waiting indefinitely. Do not launch the
combined command while another API is already listening on port 8000.

For API hot reload, use two terminals instead: run `uvicorn app.main:app --reload`
in one and `python -m app.core.sync_worker` in the other, both from this directory
with the same virtual environment and configuration. Restart the worker after
editing its backend code. Production continues to use separately supervised
services; see [automatic synchronization](../docs/AUTOMATIC_KOBO_SYNC.md).

For the local demo organization, run `python -m scripts.create_demo_organization`
and enter the desired demo password at the prompt. This creates or updates
`org@gmail.com` as an administrator of **Demo Organization** in development
SQLite only. It does not send email. The frontend uses the login screen by
default; `VITE_SKIP_LOGIN=true` explicitly enables the local preview bypass.

Development probes:

- `GET /health/live`
- `GET /health/ready`
- `GET /status`

Run `ruff check .`, `mypy app`, and `pytest` before committing.

To initialize a new Neon database and create the first administrator, add
`FIELDSIGHT_DATABASE_URL` to the ignored `.env` file and run:

```powershell
python scripts/setup_neon.py --email "admin@example.org" --username "superadmin" --full-name "Admin Name"
```

Neon PostgreSQL is the active database. SQLite is retained only as a migration backup and for isolated
tests. New data models must use Alembic migrations; do not call `SQLModel.metadata.create_all()` during
normal application startup. Use a direct Neon URL for schema migrations and the pooled URL at runtime.

### Transfer existing SQLite records to Neon

`setup_neon.py` initializes a database; it does not copy SQLite records. For an existing database,
put the Neon URL in the ignored `.env.neon-migration` file as `NEON_MIGRATION_DATABASE_URL`.
Keep the existing JWT and Kobo encryption secrets. Pause the local API and sync worker before
the final transfer, and create a Neon snapshot of the destination first.

```powershell
# Rehearse: schema upgrades and data changes are verified, then rolled back together.
python scripts/migrate_sqlite_to_neon.py --account-policy sqlite
# Commit the verified merge, choosing SQLite profile/password details for matching emails.
python scripts/migrate_sqlite_to_neon.py --account-policy sqlite --apply
```

Use `--account-policy neon` instead to retain the destination account details. Matching user emails
and sector codes reuse the Neon IDs, with incoming foreign keys remapped. Other conflicting records
stop the transfer. Existing destination records are retained. The tool checks every source table,
all copied fields, row counts, existing records, and whether SQLite changed during the operation.
It saves SQLite backups, pre-upgrade Neon public records, and a verification report under ignored
`backups/neon-transfer-*` directories. Treat these backups as sensitive.

After successful verification and commit, set `FIELDSIGHT_DATABASE_URL` in the private `.env` and
backend host secrets to the Neon pooled URL, then restart the API and worker. Keep the SQLite backup.
An older Neon Kobo connection encrypted with a different key needs its original key or reconnection.

## Deployment configuration

The private `.env` is deliberately excluded from Git and Docker builds; `.env.example` has been removed.
The local file contains generated JWT and Fernet keys. On a new server, provision these through your hosting
provider's secret settings or securely transfer the private file. Never print it in CI or paste resolved
`docker compose config` output into logs. A `.env` file is plaintext configuration, not a managed secret vault.
On Linux, restrict it to the deployment account with `chmod 600 .env`. The Windows copy has a restricted ACL.
This workspace is under OneDrive: filesystem permissions do not prevent cloud synchronization; store production
secrets outside synced folders on the deployment host.

Set `FIELDSIGHT_ENVIRONMENT=production`, `FIELDSIGHT_JWT_SECRET` to a cryptographically generated value of at
least 64 characters, and `FIELDSIGHT_KOBO_TOKEN_ENCRYPTION_KEY` to a Fernet key. Keep the Kobo key backed up
separately from the database. Replacing it makes existing encrypted tokens unreadable; reconnect Kobo or perform
a deliberate re-encryption migration. Changing the JWT secret invalidates existing signed access tokens.

Set `FIELDSIGHT_CORS_ORIGINS` to comma-separated exact HTTPS frontend origins, without trailing slashes.
Its empty default in the private deployment file allows no cross-origin browser access. Configure
`FIELDSIGHT_UPLOAD_BASE_URL` with your real HTTPS upload service before using upload URLs.

For the included single-host Compose deployment, place an HTTPS reverse proxy in front of the loopback-only
API port. Compose reads the Neon URL from `.env` and runs as a non-root user. The historically named
`fieldsight_sqlite` volume is retained for shared worker telemetry; the database itself is in Neon.
An existing telemetry volume must allow UID 10001 to write before starting the updated container.

```sh
docker compose build
docker compose run --rm api alembic upgrade head
docker compose up -d
```

Run migrations with a direct Neon URL after backing up existing data. Database records are stored in Neon;
these commands do not transfer SQLite records. TLS, DNS, hosting-provider secret storage and
the public frontend origin must be configured on the actual deployment host.

