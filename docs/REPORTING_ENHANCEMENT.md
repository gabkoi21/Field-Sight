# Reporting enhancement delivery

Implemented on `dev`; no commits, pushes, merges, application database resets, or live database migrations were performed. Pre-existing edits to styles.css, DashboardsPage.tsx, WorkspaceShell.tsx, and WorkspaceUI.tsx were preserved.

## Phase delivery and exact files

| Phase | Functionality | Files created or modified |
| --- | --- | --- |
| 0: audit | Confirmed dev, live-only reports, shared indicator calculation contract, organization-admin policy, ReportLab exports, Recharts, and migration head 0036 | Existing routes/reports.py, core/project_report.py, core/indicator_results.py, routes/indicators.py, models/operations.py, migrations, frontend workspace/API/tests reviewed |
| 1: foundation | Saved documents, built-in monthly/quarterly/donor templates, plain-text narrative sections, strict input/resource validation, pagination and optimistic draft updates | **New:** fieldsight-backend/app/models/reporting.py, app/schemas/reports.py, app/core/report_templates.py, alembic/versions/0037_saved_reports.py. **Modified:** fieldsight-backend/app/models/__init__.py, app/routes/reports.py |
| 2: editor | Saved report list, project/template selection, five workflow steps, narrative editing, draft reopen/duplicate/delete, loading/error feedback | **New:** fieldsight-frontend/src/workspace/SavedReportsWorkspace.tsx. **Modified:** fieldsight-frontend/src/workspace/WorkspaceReportsPage.tsx, src/services/apiClient.ts |
| 3: periods/results | UTC monthly/quarterly/semiannual/annual/custom periods, selected indicators, per-indicator actual/overall target charts, period trends/targets, authoritative status counts and calculation notes | **New:** fieldsight-frontend/src/workspace/reportPeriods.ts. Integration uses existing Indicators service; no new calculation engine |
| 4: PDF | Cover, organization/project context, authored sections, vector actual-target/trend charts, repeatable table headers, wrapping paragraphs, footers, page numbers, safe filenames | **Modified:** fieldsight-backend/app/core/project_report.py, app/routes/reports.py. Existing live PDF implementation retained |
| 5: publication | Preview hashes, revision conflicts, serializable capture, atomic snapshot/PDF persistence, idempotent publishing, read-only historical views, project history protection | **Modified:** fieldsight-backend/app/routes/reports.py, app/routes/organizations.py. Models/migration above store immutable-through-API history and PDF bytes |
| 6: verification | Lifecycle, permissions, review eligibility, source-change conflicts, migrations, long PDFs, frontend workflows, charts and responsive checks | **New:** fieldsight-backend/tests/test_saved_reports.py, fieldsight-frontend/src/workspace/SavedReportsWorkspace.test.tsx. **Modified:** fieldsight-frontend/src/workspace/WorkspaceReportsPage.test.tsx (existing live tests still exercise the preserved live component) |

All paths in the table are repository-relative; abbreviated backend paths remain beneath fieldsight-backend and abbreviated frontend paths beneath fieldsight-frontend.

## Migration and storage

`0037_saved_reports` follows `0036_username_only_enumerators`. It adds reports and report_snapshots without modifying project, indicator, or submission rows. Includes tenant/project and project/status indexes, creation-time index, unique report publication, report/version uniqueness, and foreign keys. Downgrade refuses populated reporting tables rather than discarding history.

Durable PDF storage follows the repository's existing table-export artifact convention: PDF bytes and canonical versioned JSON live in the database, protected by the same access checks and backup policy. This deliberately avoids ephemeral Render files and an additional object-storage dependency. Database backups must include these tables. There is no external object bucket or branding asset loader in this phase.

Deployment: from fieldsight-backend, run `.venv/Scripts/python.exe -m alembic upgrade head` against the intended configured database before deploying the frontend. This command was exercised against disposable test databases only. No application database was upgraded during implementation.

## API

All routes use the existing organization-admin membership policy and project authorization. Report lookup also constrains organization identity. Other roles were not granted new permissions.

- GET /report-templates
- GET /projects/{project_id}/reports?offset=0&limit=25 (limit up to 100)
- POST /projects/{project_id}/reports
- GET /reports/{report_id}
- PATCH /reports/{report_id} (complete editable fields plus expected_revision)
- DELETE /reports/{report_id}?expected_revision=N (draft only)
- POST /reports/{report_id}/duplicate (creates an independent draft)
- GET /reports/{report_id}/preview (captured document and SHA-256 content hash)
- POST /reports/{report_id}/publish (expected_revision and preview_hash)
- GET /reports/{report_id}/snapshot (published only)
- GET /reports/{report_id}/export.pdf?preview_hash=... (optional draft hash rejects changed source data)
- Existing GET /projects/{project_id}/report.pdf preserved
- Existing project deletion now returns 409 when saved reports exist; archive the project to retain its reporting history.

## Snapshot and security behavior

Preview/publication open a separate serializable transaction, avoiding inconsistent reads across indicator queries and submission counts. SQLite explicitly starts BEGIN IMMEDIATE; PostgreSQL uses serializable MVCC. Publication re-captures the authoritative results and compares the preview hash and report revision. Draft changes, target/result changes, review changes, or source metadata changes require a fresh preview. Serialization conflicts return 409.

PDF generation precedes the status transition; snapshot insertion and report publication commit together. Failures roll back. Retried publication of an already published report returns that publication without another snapshot or PDF. Saved PDFs are served from stored bytes, never recomputed from live sources. Corrections use duplication and a new publication; the original remains available. Duplication retains configured indicator references and can require updating a selection if an indicator has been deleted.

Narratives are explicitly plain text, displayed through React text nodes and XML-escaped for ReportLab. HTML is shown as text. No findings are generated. The snapshot includes displayed indicator definitions/results/period history, narratives, organization/project details, framework, review counts, calculation notes, UTC policy, latest successful sync metadata and publication identity/timestamp. It does not include tokens or raw submission answers. CSV formula protection and live CSV/print/PDF remain in the live report view.

## Verification commands and results

Run backend commands from fieldsight-backend and frontend commands from fieldsight-frontend.

- `.venv/Scripts/python.exe -m pytest tests/test_saved_reports.py tests/test_report_exports.py tests/test_project_deletion.py tests/test_indicator_results.py tests/test_indicator_reliability.py tests/test_migrations.py --basetemp=../tmp/reporting-final-validation -q --tb=short`: all 76 tests in that run passed. A subsequent safeguard test and strengthened PDF assertion were verified with `.venv/Scripts/python.exe -m pytest tests/test_saved_reports.py --basetemp=../tmp/reporting-final-safeguards-v2 -q --tb=short`: 10 passed.
- `.venv/Scripts/python.exe -m mypy app/routes/reports.py app/schemas/reports.py app/models/reporting.py app/core/project_report.py --follow-imports=silent`: passed.
- `.venv/Scripts/python.exe -m ruff check app/core/project_report.py app/core/report_templates.py app/models/reporting.py app/schemas/reports.py app/routes/reports.py alembic/versions/0037_saved_reports.py tests/test_saved_reports.py`: passed.
- `npm run build`: passed (TypeScript and Vite production build).
- `npm test -- src/workspace/SavedReportsWorkspace.test.tsx src/workspace/WorkspaceReportsPage.test.tsx`: 9 passed, including real Recharts SVG rendering with a sized test container.
- `npx tsc -b`: passed.
- `git diff --check`: passed.
- Full backend `pytest --basetemp=../tmp/reporting-full-suite -q`: 13 failures outside Reporting. All 13 reproduced against an isolated archive of unchanged Git HEAD: one action-migration rollback failure (projects.slug), eleven legacy development-reset failures, and one local-launcher command assertion. The temporary baseline comparison never touched the application's database.
- Full frontend `npm test`: 303 passed, 1 failed at the time of that run. SyncControls.test.tsx expects locale formatting while SyncControls uses the shared UTC formatter. Both files are unchanged by this work. The later chart test adds one additional passing focused test.
- Full backend `ruff check app tests`: 18 existing errors in test_administration.py and test_saved_dashboards.py. The reporting files pass their focused lint check. The frontend package has no lint script.
- Initial sandboxed TestClient runs could not initialize Python's local asyncio socket pair. Verified tests ran outside that network restriction, with disposable SQLite databases and provider HTTP blocked by the test fixture. No production API calls were made.

## Visual checks

Generated and rendered an eight-page synthetic PDF with long narrative text, mixed missing values, negative values, and an 80-row history table. Inspected cover, flowing paragraphs, vector chart, repeated table headings and final narrative pages. Text extraction checks content, table pagination and every page number.

Headless Chrome used synthetic API responses at 1440px desktop and 390px mobile. Verified report creation and quarterly selection, captured the saved-list/editor/period views, and confirmed mobile document scrollWidth equals viewport width. Sidebar transition was disabled for stable screenshots. QA files are temporary under tmp/pdfs, not production artifacts.

## Manual validation

1. Apply migration 0037 in a test deployment and sign in as an organization admin.
2. Open /reports, choose a project, create each template, and verify its generated narrative sections.
3. Select a calendar period and a custom date range; verify UTC boundaries and invalid-range feedback.
4. Include numeric, decrease-direction, missing-target and qualitative indicators; compare their values and notes with Indicators for the same dates.
5. Save, reopen, edit and duplicate a draft. Open it in two sessions to verify stale revision conflicts.
6. Save and preview, then change a source result or target in another session. Publishing the old preview must fail with 409; review a fresh preview and publish.
7. Download the publication, then synchronize/review source records and rename/change indicator targets. Reopen the publication and confirm its content and PDF remain unchanged.
8. Verify published reports have no edit/delete controls, duplicate publication retries retain one snapshot, and project deletion requests suggest archiving.
9. Attempt cross-tenant report URLs and use an enumerator account; access must be denied. Check desktop/tablet/mobile keyboard navigation and PDF output.
10. Open Live project report and verify CSV, date filtering, live PDF and browser print remain available.

## Known limits

PostgreSQL-specific concurrent writer behavior has not been exercised against a dedicated PostgreSQL test instance; automated integration tests use SQLite. The serializable workflow is implemented for PostgreSQL, but staging validation remains recommended. PDF rendering is synchronous and database-backed PDF artifacts increase database storage; no asynchronous export worker is added. Branding logos, rich HTML, custom template design, scheduled reporting, Word exports and formal replacement-publication links are not implemented. Corrections currently use clearly titled duplicate reports. Draft content is saved explicitly, not autosaved. Existing repository-wide regression/lint failures prevent claiming a completely green repository suite.
