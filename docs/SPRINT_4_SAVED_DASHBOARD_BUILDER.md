# Sprint 4 — complete the saved dashboard builder

## Audit before implementation

Reviewed the GitHub repository `gabkoi21/Field-Sight` and local main checkout
(`530f8ea1`), including the existing dashboard page, API client, workspace models,
schemas/routes, indicator engine, manual results, saved analysis execution,
authentication and tenant checks. The GitHub default-branch dashboard schema was
also checked through the connected GitHub tool.

Already implemented:

- `AnalyticalDashboard` stores project/organization ownership and a JSON widget
  list. CRUD, duplication, print, text notes, indicator widgets and saved survey
  charts exist. No replacement dashboard system is needed.
- Array order and half/full width are persisted. Existing UI buttons reorder and
  toggle width, but there was no dragging or persisted height.
- The indicator APIs calculate mapped and manual results with date filters. Saved
  charts execute the existing survey analysis engine. Existing admin and project
  access helpers validate widget ownership.

Gaps found:

- No saved dashboard date filters, optimistic version check, height validation,
  drag positioning or pointer resizing.
- Background Kobo successes did not refresh widget queries. Widget-specific
  result execution and source validation were spread across frontend queries.
- Filter effects on overall targets and saved chart bounds were not explained.
  Missing percentage values could be displayed as `Not reported%`.
- Deleted sources could prevent unrelated dashboard edits. Source and loading
  errors could look like empty dashboards. Widgets could not be edited in place.
- Existing tests covered basic dashboard CRUD/source validation, but not complete
  layout/filter reloads, conflicts, data freshness or drag/resize interactions.

Baseline: 143 backend tests and 8 frontend tests passed; frontend build passed.
Existing frontend bundle-size and backend deprecation warnings were present.

## Implementation

### Persistence first

The existing widget JSON remains the layout store. Array order determines
placement in the existing responsive two-column grid. `width` remains 1 or 2;
`height` adds a validated 240–900 pixel size, defaulting to 360 for old widgets.
There are no new tables and no separate widget calculation models.

Dashboard records now store nullable `date_from`/`date_to` and an integer
`version`. Current clients send the version on PUT. A conditional database update
increments it atomically or returns HTTP 409 if another editor saved first. The
UI preserves the last saved layout on failure and offers Reload saved dashboard.
Layout and widget edits save immediately; date changes preview immediately and
persist only when Save filters is selected.

Old width-only widgets and clients without a version remain supported. Read-only
fields in legacy full-object PUTs are ignored. Legacy clients that omit a version
cannot detect edits made before their request reached the server; current clients
should always send the returned version. Moving a dashboard to another project
is rejected: select/create a dashboard in the desired project instead.

### Data correctness and filter rules

`GET /dashboards/{id}/widgets/{widget_id}/results` validates dashboard, widget and
source ownership, then calls the existing indicator `_read` or analysis `_execute`
path. No aggregation or target calculation logic was copied or replaced.

- A dashboard belongs to exactly one project. Project selection switches the
  available dashboards and source lists; it never rewrites a source's project.
- Date bounds are inclusive and filter indicator result dates/submission dates
  through the existing engines. Overall indicator targets remain unchanged.
- A set dashboard date bound replaces the corresponding saved-chart date bound.
  An unset dashboard bound keeps that chart's saved bound. All other saved chart
  filters (form, review status, categories, enumerator, location, grouping and
  measure) remain intact. Clear filters removes dashboard overrides.
- Conflicting inherited chart bounds return a readable error. Invalid dashboard
  dates prevent saving or requesting widget results in the frontend and return
  HTTP 422 in the API.
- Missing values remain unavailable, rather than being converted to zero.
  Unreported percentages no longer append a percent sign. Mapping health is shown
  when the existing indicator engine reports missing/incompatible sources.

The dashboard polls the existing project sync-settings read endpoint every five
seconds while visible. Its last successful timestamp participates in widget query
keys, so a completed or unchanged import causes a fresh result request. Failed
imports do not advance that timestamp. Refresh dashboard data provides an
explicit retry/refresh path. This requires no Kobo sync code or worker changes.
Manual results are also current on navigation/refocus or explicit refresh.

### Existing UI extended

The existing cards, colors, dialogs and controls remain. Widgets now have a grip
for pointer dragging with drop highlighting, a bottom-right pointer resize handle,
and existing up/down/width buttons plus a height selector as keyboard alternatives.
Pointer cancellation, Escape, window blur and unmount clean up drag listeners.
Cards collapse to one column on smaller screens while retaining their saved width.
Tall content scrolls within cards; print removes editing controls and fixed card
height. The layout is a two-column ordered grid, not a free-position pixel canvas.

Existing widgets can be edited in place. Source lists only load when needed in
the widget editor. Empty source lists, empty dashboards/widgets, loading,
unconfigured mappings, removed sources, data errors and save conflicts have
explicit states. Dashboard-list errors do not show a misleading create-first
state. Existing unavailable sources may remain during layout edits; new invalid
or cross-project sources are rejected.

### Access controls

All dashboard/list/result/CRUD paths reuse existing active organization-admin and
project checks. Anonymous requests remain 401; non-admin requests remain denied.
Foreign dashboards and foreign widget data return 404. Create/save validates both
the source row and saved-analysis query project. Removed-source allowances only
apply to an unchanged existing widget reference; they do not permit a new foreign
source. No public sharing or new permissions are introduced.

## Migration and local testing

Revision `0020_dashboard_filters` adds only three columns to
`analytical_dashboards`. Heights and order continue to use JSON. Existing widgets
and records are preserved. Downgrading drops saved filter dates and version
metadata, but keeps widget JSON.

The local development SQLite database was backed up under the ignored backend
`outputs/before-dashboard-sprint-*.db` path and migrated. No production credentials,
environment files, deployment settings, source submissions or indicator
definitions were modified.

For another local checkout, back up its database and stop its services, then run
from `fieldsight-backend`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m scripts.start_local
```

From `fieldsight-frontend`, run `npm run dev`. Sign in as an existing organization
administrator, select a project and open Dashboards. Create a dashboard with a
text widget, an existing indicator and an existing saved analysis. Drag and resize
them, save filters, reload, and confirm order, size and dates persist. Compare
indicator values with Indicator Results and charts with Explore & Analyze. Submit
an authorized local Kobo record and allow five seconds plus fetch time for the
dashboard to refresh. Open the same dashboard in two sessions to check that stale
saves produce a conflict instead of overwriting the newer layout.

No demo or sample data is injected into application views. The browser available
to this chat opened at the normal login screen, so authenticated visual smoke
testing was not completed; authentication was not bypassed. Interaction coverage
uses the real React page with mocked APIs, while backend tests use the real API,
database, authorization and calculation engines with synthetic provider fixtures.

## Validation and remaining limitations

- New backend tests cover CRUD, duplication, JSON layout/filter reloads, default
  heights, bounds, duplicate IDs, optimistic conflicts, deleted sources,
  cross-project/organization restrictions, role denial, saved-query provenance,
  inclusive dates, unchanged targets, successful/failed sync data, and populated
  migration/downgrade/upgrade preservation.
- New frontend tests cover CRUD and widget editing, empty/error/retry states,
  pointer dragging and resizing, keyboard controls, reloads, date preview/save,
  project selection, sync-driven refresh, saved analysis rendering/empty results,
  unavailable percentages and save conflicts.
- Full backend run: **157 passed**. Frontend run: **22 passed**. Production build
  passed. Changed Python files pass Ruff and the three changed Python application
  files pass Mypy. `git diff --check` passes.
- Repository-wide Ruff still reports **seven existing errors** in unchanged
  `scripts/seed_dashboard_sample_data.py` and `scripts/seed_test_field_data.py`.
  Existing Alembic/Starlette deprecations and the frontend large-bundle warning
  remain. There is no configured frontend lint script; TypeScript/build and the
  React review checklist were used.
- Refresh is polling-based, not a push subscription or atomic multi-widget
  snapshot. A commit occurring between widget requests can briefly produce
  different refresh moments; each response independently uses committed data.
- There are at most 30 widgets per dashboard. Layout changes use a full dashboard
  PUT. Public links, collaboration cursors, arbitrary cross-project widgets and
  a free-position canvas remain out of scope.
