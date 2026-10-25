# Indicator calculation policy

The authenticated `/indicator-calculation-policy` endpoint is the compatibility matrix used by the setup forms and backend. Numeric sum/average mappings also require numeric fields. Count and matching methods accept supported scalar/select questions; repeat groups and geopoints remain unsupported.

| Unit | Linked methods | Manual methods |
| --- | --- | --- |
| Number | Count records, count matching, sum, average | Sum, unweighted mean, latest |
| Percentage | Matching percentage, average | Unweighted mean, pooled fraction, latest |
| Rate / ratio | Average | Unweighted mean, pooled fraction, latest |
| Currency / days | Sum, average | Sum, unweighted mean, latest |
| Text | None | Latest narrative |

Count records includes eligible submissions even when the selected answer is missing. Matching percentages divide matching observations by valid answered observations, counting a multi-select submission once. A numeric average gives each valid observation equal weight; it does not estimate a population-weighted fraction. Percentage averages use observations on the 0–100 scale. Sum never produces percentage units. Linked pooled fractions and advanced formulas are unsupported.

Manual sum adds observations; an unweighted mean gives every entry equal weight. Pooling divides total numerator by total denominator, multiplying by 100 for percentages, by the selected positive rate multiplier for rates, and by 1 for ratios. For example, 9/10 and 1/90 pool to 10%, whereas their unweighted percentage mean is 45.56%. Comparable populations and consistently defined components are the administrator's responsibility. Invalid/nonpositive denominators do not contribute; zero numerators remain real zero results. An empty population returns no data.

Latest observations sort by result date, creation timestamp, then UUID. Qualitative indicators use the latest dated narrative. Each reporting period and location is calculated independently. Manual and linked sources are never combined. Date filters affect actuals, not targets.

## Migration and historical interpretation

Apply Alembic revision `0028_indicator_reliability` through the normal release process after backup and disposable-database validation. This task does not migrate the user's existing database. The migration is additive: existing rows receive reliability policy 0 and definition version 0. Their calculations remain unchanged, and no original approvals or fabricated historical versions are created. New definitions use policy 1 and start as drafts; new manual evidence requires an explicit compatible method.

The previous definition, new definition, actor, timestamp, reason, effective scope and review preview are retained for observed material changes. Preview current data before confirming a change; submit its expected definition version to reject stale definition edits. Changes apply to the current calculation across all reporting periods. Stored previous definitions and previews describe what was observed at review time, **not a complete immutable snapshot of underlying source data**. Subsequent source corrections or review decisions can change recalculations. Retain the original definition when historical comparability matters; do not describe retrospective recalculations as originally approved results.

Legacy manual rows without fraction components are retained if the method is deliberately changed to pooling; they must be identified as missing components rather than invented denominators. Switching result sources retains manual evidence; only the currently selected source contributes. Before migration, review the preview and affected periods, and provide a reason. Configuration changes must never require deleting real evidence.

## Evidence

`/indicators/{id}/evidence` returns a bounded server-side page (maximum 100 records), scoped to the authenticated organization, project, form and reporting dates. Linked entries use the same review-eligibility and answer-calculation rules as actuals. It exposes only the mapped answer, not every answer in the project. Manual entries retain date, author ID, location, notes and fraction components. `/versions` is also tenant scoped and paginated. Version history does not freeze evidence freshness.

## Verification and remaining work

Use only disposable databases and synthetic records for verification. No live Kobo requests, deployment or production migration are part of this change. See the completion report for checks actually run and any remaining limitations; this document is policy, not a claim that all acceptance checks passed.
