# Survey visualization and Pie support implementation report

Date: 2026-10-28. Branch: `dev`. No deployment or merge performed.

## Findings and root-cause evidence

The local Kobo schema maps `water_available` to “Is drinking water available today?”, with raw values `yes` / `no` and labels “Yes” / “No”. The stored ready submission has `water_available = yes`. A read-only SQLite connection, using the real catalogue and aggregation functions, returned:

| Response | Count | Percent of answered |
|---|---:|---:|
| Yes | 1 | 100% |
| No | 0 | 0% |

Answered/denominator: 1; missing: 0; invalid: 0.

The audit found no evidence of corrupted Kobo choice metadata or answer extraction for this question. The previous explorer and dashboard rendered a compound label from `point.name` (primary response) and `point.group` (optional disaggregation), whereas the table showed those dimensions in separate columns. The explorer also silently selected the first supported question, which can be Additional comments. Selecting water availability as a grouping dimension while comments remain the primary question reproduces a comment response with Group = Yes. This distinction explains the reported shape without changing stored answers.

The original interaction and request body were not persisted, so that exact historical selection cannot be proved. Regression fixtures reproduce the confusing dimension combination and confirm that selecting water as the actual response question never includes comments in its categories. Presentation now makes both dimensions explicit instead of treating Group as the response.

## Implementation

- Added an explicit **Response question** selector, alongside the existing question list. Choosing a question resets its calculation/grouping/category settings as before.
- Renamed the optional grouping selector to **Group responses by (optional)**. The result header identifies the response question and any grouping question.
- Added a shared `SurveyResultChart` renderer and `SurveyResultsTable` used by both Explore and saved dashboard widgets. Response/group labels now follow one contract; grouped chart labels explicitly say `Group:`.
- Categorical single-select and text questions offer Bar, Pie and Table. Dates retain Line; continuous numeric and overlapping multi-select/grouped distributions use appropriate Bar/Table options. Existing saved Donut charts remain supported rather than being rewritten.
- Pie uses actual API category counts and the API's answered-denominator percentages. Zero-count choices remain in the legend and exact data table but are excluded from slices. Known single-select choices with no responses are included as zero-count rows; no submission, indicator or denominator is invented.
- Tooltips show the full category, count and API percentage. Bar axes use concise labels; the exact table and label titles preserve full text. Long table values wrap.
- Pie legends show readable labels, counts and percentages. The chart stacks vertically on mobile and remains side by side with its legend on wider screens.
- Missing, invalid and numeric-zero handling remains the existing aggregation contract. Review, UTC dates, location, enumerator and category filters remain intact. Analysis authorization and project/form scoping were not relaxed.
- Project-context changes reset the prior question, grouping, calculation, chart selection and filter controls.

## Saved-dashboard compatibility

The saved analysis model already stores chart names in a string column. Added `pie` to the API and TypeScript chart unions, retaining `bar`, `line`, `donut` and `table`. No migration, table reset, saved-view rewrite or new dependency was needed.

Browser verification confirmed this complete workflow in an isolated test database:

1. Select the water question and Pie.
2. Save the visualization.
3. Create a dashboard; add a **Saved survey visualization** widget using the saved source.
4. Confirm Pie and its Yes/No values render in the widget.
5. Refresh the browser and confirm the saved widget still renders Pie.
6. Reopen the saved visualization in Explore and confirm Pie, response field and filters restore.

Existing tests cover dashboard period overrides, latest shared widget results, context changes and source authorization. Backend saved-type round trips cover Bar, Pie, Table and legacy Donut.

## Files changed for this request

- `fieldsight-backend/app/core/survey.py`: include known zero-response single-select choices without changing existing totals or denominator.
- `fieldsight-backend/app/schemas/analysis.py`: accept Pie in saved visualizations.
- `fieldsight-backend/app/routes/analysis.py`: serialize the backward-compatible chart union.
- `fieldsight-backend/tests/test_analysis.py`: WASH label regression, explicit dimension distinction, empty/zero choices and saved chart round trips.
- `fieldsight-frontend/src/components/charts/SurveyResultChart.tsx`: shared chart renderer, tooltip, legend, chart eligibility and exact-value table.
- `fieldsight-frontend/src/components/charts/SurveyResultChart.test.tsx`: category labels, zero slices, multiple categories, empty results, long labels, switching and legacy compatibility.
- `fieldsight-frontend/src/pages/organization/SurveyQuestionExplorer.tsx`: explicit source/group presentation and shared Bar/Pie/Table controls.
- `fieldsight-frontend/src/pages/organization/SurveyQuestionExplorer.test.tsx`: real explorer interactions, saved Pie query/filter selection and context reset.
- `fieldsight-frontend/src/services/apiClient.ts`: saved Pie type.
- `fieldsight-frontend/src/workspace/DashboardsPage.tsx`: shared saved-visualization rendering and exact accessible data table.
- `fieldsight-frontend/src/workspace/DashboardsPage.test.tsx`: complete analysis fixtures and updated accessible row-header assertions.
- This report.

Earlier uncommitted indicator-form and project-overview changes were preserved and are outside this request's file-change list.

## Verification results

| Check | Result |
|---|---|
| Complete frontend tests | 143 passed, 30 files |
| Complete backend tests | 272 passed |
| Focused backend survey analysis tests | 33 passed |
| Backend Ruff (`app tests`) | Passed |
| Backend mypy (`app`) | Passed, 52 source files |
| Frontend TypeScript / production build | Passed |
| `git diff --check` | Passed |
| Actual local WASH aggregate | Read-only: Yes 1 / 100%; No 0 / 0% |
| Real local browser | Desktop explorer Pie, mobile explorer and dashboard, saved source selection, saved-view reopen and dashboard refresh inspected |

Browser checks used a newly created disposable database under `tmp/survey-pie-uat-20261028.db`. Synthetic fixtures were confined to that test database; its external Kobo connections were disabled. No test rows were inserted into the selected development database. The temporary browser tab and verification servers were closed after inspection.

Evidence and logs are under `tmp/` (Git-ignored):

- `survey-pie-verification/explorer-desktop.jpg` (full-page chart/table capture)
- `survey-pie-verification/explorer-desktop-final.jpg`
- `survey-pie-verification/explorer-mobile.jpg`
- `survey-pie-verification/dashboard-mobile.jpg`
- `survey-pie-final-frontend-tests.txt`
- `survey-pie-full-backend-tests.txt`
- `survey-pie-production-build.txt`
- `survey-pie-ruff.txt` and `survey-pie-mypy.txt`

## Limitations and local use

- Pie is intentionally unavailable for continuous numbers/dates and overlapping multi-select/grouped distributions. Their existing calculations and useful chart types are retained.
- The existing 60-category chart guard remains; high-cardinality/free-text results can always be examined in the table. Very small fixed-height dashboard widgets may require expansion or the existing height control to view all details.
- No historical chart request was available to establish the original user's exact source/group selections; the data-path checks and reproduced case are described above.
- The build reports the existing large-bundle advisory. Backend tests report deprecation/serialization warnings, and the frontend's deliberate failed-chunk boundary test logs its expected error; all suites pass.
- Restart the local backend once to load the new saved-chart API literal, then refresh Explore. `python -m scripts.start_local` does not run with automatic backend reload.
- No existing Kobo submissions, indicator mappings or platform data were edited. No Kobo deletion APIs, deployment or merge into main were performed.

## Follow-up: previous controls layout restored

At the user's request, restored the three-column Calculation / Disaggregate by / Review status layout and removed the additional Response question dropdown. Primary question selection remains in the existing Survey questions list. The response/group chart caption, shared label handling, Pie support and saved-dashboard integration remain intact. All 7 targeted explorer/chart tests pass after this layout adjustment.

## Follow-up: categorical responses instead of comment labels

At the user's request, the explorer now defaults to the first supported single-choice question rather than the first alphabetically sorted free-text field. Free-text questions display in Table view, including when an older saved chart requested Bar/Pie/Donut for that text field; stored saved-view settings and submissions are retained. Categorical single-choice questions continue to support Bar/Pie/Table using their actual answer choices. All 9 targeted explorer/chart tests pass.

## Follow-up: project-scoped Explore and analyze

Removed Explore and analyze from both the live and startup general sidebar. Added it to the shared project-section tabs used by Details and activity and the explorer itself. Its canonical route is now `/projects/:projectId/analytics`.

The explorer takes its project from that route, checks that it belongs to the current administrator's accessible projects, and does not fall back to another project's questions for inaccessible IDs. Project changes remount the explorer state, avoiding requests that combine a new project with the old form/question/filter selection. Saved visualizations from a different project cannot be opened into the current project. Existing internal indicator, dashboard and data-table links now use project-scoped routes.

Old `/analytics?project_id=...` bookmarks redirect to the matching scoped route. Bare `/analytics` opens the project list instead of implicitly choosing a project. The backend's existing project/form/tenant authorization remains unchanged.

Verification: 34 focused navigation/scope tests passed; complete frontend suite 151 passed; TypeScript and production build passed. Browser verification on the disposable WASH and School Feeding projects confirmed the Details-tab entry, absence from the sidebar, project-specific URL and replacement of the question catalogue on project change. Screenshot: `tmp/survey-pie-verification/project-scoped-analysis.jpg`. Temporary verification services were stopped; no existing project records were changed.

## Follow-up: preserve Kobo form question sequence

The metadata parser already preserved Kobo's survey-array order, but `build_catalogue` subsequently sorted every field alphabetically. Removed that final sort for current-schema fields. Kobo's exact question sequence, labels, question types and choice sequence now take precedence, including nested field paths and questions without submitted responses. Historical fields absent from the current schema are retained afterward in a deterministic order; when Kobo metadata is unavailable, the previous deterministic fallback remains.

The explorer renders the catalogue in that order for both Survey questions and Disaggregate by (excluding the selected response question and unsupported grouping fields). Older stored fields are visibly separated from the current Kobo form in the question list and in a separately labelled dropdown option group. No answers, mappings or schema records were rewritten.

A read-only check against the actual local WASH project confirmed that all 15 cached Kobo questions match the catalogue's first 15 fields exactly. Five older stored fields remain separately labelled afterward. Verification passed: 35 analysis/backend tests, 1 indicator compatibility test, 7 explorer tests, Ruff, mypy (52 source files) and the frontend TypeScript/production build. Restart the backend to load this ordering change; Refresh Kobo fields retrieves the latest metadata if the Kobo form has since changed.

## Follow-up: categorical doughnut and table together

Single-choice question results now default to the doughnut renderer, labelled Doughnut in the chart controls, with the exact Yes/No category table below. Selecting a supported single-choice question under Disaggregate by while the main question is text promotes that chosen category to the actual response question and clears the narrative grouping. Older saved text-plus-single-choice configurations are normalized for viewing in the same way; their stored configuration is not rewritten. The analysis query is paused during this normalization so unrelated comment categories are not requested. Reporting dates and other filters are retained; stale response-category filters are cleared because the response question changed.

The reported comments / water-availability combination is covered by regression tests, including an older saved table view. The water distribution queries water_available directly, retains zero-count No in the table/legend, and does not put narrative comments into slices or table response rows. Generic text questions without a selected categorical dimension remain table-only.

Verification: complete frontend suite 155 passed; TypeScript/production build passed. Existing raw submissions, source mappings and saved visualizations were not modified.

## Follow-up: all Yes/No questions

Centralized the chart default by question type rather than any individual question name. Every supported single-choice Yes/No question opens its own doughnut with the exact response table. A read-only schema audit identified seven Yes/No questions in the current WASH form; one UI workflow regression selects each of the seven and checks the correct query source, doughnut selection and Yes/No table rows. All 18 targeted explorer/chart tests pass. No survey schema, submissions or calculations were changed.

## Follow-up: current assigned form only, no historical field list

The user's latest request supersedes the earlier labelled legacy-field section. Survey questions and Disaggregate by now exclude all fields not in the current project's assigned Kobo form schema; the Older stored fields section is removed. The form selector contains only that assigned form. These are generic rules for every project and future form, not a WASH-specific filter.

The backend catalogue has an explicit current-only mode, used by survey field lists, indicator field lists and analysis execution/export. It returns only the assigned form's cached Kobo schema, rejects historical form IDs, and never selects an old submission form when no form is assigned. Without schema metadata, it returns no questions instead of guessing fields from stored answers. The explorer loads missing metadata from the assigned Kobo connection and retains a working retry control if that request fails.

Saved-view lists exclude views tied to old forms or removed questions, without deleting them. Metadata refresh invalidates the saved-view list. Existing indicator result calculations retain their historical read behavior, so their saved mappings and historical evidence are not rewritten. No database migration or record deletion was performed.

A read-only check against the local WASH project returned one assigned form and exactly 15 questions, identical to that form's schema, with no older fields. Tests verify obsolete-field/group rejection, historical-form rejection, missing schema, no-assigned-form behavior, exclusion of older fields in the UI, metadata loading/retry and retention of stored submissions and historical saved views.

Verification: complete frontend suite 161 passed; final affected frontend module 13 passed; affected backend analysis/indicator/evidence modules 52 passed; Ruff and mypy passed. The broad backend run passed 276 tests and exposed one older evidence/dashboard fixture that lacked Kobo schema metadata; that fixture was updated to provide its current form schema and the whole affected module was retested successfully. The separately added no-assigned-form regression also passed. TypeScript/production build logs are `tmp/current-form-production-build-verified.txt`.

Restart the local backend and refresh the browser to apply the API changes. Use Refresh Kobo fields when the source form changes in Kobo. No real project data, submissions, indicator mappings or Kobo records were changed during this work.

## Follow-up: synchronize dropdown with the active question

At the user's request, the existing Disaggregate by control now selects the primary question for all supported question types, matching selection from the Survey questions list. The heading, controlled dropdown value, blue highlight, analysis query, chart and exact table all use the same selected source field. Selecting a new question clears the previous grouping and response-category filter and resets its calculation/chart defaults. The selected sidebar row is scrolled into view within the question list without scrolling the main page. Existing saved-view aggregation remains handled by its saved query until the user chooses a different primary question. All 15 explorer regression tests pass, including date-default to Yes/No selection.
