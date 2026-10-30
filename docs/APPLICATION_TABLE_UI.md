# Shared application table UI

All 23 table declarations under `fieldsight-frontend/src` now opt into `fs-data-table`. The shared React `Table` component also applies the class automatically. The stylesheet is imported once by `main.tsx` from `components/ui/table.css`; Super Admin uses the same styling rather than a separate table implementation.

The shared presentation uses 13px text, 8px vertical / 10px horizontal cell padding, compact rows, light gray sticky column headers, thin grid borders, and rounded scroll containers. Existing numeric alignment, column widths, wrapping, status colors, grouped indicator rows, filters, pagination, sorting, and actions retain their behavior. Small-screen interactive controls retain 44px touch targets. Screen-only styling preserves existing report print layouts and screen-reader chart alternatives.

Coverage includes:

- Super Admin organization directory, users, sectors, and audit log.
- Organization project register and project history.
- Submission lists and review links.
- Field operations, enumerators, team membership, and invitations.
- Data tables, collected records, indicators, indicator periods, targets, and result details.
- Project action registers and report tables.
- Organization dashboard summaries and survey-analysis tables, including dashboard widgets.
- Shared `Table` and `DataTable` primitives and hidden accessible chart data.

Tables keep their existing data and interaction contracts. Existing scroll wrappers receive the shared border and bounded scrolling when they directly contain a styled table; the indicator register retains its dedicated viewport height. Data tables do not gain sorting or pagination controls unless the screen already supports those operations.

Verification:

- Source inventory: all 23 table declarations have the shared style class; no unstyled declaration remains.
- Production build: passed, with the existing bundle-size advisory.
- Full frontend test run: 191 passed, 4 failed out of 195. Three failures were stale navigation expectations from earlier account-menu/sidebar changes, and one indicator mapping test exceeded the 5-second timeout during the parallel run.
- After updating the stale navigation expectations, all three affected test modules passed sequentially: 10 passed, using a 15-second timeout. This covers all 195 tests across the full run and targeted rerun; a second complete run was not performed.
- `git diff --check`: no whitespace errors.

Execution logs: `outputs/application-tables-build.log`, `outputs/application-tables-tests.log`, and `outputs/application-tables-retest.log`.

Browser visual verification was unavailable in this session because Computer Use could not reliably identify the Windows browser URL earlier in the conversation.
