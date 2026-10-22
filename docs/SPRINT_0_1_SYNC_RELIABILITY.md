# Sprint 0 / 1: Kobo sync reliability

Date: 2026-10-22. Branch: `codex/kobo-sync-reliability`.

The user selected the guide's sync reliability sprint first. The five supplied screenshots remain references for later indicator, results framework, data table and dashboard work. No UI redesign is included in this sprint.

## Baseline and scope

Reviewed the implementation guide, `docs/M&E_PRODUCT_AUDIT.md`, backend README and `PHASE_0_CONTRACT.md` before changes.

- Stack remains FastAPI/SQLModel/Alembic and React/TypeScript/TanStack Query.
- Submissions were fetched with a single 1,000-record request. Unchanged runs were deleted, missing record IDs silently ignored, and the database identity omitted the source form.
- Frontend baseline build passed with a bundle-size warning.
- Ruff baseline: seven existing errors in `scripts/seed_dashboard_sample_data.py` and `scripts/seed_test_field_data.py`.
- Mypy baseline: 41 existing errors across nine application files. Final application check has the same 41 errors; none in the changed Kobo fetcher or sync implementation.
- Initial pytest execution stalled inside Windows socketpair creation under the sandbox; a full run with local TestClient sockets enabled passed the new sync coverage and exposed an existing migration test expecting revision 0010 despite existing head 0012. The stale assertion now resolves the actual Alembic head.
- Existing authentication-preview changes and package-lock changes from earlier work are preserved.

## API and UI inventory

| Existing area | Source | Current behavior / next work |
| --- | --- | --- |
| Kobo verification, form listing and questions | `app/core/kobo.py`, `app/routes/kobo.py` | Encrypted tokens, supported server allow-list. Form-list pagination is separate follow-up work. |
| Import and status | `POST /projects/{id}/sync`, `GET /sync-runs`, `GET /sync/pending` | Organization-admin-only. Sync imports all submission pages; history includes unchanged and failed runs. |
| Storage | `Submission`, `SyncRun` in `app/models/operations.py` | Raw records and review states retained. Submission identity now includes project, form, external ID. |
| Collection / analysis / quality | `app/routes/collection.py` | Existing stored-submission and aggregate endpoints retained. Full schema-aware explorer deferred to Sprint 2. |
| Indicators and intelligence | `app/routes/indicators.py`, `app/routes/intelligence.py` | Existing domains retained; no duplicate indicator model introduced. |
| Project sync UI | `src/pages/organization/ProjectWorkspacePage.tsx` | Live API request; displays received/new/updated/unchanged counts and existing error state. |
| Indicator and sync history pages | `ProjectIndicatorsPage.tsx`, `SyncHistoryPage.tsx` | Components exist but were not registered in App routes at inspection. Navigation wiring belongs to the later UI slice. |
| Dashboard and analysis UI | `OrganizationDashboardPage.tsx`, `ExploreAnalyzePage.tsx` | Existing API-backed screens retained. Saved dashboard/widget persistence is future work. |
| Authentication preview | `src/auth/developmentAccess.ts` | Earlier local frontend login bypass remains. Backend requests still require authentication; preview identity cannot perform a real sync. |

Paths in the table are relative to the backend or frontend directory as appropriate. Billing is deferred.

## File-level implementation

1. `fieldsight-backend/app/core/kobo.py`: follow provider `next` links; accept relative links and Kobo's data.json form; reject unsafe destinations, redirects, repeated pages, repeated IDs, malformed records/JSON, changed or incomplete totals and unbounded pagination. Return records only after the entire download succeeds. Provider credentials and response bodies are excluded from errors.
2. `fieldsight-backend/app/routes/collection.py`: retain unchanged history with timestamps, reject missing IDs, scope imports and pending counts by form, roll back failed storage, return derived unchanged counts. Existing tenant/role checks remain in force.
3. `fieldsight-backend/app/models/operations.py` and Alembic revision `0013_submission_form_identity`: replace project/external-ID uniqueness with project/form/external-ID uniqueness. Preserve existing rows. Fresh installs already using current metadata are supported. Downgrades refuse overlapping identities instead of deleting records.
4. `fieldsight-backend/tests/test_kobo_sync.py`: synthetic provider fixtures and real API/database integration tests. No confidential records or live Kobo credentials.
5. `fieldsight-backend/tests/test_migrations.py`: resolve migration head dynamically.
6. `fieldsight-frontend/src/services/apiClient.ts` and `ProjectWorkspacePage.tsx`: type and display unchanged counts in the existing sync feedback.

Pagination follows the documented Kobo v2 contract: https://support.kobotoolbox.org/migrating_api.html.

## Acceptance and validation

- Final full backend suite: **49 passed** (five existing Alembic configuration deprecation warnings).
- All 1,500 synthetic records import across two provider pages.
- Repeating the import creates and updates zero rows; unchanged timestamps are preserved.
- One changed source record updates exactly one row.
- Reused external IDs in another form create distinct records without overwriting old answers.
- Failed later pages and invalid IDs preserve previous imports and record a visible failure.
- Storage failure rolls back rows and saves a safe failure message.
- Unsafe links never receive the stored token. Authorization and tenant boundary tests pass.
- Empty database upgrades and a populated identity migration preserve records.
- Frontend production build passes; changed Python files pass Ruff and the diff passes whitespace checks.
- Global Ruff/Mypy debt above remains outside this sprint.

## Local rollout and remaining limits

No production configuration, existing application database, provider source records or credentials were modified. The new migration was exercised only on temporary test databases. Back up the local application database, stop the backend, and run from `fieldsight-backend` before starting this revision:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Sync remains synchronous and holds the full download in server memory. Pagination is bounded at 10,000 pages, with a 30-second timeout per request. Large production imports still need background execution with durable job status and concurrency controls. If the provider changes its reported total during download, the import fails and must be retried. Persistent database outages may prevent failure history from being saved. Failure history stores no partial download counts; successful received counts represent verified complete downloads.

Source form deletion behavior is unchanged and should be reviewed separately before production use. No live-provider import or authenticated browser sync was attempted. Existing preview mode provides UI access only.

Next single sprint: schema-aware survey question explorer (Sprint 2), reusing existing raw answers, field mappings and analytics conventions. Apply the supplied visual references when implementing the subsequent UI slices.
