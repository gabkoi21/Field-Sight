# Data table exports

Open a project → Data tables → Open data table → Export data.

The dialog offers File format, Reporting period, and Breakdown by county. All dates
and All counties are the defaults. Weekly, every-two-weeks, and monthly periods show
a date or month picker. Weekly periods start Monday; two-week periods start on the
chosen date. Downloads include every status and answer column; records are sorted
by county. Choosing one of Liberia's 15 counties filters using the survey county
answer and its choice label. All counties also retains unknown or missing counties.
If a table has no county field, use All counties. The period and summary options
described below remain available to API clients and existing schedules.

Supported downloads: Excel, CSV, JSON, PDF. Excel includes Summary, Period breakdown,
Records, and Field definitions sheets, depending on the selected content. Records-only
CSV is a rectangular dataset; summary/both CSV uses labeled sections. PDF splits wide
datasets into column bands and repeats record IDs. JSON preserves selected answer types.

Weekly reports use the selected week start. Two-week reports use the chosen start date
as their cycle anchor. Monthly reports use calendar months. Custom bounds are inclusive.
Reporting timestamps are interpreted in the selected IANA timezone (naive timestamps
are UTC). Survey date-only answers retain their calendar date. Invalid or missing dates
are counted and excluded from dated periods, and included in all-date exports.

Comparison uses the previous calendar month for monthly reports, and an equally sized
preceding interval otherwise. A zero prior count produces no percentage change. Numeric
results are total or average of valid answers for the selected numeric field, not an
indicator calculation. Missing/invalid answers are counted separately. Review status
and search filters apply to both current and previous periods. Exports include all
matching records, independent of table pagination, up to 100,000 source records per table.

## Deployment

1. Install updated requirements: `python -m pip install -r requirements.txt`.
2. Apply the migration: `python -m alembic upgrade head`.
3. Run `python -m app.core.table_export_worker` every 5 minutes from the backend
   directory, with the same database and environment as the API. Use the host scheduler
   (cron on Linux or Task Scheduler on Windows). This command runs once and exits.

Docker Compose includes a `report-worker` service with `--watch`; after migrations,
`docker compose up -d --build api report-worker` activates periodic generation.
For a non-Docker process supervisor, run `python -m app.core.table_export_worker --watch`.

The worker creates one report per due schedule per invocation, catches up missed periods
on subsequent invocations, and skips paused schedules. PostgreSQL row locks and a unique
schedule/period constraint prevent duplicates. Use a single worker when using SQLite.
Reports are stored in the database and available through authenticated downloads in the
Export dialog (latest 24 per schedule). No email or external delivery is performed.
Schedule-owner access is rechecked on every run. Failures appear in schedule history
and retry next invocation without advancing the reporting period.

Schedules run after the local period end. Past starts intentionally backfill from that
period. Reports reflect the database at generation time; later edits do not rewrite
saved files. To change settings, pause the old schedule and create a new one. Reports
are retained until an operator applies the organization's retention policy; monitor
database size. Worker activation on the deployment host is a required deployment step.
