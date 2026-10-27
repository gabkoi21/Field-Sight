# FieldSight — Consolidated Codex Implementation Plan (Sprints 0–4)

**Repository:** https://github.com/gabkoi21/Field-Sight  
**Target working branch:** `dev`  
**Purpose:** One end-to-end Codex assignment to stabilize FieldSight, restore a trustworthy submission-review workflow, refine the Project Overview, implement Actions & Follow-ups, and prepare a realistic NGO pilot.  
**Reference use case:** Daily School Feeding Monitoring Form (Education, Liberia).  
**Priority:** Correctness, preservation of existing data, tenant security, usability, then additional functionality.

> **For Codex:** Treat this file as the complete work order. Audit current repository state first; do not assume the repository still matches the findings below. Complete sprints sequentially, keep commits scoped, and verify each sprint before proceeding. Do not ask for approval between routine implementation steps. **Stop and report blockers rather than performing destructive operations, modifying real secrets, or deploying to production without explicit authorization.** If a requested integration or external user interview is not possible within your environment, implement all feasible preparation and report the unmet acceptance criterion honestly.

---

## 0. Role, product context, and design principles

You are acting as a senior full-stack engineer, M&E product designer, and software QA reviewer working on **FieldSight**, a multi-tenant Monitoring & Evaluation platform for NGOs.

The platform's existing architecture includes a React/TypeScript/Vite frontend, FastAPI backend, SQLModel/SQLAlchemy/Alembic persistence (SQLite local; PostgreSQL-compatible), KoboToolbox integration, background synchronization worker, indicators/results frameworks, saved dashboards, and reporting. Preserve existing working features rather than creating replacements.

**Personas:** Organization administrator, NGO project/program officer, M&E officer/reviewer, enumerator (typically collects using KoboToolbox). **Do not silently broaden enumerator permissions or interpret a UI route guard as adequate backend authorization.**

**School-feeding pilot example:** Form collects school name/code, date, school attendance, whether meals were served, boys/girls fed, meal portions, sufficiency/shortages, observations, and whether follow-up is required. A previous synthetic example reported 260 present, 215 fed, 215 portions, shortage yes, follow-up yes. **Do not insert this example or any other mock data into production databases or production UI.**

**Operating rules:**

1. Work on `dev`. Before editing, inspect `git status`, HEAD, pending differences, existing tests, routes, services, models, docs, CI, deployment configuration, and feature flags. Never discard user's uncommitted changes.
2. Prefer small changes to existing modules over duplicate models, endpoints, dashboards, or state management.
3. Preserve historical submissions, quality decisions, evidence, indicator definitions, dashboards, and migration history. Prefer additive, backwards-compatible migrations with tested downgrade/upgrade; **do not reset or automatically migrate a user's active database.**
4. Any new calculation must be tenant-scoped, independently testable, and distinguish **zero**, **no data**, **excluded**, **pending review**, and **not configured**.
5. Use real query results only. No invented activity, completion percentages, attendance, reporting completeness, project progress, or indicator values.
6. Preserve FieldSight visual identity and shared KPI card styling. Build accessible keyboard-usable, mobile-responsive layouts with explicit loading/error/empty states.
7. Protect against cross-organization and cross-project access, unsafe object references, forged decisions, status manipulation, stale concurrent edits, and CSV formula injection.
8. No production deployment, destructive Kobo requests, changes to external data, mass deletion, or credential rotation unless separately authorized.
9. A passing test suite is not the same as an authenticated production or real NGO user acceptance test. Document what was actually verified.
10. At the end, produce a readable change log, test evidence, manual verification guide, and clear blockers/remaining work.

### Initial repository audit checkpoints

Before implementation, verify or revise these observations against the current `dev` code:

- `main` CI recently failed on backend Ruff linting, including import ordering, long lines, and semicolon statements. Do not assume the exact error count is unchanged.
- Latest Vercel status previously showed deployment failure; inspect actual logs and current configuration, and report diagnosis rather than guessing.
- Generated/temporary assets and large dependency directories appear tracked (nested `node_modules`, Python cache, `tmp/`, test logs, downloaded template assets). Audit git tracking and licenses before cleanup.
- `dev` removed dedicated Data Quality routes/UI while retaining review/eligibility states; review restoration must reconcile the current code and legacy contracts.
- Project Overview includes collection and review visualizations and `ProjectCompletionChart.tsx`, which currently describes **binary saved project status**, not evidence-based completion.
- Dedicated Actions & Follow-ups workflow is not confirmed implemented; search current tree before adding it.

Deliver an initial **audit note** recording branch SHA, baseline tests, existing behavior to preserve, risks, and plan to reuse components. Then implement Sprints 0–4 in the order below.

---

# Sprint 0 — Stabilization, CI, and repository cleanup

## Objective

Create a clean, testable, deployable **development baseline** without silently changing product semantics or losing user data.

## Work packages

### 0.1 Run baseline diagnostics

- Examine workflow definitions in `.github/workflows/verify.yml`, `.github/workflows/deploy.yml` and frontend deployment configuration.
- Run backend Ruff, mypy, full pytest suite, disposable-db migration upgrade, and frontend `npm ci`, tests, TypeScript/build. Record failures **before** fixing.
- Check runtime package compatibility and the local API + worker start path.
- Inspect GitHub Actions and Vercel logs where supported. If external logs are unavailable, provide commands/URLs for the user and mark the blocker unverified; **never claim the hosted deployment is fixed just because local build passes**.

### 0.2 Fix lint/build/test failures

- Correct Ruff warnings/errors, prioritizing formatting/import sorting and actual correctness bugs.
- Address failing tests without deleting or weakening important assertions.
- Check `ruff check .`, `mypy app`, `pytest`, frontend test and production build from documented working directories.
- Avoid unrelated large-scale style rewrites unless required for CI.

### 0.3 Remove tracked generated artifacts safely

- Inventory tracked dependency/vendor and generated files using `git ls-files`; distinguish legitimate assets and intentionally versioned fixtures from accidental outputs.
- Update `.gitignore` patterns for all nested `node_modules/`, `__pycache__/`, `.pytest_cache/`, `*.py[cod]`, test output folders, local DB WAL/SHM, `tmp/` and appropriate generated logs.
- Use `git rm --cached` (with correct targeted paths) to **untrack only**; do not delete local developer data. Exclude legitimate snapshots, intended docs, actual source, and fixtures needed by tests.
- Audit copied third-party Metrica/theme content for license and provenance. Do not blindly remove assets referenced by the UI, and do not redistribute proprietary template files without appropriate rights.
- Check repository size/file counts before and after and ensure CI still has all required source.

### 0.4 Deployment readiness

- Verify Vercel root directory, framework, build and output configuration, env-var names, SPA rewrites, backend URL/CORS, and branch settings.
- Verify FastAPI Cloud workflow requirements and worker process deployment assumptions; don't claim API deployment enables separate worker unless actually configured.
- Check no secrets or private databases were committed. If secrets are discovered, report **secure rotation requirements** without printing their values.
- Record deployment prerequisites and an explicit manual go/no-go gate.

## Acceptance criteria

- Repository-wide configured CI checks pass locally and in GitHub when network/CI actions are available.
- Frontend production build works; no app-breaking regression from cleanup.
- Generated files are no longer tracked while local developer files remain intact.
- Hosted deployment is either verified successful **or** marked blocked with exact failure cause/diagnostic steps.
- No actual production deployment performed without explicit authorization.

**Required output:** `docs/SPRINT_0_STABILIZATION_REPORT.md` with before/after diagnostics, tracked-file cleanup inventory, CI evidence, and outstanding deployment blockers.

---

# Sprint 1 — Restore submission review and evidence quality

## Objective

Enable authorized officers to inspect submissions, record an auditable review decision, and clearly understand which records can contribute to M&E results. Prefer an integrated **Submissions → Review** workflow over reinstating a sprawling, duplicate Data Quality subsystem.

## Audit first

- Inspect `app/routes/collection.py`, `app/core/review_evidence.py`, models `Submission`, `QualityFinding`/review event/history, current status-change API, indicator eligibility rules, and deleted quality routes/tests.
- Determine whether existing APIs can safely support review without reintroducing removed endpoints.
- Preserve existing review states and historical evidence; do not automatically set records to `ready`.

## Minimum product experience

1. The Submissions table clearly displays review status, date, source, and any validation/evidence concern, with project and review-status filters.
2. An authorized reviewer opens a submission drawer/page to inspect the complete relevant answers, source identity, metadata and review history.
3. Explicit decisions: **Ready**, **Needs review**, **Invalid**, with required reason for invalid/reopened decisions as appropriate to existing policy.
4. Review actions persist actor, UTC timestamp, reason/notes, old/new status, and evidence fingerprint/version; reject stale evidence with a clear conflict response.
5. Re-synced changed evidence reopens review as dictated by the established evidence fingerprint policy. Metadata-only updates must not fabricate new review events.
6. Indicator calculations and dashboards continue to exclude ineligible evidence. Show exclusion reasons/counts where available; avoid confusing reviewed/ready data with formally donor-approved reports.
7. Expose a clear route back from Overview's review-status breakdown to the appropriate filtered Submissions view, avoiding dead/broken links.
8. Review permissions are enforced in the **backend**, not just hidden buttons. Choose the smallest valid role model and document any missing dedicated reviewer role.

## Tests

- Ready/pending/invalid transitions and corresponding indicator effects.
- Persistence of history, authorship, reasons, version/fingerprint conflicts, idempotent sync and re-review after changed evidence.
- Tenant isolation, enumerator restrictions and forbidden cross-project decisions.
- Pagination/filtering with real scoped total counts, no hidden full-table fetch.
- End-to-end frontend integration tests with mocked APIs plus API-level tests with disposable databases.

## Acceptance criteria

An authorized project officer can identify a pending School Feeding record, inspect its evidence, approve or reject it, and subsequently see correct indicator/report eligibility **without any direct database modification**.

**Required output:** `docs/SPRINT_1_SUBMISSION_REVIEW.md` with flows, APIs/permissions, screen references, and testing evidence.

---

# Sprint 2 — Project Overview refinement (accurate, modern, simple)

## Objective

Keep the modern Project Overview visual quality and make the page correct, uncluttered, and useful to nontechnical NGO project staff. **Do not recreate the analytics dashboard on Overview.**

## Required UI and behavior

1. Retain coherent header with actual project name, status, sector, location, date range, and quick actions when these fields exist.
2. Keep four or fewer meaningful overview KPI cards. Prefer the already standardized shared `MetricCard` component and avoid duplicate hard-coded visual wrappers. Cards should navigate to relevant existing screens where useful.
3. Retain collection trend and review breakdown chart **only** when backed by actual project-scoped data; clearly label their different time windows and status semantics. The review-status chart must link into the reinstated filtering from Sprint 1.
4. Audit `ProjectCompletionChart.tsx`: status `completed` is **binary project state**, not percentage of work, activities, deliverables, or indicator attainment. Rename/rework as **Project status** (or remove the misleading chart). Do not depict a fixed full progress ring as measured completion. Use true progress only if an explicit validated work-plan/denominator is available.
5. Project timeline should mean **time elapsed / planned period**, not work completed or targets achieved.
6. Keep an unobtrusive **Needs Attention** area for real exceptions (pending reviews, failed sync, overdue indicators, unresolved high-priority actions once Sprint 3 exists). Avoid duplicate alerts and avoid claiming an all-clear when a query failed.
7. Keep technical information collapsible or in dedicated pages; don't fill overview with generic explanatory cards or list every indicator.
8. Preserve error, loading, no-source, no-indicator, undated-record, and archived-project states.
9. Verify responsive behavior for desktop, tablet and narrow mobile; visible keyboard focus, readable labels, screen-reader text, and no unwanted horizontal scroll.
10. **Never infer school reporting completeness** unless a real expected school roster **and** reporting schedule exist.

## Acceptance criteria

An NGO user can open **Projects → Daily School Feeding Monitoring Form → Overview** and answer within one minute:
- What data has been collected?
- How much data is awaiting review?
- Is the source synchronization healthy?
- Where do I go to inspect or resolve the problem?

Every displayed number reconciles with its source API, and empty states never fabricate values. Do not infer that completion percentage equals project status or elapsed days.

**Required output:** `docs/SPRINT_2_OVERVIEW_REFINEMENT.md`, frontend tests, manual viewport/keyboard checklist, and (where an authenticated browser is truly accessible) screenshots from the actual app—not generated UI mockups.

---

# Sprint 3 — Actions & Follow-ups (Project action register)

## Objective

Provide a complete but deliberately small action-management module for NGO project follow-up. **Use project-scoped actions, not hard-coded School Feeding logic.** This is the primary new product feature in this assignment.

## Scope and UI

- New **Actions & Follow-ups** project page, linked from project navigation and Overview with a small summary when appropriate.
- Default **list/table view**, with optional simple status-board view only if achievable without complexity. Do not add drag-and-drop, notifications, AI, or complex workflow automation in V1.
- Filter/search by status, priority, assigned user, due date/overdue, and project; paginate server-side.
- Create and edit actions through a concise form with accessible field labels and validation.
- Action details with timeline of updates, linked supporting evidence and notes.

## Recommended data contract

Add tenant- and project-owned `ProjectAction` and audit/event records only if equivalent models do not already exist. Candidate fields:

- `id`, `organization_id`, `project_id`
- `title` (required), `description`, `priority` (`low`, `medium`, `high`)
- `status` (`open`, `in_progress`, `resolved`, `closed`, possibly `cancelled` only with a documented rule)
- `assigned_user_id` (nullable initially), `created_by_id`
- `due_date` (optional), `created_at`, `updated_at`, `resolved_at`, `closed_at`
- optional verified `submission_id` and/or indicator ID (always project-owned; no foreign record linking)
- `resolution_summary` and optional evidence attachments/links only through an existing secure upload mechanism; otherwise use validated references to already stored evidence
- version/concurrency token for stale edit protection.

Audit record: actor, event type, previous/new values where appropriate, note, UTC time. Preserve event history across edits; prohibit invisible reassignment and status changes.

## Rules and workflow

1. An authorized officer creates an action manually (e.g., "Investigate school food shortage"). Do not automatically create issues from survey answer values in V1.
2. They link an existing relevant project submission (optional) and assign an eligible active member of the same organization/project.
3. They set priority, due date, and change status to In Progress.
4. The assigned user or authorized officer records findings and corrective action.
5. Resolution requires a written summary; **Closed** should be distinct from **Resolved** if kept, with an explicit verification rule and permission.
6. Overdue is **computed** from status + due date, not a stale manually edited flag.
7. Archived projects do not accept new actions without explicit defined lifecycle rules. Historical actions remain readable.
8. The Overview should show a small genuine unresolved/overdue summary and link to the register; do not turn Overview into a second Kanban board.
9. No automatic email or push notifications until a provider and delivery/permission model are approved.

## Permissions

Begin with the current organization-admin permissions, enforce all access server-side, and document a follow-up role design for project officer/reviewer if it cannot safely be introduced here. Never expose one organization's actions, users or submissions to another tenant.

## School Feeding acceptance scenario

In a **disposable test environment only**, seed a synthetic School Feeding submission with a food shortage. Create a manually initiated action, link to that exact submission, assign a project member, set due date, move Open → In Progress → Resolved/Closed per defined policy, write a resolution note, reload, and verify a complete audit trail. Switching projects must not reveal it. Check overdue logic and same-project evidence validation.

## Tests

Backend: CRUD/validation, assignment scope, linked evidence ownership, concurrency, state transitions, audit consistency/transactions, archived-project behavior, pagination, tenant and role denial, migrations.  
Frontend: creation, filters, empty/errors, status changes, direct links from Overview and Submissions, mobile and keyboard usability.

**Required output:** `docs/SPRINT_3_ACTIONS_FOLLOWUPS.md`, explicit API contract, migration notes, and acceptance screenshots where possible.

---

# Sprint 4 — NGO pilot preparation and validation

## Objective

Prepare FieldSight for a realistic small-project test and collect repeatable evidence about usability, data correctness, and operational reliability. **This sprint cannot be honestly marked complete solely by passing synthetic automated tests.**

## Implementation/preparation

1. Supply a reusable **School Feeding pilot test protocol** and a separate **synthetic-data seed** that refuses production environments and never modifies user data accidentally.
2. Document how to connect a designated KoboToolbox test project, sync records through the worker, review submissions, map indicators, inspect dashboard results, create follow-up actions, and generate PDF/CSV reports.
3. Test values using sample scenarios: feeding served/no; shortage yes/no; missing answers; invalid field values; changed Kobo submission after review; multiple schools and dates; duplicate imports; network/sync failure.
4. Verify indicator semantics: feeding-session counts need a defined record/session grain; sum meal portions as portions, and do not label cumulative student-meal instances as unique beneficiaries. Review eligibility must affect results consistently.
5. Cross-check dashboard, indicator detail, and PDF/CSV values against the same authoritative calculations.
6. Run negative permission tests: organization A cannot read/write organization B's projects, submissions, actions or reports.
7. Document worker restart, backups, migration recovery, failure/retry, monitoring, and support escalation.
8. Produce a brief **NGO user testing script** for at least one project officer and one M&E professional. Have them attempt tasks unaided. Capture completion, confusion points, errors and suggested improvements.
9. Produce a findings register with severity, business impact, owner, repro steps, and release gate.
10. If no live authenticated environment, Kobo credentials, or actual practitioners are available, finish the automated test protocol and mark manual user interviews/UAT **Pending external validation**, not passed.

## Pilot tasks participants must attempt

- Select/create a project and understand its status.
- Locate and explain the latest Kobo synchronization outcome.
- Find a pending submission, inspect evidence and record a valid review decision.
- Create and correctly map a School Feeding indicator, then explain its target and actual.
- Distinguish submissions from eligible results and identify the effect of a rejected record.
- Create and assign a food-shortage follow-up; record resolution.
- Generate a report for a named period and explain both figures and limitations.

## Pilot go/no-go gate

**Required:** all blocking CI and deployment failures resolved, migrations tested on backups/disposable DBs, no unresolved cross-tenant access flaw, reliable submission review, accurate sample calculations, persisted action audit trail, demonstrated recovery plan, and completed authenticated smoke test. Human usability sign-off is a separate requirement: do not state NGO pilot acceptance until actual participant evidence exists.

**Required output:** `docs/SPRINT_4_NGO_PILOT_PLAN.md`, `docs/SPRINT_4_UAT_CHECKLIST.md`, `docs/SPRINT_4_FINDINGS_REGISTER.md`, and an honest outcome summary (verified / partially verified / blocked).

---

# Cross-sprint verification matrix

| Requirement | Sprint 0 | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|---|---:|---:|---:|---:|---:|
| Backend Ruff, mypy, pytest | ✓ | ✓ | if changed | ✓ | ✓ |
| Frontend Vitest + production build | ✓ | ✓ | ✓ | ✓ | ✓ |
| Disposable migration upgrade + preservation | ✓ | if changed | if changed | ✓ | ✓ |
| Project / tenant / role restrictions | regression | ✓ | regression | ✓ | ✓ |
| Real-data vs mock-data distinction | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mobile + keyboard accessibility | regression | ✓ | ✓ | ✓ | manual |
| Review eligibility and indicator consistency | regression | ✓ | regression | regression | ✓ |
| Action history and closure | — | — | — | ✓ | ✓ |
| Authenticated browser smoke test | where possible | where possible | where possible | where possible | required gate |
| Actual NGO professional feedback | — | — | — | — | pending until conducted |

**Commands** (adapt if current project setup differs):

```bash
# From fieldsight-backend
python -m pip install -e '.[dev]'
ruff check .
mypy app
pytest
alembic upgrade head  # disposable database only during automated verification

# From fieldsight-frontend
npm ci
npm test
npm run build
```

**Important:** Never use the user's live database for disposable tests or migration experiments. Back up and verify database integrity before any separately authorized active-environment upgrade.

---

# Delivery and reporting contract for Codex

## Implementation sequence

1. Inspect `dev`, existing changes and latest repo state.
2. Publish baseline audit and risks.
3. Complete Sprint 0, run checks, commit changes with descriptive scope.
4. Complete Sprint 1, run checks, commit.
5. Complete Sprint 2, run checks, commit.
6. Complete Sprint 3, run checks, commit.
7. Complete feasible Sprint 4 automation/documentation, commit; leave actual user interviews and production sign-off pending when unperformed.
8. Run full checks again and inspect `git diff`, `git status`, git-tracked artifacts, migration chain, UI links, and authorization boundaries.
9. Produce final delivery report and identify any release blockers. Do not merge to `main` or deploy without explicit authorization.

## Final report format

- **Branch / starting SHA / ending SHA**
- **Implemented features by sprint** (specific filenames, APIs, migrations)
- **Checks run and exact pass/failure counts** (not copied from old docs)
- **Data migration and backwards-compatibility notes**
- **Security / tenant-isolation evidence**
- **Browser/manual validation actually performed**
- **Known limitations, unverified assumptions, and blockers**
- **NGO pilot readiness: READY / NOT READY / PARTIALLY VERIFIED** with reasons
- **Exact local test instructions** for the School Feeding project
- **Safe next actions**; never claim a real NGO user pilot occurred without participant evidence

## Definition of done

The work is not complete simply because five documents or UI panels exist. It is complete to the extent the code works, source-linked calculations reconcile, security rules hold, tracked artifacts are cleaned, tests pass, review and follow-up workflows persist correctly, and any unavailable external/manual validation is explicitly disclosed.

**End of Codex work order.**
