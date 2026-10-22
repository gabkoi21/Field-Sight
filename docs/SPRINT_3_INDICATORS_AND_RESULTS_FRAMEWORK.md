# Sprint 3: indicators, results framework and target comparisons

Implemented 2026-10-22, continuing the existing working changes on `codex/kobo-sync-reliability`.

## Delivered experience

The organization sidebar now has **Indicators**. Each project overview also links to Indicators and Monitoring. The workspace has three tabs inspired by the supplied UI references:

1. **Indicator register**: indicators grouped under their saved results framework, with format, collection frequency, target status, actual/target values and progress bars. Definitions can be created/edited and sources explicitly mapped.
2. **Results framework**: persisted goal/objective/outcome/output/activity nodes, parent-child connectors, edit/add-child controls and linked indicator counts. Indicators use the existing domain and can attach to any framework node. Cycles and cross-project links are rejected. Nodes with children or attached indicators cannot be deleted until those links are moved or removed.
3. **Results summary**: baseline, overall target/deadline, reporting-period targets and actuals, paired bar charts, numerator/denominator, missing/invalid answers, quality exclusions, location breakdown and source provenance. Future periods without usable records say Not reported.

FieldSight branding and the existing shell are retained. No proprietary assets were copied. Empty organizations/projects have setup states rather than fabricated metrics.

## Calculation changes

- Mapping asks for the **form**, **question**, **calculation**, and (when appropriate) **expected raw answer code**. The previous automatic Yes/average assumptions were removed.
- Existing operations remain count records, count matching, percentage matching, sum and average. Schema/choice validation rejects inappropriate numeric mappings, unsupported repeat/coordinate fields and unknown answer codes.
- Source form identity is persisted. Assigning a different Kobo form to the project does not move an existing indicator to the new source.
- Only `ready` submissions contribute to indicator results. Missing, invalid and quality-excluded records are reported separately.
- Multi-select strings and arrays use option matching; a repeated option in one submission counts once. Numeric zero remains valid; malformed/non-finite values do not become usable numeric answers.
- A sample percentage independently benchmarks at **2 matching / 3 answered = 66.67%**. A sample numeric question with values 10, 0, invalid and missing benchmarks at **sum 10 / average 5**, with denominator 2.
- Target achievement and schedule status are separate. Below target before the deadline is **In progress / not due**, not automatically late. Missing deadlines do not imply lateness. Direction is respected for decrease targets.
- Progress represents the fraction of the planned baseline-to-target change when that direction is defined; otherwise a meaningful target ratio is used when possible. Display bars are bounded, while the numeric progress may exceed 100%.
- Reporting buckets follow weekly ISO, monthly, quarterly, semi-annual or annual frequency. Period actuals are independently calculated; percentages are not summed or averaged across periods.
- **Period targets are explicit.** The overall target is not divided across periods. Changing frequency while period targets exist requires clearing those targets first.
- Date filters use UTC submission dates and do not prorate targets. Undated ready records remain eligible for overall calculations but are counted and excluded from dated period results. This explains why an overall percentage may differ from its dated period percentage.

## Backend and persistence

Main implementation:

- `fieldsight-backend/app/core/indicator_results.py`: deterministic calculations, denominators, deadline/achievement interpretation, period and location results.
- `fieldsight-backend/app/routes/indicators.py`: existing indicator CRUD/mapping routes plus framework and period-target operations, using the Sprint 2 field catalogue and existing authorization helpers.
- `fieldsight-backend/app/schemas/indicators.py`: additive result context, source form, framework and target contracts; finite numeric definitions and non-null required updates.
- `fieldsight-backend/app/models/operations.py`: existing Indicator/IndicatorMapping extended; ResultFrameworkNode and IndicatorPeriodTarget added.
- Alembic `0015_indicator_framework`: new tables and source/framework columns. Legacy source form backfill occurs only for a single observed form, or an assigned form when there are no observed submissions. Ambiguous legacy sources remain unmapped to a definite form and require explicit repair.

New routes:

| Route | Behavior |
| --- | --- |
| `GET/POST /projects/{id}/results-framework` | List/create project framework nodes |
| `PUT/DELETE /projects/{id}/results-framework/{node_id}` | Edit/delete an authorized node |
| `GET/PUT /indicators/{id}/period-targets` | Read/replace validated reporting-period targets |

Existing indicator list/detail routes accept optional `date_from` and `date_to`. Existing payloads remain accepted; `source_form_id` is optional on mapping input and resolved/persisted on save. Indicator-field responses now include types, choices, form IDs and supported status. The additional result status `in_progress` and frequency-based history labels replace the old assumption that every below-target result needs attention and every history point is daily. External clients should account for those expanded result semantics.

ProjectTarget and project intelligence contracts remain unchanged. No duplicate indicator domain or arbitrary formula/SQL builder was introduced.

## Frontend

- `IndicatorWorkspacePage.tsx`: register, grouped framework tree, results summary and navigation state.
- `IndicatorForms.tsx`: definition, explicit mapping, framework and period-target forms; modal focus entry, keyboard containment and Escape handling.
- `ProjectIndicatorsPage.tsx`: compatibility export for the new workspace.
- Typed API methods, `/indicators` and `/projects/{id}/indicators` routes, sidebar entry and project tabs.

## Verification

- Full backend suite: **106 passed**, including 29 new parameterized indicator/framework regression cases. Warnings concern the existing Starlette/Alembic deprecations.
- Frontend TypeScript/Vite production build: passed; existing bundle-size warning remains.
- Changed/new Sprint 3 Python modules pass Ruff. The new calculation service, indicator routes and indicator schemas pass focused mypy.
- Global mypy now reports **38 existing errors in eight other files**, down from the 41-error baseline; the previous indicator-route type errors were removed.
- Covered two benchmark indicators, multi-select deduplication, numeric zero/missing/invalid data, readiness exclusions, source-form stability, nested paths, dates, reporting frequencies, explicit targets, no-data/zero-target handling, ambiguous legacy provenance, framework cycles/deletion/link integrity, tenant and role restrictions, and populated SQLite migration upgrade/downgrade.
- Browser QA ran against a separate synthetic organization and disposable database. Verified register grouping, hierarchy rendering, mapping average 5 → sum 10 → average 5, a framework title edit, and persistence after reload.

Review images (synthetic data only):

- `fieldsight-frontend/outputs/sprint3-indicator-register.png`
- `fieldsight-frontend/outputs/sprint3-results-framework.png`
- `fieldsight-frontend/outputs/sprint3-results-summary.png`

## Local rollout

After validation, the local development SQLite database was backed up to `fieldsight-backend/fieldsight-before-indicators-20261022-051243.db` and upgraded from revision 0014 to 0015. The demo account was checked afterward: `org@gmail.com` remains an organization administrator with the requested password. No demo survey records or fake Kobo connections were inserted into the application database.

Restart the backend and frontend, sign in, then open **Indicators**. Choose/create a project, build its framework and define indicators. Connect/sync its real Kobo form or refresh its metadata before selecting source questions. Existing ambiguous legacy mappings show **Check source** until explicitly repaired.

No production deployment, provider deletion, email, commit or push was performed. QA servers are temporary and stopped after verification.

## Remaining work

Next single sprint is **Sprint 4: saved dashboard builder**, consuming the verified survey queries, saved visualizations and indicator results. Dashboard/widget persistence, arranging/resizing widgets and organization-aware sharing are not yet implemented. Reporting/export templates remain a later stage.

This slice does not add rich formulas, multiple source mappings per indicator, location-specific targets, public sharing or predictive analytics. Current calculations load stored project records into server memory; large deployments need aggregation/query optimization and background work. Numeric results are rounded to two decimal places. An overall target comparison for a filtered window remains a comparison to the original full target; the UI states that targets are not prorated.
