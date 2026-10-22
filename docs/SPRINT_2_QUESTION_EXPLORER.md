# Sprint 2: schema-aware survey question explorer

Implemented on 2026-10-22 in `codex/kobo-sync-reliability`, continuing the uncommitted Sprint 1 changes.

## What is available

The existing `/analytics` route now opens the survey question explorer. The prior browser-side analysis component is retained in the source for compatibility/reference but is no longer routed. The original FieldSight shell remains; the new workspace uses the supplied screenshots' project/form selection, restrained teal accents, tabs, question navigation, charts and compact results tables as design references.

- Select a project and its current or previously synchronized Kobo form.
- Search the question catalogue by source path or human label.
- Read Kobo question types, multilingual labels, choice labels, groups and form version. Metadata is cached per organization/project/form and explicitly refreshed with **Refresh Kobo fields**. A failed refresh retains the previous schema. Without metadata, existing field mappings and stored answers provide an explicitly labeled fallback.
- Calculate single-select counts and percentages; multi-select per-option counts; numeric count, sum, average, minimum and maximum; date trends; and geographic counts grouped by submission location. Exact coordinates are excluded from geographic aggregates and exports.
- Filter by UTC submission date range, location, enumerator, review status and known answer choices. Disaggregate by another approved survey question. Multi-select groups can overlap; this is stated alongside results.
- See total, eligible, answered, missing and invalid-answer counts, the percentage denominator and calculation timestamp.
- Switch between appropriate charts and an aggregate table. Multi-select and numeric values cannot be shown as a misleading donut. High-cardinality results require filters rather than silently truncating totals.
- Save a visualization's title, query specification, chart and filters to the backend; reload and reopen it against the latest synchronized records. Delete saved configurations within the authorized organization.
- Export aggregate CSV with numerator counts, denominators, missing/invalid counts and filter context. Formula-like text is escaped. Raw submission rows and identifiers are not exported by this feature.

## New API contracts

| Endpoint | Purpose |
| --- | --- |
| `GET /projects/{id}/survey-fields?form_id=...` | Typed catalogue, available forms and filter values |
| `GET /projects/{id}/survey-fields?refresh_schema=true` | Refresh the currently assigned verified Kobo form's cached schema |
| `POST /analysis/query` | Validated aggregation of stored submissions |
| `POST /analysis/export` | Authorized aggregate CSV from the same query |
| `GET /analysis/saved?project_id=...` | Project-scoped saved visualizations |
| `POST /analysis/saved` | Validate and save a visualization configuration |
| `DELETE /analysis/saved/{id}` | Remove an authorized saved configuration |

Every endpoint requires an authenticated organization administrator. Tenant/project/form checks precede data access. Query and filter properties reject unknown attributes; source and group fields must belong to the server-generated catalogue. Queries never accept SQL or executable formulas.

## Semantics

The default quality selection is `ready`. Other statuses require an explicit selection. Missing values and unusable answers are separate: `eligible = answered + missing + invalid_answers`. Numeric zero is a valid answer, and numeric aggregates over no usable answers are `null`, not a fabricated zero.

Percentages use usable answered submissions after all filters as the denominator. Multi-select options are counted once per submission, whether represented by Kobo's space-delimited strings or arrays, so option percentages may add to more than 100%. Date buckets use the chosen question's value; date filters apply to the submission timestamp. Both use UTC. New imports normalize timezone offsets to UTC before SQLite storage.

Nested objects and Kobo slash-separated paths resolve to the same question key. Repeat datasets are explicitly unavailable for submission-level aggregation and are not flattened into misleading counts. Cached Kobo metadata takes precedence over explicit field mappings, which take precedence over inferred types. Choice codes remain raw in storage and are translated only in result labels.

## Files

- `fieldsight-backend/app/core/survey.py`: metadata parser, field discovery, normalization and deterministic aggregation.
- `fieldsight-backend/app/schemas/analysis.py`: typed catalogue/query/result/save contracts.
- `fieldsight-backend/app/routes/analysis.py`: authorization, schema cache, analysis, export and saved-view endpoints.
- `fieldsight-backend/app/models/operations.py`: `SurveySchema` and `SavedAnalysis` persistence.
- `fieldsight-backend/alembic/versions/0014_survey_analysis.py`: new tables; supports older databases and current-metadata fresh installs.
- `fieldsight-backend/app/core/errors.py`: serializable validation errors without echoing request inputs.
- `fieldsight-backend/app/routes/collection.py`: normalize provider timestamps to UTC before persistence.
- `fieldsight-frontend/src/pages/organization/SurveyQuestionExplorer.tsx`: new explorer UI.
- `fieldsight-frontend/src/services/apiClient.ts`: typed analysis methods and CSV response support.
- `fieldsight-frontend/src/auth/AuthContext.tsx` and `src/app/App.tsx`: retain the local login bypass, while allowing optional `/sign-in` to load protected project data. Stored authenticated sessions are now loaded in development preview too.
- `fieldsight-backend/tests/test_analysis.py`: 28 new semantic, persistence, migration and access-control cases.

## Validation

- Full backend regression suite: **77 passed**. Warnings concern existing Starlette/Alembic deprecations.
- Frontend TypeScript and Vite production build: passed, with the existing bundle-size warning.
- Ruff passes on new/changed Sprint 2 Python files. The three new analysis modules pass focused mypy. Global mypy remains at the baseline 41 errors in nine existing files; no new errors were introduced.
- Incremental upgrade from a simulated pre-Sprint 2 database creates both tables and preserves all seven fixture submissions. Empty-database migration coverage also passes.
- Browser verification used a separate local QA backend, disposable SQLite database and clearly labeled synthetic survey records. Verified optional login, question selection, multi-select denominators, save, reload, reopening and CSV download.
- Browser export verified Water and Health each count 2 out of 3 answered submissions (66.67%), with one missing record. No live Kobo credentials or application records were used.
- Screenshot: `fieldsight-frontend/outputs/sprint2-question-explorer.png`.

## Enable locally

The application database has not been migrated or changed by this sprint. Stop the backend and back up its database before applying the migrations. From `fieldsight-backend`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Start the frontend normally and open **Explore & analyze**. The app still opens without the login gate; use **Sign in to load data** when you want protected organization data. The temporary QA servers are separate from the normal development backend and are stopped after verification.

## Remaining boundaries / next sprint

Server aggregation currently loads the selected project's stored submissions in memory. Browser requests receive aggregate results, not the raw dataset. SQL-backed aggregation/caching and background jobs remain scaling work. Metadata refresh is explicit; refresh it after changing the Kobo form. Inferred types are intentionally conservative and cannot reliably recognize a space-delimited multi-select without Kobo metadata or an explicit field mapping.

Repeat datasets, period comparisons, map rendering, matrix-style pivot views, dashboard widgets and report generation are not included in this slice. Historical timestamps imported before UTC normalization may need a deliberate repair from raw provider timestamps if those sources supplied timezone offsets. No live-provider connection or import was attempted.

Next single sprint: Sprint 3, improve indicator mapping choices and calculation semantics using these verified field types and aggregation conventions. Do not assume percentage means Yes or every numeric field should be averaged.
