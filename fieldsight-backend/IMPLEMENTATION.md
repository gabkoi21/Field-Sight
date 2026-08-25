# FieldSight backend implementation guide

## Purpose and frontend findings

This document is the implementation blueprint for the FieldSight backend. It is based on the React/Vite frontend in `../fieldsight-frontend`, not on an existing backend (the backend workspace is empty at the time of writing).

FieldSight is a multi-tenant field-data operations platform. Each organization collects data through versioned forms (currently KoboToolbox is the named source), assigns enumerators, reviews data quality, analyzes results, and produces governed exports and scheduled reports. A separate super-administration surface manages all tenants, subscriptions, platform policy, system health, and audit records.

### Current frontend structure

| Surface                | Current route(s)                    | Backend responsibility                                                                                                  |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Sign-in                | `/login`                            | Password login, refresh/logout, password reset, invitation acceptance, current user/session                             |
| Organization dashboard | `/`                                 | Tenant-scoped metrics, chart series, recent activity, alerts                                                            |
| Projects               | `/projects`, `/projects/:projectId` | Project lifecycle, targets, memberships, project summaries and attention items                                          |
| Forms and sources      | `/forms`                            | Form/source connection, form/version lifecycle, deployment and sync state                                               |
| Submissions            | `/submissions`                      | Paginated records, filters, bulk selection, record detail and review decisions                                          |
| Field operations       | `/enumerators`                      | Enumerator membership, project/form assignment, targets, presence/device/sync health, daily performance                 |
| Sync history           | `/sync`                             | Integration health, sync run history, manual/scheduled sync initiation and retry                                        |
| Explore and analyze    | `/analytics`                        | Filterable aggregate datasets, location breakdowns, export creation/download                                            |
| Reports                | `/reports`                          | Templates, report definitions, asynchronous generation, report files and schedules                                      |
| Team and settings      | `/team`, `/settings`                | Invitations/memberships/roles; tenant preferences, integrations, notification, security and data policies               |
| Super admin            | `/superadmin/*`                     | Tenant provisioning, cross-tenant users/roles, plans/invoices, audit log, platform configuration and operational status |

The frontend uses React Router 7, TanStack Query, and Recharts. Only `ProjectsPage`, `ProjectWorkspacePage`, and `SubmissionsPage` currently call `src/services/mockApi.ts`; all other page data is inline mock data and all UI mutations are local state. There is no network client, authentication persistence, route protection, error state, pagination API, or backend contract yet.

### Important implementation gaps to close

- The login screen accepts the hard-coded credentials `Admin`/`12345` and `Manager`/`12345`; replace this completely with email-or-username authentication against the API. Never seed those credentials in production.
- Organization context, current user name, role, and navigation counts are hard-coded. Return them from `/auth/me` and tenant summary endpoints.
- `/superadmin/*` and all organization routes are public in the router. The frontend must add auth and authorization route guards after API integration; the backend remains the authority and must enforce them independently.
- `QualityCenterPage.tsx` contains a full quality-review experience but is not imported or routed in `App.tsx`. Build its backend now, then add an intended route such as `/quality` or `/projects/:projectId/quality` when the frontend exposes it.
- Forms, team, sync history, reports, settings, billing, audit, and system-health buttons are presentation-only. Do not infer that a click has succeeded until an API response and refetch/mutation update are wired.
- Mock labels such as “Today”, “8 min ago”, comma-formatted counts, and currency strings must become typed timestamps, integers, `Decimal` money, and ISO 8601 API values; the frontend should format them.

## Product flows and required data

### Authentication and tenant selection

1. A user signs in with an email/username, password, and optional `remember_me` value.
2. The API verifies an active account, records a session and audit event, and returns a short-lived access JWT plus a rotated refresh token.
3. `/auth/me` returns the user, platform role(s), organization memberships, effective permissions, active organization, and enforcement requirements (MFA or password-reset state).
4. A user with multiple memberships chooses an organization; the API validates the membership and stores the selection in a session or accepts an explicit tenant route parameter/header. A super admin may impersonate/switch tenant only through an audited, explicit flow.
5. Invitations create a one-time, expiring token. Accepting an invitation sets a password, activates the membership, and invalidates the invitation.

The initial authorization model uses exactly three roles across the platform. The current frontend label/value `data_manager` must be renamed and migrated to `organization_admin`; do not create a separate `data_manager` role. `analyst` is not part of the initial model. Use stable machine-readable enum values; display labels belong in the frontend. A user may have a platform-level `super_admin` role and memberships in several organizations.

```text
roles
1. super_admin
   └── Controls the FieldSight platform
2. organization_admin
   └── Controls one organization
3. enumerator
   └── Collects field data
```

| Role | Scope | Core capabilities | Explicit limits |
| --- | --- | --- | --- |
| `super_admin` | Entire platform | Create, activate, suspend, and manage organizations; create organization-owner invitations; manage platform settings, plans/billing, audit logs, and platform health | Must not use ordinary tenant endpoints to bypass audit/tenant-context controls; any cross-tenant support access must be explicit and audited |
| `organization_admin` | Their organization only | Manage organization profile/settings, members and enumerators, projects, forms/connections, syncs, submission review/quality, analytics, exports, reports, and organization-level security/data policies | Cannot view/manage another organization or platform settings, billing administration, or platform audit/health data |
| `enumerator` | Their assigned projects/forms/locations only | Use supported collection clients/sources, view their assignments and permitted own work, and submit/sync assigned records | Cannot manage users, tenant settings, projects/forms/connections, organization-wide submissions, reviews, exports, reports, or administrative policy |

Organization owners created by a super admin receive the `organization_admin` role when they accept their invitation. An organization admin creates an enumerator by inviting a user with the `enumerator` role and creating at least one `FieldAssignment` for the relevant project, form version, location, and daily target.

### Tenant administration and projects

Super admins create organizations with a name, owner email, and initial plan (`starter`, `professional`, `enterprise`), optionally inviting the owner. A tenant has a slug/workspace ID, description, country, time zone, branding, defaults, status (`trial`, `active`, `suspended`, `deleted`), retention and export policies.

Sectors define the program areas in which FieldSight organizations operate, including `health`, `education`, `agriculture`, `wash`, and `humanitarian_response`. Model them as a reusable platform catalog, not as a text field on an organization: one organization can operate in many sectors and one sector can be assigned to many organizations through `organization_sectors`. An organization admin can choose only from the approved sector catalog for their organization. A project should reference one organization-assigned sector (`organization_sector_id`) so dashboards, forms, submissions, analytics, and reports can be filtered consistently by sector.

Organizations own projects. A project needs at least a name, description, `organization_sector_id`, country or geography, status (`draft`, `active`, `in_review`, `paused`, `completed`, `archived`), start/end dates, target sample size, current form, visibility, and creation/audit fields. Validate that its sector belongs to the same organization. Project members and assignments control access. Project workspaces display collection progress, daily verified submissions, high-risk records, enumerators below target, and a form-update notice.

### Forms, sources, and synchronization

The forms page requires form name, project, lifecycle (`draft`, `live`, `paused`, `retired`), semantic version, submission count, deployment state, and last-sync time. Model a source connection separately from a form:

- `IntegrationConnection`: tenant, provider (`kobotoolbox`, `webhook`, `power_bi`, `odata`), encrypted configuration/secrets, status, last health check/error and timestamps.
- `Form`: logical instrument associated with a project and source connection.
- `FormVersion`: immutable versioned schema (`schema_json`), external form identifier, version string, deployment state, published time and change metadata.
- `SyncRun`: source/form/version, trigger (`scheduled`, `manual`, `retry`, `webhook`), cursor/range, status, received/created/updated/duplicate/invalid counts, error summary, started/completed timestamps.

Kobo synchronization must run outside the request lifecycle. A manual “Sync all forms” endpoint queues idempotent work and returns `202 Accepted` with a sync-run/job resource. Import using external submission IDs and unique constraints so retries cannot duplicate data. Webhook signatures, provider rate limits, token refresh, backoff, and a dead-letter/retry policy are required.

### Submission lifecycle and quality review

A submission is append-only source data plus review metadata. Preserve the original payload exactly and store normalized/indexed fields needed for filtering/aggregation. The submissions screen requires project, form, enumerator, location, submitted-at, validity/review status, review flags, and detail including answers and contextual metadata. It supports free-text search, project and review filters, row selection, bulk actions, and a detail drawer.

Recommended workflow:

`received` -> `processing` -> `pending_review` -> `valid | flagged | invalid`

Allow re-review without overwriting history: `SubmissionReview` records decision, reviewer, reason code, note, timestamp, and previous state. `QualityIssue` represents a specific rule/manual problem with severity (`low`, `medium`, `high`, `critical`), state (`open`, `in_progress`, `resolved`, `dismissed`), owner, details, and references to a submission/field/rule. Add `QualityComment` for the review-note thread shown by the quality center.

Automated rules should be versioned configuration (required field, range, duplicate, skip-logic, GPS/outlier, enumerator velocity, custom expression), run during import or asynchronously, and retain their result/evidence. Review counts, dashboard quality percentage, and “requires attention” cards are derived data, not separately edited counters.

### Field operations

The field operations page uses enumerator assignment, location, daily target, records today/total, flagged count, last sync, and activity status. Add:

- `FieldAssignment`: membership/user, project, form version, optional geographic area, daily target, effective dates, enabled state.
- `Device`: optional device identifier/platform/app version, last-seen/sync timestamps and health state. Store only an appropriately hashed/minimized identifier where possible.
- `FieldActivity` or aggregate query: submission timestamps and assignment data supply per-day target/actual values; do not persist easily derivable totals as the source of truth.
- `Location`: hierarchy or geometry/reference code. Submission location values should reference it when possible and retain raw source location otherwise.

Creating a field worker is an invitation plus an assignment, not a standalone name record. The drawer fields shown are name, email, project, assigned form, location, daily target, and invitation-email preference. The API should create/update the user/membership transactionally and send the invite only after commit.

### Analysis, exports, and reports

The analytics screen filters by project, form, and location and shows submission trend, response outcomes, records by location, analysis notes, and a clickable location breakdown. Implement a constrained analytics API rather than exposing arbitrary SQL:

- `GET /analytics/overview` with allow-listed filters, `from`, `to`, and timezone returns metric cards and chart series.
- `GET /analytics/locations` returns paginated/ordered location aggregates and optional drill-down link data.
- Add named, validated aggregate definitions for reusable measures. For dynamic form answers, permit only safe declared fields and aggregate operations.

Exports must be asynchronous because a tenant may have many submissions. An export request carries filters, format (`csv`, `xlsx`, optionally `json`), selected fields, and mandatory reason when policy requires it. It creates an `ExportJob` (`queued`, `running`, `completed`, `failed`, `expired`), records the requester and audit event, generates a private object-store file, and returns a short-lived signed download URL only after authorization.

Reports need templates (project progress, collection summary, quality report), a saved report definition, generated artifact, and optional recurring schedule/recipients. The UI’s report drawer indicates template, project, period, output format, delivery options, and scheduled email. Use `ReportDefinition`, `ReportRun`, and `ReportSchedule`; queue generation and email delivery, capture errors, and prevent a user from downloading another tenant’s output.

### Billing, administration, auditing, and health Note for now do not emplement the financial this will be later

Plans have limits/features (projects, users, submissions, storage, exports). Tenant usage is derived periodically. Model `Subscription`, `Invoice`, and optionally `Payment`/provider event tables; money is integer minor units or `Decimal`, never a display string. Webhook processing for a payment provider must verify signatures and use event idempotency keys.

Every security-sensitive, administrative, review, export, integration, billing, and destructive action writes an immutable `AuditEvent`: tenant (nullable for platform actions), actor/user or system, action, entity type/id, outcome, request/correlation ID, source IP, user agent, before/after values with secrets redacted, and timestamp. Super-admin audit search needs text, category, actor, tenant, outcome, and time-range filters.

System health should read operational telemetry rather than static rows: API readiness/liveness, database/connectivity, queue depth, worker status, storage usage, integration/email provider checks, deployments, and incident history. Keep public health probes minimal; expose privileged detailed health only to super admins.

## Architecture and conventions

### Required stack and supporting packages

Use Python 3.12+, FastAPI, SQLModel for persistence models, Pydantic v2 models for API inputs/outputs, SQLite for the current implementation phase, JWT authentication, and `pwdlib` for password hashing. Use Alembic from the first migration; do not rely on `SQLModel.metadata.create_all()` beyond local experiments. Design the models and migrations to support a later PostgreSQL move, but do not require PostgreSQL now.

Recommended supporting dependencies: `uvicorn[standard]`, `pydantic-settings`, `PyJWT` or `python-jose` (choose one and pin it), `pwdlib[argon2]`, `alembic`, `httpx`, `email-validator`, a task queue/worker such as Celery, Dramatiq, or ARQ with Redis when background work is introduced, an S3-compatible object-storage client when files are introduced, structured logging, OpenTelemetry/Sentry, `pytest`, and `pytest-asyncio`. Python includes the SQLite driver needed for the current database; add a PostgreSQL driver only during a future migration.

Use synchronous SQLModel sessions initially unless the team is committed to async SQLAlchemy patterns; FastAPI safely runs standard `def` dependencies in its thread pool. Consistency and testability matter more than mixing styles. Use UTC-aware `datetime` values everywhere and convert to the tenant’s configured time zone at presentation/query-boundary time.

Suggested layout:

```text
fieldsight-backend/
  app/
    main.py                 # app factory, middleware, router registration
    core/                   # config, security, logging, errors, rate limiting
    db/                     # engine/session, Alembic support, seed/dev fixtures
    models/                 # SQLModel table models, grouped by domain
    schemas/                # Pydantic request/response schemas (never table models directly)
    api/v1/                 # routers: auth, organizations, projects, ...
    services/               # domain operations and authorization-aware commands
    repositories/           # optional query/persistence layer for complex domains
    integrations/           # Kobo, email, billing, object storage
    workers/                # queued task definitions and schedules
    tests/
  alembic/
  pyproject.toml
  .env.example
  Dockerfile
  docker-compose.yml        # local only
```

Expose application endpoints at the API root (for example, `/auth/me` and `/organizations`). Keep routers thin: parse/validate input, obtain dependencies, call a service, and serialize a response. Put transactions, side effects, state transitions, authorization-aware business rules, and audit writing in services. Use `UUID` primary keys exposed publicly; avoid auto-incrementing integer IDs in the external API. Add `created_at`, `updated_at`, and where relevant `deleted_at`/`archived_at`, `created_by_id`, and an optimistic `version` value.

### Tenant isolation and authorization

Use one SQLite database for the current implementation, with an explicit `organization_id` on every tenant-owned table, composite indexes beginning with `organization_id`, and service/repository queries that always scope to the effective tenant. Enable SQLite foreign keys on every connection (`PRAGMA foreign_keys = ON`), enable WAL mode for better local read/write concurrency, and set a sensible busy timeout. Never accept an organization ID in a request body as the sole authority. Resolve it from a validated path parameter, selected tenant context, and the authenticated user’s membership; compare all three.

Create dependency primitives such as `get_current_user`, `get_current_session`, `get_tenant_context`, `require_platform_role`, `require_tenant_permission`, and `load_tenant_resource_or_404`. Return `404` rather than revealing a resource in another tenant. Enforce project membership in addition to tenant membership when project visibility is restricted.

Define permissions in code (for example `organization.manage`, `member.manage`, `project.write`, `form.manage`, `submission.review`, `export.create`, `report.manage`, `integration.manage`, `billing.read`, `platform.manage`) and map the three fixed roles to permissions. For the initial release, use a migration-safe role enum rather than a `Role` table. A custom role model can be added later only if the UI requires it.

## Data model

### Core tables

| Domain     | SQLModel tables                                                                                                                           | Essential fields and relationships                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity   | `User`, `PasswordCredential`, `RefreshSession`, `PasswordResetToken`, `Invitation`, `MfaChallenge`                                        | User identity/contact/status/last login; password hash in a separate credential record; hashed refresh/invite/reset token; session device/IP metadata; invite links user + tenant role |
| Tenancy    | `Organization`, `OrganizationMembership`, `OrganizationSettings`, `PlatformSettings`, role enum                                           | Organization name/slug/status/plan/owner; membership joins user-to-tenant with `organization_admin` or `enumerator`; JSON settings only for flexible preferences, not core filterable data |
| Sectoring  | `Sector`, `OrganizationSector` (`organization_sectors`)                                                                                | Global sector catalog (health, education, agriculture, WASH, humanitarian response); many-to-many organization-sector link, optional active state and tenant-specific metadata; projects reference an organization-sector link |
| Programs   | `Project`, `ProjectMembership`, `Location`, `FieldAssignment`, `Device`                                                                   | Tenant project lifecycle and sample target; scope assignments to people/forms/geographies; hierarchical/geo locations; device health                                                   |
| Collection | `IntegrationConnection`, `Form`, `FormVersion`, `SyncRun`, `Submission`, `SubmissionAnswer` (optional normalized), `SubmissionAttachment` | Encrypted provider credentials; immutable schemas; idempotent sync; original payload in a portable SQLAlchemy `JSON` column, external ID, timestamps, enumerator/location links, review state |
| Quality    | `QualityRule`, `QualityIssue`, `SubmissionReview`, `QualityComment`                                                                       | Rule version/evidence; issue severity/owner/state; append-only review decisions and comments                                                                                           |
| Outputs    | `ExportJob`, `ReportDefinition`, `ReportRun`, `ReportSchedule`, `StoredObject`                                                            | Filter snapshot, requester/reason/state, object key/checksum/expiry; report template/config/output/schedule/delivery history                                                           |
| Platform   | `Plan`, `Subscription`, `Invoice`, `PaymentEvent`, `AuditEvent`, `SystemIncident`, `ServiceCheck`                                         | Entitlements and billing amounts/status; verified provider events; immutable audit trail; privileged operational history                                                               |

### SQLite database design details

- Use portable SQLAlchemy `JSON` columns for raw submission payloads, form schemas, controlled report/export filters, and redacted audit snapshots. Keep every frequently filtered attribute in a typed, indexed column rather than querying JSON in SQLite.
- Enforce `UNIQUE (organization_id, slug)` for tenant slugs as appropriate; `UNIQUE (email)` on normalized user email; `UNIQUE (organization_id, provider, external_id)` for connections; and `UNIQUE (form_version_id, external_submission_id)` for imported records.
- Use foreign keys with intentional delete behavior: restrict or soft-delete tenants/projects; cascade only to true owned children; preserve audit records and key historical entities.
- Enforce `UNIQUE (organization_id, sector_id)` on `organization_sectors`; index `organization_sectors(sector_id, organization_id)` for catalog/reporting lookups and `projects(organization_id, organization_sector_id)` for sector filtering. A project may reference only an active organization-sector link.
- Add indexes for `(organization_id, created_at DESC)`, submission query dimensions `(organization_id, project_id, submitted_at DESC)`, `(organization_id, review_status, submitted_at DESC)`, `(organization_id, enumerator_id, submitted_at DESC)`, sync/job state, invitation/session expiry, and audit `(organization_id, occurred_at DESC)`.
- Begin with a location hierarchy and latitude/longitude numeric fields behind a repository interface. Defer map/within-area spatial queries until a later PostgreSQL/PostGIS migration is justified.
- Use migrations for enums/check constraints, including valid state transitions where SQL constraints help. Use service-level validation for richer workflow rules.

## REST API contract

All collection endpoints return typed Pydantic response models, not ORM objects. Use `application/problem+json` or one consistent error shape containing `code`, `message`, `details`, `request_id`. Lists use cursor pagination (`limit`, `cursor`) and return `{items, next_cursor, total?}`. Use ISO 8601 UTC timestamps, UUIDs, integer counts, booleans, enums, and decimal/integer money values—never UI-formatted strings.

### Endpoint map

| Area                        | Endpoints (representative, exposed at the API root)                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication              | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password/forgot`, `POST /auth/password/reset`, `POST /auth/invitations/accept`, `POST /auth/mfa/verify`                                                                        |
| Profile/session             | `PATCH /me`, `GET /me/sessions`, `DELETE /me/sessions/{id}`, `DELETE /me/sessions`                                                                                                                                                                                        |
| Organizations (super admin) | `GET/POST /organizations`, `GET/PATCH/DELETE /organizations/{org_id}`, `POST /organizations/{org_id}/restore`, `GET /organizations/{org_id}/usage`, `POST /organizations/{org_id}/switch-context`                                                                         |
| Sectors | `GET /sectors`, `POST/PATCH /sectors` (super admin); `GET/PUT /organizations/{org_id}/sectors`, `DELETE /organizations/{org_id}/sectors/{sector_id}` (authorized organization admin or super admin) |
| Tenant/settings             | `GET/PATCH /organizations/{org_id}/settings`, `POST /organizations/{org_id}/logo/upload-url`, `GET/PATCH /platform/settings`                                                                                                                                              |
| Membership/invitations      | `GET/POST /organizations/{org_id}/members`, `PATCH/DELETE /organizations/{org_id}/members/{membership_id}`, `POST /organizations/{org_id}/invitations`, `POST /invitations/{id}/resend`                                                                                   |
| Projects                    | `GET/POST /organizations/{org_id}/projects`, `GET/PATCH/DELETE /projects/{project_id}`, `GET /projects/{project_id}/workspace`, `GET/POST /projects/{project_id}/members`                                                                                                 |
| Forms/integrations          | `GET/POST /organizations/{org_id}/connections`, `PATCH/DELETE /connections/{id}`, `GET/POST /projects/{project_id}/forms`, `GET/PATCH /forms/{id}`, `POST /forms/{id}/versions`, `POST /forms/{id}/deploy`, `POST /forms/{id}/pause`                                      |
| Synchronization             | `GET /organizations/{org_id}/sync-runs`, `POST /organizations/{org_id}/sync-runs`, `POST /sync-runs/{id}/retry`, `POST /webhooks/kobotoolbox/{connection_id}`                                                                                                             |
| Submissions                 | `GET /organizations/{org_id}/submissions`, `GET /submissions/{id}`, `PATCH /submissions/{id}`, `POST /submissions/bulk-review`, `POST /submissions/{id}/reviews`, `GET/POST /submissions/{id}/issues`, `PATCH /quality-issues/{id}`, `POST /quality-issues/{id}/comments` |
| Field operations            | `GET/POST /organizations/{org_id}/field-assignments`, `PATCH/DELETE /field-assignments/{id}`, `GET /organizations/{org_id}/field-operations`, `GET /organizations/{org_id}/devices`                                                                                       |
| Analytics/exports           | `GET /organizations/{org_id}/analytics/overview`, `GET /organizations/{org_id}/analytics/locations`, `POST /organizations/{org_id}/exports`, `GET /exports/{id}`, `POST /exports/{id}/cancel`, `GET /exports/{id}/download`                                               |
| Reports                     | `GET/POST /organizations/{org_id}/reports`, `GET/PATCH/DELETE /reports/{id}`, `POST /reports/{id}/runs`, `GET /report-runs/{id}`, `GET /report-runs/{id}/download`, `POST/GET/PATCH/DELETE /reports/{id}/schedules`                                                       |
| Dashboards                  | `GET /organizations/{org_id}/dashboard`, `GET /platform/dashboard`                                                                                                                                                                                                        |
| Billing                     | `GET /plans`, `GET/PATCH /organizations/{org_id}/subscription`, `GET /invoices`, `GET /invoices/{id}`, `POST /webhooks/billing-provider`                                                                                                                                  |
| Governance/operations       | `GET /audit-events`, `GET /platform/health` (super-admin detailed), `GET /health/live`, `GET /health/ready`, `GET /platform/incidents`                                                                                                                                    |

Use query parameters for filters: `project_id`, `form_id`, `location_id`, `enumerator_id`, `review_status`, `issue_status`, `severity`, `search`, `from`, `to`, `sort`, `limit`, and `cursor`. Validate allowed sort fields and maximum ranges. For bulk review requests, accept no more than a configured number of UUIDs, an action/reason/note, and require idempotency keys for retryable client mutations.

### Pydantic schema pattern

Keep table and API models distinct. For each resource define `Create`, `Update`, `Read`, and `List` schemas, with role-specific variants where data must be hidden. Examples: `LoginRequest`, `TokenResponse`, `UserRead`, `OrganizationCreate`, `OrganizationRead`, `ProjectCreate`, `SubmissionListItem`, `SubmissionDetail`, `ReviewCreate`, `ExportCreate`, and `JobRead`.

Validate normalized email, password policy, IANA time zones, country/locale values, UUIDs, ownership fields, report cron/time zone, upload content type/size, filter grammar, schema size, and provider configuration. Do not accept raw provider secrets in ordinary read responses; return masked connection metadata only.

## Development phases

### Phase 0 — decisions and contracts

1. Confirm SQLite as the current database (`sqlite:///./fieldsight.db`), plus object storage, mail provider, queue/Redis, and billing-provider choices as those features are introduced. Document the conditions that will trigger a later PostgreSQL migration.
2. Convert this guide into API tickets, including acceptance criteria and role/tenant authorization for each endpoint.
3. Define OpenAPI-first Pydantic schemas and error/pagination conventions; generate or hand-maintain typed frontend client types.
4. Confirm the missing Quality Center route and whether form authoring is in scope versus Kobo-only connection/management.

**Done when:** the team has an approved role matrix, entity/state-transition diagram, API naming convention, and local development secrets policy.

### Phase 1 — project foundation

1. Create the FastAPI app factory and root API router, settings via `pydantic-settings`, structured JSON logging, correlation-ID middleware, CORS for approved frontend origins, and global exception handlers.
2. Add `pyproject.toml`, lock dependencies, lint/format/type-check tooling, Dockerfile, optional Docker Compose for Redis/local object storage when needed, `.env.example`, and pre-commit hooks. Store the SQLite database outside the container image in a mounted volume for local persistence.
3. Configure SQLModel engine/session dependency, Alembic, first migration, health/live and health/ready endpoints, and test application factory.
4. Establish CI for formatting, typing, unit tests, migration-upgrade test, and dependency/security scanning.

**Done when:** a fresh clone can start dependencies, run migrations, launch the API, display OpenAPI docs in non-production, and pass CI.

### Phase 2 — identity, tenancy, and RBAC

1. Implement `User`, credential, session/refresh token, invitation, organization, membership, `Sector`, `OrganizationSector`, plan, and settings tables/migrations. Seed the approved sector catalog: health, education, agriculture, WASH, and humanitarian response.
2. Hash passwords with `pwdlib.PasswordHash.recommended()` (Argon2 recommended configuration); verify and rehash when necessary. Never log passwords, tokens, or hashes.
3. Implement access JWTs with minimal claims (`sub`, session ID, token ID, expiry, issuer/audience) and opaque, hashed, rotating refresh tokens stored in secure `HttpOnly`, `Secure`, `SameSite` cookies for browser clients. Define CSRF protection for cookie-authenticated unsafe requests.
4. Implement login/logout/refresh/me, password reset, invite acceptance, session listing/revocation, account status rules, rate limiting, and audit events.
5. Implement tenant context and role/permission dependencies; test cross-tenant access denial before adding business endpoints.

**Done when:** super admins, organization admins, and enumerators receive only their permitted data/actions; revoked/suspended users and rotated/replayed refresh tokens are rejected.

### Phase 3 — projects, teams, settings, and storage

1. Build organization CRUD/provisioning for super admins, tenant profile/defaults, organization-sector assignment, member management/invitations, project CRUD, project membership, locations, and field assignments. Require each project to select an active organization sector.
2. Add safe direct-to-object-storage upload issuance for organization logos and later submission attachments; virus-scan or quarantine untrusted uploads before making them available.
3. Implement tenant and platform settings, notification preferences, security/data policies, sessions, and audit coverage.
4. Replace the frontend hard-coded organization/team/settings/project data with TanStack Query hooks and mutations. Add frontend route guards and token refresh handling in this integration phase.

**Done when:** the organization, team, projects, and settings pages operate against persisted data across reloads, including invitation email in a development mail sink.

### Phase 4 — forms, Kobo connection, and sync pipeline

1. Implement integration connection encryption at rest (KMS/envelope encryption or a managed secret store), source/form/version models, and configuration validation.
2. Build provider client abstraction and KoboToolbox implementation. Make sync run creation transactional and worker execution idempotent.
3. Import schema/version metadata and submissions; retain raw payloads, map enumerators/locations where possible, create attachments asynchronously, and report per-run errors/counters.
4. Expose form lifecycle, connection health, sync history, manual sync-all/single-form/retry endpoints, webhook verification, and worker status.

**Done when:** a Kobo sandbox form can be connected, synced repeatedly without duplicate records, failures are visible in sync history, and secrets never appear in responses/logs/audit snapshots.

### Phase 5 — submissions, quality, and field operations

1. Implement fast cursor-paginated submission list/detail APIs, search/filter indexes, safe raw-payload rendering contract, attachments, and bulk review actions.
2. Implement review history, quality rule execution, issues, ownership, comments, and notification events. Make changes auditable and enforce valid transitions.
3. Implement field-assignment CRUD, daily targets, device/sync signal ingestion, worker performance/coverage aggregates, and attention queries.
4. Integrate the submissions, field-operations, project-workspace, dashboard attention cards, and previously-unrouted Quality Center frontend screens.

**Done when:** an imported record can be automatically flagged, assigned, commented on, decided, and reflected correctly in every relevant dashboard without cross-tenant leakage.

### Phase 6 — dashboards, analysis, exports, and reports

1. Build aggregate queries/materialized views where measurements show they are needed; cache tenant dashboard/analytics results with clear invalidation after imports/reviews.
2. Build filterable dashboard, analytics trend/outcome/location endpoints with query-cost controls and authorization-aware data masking.
3. Build queued exports with progress, expiry, signed downloads, policy/reason checks, audit records, and object cleanup.
4. Build report templates/definitions/runs/schedules, task-worker generation (HTML/PDF/XLSX as selected), recipient verification, delivery tracking, retries, and downloads.

**Done when:** the analytics and reports screens consume real aggregates; a large export/report does not block a web request and is accessible only to its tenant/authorized users.

### Phase 7 — platform operations and billing

1. Implement platform dashboard aggregates, organization directory filters, cross-tenant user directory, plan/subscription/invoice read models, and audited tenant provisioning/suspension/restore.
2. Integrate the selected billing provider with verified, idempotent webhooks; reconcile invoices and enforce plan entitlements in relevant services.
3. Implement audit event search/export and detailed super-admin health/service/incidents endpoints using telemetry/queue/database integrations.
4. Integrate all `/superadmin/*` frontend screens with role-guarded APIs.

**Done when:** only super admins can operate cross-tenant functions, billing state is reliable after webhook retry, and audit/system pages are backed by genuine operational data.

### Phase 8 — security, performance, and production readiness

1. Perform a threat model focused on tenant isolation, invitation/token theft, provider/webhook spoofing, export exfiltration, secrets, uploads, and privilege escalation.
2. Add security headers, TLS-only deployment, strict CORS, CSRF defense where cookies are used, rate limits, account lockout/backoff, MFA support/enforcement, dependency scanning, secret rotation, redacted logging, encryption/backups, and retention/deletion jobs.
3. Load-test import, submission listing, analytics, export, and report workloads; tune indexes, worker concurrency, timeouts, and connection pools. Enforce pagination and query time limits.
4. Add production monitoring: request/error/latency metrics, traces, worker/job metrics, database and object-storage alarms, audit monitoring, backup restore drills, runbooks, incident response, and rollback-safe migrations.

**Done when:** staging passes a security review and restore drill; production has dashboards/alerts, documented SLOs, migrations and rollback plans, tested backups, and a deployment checklist.

## Security baseline

- Use HTTPS behind a trusted proxy; set trusted-host/proxy configuration explicitly.
- Sign JWTs with a rotated strong asymmetric key where operationally feasible; validate algorithm, `exp`, issuer, audience, and token/session revocation. Never put authorization decisions solely in stale role claims—load or version-check the account/membership.
- Keep access tokens short-lived. Store refresh tokens hashed, rotate them on every use, detect reuse, and revoke the token family on compromise.
- Use `pwdlib` Argon2 hashing; compare safely through the library and use a generic login failure response.
- Apply endpoint-specific rate limits to login, reset, invitation, export, and webhook endpoints; log attempts without sensitive payloads.
- Encrypt integration secrets and sensitive attachments at rest, restrict object-store IAM prefixes per environment, use private buckets, short-lived signed URLs, and validate upload size/type/content.
- Restrict CORS to known frontend origins. Do not use wildcard origins with credentials. Protect cookie-authenticated mutations from CSRF.
- Parameterize all database access through SQLModel/SQLAlchemy; never interpolate filter/order input. Whitelist sort fields and report/analytics dimensions.
- Validate webhook signatures before parsing/queuing, use idempotency keys, and make all external callbacks resilient to replay/out-of-order delivery.
- Redact password fields, authorization headers, tokens, provider config, PII, and raw submission answers from logs/error responses. Apply field-level masking to analytics and exports according to tenant policy and permissions.
- Write audit records transactionally for business actions and append system security events independently where a transaction fails.

## Testing strategy

Use a temporary file-backed SQLite database for unit and API integration tests, with foreign keys enabled, and seed factories rather than UI mock arrays. Use a file-backed database instead of `:memory:` where the application opens multiple connections. Add a PostgreSQL compatibility test suite only when planning the production migration. Test at these levels:

| Level              | Coverage                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit               | password/JWT helpers, permission rules, state machines, Pydantic validation, Kobo payload mapping, quality rules, report/export filter validation         |
| Repository/service | tenant scoping, transactions, unique/idempotency behavior, audit creation, plan entitlement rules                                                         |
| API integration    | authentication lifecycle, RBAC matrix, 401/403/404 behavior, cursor pagination/filtering, response schemas, error contract, CORS/CSRF/rate-limit behavior |
| Worker/integration | Kobo sync retry/duplicate handling, webhook signature/replay, email send retry, export/report state transitions, signed-file authorization                |
| End-to-end         | login/invitation, create tenant/project, connect/sync form, review record, export/report, super-admin management flow against a staging environment       |
| Non-functional     | migration upgrade from empty and prior versions, query-count/performance budgets, concurrency races, load tests, security scans, backup/restore drill     |

Mandatory regression tests include: a user cannot list/get/export another organization’s data; a suspended membership loses access immediately; an invitation cannot be reused/accepted after expiry; refresh-token reuse revokes the session family; repeated sync/import does not duplicate submissions; a review preserves history; a sector may be assigned to many organizations and an organization to many sectors; a project cannot reference a sector outside its organization or an inactive organization-sector link; and signed export/report URLs cannot be used after expiry or by another tenant.

## Frontend integration checklist

1. Replace `mockApi.ts` with an API client that attaches credentials, parses the standard error shape, refreshes once on an expired access token, and sends correlation/idempotency headers where appropriate.
2. Create query keys that include organization and resource/filter context; invalidate/refetch after mutations and use optimistic updates only for reversible low-risk UI changes.
3. Replace every inline mock array with API data, loading/empty/error states, server pagination, and backend-provided count badges.
4. Add protected and role-aware routes. Do not use a role only from local storage as authorization; render based on `/auth/me` permissions and rely on backend enforcement.
5. Use API IDs, timestamps, numeric values, and enum values rather than labels/display strings. Centralize display formatting in the frontend.
6. Surface `202` job states for sync/export/report creation, poll job resources or use authenticated server-sent events later, and show actionable errors/retry where allowed.
7. Add the Quality Center route/navigation only after its submission/issue endpoints and permission rules are live.

## Delivery order and first vertical slice

The most valuable first demonstrable slice is: super admin provisions a tenant and owner -> owner accepts invitation -> organization admin signs in -> creates a project and member assignment -> connects/syncs one Kobo form -> lists one imported submission -> reviews it -> dashboard counts change. This validates the difficult foundations (identity, tenant boundaries, background work, source idempotency, quality state, and aggregates) before building reports, billing, and extensive platform operations.

Keep OpenAPI and this document updated as decisions change. Every new frontend control should map to a permission, Pydantic input schema, REST endpoint, transaction/service operation, audit expectation, test, and observable user-visible result.
