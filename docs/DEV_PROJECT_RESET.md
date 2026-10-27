# Development project reset — authorized and completed

Branch: dev. Selected database explicitly confirmed by the user:
C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\fieldsight.db

This is a dedicated offline SQLite command, not a normal application endpoint.
No existing production deletion service, API guard or migration was changed.
The preparation below was reviewed before deletion. The user then provided the exact destructive confirmation; execution and independent verification completed successfully. See the execution outcome at the end.

## Schema / deletion audit

The selected DB is at 0029_auth_lifecycle. Current code also defines revision 0030
project_actions/project_action_events, but these tables do not exist in this DB.
The reset supports both audited revisions and never upgrades or downgrades either.
Unknown/missing tables, unknown revisions, unreviewed triggers, ownership graph
changes, existing FK violations and unexpected cycles cause refusal.

Audited identity, operations and workspace models; all migration files through
0030; normal local project DELETE and the separate delete-kobo-form route. Normal
DELETE still refuses projects with action history. That safeguard is unchanged.
The reset imports no application routes, migration runners or Kobo/provider code.
It has no network operation and never invokes either deletion endpoint.

Project ownership includes direct project FKs and transitive links from indicators,
submissions and actions. A child-first order is derived from the actual FK graph.
Self-referencing framework parents are cleared inside the same transaction before
removing the nodes. Foreign-key enforcement stays ON throughout. No table is
truncated, dropped or rebuilt; migration history and schema must remain identical.

The shared organization_admin_events table is selectively handled: project_status,
submission_review, submissions_export and kobo_form_deleted history, plus generic
entries resolving to a project-owned resource in the same organization, are removed.
Organization/account/configuration audit entries are preserved and fingerprinted.
Clearing local kobo_form_deleted audit rows does not perform a Kobo operation.

## Verified backup

Prepared at 2026-10-27 17:02:51 UTC with SQLite's online backup API, including the
consistent committed WAL snapshot. Backup integrity/FK checks pass and every table's
logical contents/schema match the source snapshot.

Backup:
C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\backups\project-reset-20261027\fieldsight-before-reset.sqlite3

SHA-256: 606c2b3e64468219cd7d5c97af45358bd070c16f8024863f2fc081b33d537b51

Manifest (private, Git-ignored, contains identity, fingerprints and exact preview):
C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\backups\project-reset-20261027\reset-manifest.json

The backup and manifest are not overwritten. If the source changes, execution
refuses and a new backup/manifest with fresh names must be prepared after stopping
writers. A receipt prevents reuse of a successfully executed one-time manifest.

## Dry-run preview

All projects in this selected development database, across its organizations:

1. Community health visits — Active.
2. Daily School Feeding Monitoring Form — Draft.

| Project-owned table / selected audit rows | Rows to delete |
|---|---:|
| projects | 2 |
| submissions | 90 |
| submission_review_events | 64 |
| quality_findings | 31 |
| indicators | 6 |
| indicator_definition_versions | 3 |
| indicator_mappings | 5 |
| indicator_period_targets | 12 |
| result_framework_nodes | 6 |
| analytical_dashboards | 1 |
| saved_analyses | 1 |
| field_assignments | 5 |
| survey_schemas | 2 |
| sync_runs | 2 |
| organization_admin_events (project-related subset) | 34 |
| collected_results | 0 |
| project_targets | 0 |
| field_mappings | 0 |
| sync_jobs | 0 |
| sync_schedules | 0 |
| sync_settings_changes | 0 |
| project_actions / project_action_events | Absent at revision 0029 |
| **Total** | **264** |

Preserve byte-for-byte logical rows: 17 users, 17 memberships, one organization,
one organization-sector link, five sectors, one organization-settings row, two
Kobo connection configurations, 146 refresh sessions, six worker heartbeats, and
all locations, user preferences, invitations and Alembic rows. The selected DB
currently has zero users marked platform SuperAdmin; none are removed or created.
The reset preserves SuperAdmin records wherever present (tested with a fixture).
Session/heartbeat counts may change while the app is running, causing safe stale
manifest refusal. User preference URLs, if any, are preserved as configuration.
Generated reports, images, local backups and remote attachments are outside this
DB-only reset. No external content is deleted.

## Tested command and safety gates

New file: fieldsight-backend/scripts/reset_dev_projects.py.
New tests: fieldsight-backend/tests/test_dev_project_reset.py.

13 disposable reset tests pass: all 22 owned tables populated; verified backup and
read-only preview; complete reset across organizations; protected configuration,
SuperAdmin and unselected DB preservation; confirmation, environment and branch
guards; stale source/tampered backup; one-time reuse; transactional rollback and
preserved-state invariants; unknown schema; default safe CLI; revision 0029 support.
Six existing local-deletion/archival endpoint tests pass with disposable databases
and mocked providers. Ruff passes. Mypy passes for app plus reset script (53 files).
No active database mutation was used for tests.

Before executing, stop the API and worker writing this database. --writers-stopped
is an explicit operator assertion, not a command that kills processes. Execution
locks SQLite with BEGIN IMMEDIATE, requires the prepared source identity and full
logical fingerprint still to match, rechecks backup integrity/hash, deletes inside
one transaction, checks every owned table is empty, confirms every protected table
and retained shared audit row is unchanged, then commits. --verify also performs a
fresh post-commit empty/FK/integrity check. Failures before commit roll back all DML.
A receipt file is retained after a committed run. No secret values are printed.

Exact destructive command — NOT RUN; requires final user authorization:

```powershell
Set-Location 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend'
.\.venv\Scripts\python.exe -m scripts.reset_dev_projects --database 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\fieldsight.db' --environment development --execute --manifest 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\backups\project-reset-20261027\reset-manifest.json' --confirm-database 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\fieldsight.db' --confirm-delete 'DELETE ALL DEVELOPMENT PROJECTS' --writers-stopped --verify
```

Safe read-only preview (no backup or deletion):

```powershell
.\.venv\Scripts\python.exe -m scripts.reset_dev_projects --database 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\fieldsight.db' --environment development --dry-run
```

Read-only post-reset verification: replace --dry-run with --verify. Nonempty or
unidentified databases produce refusal (exit 2). SQLite only: remote/PostgreSQL URLs
and nonexistent relative/default database paths are not accepted. Production or
unrecognized environment configuration always refuses, even with confirmations.
No default DB path or implicit .env database selection is used.

Final destructive confirmation requested from the user:
DELETE ALL DEVELOPMENT PROJECTS

## Authorized execution outcome

User separately authorized execution with the exact phrase DELETE ALL DEVELOPMENT PROJECTS.
Committed at 10/27/2026 17:07:54. Two projects and 262 related records were deleted in one local transaction.
The previously identified API/worker writers were stopped; the authorized project names and counts were rechecked and unchanged.
Only non-project runtime state had changed since the first backup, so a new verified backup and manifest were created before execution.

Final backup: C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\backups\project-reset-20261027\fieldsight-authorized-final.sqlite3
Final backup SHA-256: c69ae39a856a391654360755838a67431ba1e57280e426cdec000c7d9de1596a
Final manifest: C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\backups\project-reset-20261027\authorized-final-manifest.json
Receipt: authorized-final-manifest.json.executed.json in the same private backup directory.

All project-owned tables and selected shared audit rows verified empty both before commit and by a separate read-only verification after restarting the local API/worker.
All preserved rows and the full schema/migration history matched their pre-reset fingerprints at commit. Runtime sessions/heartbeats may update normally after service restart.
SQLite integrity and FK checks passed. Revision remains 0029_auth_lifecycle; no table was dropped or migration applied.
No Kobo client was imported/invoked by the reset. Existing local and provider-deletion endpoints were not used or changed.
Local API and worker were restarted against the exact selected database. Refresh Projects to clear cached UI results.

Executed guarded command:

```powershell
.\.venv\Scripts\python.exe -m scripts.reset_dev_projects --database 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\fieldsight.db' --environment development --execute --manifest 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\backups\project-reset-20261027\authorized-final-manifest.json' --confirm-database 'C:\Users\gabak\Videos\Field-Sight\fieldsight-backend\fieldsight.db' --confirm-delete 'DELETE ALL DEVELOPMENT PROJECTS' --writers-stopped --verify
```

Restart smoke: /health/ready returned ok/database ready; /status confirmed environment development.
