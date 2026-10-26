# Indicator evidence and preview verification — 26 October 2026

## Contribution policy

Evidence responses remain server-paginated. Contribution decisions use the entire requested date/period/location scope before selecting a page. Excluded and superseded rows remain inspectable.

- Latest manual observations use the calculation service's ordering: result date, creation time, UUID. Only the selected valid row contributes. Overall, period, and location selections are independent.
- Pooled validation is shared by calculations and evidence: missing numerator/denominator is `missing_components`; nonnumeric or invalid fractions are `invalid_components`. Zero numerators are valid. No observations produce no data, rather than zero.
- Linked evidence uses the authoritative calculator's single-record validation and mapping health. Review exclusions take precedence. Eligible count-records rows contribute without requiring a selected answer.
- Responses include scope-wide contribution/superseded counts, actual, numerator, and denominator. Manual author names supplement retained author IDs.

## Preview contract

Definition, mapping, mapping removal, and period-target previews issue a server HMAC token over the material evidence/configuration state and proposed definition. Confirmations with evidence require a reason, expected definition version, and matching token. A client timestamp or arbitrary fingerprint grants no authority.

The snapshot covers project submissions and their answers, dates, locations and review eligibility; this indicator's manual entries; definition and mapping configuration; period targets; and material question metadata. It deliberately conservatively includes all project submissions and retained manual entries, including dormant sources. Relevant changes can therefore invalidate a preview even when the aggregate value is unchanged.

Provider transport keys excluded by the existing review policy (`_tags`, `_notes`, `_validation_status`, etc.), schema refresh/version timestamps and display labels do not invalidate previews. Question types, supported status and choice codes remain material. Definition history records the accepted preview digest and before/after calculation; it does not freeze source data.

A stale save returns 409. The frontend refreshes before/after results, retains the entered reason, clears confirmation, and requires another confirmation. Mapping removal has its own preview endpoint.

SQLite reserves the writer before reading state (`BEGIN IMMEDIATE`). PostgreSQL locks definition/source tables through validation and save, protecting against inserted rows as well as updates/deletes. Definition and version history commit together. Initial configuration without results retains the existing policy allowing direct setup; supplied confirmations are still checked.

No schema changes or Alembic migration are required.

## Verification

- Complete backend suite: 239 passed. Final run recorded in `tmp/indicator-backend-release.log`.
- Complete frontend suite: 88 passed (20 files), using `npm test -- --maxWorkers=2`.
- Backend Ruff and mypy: passed (52 application files).
- Frontend production build: passed; Vite reports the existing large-bundle warning.
- Regression coverage includes latest ordering/scopes/pages, pooled invalid/missing/zero data, linked review/count-records behavior, evidence/definition/manual changes, forged tokens and changed proposals, concurrent confirmations, atomic rollback, tenant denial, mapping removal/targets, metadata policy, stale frontend refresh and renewed confirmation, readable evidence states, loading/error/retry/empty states.

## Isolated browser walkthrough

Used a new database only at `tmp/indicator-browser-isolated-20261026/sync.db`, a synthetic organization administrator, stored synthetic submissions and mocked provider responses. Authentication was unchanged. No existing user records or live destructive Kobo calls were used.

Verified draft creation; explicit latest method selection; manual entries; 80 contributing with 20 superseded; a material target preview; a synthetic correction from 80 to 90 after preview; stale save rejection; automatic refreshed actual 90 with disabled confirmation and retained reason; renewed confirmation and persistence after reload; recorded definition history; pooled (9 + 1)/(10 + 90) = 10%; compatible linked score mapping and actual 100; review exclusion changing linked actual to 80 with excluded evidence retained.

At 390×844, evidence text and controls wrapped without document overflow (document width 375, viewport 390). Shift+Tab reached Collected data from Evidence & versions, and Enter activated Indicator details. Screenshot: `tmp/indicator-browser-narrow.png`.

Development hot reloads interrupted dialogs during concurrent workspace edits; the remaining walkthrough used a frozen production build. Evidence/manual tools use a separate toolbar to preserve the existing source/details navigation. Browser date fields retained the default date during automation; distinct-date and date-scope behavior was independently covered by backend tests.

## Limits

PostgreSQL locking was implemented but no PostgreSQL instance was available for runtime verification. Locks are deliberately broad and may serialize source writers during preview/save. Scope-wide classification/state hashing reads relevant project evidence in memory; response pagination is bounded, but very large projects may warrant optimized database selection/hashing. Existing serializer/deprecation warnings and Vite's bundle warning remain.
