# Sprint 1 — submission review

Restored integrated Submissions → review, using existing SubmissionEvidence and
collection routes rather than reviving a parallel Data Quality subsystem.
Table displays saved status, source/form, dates and evidence-change concerns.
Project/search/status filters use server pagination and reset offset on scope
changes. Overview review legend links now carry the corresponding status filter.

GET /submissions/{id}?history_offset=0 returns tenant-authorized evidence, quality
findings (up to 100), evidence fingerprint, latest review token, and paged history
(50 events, history_total). PATCH /submissions/{id}/review-status requires status,
evidence_fingerprint and expected_review_token; note is required for invalid and
needs_review. Missing tokens: 422; stale evidence or competing decision: 409.
Older API clients must fetch detail and send both tokens. The existing project
write lock serializes sync and reviews. Actor comes from authenticated identity;
UTC timestamps and old/new status persist in existing event records. No migration.

Current permission model remains organization administrator only. Enumerators
cannot use the review APIs. A dedicated project-officer/reviewer role remains a
future role-design decision; no collection permissions were broadened.

Checks: targeted backend first run 38 passed, one new fixture failed because of a
detached SQLAlchemy object; fixture corrected, both new tests pass (2 passed).
Existing evidence tests cover changed/metadata-only/idempotent sync and consistent
indicator/dashboard/PDF eligibility. Ruff and mypy pass. Frontend review/filter/
Overview integration: 22 passed across three files; SubmissionEvidence tests also
passed (4). Full backend regression and production build results recorded in final
implementation report. No live environment or participant acceptance claimed.

Manual check: open Submissions, choose project and Needs review; activate a record
ID using keyboard; expand all answers, select Ready or Invalid (reason required),
save, reload and inspect history. Repeat with two tabs: the older decision must
show a conflict and Reload evidence. Review a changed Kobo test record again;
confirm only eligible Ready records contribute to indicators and reports.
History paging preserves access to older events. Close review returns focus.

Final Sprint 1 verification: full backend 245 passed (223 warnings, 305.19s); frontend integration 22 passed; production build passed (31.00s). Ruff/mypy passed. Git diff whitespace check passed.
