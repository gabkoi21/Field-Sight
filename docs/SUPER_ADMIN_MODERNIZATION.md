# FieldSight Super Admin modernization

Date: 2026-10-29. Local implementation only; no deployment or production data changes.

## Repository audit

- Working before changes: authenticated Super Admin route guard; server-enforced platform role checks; organization creation with administrator, sectors and regional settings; organization editing; soft suspension; sector creation/rename/deactivation; platform user directory; live/readiness/status APIs; TanStack Query fetching and mutations; existing shared panels, headers, buttons and metrics.
- Partial: directory search was client-side, all rows displayed despite pagination controls; user directory omitted platform administrators; row action buttons did nothing; sector list only returned active sectors; sidebar omitted Sectors/Audit; organization status had no restore workflow.
- Fabricated: billing revenue, invoices and plan distributions; example security events, event totals and retention claims; fixture worker uptime/queue metrics in data.ts.
- Unsupported interactions: global search, notifications, profile save, settings save/security toggles, billing configuration/export and audit export. Settings only changed local React state.
- Visual issues: inconsistent spacing and controls, small pointer targets, hardcoded colors, inconsistent status contrast, missing modal semantics/focus containment and reduced-motion handling.
- Backend inventory: no subscription/payment/invoice models or global settings persistence/enforcement API. Genuine OrganizationAdminEvent records exist. Sync jobs and worker heartbeat models exist but no platform-wide monitoring read integration is connected to this page.
- Authorization: platform list/mutation routes require a Super Admin role. Found suspended organizations could still satisfy workspace membership eligibility. Fixed eligibility and shared tenant authorization to require active organizations; verified with a user having both suspended and active memberships. No role editing/invitation API was added.

## Design direction

Applied `.agents/skills/ui-ux-pro-max/SKILL.md`, its generated accessible/ethical navy-and-blue recommendation, and `.agents/skills/design-system/SKILL.md` plus token architecture. Retained FieldSight branding, Inter typography, Lucide icons, existing React/Tailwind components, semantic `--fs-*` tokens and TanStack Query. Rejected the generator's generic landing-page layout in favor of the existing administration information architecture. Reviewed React guidance using the React best-practices skill.

Before: decorative controls and mixed live/example data. After: grouped navigation, collapsible desktop sidebar, native mobile navigation dialog, read-only profile with working sign-out, disabled/unavailable global tools, visible focus and reduced-motion support, functional directory pagination and filtering, truthful operational/configuration screens.

## Completed behavior

- Dashboard includes all platform accounts, active/suspended tenant counts, active users and application health. Recharts onboarding bars derive from recorded organization creation dates; no invented monthly history.
- Organizations preserve existing CRUD and assignments, add name/date sorting and ten-row client pagination, timezone input checks, success/error feedback, unsaved-form confirmation, keyboard focus containment, identity/status/creation/membership/project details and explicit suspension versus restoration. Suspended organizations must be restored before editing through the existing active-only organization endpoint.
- Status changes use a dedicated Super Admin-only PATCH endpoint and record actual organization status events. They retain all tenant records.
- User directory includes Super Admins, full names, search, organization/role/account-status filters, sorting, pagination, and a native read-only details dialog showing active and inactive memberships. Account/role/invitation mutations remain unavailable.
- Sectors use a separate protected catalog including inactive records. Added truthful statuses, status filter, an edit form instead of prompt, validation, pending guards, confirmation, success/failure feedback and retry. Shared authenticated active-sector API remains unchanged.
- Audit log uses actual organization administration records, with secure read-only access, search, UTC dates and server-side pagination. Explicitly limited coverage; no fabricated authentication or security history, retention guarantees, secret payloads or export button.
- Billing and settings show explicit unconfigured states with useful catalog navigation. No fake save feedback, revenue, policy enforcement or payment backend.
- Health retains independent live/readiness/status queries, derives successful-check timestamps, distinguishes unknown/unavailable/degraded/healthy states, and does not treat stale failed probes as healthy. Worker/queue/scheduler integration is clearly unknown.

## API additions

- GET `/administration/events`: Super Admin only; recorded event read model; query/date filtering; bounded pagination (1-100).
- GET `/administration/sectors`: Super Admin only; complete sector catalog.
- PATCH `/administration/organizations/{org_id}/status`: Super Admin only; status persistence and real audit event.
- Existing organization list gains active membership and project counts.
- Database migrations: none; existing tables are reused.

## Files modified for this task

Frontend:
- `src/components/superadmin/SuperAdminShell.tsx`
- `src/components/superadmin/AdminUi.tsx`
- `src/components/superadmin/AdminDialog.tsx` (new)
- `src/components/superadmin/superadmin.css` (new, scoped styles)
- `src/pages/dashboard/SuperAdminDashboardPage.tsx`
- `src/pages/superadmin/OrganizationsPage.tsx`
- `src/pages/superadmin/UsersPage.tsx`
- `src/pages/superadmin/SectorsPage.tsx`
- `src/pages/superadmin/BillingPage.tsx`
- `src/pages/superadmin/SystemHealthPage.tsx`
- `src/pages/superadmin/AuditLogPage.tsx`
- `src/pages/superadmin/PlatformSettingsPage.tsx`
- `src/pages/superadmin/data.ts`
- `src/pages/superadmin/SuperAdmin.test.tsx` (new)
- `src/services/apiClient.ts` (additive changes; pre-existing dashboard work retained)

Backend:
- `app/routes/administration.py`
- `app/schemas/administration.py`
- `app/routes/auth.py` (active tenant eligibility)
- `app/routes/organizations.py` (shared active tenant authorization)
- `tests/test_administration.py`

Unrelated pre-existing working-tree changes were retained. Organization Admin frontend, indicators, Kobo processing and saved dashboards were not edited for this task.

## Verification

- Production `npm run build`: passed; Vite retains its main-chunk size warning.
- Focused Super Admin and route-shell tests: 10 passed across two files.
- Full frontend suite, serial with 15-second timeout: 178 passed / 1 failed at that point. Remaining failure: existing `StartupLayout.test.js` expects eight startup sidebar links while the pre-existing edited index.html renders seven. Did not change that Organization Admin startup behavior.
- Administration + auth + auth lifecycle backend suites: passed after running outside the sandbox. Sandboxed TestClient hung while creating its local asyncio socket pair; rerun used local SQLite test databases, with no remote database operations.
- `git diff --check`: clean.
- Visual review attempted: in-app browser attach failed, and Chrome computer-use connection timed out awaiting app approval. Desktop/mobile visual sign-off remains outstanding; responsive CSS and interaction tests are not a substitute.

## Limits and next improvements

1. Organization/user list pagination is real client pagination over existing full-list APIs. Add bounded server-side directory queries and aggregate counts before scaling to large tenant fleets; organization enrichment currently inherits N+1 lookup patterns.
2. Complete desktop/tablet/375px browser review and a screen-reader/contrast pass when browser access is available. Organization forms still use existing overlays with focus handling; native dialogs are used for new details/edit/profile/mobile flows.
3. Billing needs authoritative subscription/invoice/payment infrastructure. Global settings need persistence, validation and actual operational enforcement before controls can return.
4. Global search, notifications, profile editing, invitations, role changes and user account mutations remain unavailable. Implement secure APIs before enabling them.
5. Audit coverage is existing organization administrative events plus new tenant status transitions; it is not a complete immutable security journal. Expand event recording transactionally, define retention/access policies, and add authorized streamed export as a separate workflow.
6. Connect genuine worker heartbeats/jobs to platform operations with explicit freshness rules. No queue sizes, uptime or latency have been inferred.
7. Address the pre-existing startup-layout assertion and main JS bundle size separately.


## Monthly activity chart follow-up

Added a reference-style monthly bar chart titled Most active organizations, with a year selector, labels, organization tooltips and an accessible data table. The monthly winner is the organization with the highest count of retained submissions dated within that UTC month. Missing dates are excluded; ties are explicitly disclosed; historical activity from suspended organizations is retained. No percentages, site visitors, or synthetic activity are inferred.

New read-only endpoint: GET `/administration/activity/monthly?year=YYYY`, restricted to Super Admins and validated to years 2000-2100. Aggregation runs in SQL; only twelve monthly leaders and available years are returned. No migration required.

Additional files: `fieldsight-frontend/src/components/superadmin/MonthlyOrganizationActivity.tsx` and `MonthlyOrganizationActivity.test.tsx`. Updated the dashboard, API client, administration route and administration tests. Frontend activity tests: 3 passed. TypeScript check passed. Removed the dashboard's obsolete health polling following the earlier status-banner removal.
