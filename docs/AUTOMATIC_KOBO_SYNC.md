# Automatic Kobo synchronization

Automatic synchronization extends the existing validated Kobo importer. Existing projects default to manual mode. The Forms workspace provides automatic scheduling, an interval in seconds, last successful synchronization, and a durable manual queue button. At the user's request, the detailed history table and routine status banners have been removed from this workspace; synchronization continues in the background and audit history remains stored in the backend. Existing synchronous clients can continue using `POST /projects/{id}/sync`.

## Migration and worker rollout

Back up the application database and stop API/worker processes before upgrading. From `fieldsight-backend`, using the existing environment and secrets:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.core.sync_worker
```

Run the worker as a separately supervised long-lived process alongside the existing API. It must use the **same database** and existing Kobo encryption configuration as the API. Configure the process supervisor to restart it after failure. No API startup background task or additional broker is required. No production credentials or deployment files were changed. The October 23 follow-up processed the existing user-requested job in the local development database.

For local development, `python -m scripts.start_local` starts the API and worker
together. It stops both if either process exits, so an API cannot silently keep
accepting jobs after its worker has exited. This launcher uses port 8000 without
hot reload; restart it after backend edits. Stop any existing local API first.
Production must continue using separately supervised services.

### Troubleshooting a sync that stays pending

On October 23, a local manual job waited about 13 minutes with zero attempts
because Uvicorn was running without the sync worker. Starting the worker drained
the queue: two records were received in approximately 1.6 seconds (one new and one
unchanged). The delay was before the download, rather than a slow Kobo response.

Manual requests are picked up at the worker polling cadence (0.1 seconds by
default after the second-interval update, plus time spent on other jobs), independently of the project's automatic
interval. With automatic synchronization unchecked, the displayed interval does
not postpone manual requests.

The interface now shows pending duration and a warning after a minute, plus the
next retry time after a failed attempt. A pending job does not prove that the
worker is currently downloading data: the importer deliberately keeps its claim
uncommitted until completion. The warning says the service may be stopped or busy;
it does not claim to be a worker heartbeat. Check the worker process and the
existing failure history when investigating. New queue timestamps include an
explicit UTC offset so browsers in other time zones calculate wait times correctly.

This follow-up adds no database migration and changes no production settings.

Revision `0018_automatic_sync` adds `sync_schedules`, `sync_jobs`, `sync_settings_changes`, and audit/count fields on `sync_runs`. It preserves existing records. Downgrading removes scheduling and the new history fields; stop workers before downgrading. Tests exercise fresh and populated migration paths using temporary databases.

Optional worker environment variables (defaults shown):

| Variable | Default | Meaning |
| --- | --- | --- |
| `FIELDSIGHT_SYNC_POLL_SECONDS` | 0.1 | Idle poll cadence, 0.05–300 seconds; successful jobs do not add an extra polling sleep |
| `FIELDSIGHT_SYNC_MAX_ATTEMPTS` | 3 | Attempts per queued job, 1–10 |
| `FIELDSIGHT_SYNC_RETRY_SECONDS` | 30 | Initial retry delay, 1–3,600 seconds; doubles per failed attempt |

Project intervals range from **1.6 to 604,800 seconds** (seven days). The form now uses seconds and accepts decimal values. The API accepts `interval_seconds`; legacy clients can still send whole `interval_minutes` from 1 to 10,080. Seconds take precedence if both are supplied. Enabling scheduling makes the project immediately eligible. Changing its interval resets its next due time. Disabling scheduling removes pending scheduled work but preserves explicitly queued manual work. Work that already owns the transaction can finish before the settings update is applied. A scheduled run after an outage imports the current full source once; missed intervals are coalesced.

Revision `0019_sync_seconds` adds nullable fractional-second intervals to schedules and settings audit records. Existing minute-based schedules retain their original cadence. Apply `alembic upgrade head`, then restart the worker; no production configuration or secrets need changing. Downgrading uses the stored whole-minute fallback, rounded up for schedules configured in seconds. The local development database was backed up and migrated, and the selected local project was explicitly enabled at 1.6 seconds at the user's request.

A 1.6-second interval targets the time between scheduled attempts, subject to worker availability and provider response time. Imports never overlap for a project. If an import takes longer, the next attempt waits for completion; Kobo throttling or failures still use the existing retry backoff. The polling interval may be explicitly overridden in deployment environments; it must be short enough for the desired project cadence.

## Durability and consistency

The queue has one row per project. API enqueue operations lock the project before inserting; duplicate requests return the existing pending state. Schedulers claim due schedule rows with a conditional database update. Workers conditionally claim due jobs and hold project/job database write locks through completion. Multiple workers cannot import the same queued job concurrently. A process crash or database outage rolls back its claim, allowing a later worker to retry. Imports and queue removal commit together.

Worker submission writes use a savepoint. Failed imports roll back every submission change while retaining the outer job lock, then commit readable failure history and a future retry time. Exhausted jobs leave their failure history visible and can be manually queued again. Automatic schedules can create a fresh job at a later interval. Every attempt records its trigger, attempt number and actor; settings changes are recorded separately with actor and timestamp. Project deletion cleans up associated scheduling rows using the existing project deletion flow.

The importer still validates the entire paginated download and uses `(project_id, kobo_form_id, external_id)` identity. Unchanged records preserve timestamps and review decisions. Updated answers retain existing review status. The indicator engine continues reading committed submissions; failed or partial imports never become its inputs. The workspace invalidates submission and indicator queries after a successful sync timestamp changes.

`failed` is the size of a downloaded batch rejected atomically. If downloading fails before a complete batch is available, the count is zero (unknown), and the error explains the failure. Received/new/updated/unchanged counts describe committed records only. Both completed and unchanged imports advance the last successful synchronization timestamp; failures do not.

All settings, queue and history APIs retain existing organization-admin authorization and tenant scoping. Jobs contain no tokens or raw answers. Workers decrypt the existing encrypted connection token only when importing and validate that the connection belongs to the project organization and is verified. Database failures are logged without SQL parameters or response payloads.

## Operational limits

Database locks deliberately span the provider download. SQLite serializes writes and may delay other writes during large imports; PostgreSQL provides project-level write concurrency. Provider requests retain existing timeout and pagination bounds, and downloads remain in memory. A database outage can prevent recording failure history until connectivity returns. Queue pending state includes both waiting and running work; it is not a progress percentage. History currently uses the existing organization-wide history API and filters by project in the interface.

## Validation

Backend tests cover schedule enable/disable and interval validation, deduplicated manual requests, two-worker contention, worker crash rollback, exponential retries and exhaustion, tenant/role boundaries, transactional failure counts, indicator values after successful and failed updates, and deletion cleanup. Existing provider-pagination, idempotency and migration tests remain in place.

Final validation after the October 23 second-interval follow-up: the full backend suite passed **143 tests**; the frontend suite passed **8 tests** and the production build passed. Tests include validation and scheduling of a 1.6-second interval and preservation of legacy minute-based settings.

Frontend tests use Vitest/Testing Library to check automatic enablement and interval selection, manual requests and readable errors, duplicate prevention, settings-load errors and unavailable connections. Run `npm test` and `npm run build` from `fieldsight-frontend`; run `python -m pytest` from `fieldsight-backend`.

Existing repository-wide Ruff failures remain in `scripts/seed_dashboard_sample_data.py` and `scripts/seed_test_field_data.py` (seven errors); changed Python files pass Ruff. Existing Alembic/Starlette deprecation warnings and the frontend bundle-size warning remain. npm reported dependency security advisories during test-tool installation; they have not been remediated or classified against a dependency baseline in this task.
