# FieldSight five-sprint implementation report — 2026-10-27

## Delivery and release status

The feasible implementation and pilot preparation for Sprints 0–4 is complete on
**dev**, sequentially verified and committed. **Pilot readiness: PARTIALLY VERIFIED.**
The authenticated local synthetic workflow passes; live NGO pilot acceptance is
**NOT READY** pending the external release gates below. No real practitioner
interview, live Kobo acceptance or hosted deployment success is claimed.

- Starting dev SHA: 888efe9434a4e4d8ea14e7305bf4bde04e8934fc.
- Ending implementation SHA: 276e15064a4b3077e77b554315859b796882c27a.
- This final report and evidence whitespace cleanup are a subsequent report-only
  commit; obtain its exact delivery SHA with `git rev-parse HEAD`.
- Initial checkout was main at 010ba5445b230016dc75d02fc6d40385273bbd49; the switch
  to dev preserved the working tree. no implementation commits were merged to main or deployed.
- Reflog inspection found main separately fast-forwarded from 010ba544 to
  888efe94 at 14:37:05 UTC, before this task switched to dev at 14:37:40.
  No merge command was issued by this task. main still points to the starting dev
  SHA and contains none of the implementation commits listed below; it was not reset.
- No push was performed by this task, since branch pushes can trigger connected hosting.
- The pre-existing untracked root implementation-plan file remains untracked.

The attached plan was read as task material; the user's explicit request authorized
implementation and verification and prohibited deployment/main merge. No document
instruction was used to broaden those permissions.

## Implemented changes and scoped commits

| Sprint | Implementation | Commits / detailed report |
|---|---|---|
| 0 | Baseline audit, 24 Ruff errors fixed without weakening tests; generated dependencies/caches/test outputs and private backup snapshots untracked only; deployment/worker/license audit | af9b2ee1, d7c3cd91; [stabilization report](SPRINT_0_STABILIZATION_REPORT.md) |
| 1 | Submission review statuses/filter, keyboard evidence inspection, paged audit history, required reasons, evidence and concurrent-review tokens, filtered Overview links; retained ready-only results | de6dc5c2; [review report](SPRINT_1_SUBMISSION_REVIEW.md) |
| 2 | Shared source-linked cards; plain saved Project status replaces binary percentage ring; explicit time-elapsed timeline; compact real backlog/sync/overdue attention | dd12613f; [Overview report](SPRINT_2_OVERVIEW_REFINEMENT.md) |
| 3 | Project action register, assignment/evidence checks, lifecycle, version conflicts, computed overdue, transactional audit, archived read-only history, Overview/navigation/submission links; additive 0030 migration | 18ebe88d; [actions report and API contract](SPRINT_3_ACTIONS_FOLLOWUPS.md) |
| 4 | Guarded disposable seed, reconciled School Feeding tests, authenticated responsive browser smoke/screenshots, operational/UAT/recovery protocols; patched vulnerable build/test dependencies; dev verification trigger | 276e1506; [pilot protocol](SPRINT_4_NGO_PILOT_PLAN.md), [UAT evidence](SPRINT_4_UAT_CHECKLIST.md), [findings register](SPRINT_4_FINDINGS_REGISTER.md) |

Primary implementation files:

- Backend `app/routes/collection.py`: GET /submissions/{id}, review history paging,
  UTC timestamps and required evidence/review concurrency tokens on review PATCH.
- Backend `app/routes/actions.py`, `app/models/operations.py`, `app/api/v1/router.py`:
  project-owned action list/create/detail/update, safe assignment and evidence links,
  locked/versioned writes and actor-authenticated immutable-through-API events.
- Backend `app/routes/organizations.py`: projects with action history must be archived
  rather than hard-deleted. Historical evidence and action audit are preserved.
- `alembic/versions/0030_project_actions.py`: new tables/indexes; populated downgrade
  refuses history loss. `alembic/env.py` correctly escapes percent signs in URLs.
- Frontend `SubmissionsPage.tsx`, `SubmissionReview.tsx`, `SubmissionEvidence.tsx` reuse;
  `ProjectWorkspacePage.tsx`, `ProjectOverviewCharts.tsx`, `ProjectCompletionChart.tsx`,
  `ProjectTimeline.tsx`; new `ProjectActionsPage.tsx` and `ProjectActionSummary.tsx`;
  existing API client, App routes and Workspace navigation extended.
- `scripts/school_feeding_pilot.py` and `tests/test_school_feeding_pilot.py`:
  fresh-path/environment safety and independently expected cross-surface values.
- Frontend package/lockfile: Vite 6.4.5, Vitest 5.0.5, compatible transitive fixes,
  explicit Node engine. Compatibility checked against current registry metadata and
  [official Vitest migration guidance](https://vitest.dev/guide/migration/).

## Exact verification evidence

| Gate | Result |
|---|---|
| Sprint 0 backend | 243 passed; 222 warnings; 381.32s |
| Sprint 0 frontend | 119 passed / 24 files, one worker; 134.94s; production build passed |
| Sprint 1 backend | 245 passed; 223 warnings; 305.19s |
| Sprint 1 frontend integration | 22 passed; production build 31.00s |
| Sprint 2 Overview/status tests | 23 passed; 35.54s; production build 40.41s; no backend change |
| Sprint 3 full backend | 252 passed; 232 warnings; 281.71s |
| Sprint 3 full frontend | 127 passed / 26 files; 184.89s; build 23.19s |
| Final Sprint 4 full backend | **254 passed, 0 failed**; 233 warnings; 468.91s |
| Final clean-lock frontend | **127 passed, 0 failed / 26 files**; 306.91s |
| Final production build | **Passed**, 15.24s; existing large-chunk warning |
| Final Ruff | **All checks passed** |
| Final mypy | **No issues in 52 source files** |
| Final standalone Alembic | Fresh disposable DB upgrades to **0030_project_actions** |
| Migration preservation | Existing answers retained; empty downgrade/upgrade passes; populated downgrade safely refused |
| Final npm ci / audit | Fresh isolated locked install passes; **0 known vulnerabilities** |
| Authenticated browser | Login, review, evidence-linked action lifecycle, audit reload, project switch, responsive/focus checks pass |

Durable logs: [backend tests](verification/backend-final.txt),
[frontend tests](verification/frontend-final.txt), [build](verification/frontend-build.txt),
[Ruff](verification/backend-lint.txt), [mypy](verification/backend-typing.txt),
[migrations](verification/disposable-migration.txt), [npm audit](verification/npm-audit.json).
Frontend negative error-boundary tests intentionally emit rejection stacks; the
suite summary remains 127 passed. Existing dependency/deprecation warnings remain
visible and were not suppressed.

Baseline failures are retained honestly: original npm ci failed on a locked Windows
esbuild executable; a first parallel frontend run had 116 passes / 3 timing failures,
while a serial rerun passed all 119. New test fixture/setup errors were corrected
before sprint acceptance. Fresh verification used separate frontend directories,
never killed the user's running app, and did not weaken assertions. Initial npm
audit found six vulnerabilities (two moderate, two high, two critical); the verified
patched lockfile now reports zero. Final code and dependency checks all pass.

## Data preservation and compatibility

No command migrated, reset, seeded or deleted the user's active database. Test
engines and migration experiments used disposable paths. New synthetic data is
clearly labelled and confined to newly created tmp databases. The seed refuses
production, paths outside workspace tmp and existing files using exclusive creation.

8,302 formerly tracked generated/private-backup paths were removed from Git tracking
without deleting their local copies. Tracked files fell from 9,188 to **920 including
this report and intentional verification evidence**, with new source/tests/docs
included. No tracked node_modules, tmp, Python bytecode/cache artifacts remain.
Metrica source references/license provenance were audited; mirrored assets were
retained and remain excluded from the frontend deployment input.

The 0030 migration adds action tables/indexes and leaves submission decisions,
indicators, dashboards, framework and migration history intact. A populated downgrade
is deliberately refused; plan a backed-up rollback rather than dropping history.
The active environment requires a separately authorized backup/upgrade before it
can use the new action schema. Old review API clients must fetch detail and submit
both evidence_fingerprint and expected_review_token; omitted tokens return 422.

## Security and calculation evidence

API tests demonstrate tenant/project object ownership, enumerator denial, active
assignment rules, same-project evidence, rejection of forged fields, stale evidence
and concurrent edits, required reasons/resolution/verification, immutable audit
access, transactional rollback when audit storage fails, archived writes and
preservation against project hard deletion. Existing CSV formula-injection tests
remain in the passing regression suite. SQLite was executed; PostgreSQL was not.

School Feeding fixture: after five Ready decisions and one Invalid decision,
PORTIONS=365, school-day records reporting served=yes=4, student-meal instances=445.
Missing portions remain missing, zero remains zero and invalid evidence is excluded.
Indicator register/detail, eligibility/dashboard counts, named-period PDF and raw
filtered CSV are reconciled by test. No expected school roster or schedule is
invented, and cumulative student meals are never described as unique beneficiaries.

## Browser and manual validation actually performed

A real browser authenticated to the local synthetic API/frontend. It opened the
School Feeding project, followed the review legend with Enter, inspected and saved
a decision, created a submission-linked action, assigned the collector, committed
a past due date with native keyboard input, progressed it to Resolved and Closed,
reloaded all five audit events, and switched to an empty other-project register.
The browser fixture intentionally has one reviewed submission; the independent
calculation test reviews all six. No real programme records were used.

Desktop/tablet/mobile widths 1440/768/375 had no page-level horizontal overflow;
action page also fit 375. Tab navigation had a visible solid focus outline. Actual
screenshots and detailed limitations are in the [UAT evidence](SPRINT_4_UAT_CHECKLIST.md).
[Verified Overview screenshot](verification/pilot-overview-desktop.jpg).
Temporary test servers were stopped. This is synthetic technical acceptance,
not evidence that an NGO professional completed the tasks unaided.

## External blockers and safe next actions

1. Inspect the [failed starting Vercel deployment](https://vercel.com/gabkoi21s-projects/fieldsight/Enfrw6wd7jWMmdxLUkkbfbkuoQqk).
   Connected GitHub returned no workflow runs for the starting SHAs checked. Hosted
   failure cause remains unverified; local passing builds do not prove hosted success.
2. Assess the two backup snapshots in old Git history privately. Current tracking
   is removed, but prior blobs remain. Coordinate any required history cleanup and
   rotation of actually exposed credentials separately; none were printed/rotated.
3. Supply a designated Kobo test project/account and run the documented worker,
   changed-evidence, retry and report smoke. Confirm API and worker deployment
   separately, exact CORS/VITE_API_URL and backup/restore readiness.
4. Run the practitioner script with a project officer and M&E professional and
   capture actual findings/sign-off. Neither interview occurred during this task.
5. Resolve theme provenance before redistributing mirrored assets; execute disposable
   PostgreSQL checks before a PostgreSQL release. Review the deliberately coarse
   administrator-only role model before expanding portal access.
6. Only after external gates and explicit authorization should an operator migrate
   active data, publish/deploy or merge main. Those actions were not performed.

Exact local School Feeding seed, login, mapping/review/action/report tasks, expected
values, worker restart and recovery commands are in [the pilot protocol](SPRINT_4_NGO_PILOT_PLAN.md).
From backend run `python -m ruff check .`, `python -m mypy app`, and `python -m pytest`
with a fresh disposable basetemp; from frontend run `npm ci`,
`npm test -- --maxWorkers=1`, `npm run build`, and `npm audit`.
Do not run Alembic against the active DB as a verification shortcut.
