# FieldSight workspace quick-start UI

Implemented against the public [TolaData quick-start guide](https://www.toladata.com/docs/quick-start-guide/welcome-to-toladata/), with original FieldSight components and branding. No authenticated reference screens, proprietary assets or code were copied.

## Navigation and existing data

- Projects are presented as Workspaces; the existing `/projects` routes, IDs and organization boundaries remain authoritative. `/workspaces` redirects to the same list.
- A shared workspace selector follows navigation between details, indicators, tables, analysis and dashboards.
- The sidebar is navy blue (`#071f47`), per the user's correction. The organization-name card was removed.
- Collection overview, Kobo connections, quality and submissions remain available in Data operations.
- The existing demo login and all existing project/form/submission data are retained.

## Quick-start coverage

| Reference chapter | FieldSight screen and behavior |
| --- | --- |
| Welcome | Workspaces plus a searchable 13-chapter in-app guide at `/guide` |
| Login and account setup | Existing sign-in, account-help screen, invitation acceptance, profile, password change and saved landing page |
| Understanding workspaces | Shared selector and project-backed workspace cards |
| Invite new users | Organization team directory, expiring one-time invitation links, revocation and acceptance |
| Create a workspace | Name, enabled sector, dates and description; saved through existing project API |
| Add team members | Existing active field members assigned to a workspace through collection assignments |
| Manage members | Organization roles and membership activation; self-demotion is blocked |
| Add indicators | Minimal name/format form, grouped register, target progress and editable details |
| Results framework | Existing framework tree plus indicator drag-to-group and accessible Edit grouping |
| Import data | Verified Kobo connections or bounded CSV imports, table cards, row preview and pagination |
| Add collected results | Dated manual numeric/qualitative results, or an explicit linked-table calculation |
| Troubleshooting | Searchable original FieldSight guidance with direct navigation to the relevant screen |
| In-app help | Sidebar guide, top-bar Help, profile and team links |

Additional connected screens: persisted dashboards with indicator, saved-analysis and text widgets; saved widget order/width; dashboard date filters; duplication, renaming and deletion; printable workspace reports and aggregate CSV export. The old placeholder Team, Settings and Reports entry points now forward to live implementations.

## Calculation and import rules

- CSV imports accept up to 1,000,000 characters, 2,000 rows, 80 unique headings and 10,000 characters per cell. Invalid row shape or mapped dates reject the entire import. Identical file/mapping imports are rejected for the same workspace.
- Optional CSV date and location columns must name actual headings. CSV rows begin as `needs_review`; users must review quality before linked indicator actuals include them.
- Offline CSV provenance records are explicitly unverified and carry no working Kobo credentials. Imports never create a successful Kobo sync history.
- A manual result cannot be added to a mapped indicator. An indicator with manual results cannot acquire a table mapping or change unit until those results are removed.
- Manual numeric values are summed. Manual percentages/rates/ratios use an explicitly labeled unweighted mean. Qualitative actuals are the latest narrative by result date (creation time breaks ties).
- Date filters apply to actuals, not to prorated targets. Linked indicators retain ready-only inclusion and missing/invalid-answer context.
- Dashboard widget sources must belong to the dashboard's own accessible workspace. Dashboard dates override saved-query dates when supplied; other saved filters remain in effect.
- CSV report export escapes cells that could be interpreted as spreadsheet formulas. It exports aggregate indicator results, not individual survey answers.

## Access and deliberate limits

FieldSight's existing portal policy is unchanged: platform and organization administrators sign into the portal; enumerators collect through KoboToolbox. An invitation registers FieldSight team membership and does not create a Kobo account. The UI documents this distinction; it does not introduce the reference product's four project permission roles.

Invitation email delivery and automated password-recovery email are not configured. Invitations provide a copyable setup link and are never described as emailed. Existing accounts cannot be overwritten by accepting an invitation. Password changes verify the current secret and revoke existing sessions.

Authenticator MFA, Azure/enterprise SSO, public dashboards, partner sharing, scheduled report delivery and additional file/provider connectors are not implemented by this UI update. Screens explain the available local workflow instead of simulating these services. Reports are generated from current data, not represented as published or scheduled artifacts.

## Migration and verification

- Migration: `0016_workspace_quick_start`, following `0015_indicator_framework`.
- Adds `workspace_invitations`, `user_preferences`, `collected_results`, and `analytical_dashboards`. Existing project and indicator data are not replaced.
- Local migration applied after SQLite backup: `fieldsight-before-workspace-quickstart-20261022-094524.db`.
- Migration handles the legacy baseline's `metadata.create_all` behavior and already-present model tables/indexes. Fresh and legacy upgrade regressions pass.
- New integration coverage: 16 workspace cases covering invitations, expiry/reissue, assignment idempotence, inactive/self access, CSV validation/atomicity, review inclusion, manual calculations/date windows, qualitative values, source boundaries, dashboards, password/session revocation and administrator-only portal access.
- Browser verified using Demo Organization: sign-in, workspace list, navy sidebar without organization card, guide, stored table rows, live team directory, collected-data navigation and persisted dashboard/widget creation and resize.
- Frontend production build passes. The existing large JavaScript chunk warning remains. Targeted Ruff and mypy checks pass for the new workspace routes, schemas/models, collected-result calculation and changed indicator routes.
- Final full backend regression run: **122 passed**. A clean browser reload rendered the live report with no new console errors; transient errors recorded during development hot updates were resolved by that reload.
- A labeled `DEMO — Youth outreach results` dashboard was saved against the existing synthetic Youth outreach workspace. It uses the real stored demo indicator and saved survey query plus a clearly labeled explanatory note.

Screenshots are saved under `fieldsight-frontend/outputs/`: `workspaces-blue-sidebar.png`, `workspace-quick-start-guide.png`, `workspace-data-table.png`, `workspace-dashboard.png`.
The final sidebar proof is `sidebar-blue-no-organization.png`.

After updating a running checkout, restart its backend process to load the new routes. Run `python -m alembic upgrade head` from `fieldsight-backend` when setting up another database, and start the frontend with its normal `npm run dev` command.
