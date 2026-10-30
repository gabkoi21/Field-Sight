# Super Admin refinement

Implemented incrementally using the required ui-ux-pro-max and design-system skills, preserving FieldSight tokens, React Query, reusable UI components, tenant routes, and branding.

## Changes
- Dashboard has exactly four KPI cards: Total Organizations, Total Platform Users, Active Organizations, Total Projects. Existing monthly activity and availability charts remain below them.
- New authenticated Super Admin-only `GET /administration/overview` uses one SQL statement with four scalar count subqueries. It returns no account or project details and does not depend on tenant selection.
- Users: each stored User row counts once, including Super Admin, inactive and unassigned accounts. Multiple memberships do not multiply the total. Invitations without accounts do not count.
- Projects: every stored Project row counts once across every tenant, privacy level and status, including archived projects and suspended organizations. Deleted rows do not count.
- Administrator profile now loads and saves names through existing GET/PUT `/auth/profile`, preserving the existing landing preference. Success follows API persistence; failure retains input and supports retry.
- Sectors now paginate filtered records, reset pagination on filter changes, expose visible creation labels, and retain existing CRUD and confirmations.
- Super Admin panels, KPI heights, table alignment, tabular numerals, row feedback, pagination buttons, mobile inputs, and dialog surfaces have consistent scoped styling.

## Existing capabilities reviewed and preserved
- Organizations: creation, update, suspension/restoration with confirmation, filtering and pagination.
- Users: authorized directory, membership role visibility, filters, search, pagination, read-only details. No platform account-mutation API exists; tenant administration APIs were not repurposed for global access.
- Direct Sectors and Audit Logs navigation; native dialog focus containment/Escape support and restored focus.
- Search and Notifications are explicitly disabled with explanations.
- Audit logs use authorized persisted administrative records with server filtering/pagination, and clearly disclose incomplete event coverage.
- Health checks preserve real responses and unavailable/unknown states without uptime claims.
- Billing and global settings explicitly indicate missing backend support. No demonstration amounts or unenforced security controls are enabled.

## Modified files
- fieldsight-backend/app/routes/administration.py
- fieldsight-backend/tests/test_platform_overview.py (new)
- fieldsight-frontend/src/services/apiClient.ts
- fieldsight-frontend/src/pages/dashboard/SuperAdminDashboardPage.tsx
- fieldsight-frontend/src/pages/superadmin/SectorsPage.tsx
- fieldsight-frontend/src/pages/superadmin/SuperAdmin.test.tsx
- fieldsight-frontend/src/components/superadmin/AdminUi.tsx
- fieldsight-frontend/src/components/superadmin/SuperAdminShell.tsx
- fieldsight-frontend/src/components/superadmin/AdminProfile.tsx (new)
- fieldsight-frontend/src/components/superadmin/SuperAdminShell.test.tsx (new)
- fieldsight-frontend/src/components/superadmin/superadmin.css

## Verification
- Focused frontend: 12 tests pass, including four cards, profile success/failure, sector pagination/search, directories, audit pagination, and mobile navigation interaction.
- Full backend suite: all 283 tests pass (existing deprecation/serialization warnings).
- Focused backend: 10 tests pass covering multi-tenant project totals, unique account counts, 401/403 boundaries, organization workflows, audit access, monthly activity, archival and profile persistence.
- Frontend production build and TypeScript: pass; existing large bundle warning remains.
- Backend Ruff checks: pass for the modified route and new test.
- Full frontend sequential run: 186 pass, 1 fails in unchanged StartupLayout.test.js (expects eight Organization Admin startup links; template has seven). The new shell test also passes separately.
- Backend mypy: 13 existing errors in audit/monthly activity SQLModel expressions; no errors in the new aggregate.
- Frontend has no configured lint script or ESLint dependency.
- Browser: local app redirects to login. Authenticated desktop/mobile visual verification remains outstanding; automated tests verify navigation interactions, not actual responsive rendering.
- No deployment, migrations, new dependencies, or production record writes.

## Remaining limits
Global settings persistence, billing integration, notification delivery, global search, and platform account mutations need supported backend capabilities. Audit history covers recorded organization administration only. User and organization directories still fetch full lists before client-side filtering; dashboard counts no longer fetch those lists.
