# Sprint 3 — Actions & Follow-ups

New project action register reuses tenant authorization, project/team membership,
shared controls, the API client and project navigation. Open from project sidebar,
project tabs, Overview summary, or a submission's Create follow-up link. Records
are manually created; survey answers never automatically create actions.

## API contract

All endpoints require an authenticated active organization administrator and a
project owned by that administrator's organization. Enumerators remain excluded.
Assigned field members collect outside this portal; the officer records findings
on their behalf. A dedicated officer/assignee portal role remains future work.

- GET /projects/{project}/actions: server pagination offset >=0, limit 1..100
  (default 20); filters status, priority, assigned_user_id, due_from/due_to, overdue,
  search (escaped contains). total reflects filters; summary reflects all project
  unresolved/overdue/unresolved-high-priority actions, independent of list filters.
- POST same path: title (required, stripped, 1..200), description, priority,
  assigned_user_id, due_date, submission_id, indicator_id. Starts Open, version 1.
- GET /projects/{project}/actions/{id}: details and 50 audit events with
  history_offset and history_total. Events retain actor, UTC time, note, old/new
  snapshots; clients cannot edit or delete audit entries.
- PATCH same path: expected_version is required. Optional changed fields plus
  status, resolution_summary and note. Stale versions return 409; invalid scope,
  transitions, dates, assignment or evidence return 422. Unknown/forged fields are
  rejected. Tenant/object mismatch returns 404; role denial returns 403.

Open → In progress → Resolved → Closed. In progress can return to Open. Resolved
can reopen to In progress, and Closed can reopen to Open, both with a reason.
Resolving requires a written resolution; closing requires an administrator's
verification note and retained summary. Closed actions must be reopened before
editing. Reopening clears current resolution/closure timestamps and summary while
preserving all prior values in audit history. Due before today's UTC date and an
unresolved status computes Overdue; resolved/closed actions are not overdue.

Assignment requires an active same-organization user and membership, plus an
active, currently effective project assignment for field staff. Organization
administrators already span projects. Evidence links must match both tenant and
project. Existing submission/indicator references provide supporting evidence;
no new upload or arbitrary attachment-link mechanism was introduced.

Writes lock the project before checking lifecycle/version, and action plus audit
commit together. All actions in archived projects remain readable and read-only.
Projects with action history cannot be permanently deleted: archive them instead.
No hard-delete endpoint is provided for actions. No email, push or drag-and-drop.

## Migration / preservation

0030_project_actions adds project_actions and project_action_events after 0029.
No existing submission, decision, indicator, dashboard or framework is rewritten.
Indexes support scope/status/assignment/due filters. Evidence deletion clears live
optional pointers while historical event snapshots preserve original references.
Empty-table downgrade/upgrade is tested. Populated downgrade intentionally refuses
to erase action history. Retain/export history and plan rollback separately.
Alembic URL configuration now escapes percent signs for ConfigParser, including
encoded Windows paths and database credentials. Active database was not migrated.

## Verification

Six API tests cover disposable School Feeding lifecycle, assignment scope, evidence
ownership, concurrency, audit rollback, filters, paging, archival and tenant/role
denial. Migration test preserves existing submission answers, exercises genuine
pre-0030 DDL, empty downgrade/upgrade and populated downgrade refusal. Initial test
fixtures lacked required Kobo connection IDs; corrected without changing schema
requirements. A migration URL interpolation defect was found and fixed.

Six action-page UI integration tests verify creation, evidence/assignment payload,
filters, server pagination, transitions/version, conflicts/reload, archival and
errors. Existing Overview, sidebar and submission-review integrations also run.
Production build passes; full suite counts and screenshots are recorded in the
final report. No production or live Kobo changes were made.

Manual acceptance: create a disposable shortage submission, open its review,
create follow-up, assign eligible member, set high priority and past due date,
move Open → In progress → Resolved (summary) → Closed (verification note), reload
and inspect every event. Switch projects and confirm the action disappears; try
linking foreign-project evidence and stale edits; confirm rejection. Archive and
confirm history remains readable while new edits are denied.

Final Sprint 3: full backend 252 passed (232 warnings, 281.71s); full frontend 127 passed in 26 files (184.89s); production build passed (23.19s); Ruff and mypy pass. Follow-up UTC/audit-rollback checks: 2 passed. Strengthened action empty-state test rerun: 6 passed. Existing dependency warnings and npm audit findings remain release-review items for Sprint 4.
