# Administrator journey: implemented follow-up

## Synchronization visibility

The worker now publishes a heartbeat every five seconds on a separate thread,
independent of SQLite's import write lock. Running evidence is published only
after the conditional queue claim owns that transaction. It includes the exact
queue creation timestamp, so evidence from an earlier job cannot label a new
job as running. A heartbeat older than 20 seconds marks execution unconfirmed;
it does not mark the import failed or release the queue. Existing transaction
rollback, automatic retry, deduplication and concurrency protections remain
authoritative.

API and worker must share the telemetry directory. SQLite defaults to
`<database filename>.sync-workers` beside the configured database. Compose sets
`FIELDSIGHT_SYNC_TELEMETRY_DIRECTORY=/data/sync-workers` on both services and uses
their shared volume. For PostgreSQL or separate hosts, explicitly configure a
shared directory supporting atomic replacement; without it, health is unknown.
Restart API and workers together when adopting this version. Old workers do not
publish the new independent execution evidence.

## Pooled manual percentages, rates and ratios

Migration `0025_manual_pooled_results` adds nullable numerator/denominator fields,
an explicit aggregation method and a rate multiplier. All existing indicators
default to `legacy`; existing results do not change.

Indicator settings offer legacy mean, explicitly selected unweighted mean, or
pooled fractions. Pooling calculates `sum(numerator) / sum(denominator)`, multiplied
by 100 for percentages, by the selected population multiplier for rates, and by
1 for ratios. The same calculation service computes overall, period, location,
dashboard, CSV-report and PDF-report results. Zero numerator is a reported zero;
no eligible fractions is no data. Denominators must be positive and finite;
percentage numerators cannot exceed denominators. Unsupported numeric ranges
are rejected.

Legacy entries without denominators cannot be silently converted. Retain their
indicator and create a separate pooled indicator with the underlying counts.
Manual-only indicators no longer query the survey submission dataset.

## Saved quality review and pagination

Migration `0026_quality_review` adds reviewer assignments, review events and saved
validation findings. Notes, assignments, validation changes and administrator
decisions retain their author and UTC timestamp. Reviewers must be active
administrators in the same organization. Review history is retained when marking
a record ready, and can be revisited using **Include reviewed findings**.

The main quality screen uses a SQL-paginated snapshot queue and database status
counts, fetching details/history for the selected submission. Findings reflect
the last validation; run validation after sync. Validation still inspects the
complete project dataset to preserve duplicate detection. Historical review
decisions before this migration are not fabricated or backfilled. The older
`/quality/issues` endpoint remains compatible.

## Reports and exports

Submission export streams every matching record, independent of the table page.
It uses the same project/search/review filters, plus the chosen UTC date window.
CSV cells escape spreadsheet formulas. Export requests record a real organization
administrative event. The backend streams rows in bounded batches; the browser
still buffers the downloaded CSV, so very large asynchronous export jobs remain
a future improvement.

**Download PDF** creates a server-generated report using the authoritative
indicator service. It includes project scope, reporting dates, sync freshness,
submission quality counts, baseline/target/actual, calculation methods and source
counts. It explicitly states that FieldSight does not retain a historical report
snapshot. ReportLab embeds its bundled Vera fonts. Long narratives flow across
pages rather than overflowing a table row. The existing print control remains
available.

The synthetic PDF sample was extracted and visually inspected after Poppler
rendering. Tests cover a zero result, no data, pooled percentages, page footers,
long narrative pagination, and escaping literal markup. No production information
appears in that sample.

## Account recovery remains disabled

Password recovery remains disabled at the user's explicit request. No email provider
was connected or outbound email sent. Account help continues to direct users to
their administrator. A future recovery implementation must use an approved delivery
provider, expiring single-use tokens, throttling and session revocation.

## Verification and adoption

Verification passed: 187 backend tests, 44 frontend tests, Ruff, mypy across 49
source files, and the frontend production build. The three report/export tests
also passed after the final qualitative missing-answer count correction. The
build retains its large-bundle warning.

Tests use disposable databases and mocked provider calls. The migration regression
upgrades and downgrades the new schema with legacy manual records present and
checks their retained values. Concurrency tests observe running execution while
SQLite holds the import lock; stale evidence cannot apply to another job. Review
and export tests cover authorization, organization isolation and persistence.

Install updated backend dependencies (`reportlab` runtime; `pypdf` for tests), back
up the application database, apply Alembic migrations, then restart API and worker.
The existing developer database was not migrated or modified during this work.
No deployment or destructive live Kobo call was performed.
