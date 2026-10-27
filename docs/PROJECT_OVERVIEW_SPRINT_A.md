# Project Overview — Sprint A

## Audit and scope

The existing page is `fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx`,
served at `/projects/:projectId`. It previously downloaded organization-wide submissions,
filtered them in the browser, and mixed all-time totals with a 30-day analytics overview.
Its exception panel inferred issues from generic missing fields and claimed automated
validation success without checking persisted quality findings.

Existing APIs reused, with no backend production-code changes:

| Concern | Existing API | Use in this overview |
| --- | --- | --- |
| Authorized project | `GET /organizations/{organization_id}/projects/{project_id}` | Project metadata and authorization gate before loading other data |
| Collection | `GET /submissions/page?project_id=…&limit=5` | All-time total and per-review-state counts; no raw organization-wide fetch |
| Data quality | `GET /quality/queue?project_id=…&limit=1` | Total saved open findings; findings reflect the last validation run |
| Synchronization | `GET /projects/{id}/sync-settings` | Latest successful sync independently of latest run status; queued status |
| Synchronization action | `POST /projects/{id}/sync` | Existing action, unchanged; relevant query caches refresh on success |
| M&E | `GET /projects/{id}/indicators` | Active configured indicators, current results, setup health, exclusions, overdue status |
| Organization analytics | `GET /analytics/overview`, `GET /dashboard/overview` | Audited; not used for all-time project counts because these APIs have reporting-period semantics |
| Dashboards and reporting | Existing `/dashboards`, `/analytics`, `/reports` pages and their APIs | Preserved; project-filtered navigation links |

Implementation: compose the existing APIs in the current page; derive read-only actions
in `projectOverview.ts`; add indicator selection through the `indicator_id` URL parameter;
test the frontend behavior and existing backend API contracts. No migration, synchronization
policy change, indicator calculation change, follow-up assignment system, credential change,
or production database write is part of this work.

## Meaning of the displayed values

- **Submitted records:** all saved submissions for the project, including old and undated records.
- **Awaiting review:** records whose existing status is `needs_review`.
- **Ready records:** records whose existing status is `ready`. This is not M&E result approval.
- **Latest successful synchronization:** the sync-settings API's successful completion time,
  displayed in UTC. A newer failed run does not overwrite this time.
- **Configured M&E results:** the unchanged indicator API's current all-date calculations under
  each saved definition and source/eligibility rules. Manual and linked results are identified.
  Zero is displayed as zero; missing results display “Awaiting data.”
- Targets, direction, source mappings, and calculations are configured by the officer.
  The overview does not guess feeding fields or interpret each submission as a feeding session.

The repository has data-review eligibility and indicator definition history, but no frozen
M&E result approval snapshot. This page therefore explicitly distinguishes current calculated
results from approved reporting results. It does not introduce an approval workflow.

“Needs Your Attention” uses persisted review counts, persisted findings, failed/no-success
sync evidence, incomplete active indicator setup, and the existing `overdue` schedule status.
Quality findings can overlap review counts and are not added together into a misleading total.
Missing optional fields, elapsed sync age, and absent quality findings do not imply missing
reports, sync failure, or successful validation. Partial failures show retry controls and
suppress the all-clear message. Operational and indicator errors are independent.

## Reporting completeness extension

There is no authoritative school roster or school reporting schedule in the current model.
`ReportingCompleteness` is a discriminated TypeScript contract. The unavailable state contains
only a reason, with no expected/missing counts. A future available provider must supply both
roster and schedule identifiers plus expected/received counts. No provider or calculated
completeness metric is activated in Sprint A.

## Permissions and isolation

The existing project route and APIs retain their organization-administrator permission
requirements. A “Project Officer” is a persona, not a new role: officers need the existing
authorized organization membership. Enumerators and inactive memberships receive the existing
403 responses. Foreign projects return 404 on project/indicator/sync APIs; collection/quality
list APIs return tenant-filtered empty results. Child queries wait for authorized project
metadata. Overview caches include organization and project identity. No cross-project
placeholder data is retained when navigating.

## Test with the Daily School Feeding Monitoring Form project

Use an authorized organization-admin account and a development/staging copy of the project.
Do not change production credentials or generate fake production submissions.

Read-only local reference inspection on 27 October 2026 found one saved submission, in
`needs_review`, and one active indicator, “Number of school feeding sessions conducted.”
That indicator already uses `count_matching` against its configured feeding question, with
an overall target of 20. No students-fed or shortage indicator was configured in this local
copy. This implementation preserves that configuration; it does not reinterpret the source
or create additional indicators. The three-indicator scenario is covered by disposable
synthetic backend/frontend tests, rather than by modifying this project database.

1. Open **Projects → Daily School Feeding Monitoring Form → Overview**.
2. Check **Submitted records**, **Awaiting review**, and **Ready records** against Submissions
   filtered to that project. Include records older than 30 days and undated records when comparing.
3. In the project's Indicators screen, configure the desired indicators using the form's actual
   question catalogue, for example feeding sessions completed, students fed, and food shortage
   incidents. Choose the calculation, matching choice, direction, eligibility rules, and target
   explicitly. A session count requires a verified relationship between submissions and sessions;
   do not assume that relationship from the form title.
4. Return to Overview. Only active configured indicator names/results should appear. Compare
   each result with its own indicator results page using no date filters. Verify zero values and
   “Awaiting data” are distinct. Review exclusions should remain visible.
5. Open each attention action. Review actions must retain `project_id` and the review status;
   quality actions must retain `project_id`; indicator actions must select the named indicator,
   including one that is not the first in the list.
6. Compare the UTC successful-sync timestamp with the source's sync controls. In a disposable
   environment, a failed latest sync should show an action while preserving the prior success.
7. Test an empty project and an inactive/unconfigured indicator. Confirm setup guidance appears
   without guessed metrics. Disconnecting Kobo must not invent a successful sync.
8. Confirm **Reporting completeness** is unavailable: no expected school count or missing-report
   count should appear. There is no follow-up assignment UI.
9. Switch projects, then repeat with an enumerator account and a project from another tenant.
   No previous project values should appear and existing access restrictions must hold.
10. Use keyboard navigation and a narrow/mobile viewport. Check focus indicators, section labels,
    action names, retry controls, and wrapping cards. Open existing dashboards/reports to confirm
    their functionality remains available.

## Automated checks

- Frontend: `npm test`, `npm run build` (includes TypeScript).
- Backend: `.venv/Scripts/python.exe -m pytest` on disposable test databases,
  `.venv/Scripts/python.exe -m ruff check .`, `.venv/Scripts/python.exe -m mypy app`.
- New backend contract tests: `tests/test_project_overview.py` (School Feeding is synthetic fixture
  data only; providers are mocked by the existing test fixture).
- New frontend behavior tests: `ProjectWorkspacePage.test.tsx`; indicator-link regression in
  `IndicatorWorkspacePage.test.tsx`.
- There is no separate frontend lint script/configuration; the configured frontend static check
  is TypeScript through the production build.

Verification on 27 October 2026:

| Check | Result |
| --- | --- |
| Full backend suite | 244 passed (222 existing serializer warnings), using disposable SQLite test databases |
| Full frontend suite | 98 passed across 21 files |
| Targeted overview and indicator tests after the test-fixture type correction | 14 passed |
| Backend mypy | Passed, 52 source files |
| Ruff: application code plus new backend tests | Passed |
| Full repository Ruff | 24 findings in existing scripts/tests outside this Sprint A change |
| Production build, including TypeScript | Passed; Vite reports its existing large-chunk advisory |

The full Ruff findings are in `scripts/auth_browser_fixture.py`, `scripts/seed_community_preview.py`,
`tests/test_auth_lifecycle.py`, `tests/test_indicator_reliability.py`, `tests/test_indicator_results.py`,
`tests/test_migrations.py`, `tests/test_pooled_results.py`, and `tests/test_workspace.py`.
They are import-order, line-length, and multiple-statements issues. No unrelated auto-fix was
applied. This is not a claim that every repository check is green.

No deployment was performed. Browser-based manual acceptance steps above remain to be run
against an authorized School Feeding workspace; automated UI verification used jsdom.
