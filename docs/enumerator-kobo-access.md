# Kobo collection sharing from FieldSight

Organization administrators can now grant, check and revoke a named enumerator's
direct collection permission from **Project → Field Team**, without leaving FieldSight.
Save an assignment with its Kobo username and selected form, then choose **Grant Kobo
access** and confirm. **Check access** reads the current provider permissions.
**Revoke collection** separately removes direct collection permission; it does not
remove the FieldSight assignment. Removing or deselecting an assignment does not
silently change external permissions. Inactive and old form mappings retain Check
and Revoke actions so administrators can clean up sharing.

The enumerator must already have an account on the same Kobo server. No Kobo user
accounts or passwords are created or stored. The existing encrypted organization
connection token is used only on the backend. Its account needs **Manage project**
on the form. Grant requires a deployed, active form and its current project mapping.

## Verified API contract

Checked against Kobo's current documentation and public server source on 2026-10-30:

- [User-level sharing](https://support.kobotoolbox.org/managing_permissions.html):
  Add submissions enables collection and automatically includes View form; accounts
  must be on the same server.
- [API v2 migration guide](https://support.kobotoolbox.org/migrating_api.html):
  permission assignments use API v2 asset, user and permission URLs.
- [Permission serializer](https://github.com/kobotoolbox/kpi/blob/main/kpi/serializers/v2/asset_permission_assignment.py):
  named user URL, permission URL, and individual permission assignment URL.
- [Permission view](https://github.com/kobotoolbox/kpi/blob/main/kpi/views/v2/asset_permission_assignment.py):
  unpaginated list, individual create/delete, manage-asset requirements, owner protection.
- [Asset serializer](https://github.com/kobotoolbox/kpi/blob/main/kpi/serializers/v2/asset.py):
  runtime assignable permission URLs, deployment status and effective permissions.

Backend requests:

1. GET `/api/v2/assets/{form_id}/`; require the manager capability and advertised
   `add_submissions` permission, and validate the returned asset identity.
2. GET `/api/v2/assets/{form_id}/permission-assignments/`.
3. Grant: POST missing `view_asset` and `add_submissions` assignments with the exact
   named `user` URL. Explicit View form supports project discovery on deployments
   that do not list forms from calculated collection permissions alone.
4. Revoke: DELETE only that user's direct `add_submissions` assignment URL, after
   checking the URL stays on the configured server and the exact asset path.
5. Re-read the permission list. Grant is verified when both explicit `view_asset`
   and `add_submissions` assignments are present for the exact named account.
   View form alone never verifies collection access. Revoke is confirmed only after direct collection
   permission is absent. Repeated requests are idempotent.

Unrelated permissions, including existing View form and submission viewing rights,
are preserved. Owner identities, AnonymousUser targets, anonymous collection and
collector accounts with direct Manage project access are refused for manual review.
Unsupported response shapes or deployments without the required advertised metadata
fail safely. Existing supported HTTPS host restrictions and disabled redirects apply.

These checks verify **direct API permissions at a timestamp**, not a successful
collector login or submission, or the absence of all inherited organization/group
access. Revoke affects that Kobo account/form wherever it is used, including another
FieldSight project mapped to the same form. Offline copies already downloaded to a
device are not removed. A real collector test remains useful before field deployment.

## State, retries and audit

`CollectorFormAccess` now stores `permission_username`, `last_checked_at`, `last_error`,
`operation_id` and `requested_action`. Provider-managed states are `pending`,
`verified_granted`, `failed` and `revoked`; manual reports remain distinct. Failed
requests never deactivate FieldSight membership. Errors exclude provider bodies and
credentials. Failed grant/revoke operations can be retried explicitly; Check access
reconciles uncertain results after timeouts, including a write that completed before
the response failed. No background permission worker or automatic recurring retries
were added.

An atomic operation claim prevents simultaneous requests. Claims older than two
minutes can be reconciled by a subsequent action. A superseded operation cannot
overwrite a newer result. Form/identity edits and removal are blocked during an active
operation. A tracked username cannot be replaced while its provider access is granted
or uncertain: revoke/check the old account first. The original target stays recorded
for reconciliation and revocation. Manual dropdown edits cannot forge verified state.
Existing organization admin events record request and result, actor, time, target
username and form-access resource. No production Kobo permissions were changed during
development or testing.

## Migration

From `fieldsight-backend`, run against the intended deployment database:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

New revision: `0032_kobo_collection_access`, after `0031_project_enumerators`. Upgrade
adds nullable reconciliation columns without modifying contacts, assignments, forms,
submissions, credentials or sync routing. It also tolerates the repository's baseline
creating current metadata. Downgrade refuses to remove recorded provider identities;
empty reconciliation data can be rolled back. Application/deployment databases were
not migrated in this task. No new environment variables are required. PostgreSQL
migration execution and a real authenticated Kobo deployment were not exercised.

## Changed files and verification

- `app/core/kobo_permissions.py`: bounded, authenticated provider requests and verification.
- `app/routes/project_enumerators.py`: tenant-scoped action endpoint, operation claims,
  identity preservation, audit and status/error responses.
- `app/models/operations.py` and migration `0032_kobo_collection_access.py`: persistent state.
- Frontend `apiClient.ts`, `ProjectEnumerators.tsx`, and its test: typed actions,
  confirmations, per-form status/errors and timestamps; no collector data-entry UI.
- `tests/test_kobo_permissions.py`: mocked provider contract, grant/check/revoke,
  idempotency, timeouts before/after writes, safe URLs, authorization, failed revocation,
  old mappings, in-flight conflicts and real migration shape/retention checks.

The expanded backend regression run passed **78 tests**, covering sharing, assignments,
migrations, existing Kobo sync, workspace and project action behavior. The subsequent
final sharing/migration/deletion run passed **27 tests**, including the additional
reconciliation migration test. The focused frontend regression run passed **27 tests** (including 7 enumerator
component tests). Targeted mypy and Ruff checks are run on the changed Python code;
the frontend is checked with TypeScript and a production build. Provider calls are
mocked in tests; live HTTP is blocked by the existing test fixture.

Backend command:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_kobo_permissions.py tests/test_project_enumerators.py tests/test_migrations.py tests/test_kobo_sync.py tests/test_project_actions.py tests/test_workspace.py --basetemp=../tmp/kobo-sharing-regression -q -o addopts=''
```

Frontend commands:

```powershell
npm test -- src/workspace/ProjectEnumerators.test.tsx src/workspace/WorkspaceShell.test.tsx src/services/apiClient.test.ts
npm run build
```

Existing Starlette/Alembic deprecation, Pydantic serialization and Vite bundle-size
warnings remain outside this feature's scope. Browser screenshots were not captured.
