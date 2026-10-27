import type { apiClient, Indicator } from "../../services/apiClient";

export type SyncStatus = Awaited<ReturnType<typeof apiClient.syncSettings>>;
export type OverviewIssue = { id: string; title: string; detail: string; to: string; action: string };

// A future provider must supply a roster AND a schedule before computing completeness.
// No expected/missing counts are valid in the unavailable state.
export type ReportingCompleteness =
  | { state: "unavailable"; reason: string }
  | { state: "available"; rosterId: string; scheduleId: string; expected: number; received: number };

export const reportingCompleteness: ReportingCompleteness = {
  state: "unavailable",
  reason: "A school roster and reporting schedule are required before expected or missing reports can be calculated.",
};

export function indicatorLink(projectId: string, indicatorId: string) {
  return `/projects/${encodeURIComponent(projectId)}/indicators?view=results&indicator_id=${encodeURIComponent(indicatorId)}`;
}

export function overviewIssues({ projectId, connected, counts, sync, indicators, findings }: {
  projectId: string;
  connected: boolean;
  counts?: Record<string, number>;
  sync?: SyncStatus;
  indicators?: Indicator[];
  findings?: number;
}): OverviewIssue[] {
  const scope = `project_id=${encodeURIComponent(projectId)}`;
  const issues: OverviewIssue[] = [];
  if (!connected) issues.push({ id: "source", title: "No Kobo form connected", detail: "Connect a data source to collect project submissions.", to: `/forms?${scope}`, action: "Configure data source" });
  if (connected && sync?.latest_status === "failed") issues.push({ id: "sync", title: "Latest synchronization failed", detail: "Review the source connection and synchronization status, then retry.", to: `/forms?${scope}`, action: "Check synchronization" });
  else if (connected && sync && !sync.last_successful_sync) issues.push({ id: "first-sync", title: "No successful synchronization recorded", detail: sync.pending ? "A synchronization is queued. Check its progress." : "Check the source and synchronize the project.", to: `/forms?${scope}`, action: "Check synchronization" });
  for (const [status, title] of [["needs_review", "records awaiting review"], ["invalid", "invalid records excluded from default results"]]) {
    const count = counts?.[status] ?? 0;
    if (count) issues.push({ id: status, title: `${count} ${title}`, detail: "Open the filtered submissions to inspect the records.", to: `/submissions?${scope}&review=${status}`, action: "Review submissions" });
  }
  if (findings) issues.push({ id: "quality", title: `${findings} saved quality findings`, detail: "Findings reflect the last validation run and can overlap the review counts above.", to: `/quality?${scope}`, action: "Open data quality" });
  for (const item of indicators ?? []) {
    if (!item.is_active) continue;
    const to = indicatorLink(projectId, item.id);
    if (!item.setup_complete || item.result_source === "unconfigured") {
      issues.push({ id: `setup-${item.id}`, title: `${item.name}: setup needs attention`, detail: "Check the indicator definition and its source mapping or manual result method.", to, action: "Configure indicator" });
    } else if (item.schedule_status === "overdue") {
      issues.push({ id: `overdue-${item.id}`, title: `${item.name}: target overdue`, detail: `The configured target deadline was ${item.target_date}. Review the calculated result and target.`, to, action: "Review indicator" });
    }
  }
  return issues;
}
