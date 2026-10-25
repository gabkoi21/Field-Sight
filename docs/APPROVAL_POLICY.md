# Submission approval and evidence policy

An administrator's ready, invalid, or needs-review decision belongs to the exact
evidence they reviewed. Running automated validation stores independent findings
and a validation status; it does not replace a decision on unchanged evidence.
New submissions retain the existing automated validation workflow. When evidence
changes, the submission requires an explicit new administrator decision even if
automated checks subsequently pass. The previous decision, author, notes, time,
and evidence fingerprint remain in history. Rejected submissions follow the same
policy: changed evidence reopens review instead of silently carrying rejection
or approval forward.

## Fingerprint v1

SHA-256 of UTF-8 canonical JSON (sorted object keys, compact separators), prefixed
with `v1:`. All answer fields, nested groups, repeat order, zero, false, missing,
null, empty values, timestamps, collector, duration, location, geolocation,
attachments, and unknown provider fields participate. Types and array ordering
matter; object key ordering does not. No broad underscore-key exclusion is used.
Only top-level `_id`, `_uuid`, `_status`, `_tags`, `_notes`,
`_validation_status`, `_xform_id_string`, and `meta.instanceID` are ignored:
these identify/provider-route a record or describe provider-side workflow, rather
than the collected evidence. Unknown metadata is conservatively substantive.
Attachment metadata changes are conservatively substantive, including changed URLs.
Form identity remains part of the existing project/form/external-ID key.

Metadata-only sync updates stored raw provider data without reopening review or
adding review events. An identical second import writes no submission or review
event. Evidence changes, state changes, and fingerprints commit with imported
answers; any failed import rolls all of them back. Sync, validation and review
serialize on the same project write lock. The browser sends the evidence fingerprint
with its decision; stale evidence produces HTTP 409 and must be reloaded.

Automatic events have no human actor and name their source (`kobo_sync`,
`validation`, or `migration`). A user starting validation is not its reviewer.
Previous statuses, new statuses, reasons, timestamps and evidence versions are
stored in the event log. Existing validation events are reclassified as automatic
without deleting their notes.

## Legacy migration (0027_review_evidence)

Back up through the normal operational process, then run `alembic upgrade head`
before starting the updated API and worker. This task never migrates the user's
database. All existing submissions without recorded evidence fingerprints move
to needs-review with a migration event and queue finding. Their previous statuses
and history are retained; no past approval is claimed to verify current answers.
Revalidation cannot clear this migration hold. Administrators must review and
decide again. This intentionally reduces eligible reporting totals until review.
Downgrading removes fingerprint columns but does not restore legacy approvals;
export audit evidence before any production downgrade.

Only ready records contribute to indicator calculations and therefore analytical
dashboards and reports. Records held for new evidence are also excluded from
survey analysis even when an older saved analysis requests all statuses. Explicit
needs-review decisions are likewise excluded in every analysis filter. An explicit
invalid-record analysis filter remains available for diagnostic inspection; saved
dashboard widgets always enforce ready-only results.
Operational dashboards still count submissions and show review backlog, and raw
submission exports can deliberately include review statuses for audit purposes.
Historical exported reports are snapshots and are not rewritten retroactively.

## Verification and deployment

Root workflows verify backend lint, typing, tests and disposable migrations with
Python 3.12, plus npm lockfile install, frontend tests and build. Tests disable
real HTTP transport so provider requests must be mocked. Verification rejects
local environment files, uses test-only configuration and no production secrets.
Deployment calls verification for the same push SHA and depends on both jobs;
the existing FastAPI Cloud integration secret names are preserved.
