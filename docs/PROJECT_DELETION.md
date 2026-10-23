# Project deletion

Organization administrators can open a project’s Actions menu, choose Delete in Update Project,
and confirm by typing its saved name. Cancellation sends no deletion request; errors remain in the modal.

Deletion removes dashboards/widgets, saved analyses, cached survey metadata, indicators/mappings,
period targets, collected results, framework groups, project targets, imported submissions/field mappings,
team assignments and synchronization settings/jobs/history. Shared organization users, locations, sectors
and Kobo connection credentials remain. No schema migration is required.

The existing endpoint also deletes the connected form and its submissions from KoboToolbox.
The confirmation explicitly warns about this. Another FieldSight project using the same form on the
same Kobo server blocks deletion. Kobo failures stop local cleanup. Local cleanup runs in one transaction;
if it fails after Kobo deletion, the remote deletion cannot be rolled back. Retry completes local cleanup
(the Kobo connector treats an already-missing form as deleted).

No production data is deleted by these changes or their tests. Tests mock remote Kobo deletion and use
isolated SQLite databases, with foreign keys enabled for the graph cleanup regression.

Local checks:

- Backend: `.\.venv\Scripts\python.exe -m pytest tests/test_project_deletion.py tests/test_automatic_sync.py`
- Frontend: `npm test -- --run src/workspace/WorkspacesPage.test.tsx`
- Build: `npm run build`

Restart the local backend to load endpoint changes if it was launched without reload.

Projects with a saved form reference but no Kobo connection can be deleted locally. The confirmation
explains that remote forms and submissions remain; no provider request is attempted.
