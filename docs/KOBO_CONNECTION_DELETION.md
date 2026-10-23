# Kobo connection deletion

Connected accounts now has a red delete icon and a confirmation modal.
The existing organization administrator permission check and organization ownership checks apply.
`DELETE /kobo/connections/{connection_id}` returns 204 for unused connections, including unverified
connections, 404 for inaccessible IDs and 409 while a project references the connection.

Deletion removes the local connection and encrypted token. It does not call Kobo or delete forms,
submissions, imported records, projects, or indicators. Reassign linked projects before deleting.
Database foreign keys also guard concurrent project assignments.

Apply migration `0021_deleted_connections` with `python -m alembic upgrade head`.
Connections referenced by historical submissions or sync runs are hidden and their tokens erased,
while the reference row remains to preserve provenance. Unreferenced connections are removed.
Active project links still block deletion. No deployment configuration changes are required. Restart the local backend to load
the new endpoint if using the launcher without reload.

Tests: `tests/test_connection_deletion.py` and
`src/pages/organization/KoboConnectionsPage.test.tsx`.
