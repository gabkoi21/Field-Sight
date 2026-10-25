# Local activation — 25 October 2026

The existing local SQLite database was upgraded from `0021_deleted_connections`
to `0026_quality_review`. Migrations 0022–0026 applied successfully.

## Backup and preservation

Verified SQLite backup: `fieldsight-backend/backups/activation-20261025-000922/fieldsight.db`.
The adjacent manifest records the source, original revision, row counts and SHA-256.
The backup passed SQLite integrity checking. After migration, every row and every
pre-existing column value in every original application table matched the backup.
The migrated database passed integrity and foreign-key checks. Existing data
included two projects, 31 submissions, five indicators and one saved dashboard.
Backups are excluded from Git.

## Runtime

Updated backend requirements are installed in the existing `.venv`.
`pip check` found no broken requirements. API and worker were stopped for backup
and migration, then restarted together with `python -m scripts.start_local`.
The frontend development server remains at `http://localhost:5173`.
The API listens on `http://127.0.0.1:8000`.
Background service logs are in `fieldsight-backend/outputs/followup-activation/`.

## Verification

- API liveness and database readiness returned HTTP 200.
- Browser CORS preflight for `http://localhost:5173` returned HTTP 200 with the correct origin.
- Worker telemetry contained a fresh heartbeat.
- Quality queue and CSV routes rejected unauthenticated requests with HTTP 401.
- The PDF route is registered; password recovery endpoints remain absent.
- Targeted backend regressions passed for migrations, admin workflow, persisted
  quality review, pooled results, CSV/PDF exports, and concurrent worker telemetry.
  These used disposable databases and mocked provider calls.
- All 44 frontend tests passed; the production build passed with the existing large-bundle warning.
- The local browser loaded the sign-in screen. The authenticated browser
  walkthrough remains pending the user's organization-administrator sign-in.

No live Kobo sync was manually triggered and no outbound recovery email was sent.
The restarted worker resumes normal operation with existing synchronization settings.
Password recovery remains disabled as requested.
