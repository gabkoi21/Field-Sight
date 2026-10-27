# Data Quality feature removal

The dedicated Data Quality feature and the review UI on Submissions have been removed.

Removed:

- Data Quality sidebar entry, frontend page, lazy route, loading fallback, client methods/types,
  associated frontend feature tests, and links from data tables and the guide.
- Dedicated backend quality router, queue/detail/reviewer/note endpoints, validation rules,
  validation-run endpoint, and findings-list endpoint.
- Submissions review column, badges, filter, review-specific counters, quality action,
  detail-panel review history, and review-action buttons.
- Unused overview quality polling/attention code. Overview chart links now open the project
  submissions without passing an unsupported review filter.

Old `/quality` frontend URLs fall back to Projects. Old backend `/quality/*` endpoints and
the dedicated reviewer/note/detail endpoints return 404 and are absent from OpenAPI.

Retained intentionally:

- Existing submission eligibility rules, stored decision/evidence fields, audit history,
  and the organization-admin status API used by existing sync/integration regression tests.
  These are shared calculation/integrity code, not the removed Data Quality page.
- Historical migrations and database tables/records, including legacy findings. This change
  performs no data deletion or automatic approval and makes no production database changes.
- Indicator exclusion counts and export/reporting semantics. Previously ineligible records
  do not silently become reportable just because their review UI was removed.

Tests check that retired endpoints and navigation are absent, the Submissions review UI is
absent, and saved decisions, sync evidence changes, calculations, authentication, tenant
isolation, pagination, and exports continue to behave consistently.

Verification: 243 backend tests passed; the full frontend run passed 103 tests, and the
additional route/sidebar/submissions run passed 10 tests after adding the retired-route
regression. Backend type checking passed for 51 files. Changed backend files pass Ruff.
The final production build passed, including removal of the project tab bar from
Explore & analyze. Vite retains its large-chunk advisory. No deployment was performed.
