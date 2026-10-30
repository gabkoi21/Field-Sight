# Project enumerators — Phase 1

The subsequent [Kobo access integration](enumerator-kobo-access.md) adds explicit
grant/check/revoke actions. The Phase 1 description below records the original manual
workflow; see that report for the current provider-managed behavior and migration.

## Architecture and scope

The backend uses FastAPI, SQLModel and Alembic (previous head: `0030_project_actions`).
`User`, `OrganizationMembership`, `WorkspaceInvitation` and `FieldAssignment` already
provide authentication, organization roles, invitations and project/location assignments.
Existing invitations and enumerator account creation grant FieldSight access, so they
are not used to register collection-only contacts. Existing enumerator memberships
remain selectable; their project-wide `FieldAssignment` rows are reused, including
disabled rows on reassignment. Legacy rows acquire a profile when edited.

`CollectorProfile` holds an organization-scoped contact and Kobo username,
with an optional link to the existing organization membership. New contacts create
neither a User nor an OrganizationMembership, password, invitation or login.
`FieldAssignment.membership_id` is now nullable for these contacts; `collector_id`
links them to the existing assignment model. A unique project/profile constraint
prevents duplicate assignments; soft removal and reassignment reuse the same row.
Profile email uniqueness is organization-scoped. API email writes are lowercase.

Each project currently has exactly one trusted `kobo_connection_id`/`kobo_form_id`
mapping. Form selection uses that mapping, not a provider asset inventory or historic
submission/schema records. Zero connected forms and zero enumerators are supported.
The UI intentionally offers only that mapped form. Supporting several simultaneous
project source mappings requires a separate change to the existing Kobo architecture.

`CollectorFormAccess` stores the connection/form mapping, selection, reporting actor,
timestamp and manual access state separately from assignment activation. States
accepted in Phase 1 are `not_configured`, `pending`, and
`reported_configured_unverified`. No write endpoint can claim verified access.
Old form records remain visible after a mapping change or deselection. Changing the
Kobo username clears prior manual reports across that profile's project assignments.

All endpoints reuse `_project` and the existing organization-admin policy (exactly
one active organization-admin membership). Super administrators receive no new
implicit tenant access. Nested assignments, organization members, profiles and
connection/form inputs are validated against the authorized project. Existing
`OrganizationAdminEvent` records actor/time for creation, assignment, removal,
identity changes and form selections/manual reports. Form report events include
the submitted mapping/state payload; no credentials are returned or logged.

Kobo credentials remain in the existing encrypted connection storage. Provider
requests, submission provenance and trusted project routing are unchanged.
The existing durable sync worker/retry behavior is unchanged. Collector attribution
and reporting are outside Phase 1; no counts or identity associations are inferred.

## Changed files

- `fieldsight-backend/app/models/operations.py`: extend FieldAssignment; add contact and form state tables.
- `fieldsight-backend/alembic/versions/0031_project_enumerators.py`: additive upgrade and guarded downgrade.
- `fieldsight-backend/app/routes/project_enumerators.py`: list/eligible/create/update/remove API.
- `fieldsight-backend/app/api/v1/router.py`: register the API.
- `fieldsight-backend/tests/test_project_enumerators.py`: feature, authorization, identity and migration tests.
- `fieldsight-frontend/src/services/apiClient.ts`: typed API; nullable membership on collection-only assignments.
- `fieldsight-frontend/src/app/App.tsx`: project Field Team route uses the assignment workflow.
- `fieldsight-frontend/src/workspace/WorkspaceTeamPage.tsx`: project wrapper; preserve organization administration.
- `fieldsight-frontend/src/workspace/ProjectEnumerators.tsx`: search/pagination, add/edit/remove and sharing guidance.
- `fieldsight-frontend/src/workspace/ProjectEnumerators.test.tsx`: loading/error/empty and mutation workflows.
- `fieldsight-frontend/src/pages/organization/FieldOperationsPage.tsx`: skip collection-only contacts in the existing account-name map.

## Migration and operation

From `fieldsight-backend`, using the configured deployment database:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

No new configuration or credentials are required. Migration checks run on disposable
SQLite databases; the user's configured application database was not migrated.
The migration handles the repository's baseline migration importing current metadata,
and also the actual old field-assignment shape. Upgrade retains existing rows.
Downgrade refuses when collector profiles exist, to avoid destroying contacts/history.
An empty feature can be downgraded to `0030_project_actions`. PostgreSQL deployment
migration execution has not been exercised here.

Existing organization enumerator-account pages still manage FieldSight accounts.
Collection-only contacts are managed from projects and can be selected on other
projects through the organization-scoped eligible list. They have no login or action
assignee account. Deleting a project follows the existing deletion policy; form
records cascade with assignments, while organization audit events remain.

## UI walkthrough

1. Open a project and its **Field Team** tab.
2. Choose **Add Enumerator**; select an existing organization enumerator, or choose
   **New collection-only enumerator** and enter name/email.
3. Enter the required actual Kobo username. Select the project's connected form.
4. Review the sharing instructions and choose **Confirm assignment**.
5. Configure collection access manually in that Kobo deployment. Use **Edit forms &
   Kobo access** to record **Reported configured — not verified**.
6. Removing an enumerator requires confirmation and warns that Kobo revocation must
   be performed separately. The inactive assignment and manual reports stay visible;
   **Reassign** reuses the contact and assignment.

The UI uses existing Page, Panel, Field, Dialog, Button, LoadingState and React Query
patterns, labeled native controls, keyboard-accessible dialogs and wrapping cards.
Responsive browser screenshots were not captured; the component workflows are tested
under jsdom and the production TypeScript/Vite build is checked.

## Validation

Final results: **68 backend tests passed** (28 warnings), **28 frontend tests
passed**, and the production TypeScript/Vite build passed.

Backend regression command (temporary databases deliberately located in the workspace):

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_project_enumerators.py tests/test_workspace.py tests/test_migrations.py tests/test_project_deletion.py tests/test_kobo_sync.py tests/test_auth.py tests/test_project_actions.py --basetemp=../tmp/enumerator-complete -q -o addopts=''
```

Frontend checks:

```powershell
npm run build
npm test -- src/workspace/ProjectEnumerators.test.tsx src/workspace/WorkspaceShell.test.tsx src/pages/organization/FieldOperationsPage.test.tsx src/services/apiClient.test.ts
```

Ruff passes for all changed Python files. Targeted mypy passes for
`app/routes/project_enumerators.py --follow-imports=silent`. `git diff --check` passes.
The backend tests exercise tenant/role denial, contacts without accounts, existing
members, duplicate assignment, reuse across projects, removal/reassignment, form and
username validation, rejection of verified-granted claims, identity invalidation,
stale mappings, audit history and a populated legacy migration roundtrip. Existing
Kobo sync, auth, workspace, project actions/deletion and migration regressions run too.
Frontend tests exercise loading/error/empty/populated states and new/existing contact,
form editing and confirmed removal workflows.

The sandbox could not complete the threaded FastAPI client; backend tests were run
with approved execution outside it. Existing Pydantic serialization/deprecation and
Alembic configuration warnings remain; Vite reports the existing large bundle warning.
No live Kobo permission checks were performed. Automatic grant/revoke/reconciliation,
verified permission states and collector attribution are deliberately deferred.

Kobo username is now required for every assignment creation or edit; omitted, null,
blank, whitespace-only and malformed values are rejected. Legacy contact rows can
retain a missing username until edited. This validation change needs no migration.

