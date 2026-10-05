# FieldSight M&E Product Audit

Phase A audit for adding a practical Monitoring and Evaluation layer to the existing FieldSight application.

This audit treats the external implementation plan as product context. It does not override repository conventions or introduce production changes. No models, migrations, routes, or UI files were changed in this phase.

## Executive Summary

FieldSight already has the foundations needed for M&E V1:

- Tenant-owned organizations, memberships, projects, locations, assignments, Kobo connections, synced submissions, review statuses, quality checks, analytics, and dashboards.
- A lightweight project intelligence layer with `FieldMapping`, `ProjectTarget`, and `/projects/{project_id}/intelligence`.
- React project workspace, analysis, quality, dashboard, submissions, projects, forms, and API client layers.

The next implementation should not duplicate projects, submissions, Kobo connections, analytics, or quality. It should add a clearer Indicator domain and gradually migrate the current target/intelligence ideas into explicit M&E concepts.

Important current overlap:

- `Project.target_sample_size` already covers collection volume targets.
- `FieldMapping` already maps raw Kobo answer keys to friendly project fields.
- `ProjectTarget` already stores simple project targets, but it is not enough for M&E indicators because it has no baseline, no indicator unit enum, no status enum, no mapping calculation type, and no result contract.
- `/analytics/overview`, `/dashboard/overview`, `/quality/*`, and `/projects/{project_id}/intelligence` already calculate useful current-state summaries from synced submissions.

Recommended Phase B direction:

- Add a dedicated `Indicator` model beside existing `ProjectTarget`.
- Keep `ProjectTarget` for existing lightweight target progress until a deliberate migration path exists.
- Reuse authorization and tenant isolation helpers from existing routes.
- Reuse `Submission.raw_answers`, `review_status`, `submitted_at`, `location`, and `enumerator` for later calculation and disaggregation.
- Do not add `IndicatorMapping` until Phase D, but design `Indicator` so it can connect cleanly.

## Current Architecture Map

| Area | Current feature | Current files | Decision | Required M&E change | Dependencies | Priority |
|---|---|---|---|---|---|---|
| Identity and tenancy | Users, organizations, active memberships, roles | `fieldsight-backend/app/models/identity.py`, `fieldsight-backend/app/routes/auth.py`, `fieldsight-backend/app/routes/organizations.py` | KEEP | Reuse `organization_id`, `created_by_id`, and role checks for all indicator APIs. | Existing `Role` enum and active membership checks. | P0 |
| Organization admin authorization | Organization admin enforced in Kobo, collection, intelligence, project mutations | `fieldsight-backend/app/routes/kobo.py`, `fieldsight-backend/app/routes/organizations.py`, `fieldsight-backend/app/routes/intelligence.py` | MODIFY | Extract or reuse an admin/project authorization helper so indicator routes do not copy too much private route logic. | Existing `_organization_admin_id`, `_authorize`, `_project` conventions. | P0 |
| Enumerator permissions | Enumerators exist as tenant users and field assignments | `fieldsight-backend/app/models/identity.py`, `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/app/routes/organizations.py` | KEEP | Indicator create/update/delete must reject enumerators. | Active membership role check. | P0 |
| Projects | Project lifecycle, dates, country, status, sample-size target, Kobo assignment | `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/app/routes/organizations.py`, `fieldsight-backend/app/schemas/organizations.py`, `fieldsight-backend/app/schemas/crud.py` | KEEP | Indicators should be project-scoped and organization-owned. Use project dates later for expected progress if needed. | Project must belong to effective organization. | P0 |
| Collection target | `Project.target_sample_size` for submission-volume progress | `fieldsight-backend/app/models/operations.py`, `fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx`, `fieldsight-frontend/src/components/dashboard/SubmissionActivityPanel.tsx` | KEEP | Do not confuse sample-size target with indicator target. Surface separately in monitoring. | Existing project dashboard cards. | P1 |
| Kobo connections | Tenant-owned connection, verified token, selected form, project form assignment | `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/app/routes/kobo.py`, `fieldsight-backend/app/core/kobo.py`, `fieldsight-backend/app/schemas/kobo.py` | KEEP | Indicator mapping should reference the project-assigned Kobo form first. | Existing connection verification and project form assignment. | P1 |
| Form metadata | Current app stores selected `kobo_form_id` and `kobo_form_name`; no persisted `Form` or `FormVersion` model found | `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/app/routes/kobo.py` | ADD | Phase D cannot reuse `FormVersion.schema_json` because it does not exist. Add mapping options from synced `Submission.raw_answers` first, or introduce form schema storage later. | Kobo API capabilities and existing synced answer keys. | P1 |
| Submission sync | Imports Kobo submissions into tenant/project scoped `Submission` rows | `fieldsight-backend/app/routes/collection.py`, `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/tests/test_kobo.py` | KEEP | Indicator calculations should read synced submissions, not remote Kobo directly. | `Submission.raw_answers`, `review_status`, indexes. | P0 |
| Submission review state | `ready`, `needs_review`, `invalid` stored on submissions | `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/app/routes/collection.py`, `fieldsight-frontend/src/pages/organization/QualityCenterPage.tsx` | KEEP | Phase E should default to include `ready`, exclude `invalid`, and make `needs_review` a documented product decision. | Quality validation workflow. | P0 |
| Dynamic raw answers | Kobo answers stored as JSON | `Submission.raw_answers` in `fieldsight-backend/app/models/operations.py` | KEEP | Indicator mapping and calculation should read allow-listed keys from JSON payloads. Do not expose arbitrary SQL. | Field names from raw payloads. | P0 |
| Field mappings | Maps project source fields to display names and data types | `FieldMapping` in `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/app/routes/intelligence.py`, `fieldsight-backend/app/schemas/intelligence.py`, `fieldsight-frontend/src/services/apiClient.ts`, `fieldsight-frontend/src/pages/organization/ExploreAnalyzePage.tsx` | MODIFY | Reuse as mapping-option metadata. Do not treat it as the final Indicator mapping because it has no calculation type or expected value. | Current intelligence tests. | P1 |
| Project targets | Simple target table with value, unit, direction, optional field mapping | `ProjectTarget` in `fieldsight-backend/app/models/operations.py`, `fieldsight-backend/app/routes/intelligence.py`, `fieldsight-backend/app/schemas/intelligence.py` | MODIFY | Keep for compatibility, but add `Indicator` for baseline/target/current/status. Later migrate or relate targets to indicators if needed. | `/projects/{project_id}/targets`, `/projects/{project_id}/intelligence`. | P0 |
| Project intelligence | Calculates progress and simple pulse from submissions, mappings, and targets | `fieldsight-backend/app/routes/intelligence.py`, `fieldsight-backend/tests/test_intelligence.py`, `fieldsight-frontend/src/services/apiClient.ts` | MODIFY | Use as inspiration for deterministic insights, but move authoritative indicator calculations into a service before exposing monitoring. | Existing `ProjectIntelligence` contract. | P1 |
| Analytics overview | Tenant/project/location/period aggregate metrics | `fieldsight-backend/app/routes/collection.py`, `fieldsight-frontend/src/pages/organization/ExploreAnalyzePage.tsx`, `fieldsight-frontend/src/pages/dashboard/OrganizationDashboardPage.tsx` | KEEP | Reuse filtering patterns and available locations. Add indicator-specific results separately. | Submission indexes in migration `0010`. | P1 |
| Quality engine | Form-agnostic checks and review-status updates | `fieldsight-backend/app/routes/collection.py`, `fieldsight-frontend/src/pages/organization/QualityCenterPage.tsx` | KEEP | Link indicator results to quality counts for relevant records in Phase H. | `Submission.review_status`, `_quality_findings`. | P2 |
| Project workspace | Project overview with sync, metrics, top locations, leaderboard, exception alerts | `fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx` | MODIFY | Add project tabs for Data, Analysis, Indicators, Monitoring, Quality over time. Start Phase C with Indicators tab or route. | API client, React Router, TanStack Query. | P1 |
| Analysis page | Dynamic question analysis from synced records and field mappings | `fieldsight-frontend/src/pages/organization/ExploreAnalyzePage.tsx` | KEEP | Link from an indicator to source question analysis later. Do not merge monitoring into analysis. | Query param `project_id`, field mappings endpoint. | P2 |
| Quality page | Review queue, validation run, status mutations | `fieldsight-frontend/src/pages/organization/QualityCenterPage.tsx` | KEEP | Project workspace should link/filter into quality by project. Monitoring should show quality warning only. | `qualityIssues(projectId)`, `runQualityValidation(projectId)`. | P2 |
| API client | Central typed fetch wrapper and API methods | `fieldsight-frontend/src/services/apiClient.ts` | MODIFY | Add indicator types and client methods in Phase C. Keep query naming consistent. | Existing `request<T>`, `ApiError`, TanStack Query usage. | P0 |
| Frontend routing | Organization routes include projects, project detail, forms, submissions, quality, analytics, reports | `fieldsight-frontend/src/app/App.tsx`, `fieldsight-frontend/src/components/layout/AppShell.tsx` | MODIFY | Add project indicators/monitoring routes or in-page tab mode based on current workspace pattern. | React Router. | P1 |
| Tests | Backend tests cover auth, migrations, Kobo, dashboard, intelligence | `fieldsight-backend/tests` | MODIFY | Add indicator CRUD and tenant isolation tests with same sqlite/TestClient style. | `SQLModel.metadata.create_all`, `create_app`, token helpers. | P0 |
| Audit logging | Plan mentions audit events, but no clear audit-event model found | `fieldsight-backend/app/routes/administration.py`, `fieldsight-frontend/src/pages/superadmin/AuditLogPage.tsx` | ADD | Confirm actual audit storage before Phase B audit events. If absent, do not invent broad audit infra in the same slice. | Superadmin audit UI may be static or backed elsewhere. | P2 |
| Reports | Reports page exists in frontend, but M&E reports are not present | `fieldsight-frontend/src/pages/organization/ReportsPage.tsx` | LATER | Add monitoring exports after indicator calculations are reliable. | Indicator result API. | P3 |

## KEEP

Keep these systems as the source of truth:

- Tenancy: `Organization`, `OrganizationMembership`, `Role`, and active membership checks.
- Project ownership: `Project.organization_id`, `Project.id`, lifecycle fields, and current CRUD routes.
- Kobo connection and project form assignment: `KoboConnection`, `Project.kobo_connection_id`, `Project.kobo_form_id`, `Project.kobo_form_name`.
- Synced submissions: `Submission` rows and `raw_answers` JSON.
- Data quality state: `Submission.review_status` with values `ready`, `needs_review`, and `invalid`.
- Existing analytics and dashboard endpoints for collection progress and high-level operational status.
- Frontend API client and TanStack Query approach.
- Recharts as the charting library.

## MODIFY

Modify these areas carefully:

- `fieldsight-backend/app/routes/intelligence.py`
  - Keep existing endpoints working.
  - Use its project scoping and deterministic calculations as a reference for the indicator service.
  - Do not expand this file into all M&E behavior indefinitely; create a focused indicator route/service.

- `fieldsight-backend/app/models/operations.py`
  - Add indicator-related models here if the project keeps all operations models together.
  - Existing `ProjectTarget` overlaps with indicator targets but should not be stretched into baseline/current/status.

- `fieldsight-backend/app/api/v1/router.py`
  - Include a new indicator router in Phase B.

- `fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx`
  - It is currently overview-only with an Analytics nav link.
  - Add Indicators and Monitoring affordances here in later phases.

- `fieldsight-frontend/src/services/apiClient.ts`
  - Add typed Indicator contracts and calls.
  - Keep API naming consistent with existing client methods.

## ADD

Add these M&E concepts in order:

1. `Indicator`
   - Organization-owned and project-scoped.
   - Fields: `name`, `description`, `code`, `unit`, `direction`, `baseline_value`, `target_value`, `target_date`, `status`, `is_active`, `created_by_id`, timestamps.
   - Use enums for unit, direction, and status.

2. Indicator schemas
   - `IndicatorCreate`
   - `IndicatorUpdate`
   - `IndicatorRead`
   - `IndicatorListItem`

3. Indicator service
   - Encapsulate project ownership validation, role authorization, CRUD, status defaults, and soft deletion.
   - Keep status rule functions isolated for later replacement.

4. Indicator endpoints
   - `GET /projects/{project_id}/indicators`
   - `POST /projects/{project_id}/indicators`
   - `GET /indicators/{indicator_id}`
   - `PATCH /indicators/{indicator_id}`
   - `DELETE /indicators/{indicator_id}`

5. Indicator frontend experience
   - Project Indicators view using persisted API data.
   - Create/edit flow with baseline, target, unit, direction, target date, and mapping status placeholder.

6. Indicator mapping
   - Add only after indicators exist.
   - Because no persisted form schema/version model exists, Phase D should initially derive mapping options from `Submission.raw_answers` and/or existing `FieldMapping.source_fields`.

7. Indicator calculation service
   - Add after mappings exist.
   - Calculate from `Submission.raw_answers`, scoped by organization and project.
   - Exclude invalid records by default.

8. Monitoring dashboard
   - Build from backend result API, not frontend-only calculations.

## LATER

Defer these until after Phase E/F is stable:

- Universal form schema/version storage, unless needed earlier for reliable mapping labels.
- Donor reporting templates and report designer.
- Advanced logical framework or theory of change.
- Custom formulas or tenant-supplied SQL.
- Advanced GIS and predictive analytics.
- AI-generated monitoring recommendations.
- Full audit event expansion if there is not already a durable audit event model.
- Organization-level M&E dashboard summaries until project-level indicator results work.

## Existing Data Model Notes

### Project

Defined in `fieldsight-backend/app/models/operations.py`.

Relevant fields:

- `organization_id`
- `organization_sector_id`
- `status`
- `start_date`
- `end_date`
- `target_sample_size`
- `kobo_connection_id`
- `kobo_form_id`
- `kobo_form_name`

M&E use:

- Indicators should belong to a project and organization.
- Project dates can later support expected-progress calculations.
- Sample size should remain a collection target, not an indicator target.

### Submission

Defined in `fieldsight-backend/app/models/operations.py`.

Relevant fields:

- `organization_id`
- `project_id`
- `kobo_form_id`
- `submitted_at`
- `enumerator`
- `location`
- `review_status`
- `raw_answers`

M&E use:

- Source of truth for indicator calculation after Kobo sync.
- `raw_answers` contains dynamic Kobo keys.
- `review_status` should gate calculation eligibility.
- `location`, `enumerator`, and `submitted_at` support V1 disaggregation.

### FieldMapping

Defined in `fieldsight-backend/app/models/operations.py`.

Relevant fields:

- `source_field`
- `display_name`
- `meaning`
- `data_type`
- `is_required`
- `is_location`

M&E use:

- Reuse for friendly labels and data-type hints.
- Not enough for indicator mapping because it lacks calculation type and expected value.

### ProjectTarget

Defined in `fieldsight-backend/app/models/operations.py`.

Relevant fields:

- `field_mapping_id`
- `name`
- `target_value`
- `unit`
- `direction`
- `due_date`

M&E use:

- Existing simple target system.
- Do not use as the canonical V1 indicator object because it lacks baseline, active status, indicator direction enum, and result semantics.

## Backend Implementation Map

### Phase B Files to Add

- `fieldsight-backend/app/schemas/indicators.py`
- `fieldsight-backend/app/routes/indicators.py`
- `fieldsight-backend/alembic/versions/0011_indicators.py`
- `fieldsight-backend/tests/test_indicators.py`

Optional if the domain grows:

- `fieldsight-backend/app/services/indicator_service.py`

The repository does not currently have a `services` package. If Phase B is small, keeping route helpers in `routes/indicators.py` is consistent with the current codebase. If calculation/status logic starts to grow, create a services package before Phase E.

### Phase B Files to Modify

- `fieldsight-backend/app/models/operations.py`
  - Add indicator enums and `Indicator` SQLModel.

- `fieldsight-backend/app/models/__init__.py`
  - Confirm no export changes are needed. It may be empty.

- `fieldsight-backend/app/api/v1/router.py`
  - Include indicator router.

- `fieldsight-backend/app/routes/organizations.py`
  - Project deletion cleanup must include indicators after the table exists.

### Authorization Pattern

Current routes use two patterns:

- Explicit organization ID routes use `_authorize(org_id, user, db, admin=True)` in `organizations.py`.
- Token-scoped organization admin routes use `_organization_admin_id(user, db)` in `kobo.py`, `collection.py`, and `intelligence.py`.

For Phase B indicator endpoints:

- Listing by project should resolve the admin organization from the authenticated user and verify the project belongs to it.
- Create/update/delete should require organization admin.
- Enumerator access should be rejected for write operations. If read access is allowed later, it should be explicit and project-assignment scoped.

Recommended helper shape:

```text
def _project_for_admin(project_id, user, db) -> Project
def _indicator_for_admin(indicator_id, user, db) -> Indicator
```

Avoid trusting `organization_id` from request bodies.

### Migration Pattern

Existing migrations:

- Use Alembic revision files under `fieldsight-backend/alembic/versions`.
- Some migrations inspect existing tables/indexes before creating objects.
- SQLModel UUID columns are represented as `sa.Uuid()`.

For `0011_indicators.py`:

- Add `indicators` with indexes on `organization_id`, `project_id`, and possibly `(organization_id, project_id, is_active)`.
- Add foreign keys to `organizations.id`, `projects.id`, and `users.id`.
- Use string enums or SQLAlchemy enum consistently. The existing code mostly stores operational statuses as strings except `Role`.

## Frontend Implementation Map

### Current Project Workspace

File: `fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx`

Current tabs:

- Overview as a local active tab.
- Analytics as a link to `/analytics?project_id=...`.

Recommended Phase C:

- Add an Indicators tab/link from the workspace.
- Either create `ProjectIndicatorsPage.tsx` with a route like `/projects/:projectId/indicators`, or implement in-page tabs if the workspace is refactored.
- Keep the first implementation focused: list, empty state, create/edit, persisted refresh.

### API Client

File: `fieldsight-frontend/src/services/apiClient.ts`

Add:

- `IndicatorUnit`
- `IndicatorDirection`
- `IndicatorStatus`
- `ApiIndicator`
- `CreateIndicatorInput`
- `UpdateIndicatorInput`
- `projectIndicators(projectId)`
- `createIndicator(projectId, input)`
- `indicator(indicatorId)`
- `updateIndicator(indicatorId, input)`
- `deleteIndicator(indicatorId)`

### Routing

File: `fieldsight-frontend/src/app/App.tsx`

Options:

- Add nested project routes later if the workspace becomes a layout.
- For a minimal Phase C, add sibling routes:
  - `/projects/:projectId/indicators`
  - `/projects/:projectId/monitoring`

The current workspace is not a nested route layout, so avoid a large routing refactor during the first frontend slice.

## M&E Feature Mapping

| Proposed M&E feature | Existing extension point | Gap | Implementation priority |
|---|---|---|---|
| Indicators | `Project`, `ProjectTarget`, `FieldMapping`, project workspace | No canonical indicator model | P0 |
| Baselines | None | Need `baseline_value` on Indicator | P0 |
| Targets | `ProjectTarget`, `Project.target_sample_size` | Need indicator-level target separate from collection target | P0 |
| Kobo question mapping | `FieldMapping`, `Submission.raw_answers`, `get_field_mappings` | Need calculation type and expected value | P1 |
| Current indicator calculation | `/projects/{project_id}/intelligence`, analytics overview | Need authoritative indicator result contract | P1 |
| Indicator status | Project intelligence pulse and target status | Need isolated status rules | P1 |
| Monitoring dashboard | Project workspace, dashboard cards, Recharts | Needs backend result API | P2 |
| Disaggregation | `Submission.location`, `Submission.enumerator`, `submitted_at`, analysis filters | Need indicator-scoped breakdowns | P2 |
| Data-quality linkage | Quality endpoints and review status | Need relevant-record quality counts | P2 |
| Insights | Project intelligence pulse and dashboard alerts | Need deterministic M&E insight categories | P3 |
| Basic reports | Reports page | Need export from real indicator results | P3 |

## Risks and Product Decisions

### Form Schema Storage

The implementation plan mentions `FormVersion.schema_json`, but this repository currently does not have `Form` or `FormVersion` tables. Current Kobo form information on `Project` is only ID/name. Phase D should either:

- derive available questions from synced `Submission.raw_answers` and existing `FieldMapping` metadata, or
- add formal Kobo form schema storage as a separate slice before mapping UI.

Recommendation for V1 speed: derive fields from synced submissions first, and add schema storage only if question labels and choice lists are needed.

### Existing Target System

`ProjectTarget` already stores target-like data. It is tempting to retrofit it into indicators, but doing so would blur:

- project collection targets,
- simple project targets,
- M&E indicators with baseline/current/target/status.

Recommendation: add `Indicator` and preserve `ProjectTarget` for compatibility. Later migration can map simple targets into indicators if product direction confirms it.

### Review Status Inclusion

Current review statuses are:

- `ready`
- `needs_review`
- `invalid`

Recommendation for Phase E:

- Include `ready`.
- Exclude `invalid`.
- Decide whether `needs_review` is included, excluded, or included with a confidence warning. Document the rule in the result service.

### Tenant Isolation

Most current endpoints scope by a single active organization admin membership. Multi-organization admin memberships can produce conflicts in some helper paths.

Recommendation:

- Keep Phase B endpoints project-scoped wherever possible.
- Resolve organization through the project, then check membership.
- Never accept `organization_id` from indicator request bodies.

## Acceptance Criteria for Phase A

- No duplicate production models introduced: satisfied.
- Existing project and analytics architecture understood: satisfied.
- Required M&E additions separated from existing functionality: satisfied.
- Precise implementation map exists for indicators, baselines, targets, Kobo mapping, calculation, monitoring, quality linkage, and insights: satisfied.
