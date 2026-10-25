# Organization administrator review

Later implementation supersedes several limitations below. See
[administrator follow-up](ADMIN_JOURNEY_FOLLOWUP.md) for independent execution
heartbeats, pooled manual results, persisted quality reviews, full CSV export,
verified PDF generation and the email delivery dependency.

## Delivered changes by phase

1. Project navigation: persistent selection while navigating, a header selector,
   direct Indicators / Data Quality / Field Team links, and a setup checklist
   derived from saved project assignment, successful sync history, configured
   indicators and project dashboards. Pending/error checklist queries have
   separate states. Frontend checklist regressions cover scoped action links.
2. Synchronization: retain the database queue, transaction ownership, backoff and
   idempotent import. Expose the most recent attempt, counts, safe error and the
   actual last worker poll. Compose starts a separately supervised worker using
   the API's volume, database and environment. A poll is not proof that a queued
   job is running. A busy worker may have an old poll; the UI explains that limit.
3. Quality: scoped navigation and URL selection, explicit ready-only calculation
   rules, truthful review feedback, calculation cache invalidation, and clearly
   labelled unsaved session notes/reviewer previews. No invented review history.
4. Indicators: retain existing calculations and zero/no-data behavior. Add an
   explicit administrator acknowledgement of the unweighted mean for manual
   percentages, rates and ratios. Existing records retain the same results and
   are identified as legacy behavior until acknowledged. This method gives each
   entry equal weight; it does not pool populations. For pooled percentages use
   a mapped percentage over individual source records. No numerator/denominator
   manual-entry aggregation was introduced. Dashboard/report interpretation uses
   the same backend indicator result service.
5. Protection: Archive / Restore replaces deletion in the project action dialog.
   Archive retains all evidence and Kobo assets, cancels pending work and disables
   automatic synchronization. A transaction already importing completes before
   archival takes the project lock. Restore returns to active status with manual
   sync; it does not silently resume a schedule. Permanent local DELETE performs
   local transactional cleanup only. Provider deletion is a separate POST to
   `/organizations/{org}/projects/{project}/delete-kobo-form`, requires an archived
   project and exact `confirmation=DELETE KOBO <form ID>`, and refuses shared forms.
   Provider 404 is retry-safe. If local event recording fails after provider
   success, retained local records remain and the provider action can be retried.
6. Access/accounts: retain invitation expiry/revocation, hashed invitation tokens,
   membership and assignment controls. Clarify that FieldSight invitations never
   create Kobo accounts. Persist real project lifecycle, submission review and
   provider-deletion events, with tenant-scoped recent history in settings.
   This is a bounded event history, not a complete compliance audit.
7. Dashboards/reports: show project/date scope, last successful sync and indicator
   quality context; retain saved dashboards and source links. Reports explicitly
   describe current data rather than historical snapshots; CSV includes exclusion
   counts and calculation notes. Print styles remove app chrome, repeat table
   headers and wrap long cells. Browser PDF rendering remains a separate check.
8. Performance/accessibility: submission list pagination/search/review filtering
   runs in SQL with tenant constraints and stable date/ID ordering. Scoped count
   cards remain full-project counts. Submission CSV is explicitly current-page
   and selected-period only, with formula escaping. Table counts use SQL grouping;
   cached-schema table pages use SQL pagination. Legacy tables without schema
   metadata still infer fields from all records to avoid silently dropping fields.
   Heavy result routes load lazily; form-assignment and shared modals handle focus.

## Database changes

- `0022_worker_heartbeat`: last real poll per worker process.
- `0023_manual_mean_choice`: false by default, preserving legacy averages.
- `0024_admin_events`: real organization administrative events.

Use Alembic to upgrade after backing up the deployment database. No migration was
run against the developer's existing FieldSight database. Disposable test and
browser databases only were used. Older migrations use current metadata, so the
new migrations guard against tables/columns already created by that baseline.

## Verification and dependencies

The backend suite includes sync deduplication/retries/concurrency/rollback,
tenant authorization, indicators, saved dashboard filters, migration tests and
new archive/restore, heartbeat, explicit provider confirmation, manual zero vs
no-data, and paginated submission regressions. Kobo calls are mocked.

The initial sandbox blocked asyncio's loopback socket pair before TestClient
could start. Running tests with local sockets available separates that environment
failure from application failures. Backend typing issues found during review
were corrected without changing authorization or calculation contracts.

No outbound email service or delivery configuration exists in the application.
Invitations remain copy-link delivery and account help honestly directs users to
their administrator. Secure automated recovery still requires an email provider,
single-use expiring hashed recovery tokens, throttling and delivery verification;
no pretend reset-email action was added.

Final verification: 173 backend tests passed, plus 10 protection regressions
rerun after lock-order hardening. All 39 frontend tests passed. `mypy app` passes
across 45 source files; frontend TypeScript/Vite build passes. Full Ruff checks
pass after removing the temporary QA server helper. Remaining output consists
of upstream deprecation warnings and Vite's bundle-size warning.

Browser verification used an isolated loopback API, a new SQLite database and
synthetic provider responses. Verified sign-in, project creation, form assignment,
queued sync and completion (5 received / 5 created), validation (one short
interview), review feedback, question mapping and sum (30), dashboard/widget
persistence, saved date-filter persistence and no-data behavior after reload.
CSV downloaded successfully and its actual value of 30 and five eligible records
were checked. The report was inspected at 390px width. Actual PDF output was not
rendered or verified. The screenshot under `outputs/organization-admin-review/`
contains synthetic QA data only.

No production data, destructive live Kobo calls, or deployment was used. The
frontend still emits a large-bundle warning despite route splitting. Quality
review and aggregate calculations still load full eligible datasets; further
optimization must preserve exact calculations. Worker polls do not expose
live per-job execution telemetry while the worker transaction is uncommitted.
