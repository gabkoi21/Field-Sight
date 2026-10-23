# FieldSight backend

FastAPI backend for FieldSight. The current foundation uses SQLite and SQLModel. Phase 2 introduces identity, tenant models, roles, sectors, and the first application tables.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
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

SQLite is the active database. New data models must use Alembic migrations; do not call `SQLModel.metadata.create_all()` during normal application startup.

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

For the included single-host SQLite deployment, place an HTTPS reverse proxy in front of the loopback-only
API port. Back up the SQLite volume. Compose reads `.env` at runtime and runs as a non-root user.
An existing volume must allow UID 10001 to write before starting the updated container.

```sh
docker compose build
docker compose run --rm api alembic upgrade head
docker compose up -d
```

Run migrations after backing up existing data. The Docker volume is separate from the local `fieldsight.db`;
these commands do not migrate local records into that volume. TLS, DNS, hosting-provider secret storage and
the public frontend origin must be configured on the actual deployment host.

