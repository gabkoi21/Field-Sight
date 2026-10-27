# Project Overview UI redesign

## Navigation placement

The sidebar order is **Projects → Overview → Details & activity**. Opening or creating a project
at `/projects/:projectId` now redirects to its `/overview` page. Editable project metadata remains
available at `/projects/:projectId/details`; the sidebar, Details tab, Edit project action, and
indicator setup link use that URL. No Overview tab is reintroduced on the other project pages.

## Minimal-text refinement (current)

Following the screenshot review, the supporting section is now deliberately smaller:

- The Indicator overview text card is replaced by an actual horizontal indicator-status bar chart.
  Configured, Needs setup, and Overdue targets come from active configured indicators. Overdue is
  an independent count, not an extra segment of a fabricated completion percentage.
- Needs Your Attention is one collapsed disclosure with an item count. Expanding it reveals
  direct action links; long explanations are no longer permanently displayed.
- The recent-activity feed is removed. A single footer timestamp shows the actual last successful
  sync, without repeating the same event/time in multiple places.
- The extra project-information and explanatory footer panels are removed. Project context remains
  in the header; Edit project / Project details and Manage source / Connect source preserve the
  existing workflows. Operational/M&E semantics remain an accessible summary description.

References reviewed for this iteration:
[Metronic on ThemeForest](https://themeforest.net/item/metronic-responsive-admin-dashboard-template/4021469)
and [Velzon on ThemeForest](https://themeforest.net/item/velzon-aspnet-core-admin-dashboard-template/36077495).
Only their concise chart/card presentation patterns inform the UI; no commercial theme source,
assets, dependencies, sample statistics, or template branding are added.

The earlier sections below describe prior iterations. This section takes precedence for the
currently displayed content and removed panels.

## Chart-focused refinement

The current iteration brings real charts above the supporting information:

- **Collection trend:** an area/line chart of submitted and ready records from the existing
  project-scoped analytics API, with a 7/30-day control. Only recorded days returned by the server
  are plotted; no synthetic submissions, gap-filled dates, or sample values are generated.
  The API field `approved` is correctly labeled **Ready records**, since it counts the existing
  data-review status and does not represent approved M&E reporting results.
- **Review status:** an all-time donut chart from the existing submission-status counts.
  Its labels link to the corresponding project-filtered submissions. Unrecognized statuses
  remain visible as Other statuses, rather than being silently dropped.
- **Concise supporting content:** project information is now expandable; recent activity shows
  the latest three available entries; indicator setup counts sit in a compact horizontal strip.
  The four primary summary cards and all Sprint A actions remain available.
- **Accessible alternatives:** a daily chart-data table and labeled review-status links expose
  the exact values independently of SVG tooltips. Empty/error states replace the chart when
  source data is unavailable. Animations are disabled and the trend series also differ by line style.

The trend period affects only the trend chart. Headline collection counts and the review donut
remain explicitly all-time. This avoids mixing period totals and all-time statistics.
The existing customizable Dashboard page is unchanged.

Design references reviewed were the official
[Asana project dashboards](https://help.asana.com/s/article/project-dashboards) and
[monday.com project overview](https://support.monday.com/hc/en-us/articles/22598441769746-Project-boards-on-monday-com)
examples. Their chart hierarchy and compact project-context approach informed this layout;
FieldSight retains its own branding and existing data semantics.

Chart presentation lives in `ProjectOverviewCharts.tsx`, using the already-installed Recharts
dependency. The overview's existing authorized project gate also guards the analytics request.
Tests cover exact server chart values, reporting-period scope, review links, and chart empty/error
states. The layout description below documents the underlying components retained from the prior
iteration; project information is now initially collapsed and charts precede the supporting sections.

## Scope and audit

Implemented on `dev` in `fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx`.
The existing route remains `/projects/:projectId/overview`, with the sidebar and project-tab
entry points introduced in Sprint A. The editable Details page remains `/projects/:projectId`.

The previous layout showed repeated status explanations, all active indicator results as cards,
and a large attention list. It had no structured project metadata or recent-activity area.
The redesign changes the presentation and reuses the existing project-scoped requests and actions.

## Layout and components

1. **Project header:** saved project code (if present), project name, status, sector, country/location,
   and project dates. Refresh, Edit project, and Sync data use the existing workflows. Sync remains
   unavailable for archived projects or projects without a connected Kobo form.
2. **Horizontal navigation:** Overview, Details & activity, Indicators, Dashboards, Analytics, Reports.
   Links retain project context, use `aria-current`, and scroll horizontally when space is limited.
3. **Four primary summary cards:** submitted records, awaiting review, ready records, active indicators.
   Each card links to its existing project-scoped destination. The grid changes from one to two to
   four columns. There are no invented completion percentages, trends, or school counts.
4. **Project information:** description and a labeled definition list for sector, location, start/end
   dates, stage, and saved code. A compact connected-source row links to the existing Forms screen.
5. **Needs Your Attention:** the unchanged Sprint A issue derivation, presented as native expandable
   rows. Titles remain visible; explanations and action links expand on demand. The count is labeled
   “items,” not a count of unique affected records; review counts and quality findings may overlap.
6. **Recent activity:** up to five actual saved submissions from the existing paginated response,
   plus the actual latest successful synchronization. Dates are displayed in UTC. A submission date
   is not presented as an import/sync event. Missing dates remain “Not recorded”; no project-created,
   edited, assignment, or fictional event history is generated.
7. **Indicator overview:** configured/setup/overdue counts for active indicators and a link to the
   full Indicators page. Individual performance values are no longer duplicated on Overview.
   Individual indicator attention actions still open the correct indicator.
8. **About these figures:** secondary disclosure preserves the operational-versus-approved-M&E
   distinction and the explicit unavailable school-reporting-completeness explanation from Sprint A.

`OverviewMetric`, `SectionHeading`, `ProjectInformation`, `AttentionSection`, `RecentActivity`,
`IndicatorSummary`, and `LoadError` are page-local presentation components. The existing API query
and synchronization flow remain in the page; issue rules stay in `projectOverview.ts`.

## Existing data and API reuse

- Project metadata: existing `getProject` response. Its already-returned `organization_sector_id`
  is now represented as an optional field in the frontend `ApiProject` type.
- Sector name: existing organization-sector membership list joined with the existing sector
  catalogue. These lookups run only after project authorization and when the project has a saved
  sector ID. Topics are never reinterpreted as sector names.
- Location: saved `workspace_details.countries`, with saved `country` as a fallback. No location
  is guessed from project names or submission contents.
- Summary/activity: existing `/submissions/page?project_id=…&limit=5` response.
- Synchronization: existing project sync-settings API and synchronization action.
- Indicators/attention: existing indicator results and quality queue responses.

No backend endpoint, database migration, credential change, generated production record,
new dependency, follow-up assignment workflow, or Dashboard-page implementation is introduced.
Existing dashboards, reporting, submission review, source management, and indicator calculations
remain unchanged.

## Branding and accessibility

Uses FieldSight's existing `--fs-*` color tokens, Inter typography, white `Card` surfaces,
border/radius conventions, blue primary action, shared Button/LoadingState/LoadingSkeleton,
spacing scale, and lucide icons. No new visual theme or font is introduced.

The layout becomes a single column below the wide desktop breakpoint; the header and metadata
wrap, and long names/descriptions can break without forcing page-level horizontal overflow.
Navigation remains native links, disclosures remain native details/summary controls, decorative
icons are hidden from assistive technology, icon-only refresh has an accessible label, and visible
focus styles are inherited. The page uses labeled sections and a semantic project-information list.

Loading uses neutral skeletons without fabricated values. Failed independent data sources show
retry controls rather than zeros or an all-clear. Unknown metadata is explicit; partial activity
errors do not manufacture events. Organization/project-scoped cache keys, authorization gates,
permissions, and synchronization invalidation from Sprint A are preserved.

## Verification and manual review

Frontend behavior tests cover four-card limits, concise indicator presentation, project metadata,
sector resolution, no inferred sector, real activity ordering/links, expandable attention actions,
empty/error states, permissions, project switching, synchronization invalidation, and existing
indicator action links. Existing actual-router/sidebar tests still cover reachability.

Run `npm test` and `npm run build` from `fieldsight-frontend`.

Manual review:

1. Open a project, then **Overview** in the sidebar/project tabs.
2. Compare metadata with Details & activity; use **Edit project** and return to Overview.
3. Open each summary card and confirm its project/review filter.
4. Expand attention items and use their actions; verify indicator links select the named indicator.
5. Compare recent submissions and the UTC successful-sync time with the saved source data.
6. Open **View all indicators**, Dashboards, and Reports; verify existing workflows are intact.
7. Review a project with no metadata, source, submissions, or indicators. No values should be invented.
8. Use keyboard-only navigation and narrow/mobile widths; check tab scrolling, wrapped header
   actions, single-column cards, and focus visibility.

Verification after the minimal-text refinement: **109 frontend tests passed across 22 test files**.
The overview-specific regression tests passed. The production build passed,
including TypeScript. Vite retains its large-chunk advisory. `git diff --check` passed for the
changed frontend files. No backend changes required backend test reruns for this UI-only task.

Live browser visual verification was attempted but Computer Use could not establish the current
Chrome URL confidently and stopped browser access. No browser visual pass or deployment is claimed.
