# FieldSight — Codex Implementation Guide & Product Blueprint

**Version:** 1.0  
**Prepared:** 2026-10-22  
**Repository:** https://github.com/gabkoi21/Field-Sight  
**Primary design/workflow reference:** [TolaData main documentation](https://www.toladata.com/docs/)  
**Secondary data analysis/visualization reference:** [DHIS2 analytics](https://dhis2.org/features/analyze/)

> **Important:** Use TolaData and DHIS2 for product/workflow inspiration only. Build an original FieldSight UI and implementation. Do not scrape authenticated screens, copy proprietary code/assets, or assume their exact backend designs. Respect data privacy and organizational permissions.

## 1. Product vision

FieldSight is a multi-organization field-data, monitoring, evaluation, and analysis platform. Field workers collect survey responses in KoboCollect/KoboToolbox. Organization admins connect Kobo accounts, assign forms to projects, synchronize responses into FieldSight, review data quality, explore results, map answers to M&E indicators, build custom dashboards, and export reports.

**North star workflow:** KoboCollect → KoboToolbox API v2 → verified sync → stored submissions → data quality → dynamic analysis → indicator calculations → dashboards → reports.

**Two dashboard experiences:**
1. **Operational dashboard (automatic)**: project count, active forms, submissions, sync status, daily trends, quality issues, enumerator activity; minimal setup.
2. **Analytical dashboard (customizable)**: users create dashboards and add configurable KPI, indicator, survey question, chart, table, text and map widgets; filter, save, arrange and share according to access controls.

**Build philosophy:** Extend the actual existing code. Ship small, tested vertical slices. Avoid a premature rewrite, custom SQL builder, predictive AI, full GIS suite, or billing. Financial/billing features are **deferred**.

## 2. Reference products and exactly what to study

### Primary — TolaData
- **Main documentation hub:** https://www.toladata.com/docs/
- Dashboard creation: https://www.toladata.com/docs/knowledge-base/dashboards/creating-a-dashboard/
- Dashboard widgets: https://www.toladata.com/docs/knowledge-base/dashboards/adding-widgets-to-your-dashboard/
- Indicators quick start: https://www.toladata.com/docs/quick-start-guide/add-indicators/
- Indicator workflow: https://www.toladata.com/docs/knowledge-base/indicator-workflow/
- Product homepage: https://www.toladata.com/

**Study:** project and workspace navigation, result frameworks, indicator registers, baselines and targets, mapping imported Kobo data to indicators, project progress and target comparison, creating a dashboard, choosing widget types, arranging/resizing widgets, permission-aware sharing, report templates and scheduled reports.

### Secondary — DHIS2
- Analysis, charts, pivot tables, maps, dashboards: https://dhis2.org/features/analyze/
- Main project: https://dhis2.org/

**Study:** question/data explorer, reusable saved visualizations, dimension and period filters, cross-tabulation/pivot tables, geographic breakdown, drill-down, dashboard-level filters, chart switching, and chart/table exports.

**Synthesis:** TolaData guides **WHAT workflows** the M&E product needs; DHIS2 guides **HOW users independently explore and visualize** datasets. FieldSight should additionally allow a chart directly from a Kobo question **without** requiring that question to be an M&E indicator first.

## 3. Existing repository: reuse before creating

Observed code structure on `main` (reviewed 2026-10-22; verify current files before writing):

| Existing area | Path | Notes |
|---|---|---|
| Kobo client | `fieldsight-backend/app/core/kobo.py` | Token verify/encrypt, forms/questions, submission import |
| Kobo connection endpoints | `fieldsight-backend/app/routes/kobo.py` | Tenant-controlled Kobo connection and project form selection |
| Sync / dashboard / analytics / quality | `fieldsight-backend/app/routes/collection.py` | Existing synchronous form sync, submissions, dashboard/analytics, quality |
| Indicator APIs | `fieldsight-backend/app/routes/indicators.py` | CRUD, mapping, calculation, history, geographic breakdown |
| Indicator models | `fieldsight-backend/app/models/operations.py` | Inspect existing `Indicator`, `IndicatorMapping`, `ProjectTarget` and `Submission` |
| Project intelligence | `fieldsight-backend/app/routes/intelligence.py` | Existing mappings, targets and calculations; preserve compatibility |
| Typed API client | `fieldsight-frontend/src/services/apiClient.ts` | Extend existing API method conventions |
| Indicator UI | `fieldsight-frontend/src/pages/organization/ProjectIndicatorsPage.tsx` | Existing indicator workflow and charts |
| Explore / Analyze UI | `fieldsight-frontend/src/pages/organization/ExploreAnalyzePage.tsx` | Existing survey analysis experience |
| Project workspace | `fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx` | Project-level navigation, progress |
| Organization dashboard | `fieldsight-frontend/src/pages/dashboard/OrganizationDashboardPage.tsx` | Existing overview |
| Tests | `fieldsight-backend/tests/test_kobo.py`, `test_indicators.py`, `test_dashboard.py`, `test_intelligence.py` | Add regression and edge-case tests |
| M&E architecture audit | `docs/M&E_PRODUCT_AUDIT.md` | Review before building further indicator/M&E features |

**Existing stack:** React + TypeScript + Vite + Tailwind; TanStack Query, Recharts, Leaflet; Python FastAPI, SQLModel/Pydantic, Alembic, current SQLite with a Neon/PostgreSQL path. Preserve RBAC roles `super_admin`, `organization_admin`, `enumerator` and organization isolation. Test actual environment before assuming readiness.

## 4. Feature backlog — what the finished product should support

### A. KoboToolbox connection and complete sync (P0)
- Add/test connections to supported HTTPS KoboToolbox API v2 hosts; store API tokens encrypted server-side, never reveal them in browser responses or logs.
- List and select accessible forms; assign a form to an organization-owned project.
- Retrieve **all** submissions using verified pagination (`next` or equivalent) rather than stopping at the first 1,000 records; guard against pagination loops and malformed responses.
- Sync idempotently keyed by project/form/external submission ID. Changed source records update safely, unchanged records remain unchanged.
- Track sync status, started/completed timestamps, received/created/updated/skipped/error counts, last successful sync; preserve error details without leaking tokens or sensitive answers.
- Fail visibly on incomplete import; never report success after only the first page. Introduce incremental sync when the provider contract supports it and a full sync baseline is reliable.
- Run large sync jobs outside HTTP request lifecycle; start with a manageable background-job approach and add a durable queue/worker before production-scale use.
- Protect deletion actions from accidentally deleting Kobo source forms or provider-hosted submissions; use explicit, separately confirmed destructive operations.
- Support realistic test fixture of **1,500 records** spanning multiple provider pages; second sync creates zero duplicates.

### B. Form schema and question catalogue (P0/P1)
- Parse Kobo form metadata into a safe field catalogue: source path, human label, type (`select_one`, `select_multiple`, integer, decimal, date, text, geopoint, etc.), choices and labels where available, groups/repeats and form version.
- Store appropriate metadata or cache/version it; validate question identifiers against an allow-list; never accept arbitrary database expressions from clients.
- Preserve raw provider data and a clear separation from derived normalized analytical values.
- Handle multilingual labels, nested paths, multiple selections, skipped/null answers and version changes explicitly.

### C. Dynamic survey question explorer (P1)
- User selects project, Kobo form and any eligible survey question, with search and friendly labels.
- Default visualization/aggregation according to field type: category counts and percentages for single-select, per-option counts for multi-select, sums/averages/ranges for numeric, time trends for dates, location grouping for geodata.
- Provide filters: project, form, date range, location, enumerator, quality/review status, and optional answer categories.
- Show numerator, denominator, missing responses and sample size; guard against division by zero; label missing/not reported.
- Support group-by/disaggregation, cross-tabs and compare periods where correctly defined.
- Save a visualization and optionally add it to a custom dashboard; offer CSV export with access checks.
- Do calculations in the backend; return validated, stable typed response objects to frontend.

### D. M&E indicator management (P1)
- Project-scoped indicators: name/code, description, unit, direction, baseline, target, target date, reporting frequency, owner/status and audit metadata.
- Map indicators to one or more approved survey field operations: count records, count matching, percentage matching, sum, average; introduce richer formulas only after safe semantics/tests exist.
- Mapping UI must let users choose calculation and expected response; never assume every percentage question means answer `Yes` or every numeric field should be averaged.
- Clearly define eligible records (e.g., default `ready` only), numerator, denominator, missing values, multi-select behavior and time periods.
- Distinguish **target achieved** from **on track for date**; do not call every below-target project late when target deadline lies in the future. Preserve direction (`increase`/`decrease`) logic.
- Present result trends, location breakdown, baseline/target/current, mapping health, and source traceability.
- Keep existing `ProjectTarget` and intelligence APIs compatible until there is a tested migration plan; do not create duplicate indicator domains.

### E. Dashboards (P1/P2)
#### Automatic operational dashboard
- Automatically render submissions, daily trends, sync health, quality queue, assigned forms and field operations using existing APIs.
- Filter by organization, project and reporting period; show last-refresh time and empty/error states.

#### Custom dashboard builder
- Create / rename / describe / duplicate / archive dashboards scoped to the organization/project.
- Add widgets: number/KPI, indicator progress, categorical bar, line/time-series, pie/donut where appropriate, table, location map, explanatory text.
- Widget configuration: title, dataset, project/form, question or indicator, aggregation, group-by, period, colors if needed, sort, and filters.
- Arrange widgets in responsive layout, reorder and resize, save layout changes; support mobile read-only-friendly layout.
- Global dashboard filters and widget-level filters with clearly documented precedence.
- Refresh charts after successful sync/indicator update; support cache invalidation.
- Share only with organization members who have underlying data access; add public links only after a deliberate security/privacy review.
- Allow widgets to open a detailed analysis screen to investigate underlying aggregate counts.
- **Persistence idea:** `Dashboard` and `DashboardWidget` tables with scoped ownership, layout JSON with validation, and typed widget query specifications. Add Alembic migrations, services, schemas and routes; do not let client send SQL.

### F. Quality control (P1/P2)
- Reuse existing `ready`, `needs_review`, `invalid` review states and quality endpoints.
- Introduce/complete duplicate, mandatory field, range, outlier and data inconsistency checks with explicit rules and evidence.
- Show issue counts, affected fields, review queue, decision reason, reviewer and time.
- Do not silently include invalid rows in M&E results; display the quality selection used for every metric.

### G. Reports and exports (P2)
- Generate a project summary report with date range, data-source provenance, submission volume, quality issues, selected charts, and indicators vs targets.
- Start with CSV and reproducible print/PDF report; add XLSX, scheduled email, approval flows and templates only in later iterations.
- Queue large exports; enforce authorization and limit exposure of identifiable survey response data.
- Distinguish project reports from analytical dashboard exports; allow export of a saved visualization.

### H. Field operations and access (P2)
- Enumerator assignments, project/form/location access and collection progress; no unauthorized organization-wide exports.
- Separate operational completion statistics from survey result indicators.
- Keep organization/tenant authorization on every list, detail, sync, mapping, dashboard and export route.

## 5. UI / information architecture proposal

Sidebar: **Overview / Projects / Kobo Connections / Forms / Submissions / Explore & Analyze / Indicators / Dashboards / Data Quality / Reports / Field Operations / Team / Settings**. Hide items by role and retain existing routes where possible.

**Project workspace tabs:** Overview | Data | Analysis | Indicators | Monitoring | Quality | Reports. Start by linking existing pages; don't duplicate full screens.

**Dashboard creation experience:**
1. Open Dashboards → Create dashboard → enter title/description and scope.
2. Add widget → select *KPI*, *Survey question*, *Indicator*, *Map*, or *Text*.
3. Choose project/form and relevant question or indicator.
4. Set measure/aggregation, group-by, filter, visualization and title.
5. Preview data and display denominator/missing-value context.
6. Save widget, resize/reorder, save dashboard.
7. Apply dashboard date/location/project filters and drill into analysis.
8. Share internally with access controls and export.

**Do not hardcode demo numbers as real project metrics.** Empty projects must have helpful blank states; widgets with missing mappings must say why data is unavailable.

## 6. Backend API contracts (proposed; adapt to existing conventions)

Avoid introducing routes until the code has been inspected for equivalent existing ones.

- `GET /projects/{id}/survey-fields` → approved field catalogue with type, label, choices and source path.
- `POST /analysis/query` → safe server-validated analytics request `{project_id, form_id, source_field, measure, group_by, filters, time_grain}` returning `{total_records, eligible_records, answered_records, missing_records, series, groups, metadata}`.
- `GET/POST /dashboards`; `GET/PATCH/DELETE /dashboards/{id}`.
- `POST /dashboards/{id}/widgets`; `PATCH/DELETE /dashboard-widgets/{id}`.
- `GET /dashboards/{id}/results?from=...&to=...` → resolved widgets with scoped calculations.
- Existing indicator CRUD/mapping APIs remain authoritative; extend only where necessary.
- Existing sync API can evolve to `202 Accepted` and a status resource for queued imports after compatible UI changes.

**Constraints:** Validated IDs and filter operators; bounded pagination; no arbitrary SQL, Python evaluation, or unsanitized field-name interpolation; server-side role/tenant scope; repeatable time zone handling; controlled exports; predictable error format.

## 7. Implementation sprints and acceptance gates

### Sprint 0 — Baseline and safety
- Inspect repository and read `docs/M&E_PRODUCT_AUDIT.md` and backend `PHASE_0_CONTRACT.md`.
- Create branch `feature/fieldsight-data-analytics-roadmap` (or one short-lived branch per sprint).
- Run backend tests, linters and frontend build; record initial failures before edits.
- Catalog actual APIs, migrations, mock-vs-live frontend pages and unfinished flows.
- Define demo survey data with no confidential personal information.

**Done when:** baseline test/build status and a prioritized, file-level change plan are documented.

### Sprint 1 — Reliable Kobo sync (highest priority)
- Fix paginated submission retrieval, error cases and idempotent re-import.
- Add multi-page fixtures and tests for first sync, repeat sync, changed row and provider failure.
- Ensure sync UI shows actual status and counts.

**Done when:** 1,500 fixture submissions import completely; repeat sync duplicates none; partial failures are visible.

### Sprint 2 — Schema-aware question explorer
- Implement stable field catalogue from Kobo metadata and synced records.
- Implement safe aggregate/query service and question-level UI.
- Test single-select, multi-select, numeric, nested, null and time filters.

**Done when:** admin selects a question and receives an accurate count, percentage or trend with traceable denominators.

### Sprint 3 — Correct indicator calculations
- Improve existing indicator mapping choice and calculation semantics.
- Add targets, progress/status interpretation and reporting periods correctly.
- Test quality exclusions and location/time breakdown.

**Done when:** two benchmark sample indicators match independently calculated results and explain included records.

### Sprint 4 — Saved dashboard builder
- Add scoped dashboard/widget persistence, widget CRUD, charts/table and responsive layout.
- Connect existing/updated analytics results, live refetch and filters.

**Done when:** a user creates a dashboard, adds three widgets, saves, reloads and sees the same configuration/results.

### Sprint 5 — Reporting / hardening
- Create report/export workflow and at least one print/PDF-ready summary.
- Validate RBAC and cross-organization isolation; check logs and secrets; assess background sync strategy.

**Done when:** users can produce a correct project report, and prohibited accounts cannot access another organization's data.

## 8. Non-functional requirements and test checklist

- **Security:** Encrypt Kobo tokens; never put tokens in URLs/client state/logs. No public record exports by default. Restrict access by organization plus role and project assignment. Use HTTPS, secure CORS and secret management.
- **Correctness:** Verify totals across pagination; label sample sizes; map question types correctly; do not confuse missing and zero; align time ranges/time zones.
- **Performance:** Avoid fetching entire large submission datasets into browser. Paginate list views. Optimize aggregated queries/indexes. Run expensive sync/export tasks asynchronously.
- **Reliability:** Retry only safe requests; preserve last known-good imports; log sync failure and data provenance; use idempotent writes and migrations.
- **Accessibility:** Accessible forms, clear loading/empty/error states, keyboard usable charts/tables and readable mobile layouts.
- **Testing:** `pytest`, `ruff check .`, `mypy app` (where configured), `npm run build` in frontend, targeted integration tests; verify with sample projects in UI.
- **Privacy:** Use synthetic/sample Kobo records while developing and showing screenshots. Protect personally identifiable, household, GPS and sensitive survey information.
- **Future:** Neon/PostgreSQL, asynchronous workers, polished map analysis, scheduled reporting, full audit event model, AI-assisted insights (optional, only after trustworthy deterministic metrics).

## 9. Instructions to Codex (copy/paste)

```text
You are assisting in the existing GitHub repository https://github.com/gabkoi21/Field-Sight.
Read FIELDSIGHT_CODEX_IMPLEMENTATION_GUIDE.md, docs/M&E_PRODUCT_AUDIT.md, fieldsight-backend/README.md and fieldsight-backend/PHASE_0_CONTRACT.md first. Inspect current implementation before proposing changes.

The product should take workflow inspiration from https://www.toladata.com/docs/ and analytics inspiration from https://dhis2.org/features/analyze/. Implement original FieldSight UX; do not copy proprietary assets or entire reference interfaces.

Do not rewrite the stack. Maintain current FastAPI/SQLModel/Alembic, React/TypeScript, multi-tenancy and RBAC conventions. Preserve existing working routes and migrations and do not implement billing.

FIRST TASK ONLY: Sprint 0 and Sprint 1 (KoboToolbox sync reliability). Begin by summarizing existing relevant code, identify baseline test failures, and propose a file-by-file change plan. Then implement Kobo API pagination, robust error handling, and idempotent sync with tests. Fix all relevant tests/build issues caused by your changes. Avoid touching unrelated UI or data models. Use a short-lived feature branch and show the diff and test results. Do not commit credentials or modify production configuration. Ask for explicit approval before any destructive operation or deployment.

After Sprint 1, report completed acceptance criteria, remaining risks and recommend the next single sprint. Do not attempt the whole roadmap in one code generation pass.
```

## 10. Where to keep this file

Add this file to the repository root as `FIELDSIGHT_CODEX_IMPLEMENTATION_GUIDE.md` and reference it in future Codex sessions. Optional: split later into `docs/ROADMAP.md`, `docs/FEATURES.md`, and sprint issues once implementation begins.

---

*This blueprint is an implementation guide, not a claim that all features already exist or have been tested. Re-check current upstream documentation and repository behavior at implementation time.*
