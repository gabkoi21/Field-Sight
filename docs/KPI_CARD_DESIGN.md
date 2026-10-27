# Shared KPI card design

KPI cards use `components/ui/MetricCard.tsx`, matching the supplied Project Overview reference:

- Square white surface, 1px `#d8e0e9` border, no shadow or active/hover border treatment.
- Minimum height 120px, 20px padding, 16px gap.
- Left-aligned label and 28px semibold value with tabular numbers.
- Right-aligned 44px pale tile (`#f0f6f8`) and 21px icon (`#4f8491`).
- Native links/buttons retain their destinations/actions and keyboard focus indication.
- Supplemental descriptions remain accessible and plain-text descriptions are also tooltips;
  they no longer add a permanent extra text row. Dates may use a smaller value style.
- Loading skeletons match the card geometry. Long values can wrap rather than truncate.

Audit/migration coverage:

| Area | Implementation |
| --- | --- |
| Project Overview | Existing OverviewMetric delegates to MetricCard |
| Organization / platform overviews | Existing MetricCard consumers inherit the design |
| Field Team | Three inline metric cards migrated |
| Submissions | All-submissions card migrated |
| Indicators | Register summary, result summary, and response-count cards migrated |
| Explore & analyze | Survey result counts migrated |
| Legacy Analysis | Local Metric wrapper delegates to MetricCard |
| Project dashboards | Indicator-value widgets use MetricCard |
| Super-admin organization/users/billing/health/audit pages | AdminMetric delegates to MetricCard |

Charts, tables, project metadata, and progress/detail panels are not reclassified as KPI cards.
Existing data sources, calculations, labels, permissions, links, exports, and actions are preserved.
No backend, database, dependency, or deployment changes are included.

Verification: all 109 frontend tests passed across 22 files, including shared-card navigation,
action, zero-value, and status-value regressions. Production build/TypeScript passed. Vite retains
its large-chunk advisory. Review was a source audit and automated verification; no live-browser
visual acceptance pass is claimed.
