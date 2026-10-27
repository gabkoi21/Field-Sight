import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useParams } from "react-router-dom";
import { ArrowRight, Building2, Clock3, Database, FileCheck2, RefreshCw, Target } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge, Button, LoadingState, MetricCard } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, type Indicator } from "../../services/apiClient";
import { indicatorLink, overviewIssues, reportingCompleteness } from "./projectOverview";

const linkClass = "inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand underline underline-offset-2";
const formatNumber = (number: number) => number.toLocaleString(undefined, { maximumFractionDigits: 2 });
function resultValue(item: Indicator) {
  if (item.unit === "text") return item.qualitative_value || "Awaiting data";
  if (item.current_value === null) return "Awaiting data";
  return `${formatNumber(item.current_value)}${item.unit === "percentage" ? "%" : ""}`;
}
function timestamp(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC" : "Not recorded";
}

export function ProjectWorkspacePage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const cache = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const organizationId = user?.memberships.find(member => member.role === "organization_admin")?.organization_id;
  const enabled = Boolean(!authLoading && organizationId && projectId);
  const scope = `project_id=${encodeURIComponent(projectId)}`;
  const [syncMessage, setSyncMessage] = useState<{ projectId: string; text: string } | null>(null);
  const projectQuery = useQuery({
    queryKey: ["project", organizationId, projectId],
    queryFn: () => apiClient.getProject(organizationId!, projectId), enabled,
  });
  // Child requests wait for the authorized project. No organization-wide raw data fetch.
  const authorized = enabled && projectQuery.isSuccess;
  const submissionsQuery = useQuery({
    queryKey: ["project-overview", organizationId, projectId, "submissions"],
    queryFn: () => apiClient.submissionPage(new URLSearchParams({ project_id: projectId, limit: "5" })), enabled: authorized,
  });
  const syncQuery = useQuery({
    queryKey: ["project-overview", organizationId, projectId, "sync"],
    queryFn: () => apiClient.syncSettings(projectId), enabled: authorized, refetchInterval: 15000,
  });
  const indicatorsQuery = useQuery({
    queryKey: ["indicators", projectId, "overview", organizationId],
    queryFn: () => apiClient.indicators(projectId), enabled: authorized,
  });
  const qualityQuery = useQuery({
    queryKey: ["quality-issues", organizationId, projectId, "overview"],
    queryFn: () => apiClient.qualityQueue(new URLSearchParams({ project_id: projectId, limit: "1" })), enabled: authorized,
  });
  const syncMutation = useMutation({
    mutationFn: (id: string) => apiClient.syncProjectKoboForm(id),
    onSuccess: async (result, id) => {
      setSyncMessage({ projectId: id, text: `Sync complete: ${result.received} received, ${result.created} new, ${result.updated} updated.` });
      await Promise.all(["project-overview", "submissions", "sync-settings", "sync-runs", "kobo-pending-sync", "indicators", "quality-issues", "dashboard-widget"].map(key => cache.invalidateQueries({ queryKey: [key] })));
    },
  });
  const refresh = () => Promise.all([projectQuery.refetch(), submissionsQuery.refetch(), syncQuery.refetch(), indicatorsQuery.refetch(), qualityQuery.refetch()]);

  if (authLoading || (enabled && projectQuery.isPending)) return <LoadingState variant="page" label="Loading project…" />;
  if (!organizationId) return <div role="alert">An active organization administrator membership is required to view this project.</div>;
  if (projectQuery.error || !projectQuery.data) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Unable to load project. <Button variant="secondary" onClick={() => void projectQuery.refetch()}>Retry project</Button></div>;
  const project = projectQuery.data;
  const connected = Boolean(project.kobo_connection_id && project.kobo_form_id);
  const activeIndicators = indicatorsQuery.data?.filter(item => item.is_active);
  const issues = overviewIssues({ projectId, connected, counts: submissionsQuery.data?.counts, sync: syncQuery.data, indicators: indicatorsQuery.data, findings: qualityQuery.data?.total });
  const attentionLoading = [submissionsQuery, syncQuery, indicatorsQuery, qualityQuery].some(query => query.isPending);
  const attentionError = [submissionsQuery, syncQuery, indicatorsQuery, qualityQuery].some(query => query.isError);

  return <div className="flex flex-col gap-5 pb-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <NavLink to="/projects" className={linkClass}>All projects</NavLink>
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand" aria-hidden="true"><Building2 size={22} /></span>
          <div><h1 className="m-0 text-2xl font-bold text-[var(--fs-text)]">{project.name}</h1><p className="mb-0 mt-1 text-sm text-[var(--fs-muted)]">Project overview</p></div>
          <Badge value={project.status} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void refresh()}><RefreshCw size={15} aria-hidden="true" />Refresh overview</Button>
        <Button disabled={!connected || project.status === "archived" || syncMutation.isPending} onClick={() => { setSyncMessage(null); syncMutation.mutate(projectId); }}><RefreshCw size={15} aria-hidden="true" />{syncMutation.isPending ? "Syncing…" : "Sync data"}</Button>
      </div>
    </header>
    {syncMessage?.projectId === projectId && <p role="status" className="m-0 text-sm text-[var(--fs-success)]">{syncMessage.text}</p>}
    {syncMutation.error && syncMutation.variables === projectId && <p role="alert" className="m-0 text-sm text-[var(--fs-danger)]">Synchronization failed. Check the source connection and try again.</p>}
    <nav aria-label="Project sections" className="flex flex-wrap gap-x-5 border-b border-[var(--fs-border)]">
      <span aria-current="page" className="min-h-11 border-b-2 border-brand py-3 text-sm font-semibold text-brand">Overview</span>
      <NavLink className={linkClass} to={`/projects/${projectId}/indicators`}>Indicators</NavLink>
      <NavLink className={linkClass} to={`/dashboards?${scope}`}>Dashboards</NavLink>
      <NavLink className={linkClass} to={`/analytics?${scope}`}>Analytics</NavLink>
      <NavLink className={linkClass} to={`/reports?${scope}`}>Reports</NavLink>
    </nav>

    <section aria-labelledby="collection-heading">
      <h2 id="collection-heading" className="mb-1 mt-0 text-lg font-semibold">Data collection</h2>
      <p className="mb-4 mt-0 text-sm text-[var(--fs-muted)]">All saved project records, including records awaiting review. These counts are operational, not approved M&E results.</p>
      {submissionsQuery.isPending ? <LoadingState variant="panel" label="Loading collection counts…" /> : submissionsQuery.error ? <LoadError label="collection counts" retry={() => void submissionsQuery.refetch()} /> : <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Submitted records" value={submissionsQuery.data!.total} icon={Database} context={<NavLink to={`/submissions?${scope}`} className={linkClass}>View submissions</NavLink>} />
        <MetricCard label="Awaiting review" value={submissionsQuery.data!.counts.needs_review ?? 0} icon={Clock3} context={<NavLink to={`/submissions?${scope}&review=needs_review`} className={linkClass}>Review records</NavLink>} />
        <MetricCard label="Ready records" value={submissionsQuery.data!.counts.ready ?? 0} icon={FileCheck2} context="Ready is a data-review status, not result approval." />
      </div>}
      <Card className="mt-3 p-4">
        <h3 className="m-0 text-sm font-semibold">Latest successful synchronization</h3>
        {syncQuery.isPending ? <p role="status">Loading synchronization status…</p> : syncQuery.error ? <LoadError label="synchronization status" retry={() => void syncQuery.refetch()} /> : <p className="mb-0 mt-2 text-sm text-[var(--fs-muted)]"><time>{timestamp(syncQuery.data?.last_successful_sync)}</time>{syncQuery.data?.pending ? " · Synchronization queued" : ""}</p>}
        {!connected && <p className="mb-0 mt-2 text-sm">No Kobo data source is configured. <NavLink className={linkClass} to={`/forms?${scope}`}>Connect a data source</NavLink></p>}
        {connected && submissionsQuery.data?.total === 0 && <p className="mb-0 mt-2 text-sm">No submissions saved yet. Synchronize the connected form to load records.</p>}
      </Card>
    </section>

    <section aria-labelledby="attention-heading">
      <Card>
        <CardHeader title={<span id="attention-heading">Needs Your Attention</span>} subtitle="Actions based on saved project data and configured indicator rules." />
        <div className="p-5">
          {attentionLoading && <LoadingState variant="inline" label="Checking project issues…" />}
          {attentionError && <LoadError label="some attention checks" retry={() => void refresh()} />}
          {issues.length > 0 && <ul className="m-0 list-none divide-y divide-[var(--fs-border)] p-0">{issues.map(issue => <li key={issue.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><h3 className="m-0 text-sm font-semibold">{issue.title}</h3><p className="mb-0 mt-1 text-sm text-[var(--fs-muted)]">{issue.detail}</p></div><NavLink to={issue.to} className={linkClass} aria-label={`${issue.action}: ${issue.title}`}>{issue.action}<ArrowRight size={14} aria-hidden="true" /></NavLink></li>)}</ul>}
          {!attentionLoading && !attentionError && !issues.length && <p className="m-0 text-sm text-[var(--fs-muted)]">No actionable issues found in the loaded checks. Saved quality findings reflect the last validation run.</p>}
        </div>
      </Card>
    </section>

    <section aria-labelledby="results-heading">
      <h2 id="results-heading" className="mb-1 mt-0 text-lg font-semibold">Configured M&E results</h2>
      <p className="mb-4 mt-0 text-sm text-[var(--fs-muted)]">All dates. Current calculations use each indicator's saved definition and eligibility rules. These are not frozen, approved reporting results.</p>
      {indicatorsQuery.isPending ? <LoadingState variant="panel" label="Loading indicator results…" /> : indicatorsQuery.error ? <LoadError label="indicator results" retry={() => void indicatorsQuery.refetch()} /> : !activeIndicators?.length ? <Card className="p-5"><h3 className="m-0 text-base font-semibold">No active indicators configured</h3><p className="mb-0 mt-2 text-sm text-[var(--fs-muted)]">Configure indicators and their data sources to show project performance here.</p><NavLink to={`/projects/${projectId}/indicators`} className={linkClass}>Configure indicators</NavLink></Card> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{activeIndicators.map(item => <MetricCard key={item.id} label={item.name} value={resultValue(item)} icon={Target} context={<><span className="block">{item.result_source === "manual" ? "Manual results" : item.result_source === "table" ? "Linked source data" : "Source not configured"}{item.target_value !== null ? ` · Target: ${formatNumber(item.target_value)}${item.unit === "percentage" ? "%" : ""}` : " · No target set"}</span><span className="mt-1 block">{item.quality_excluded_records} excluded by data review</span><NavLink to={indicatorLink(projectId, item.id)} className={linkClass}>View {item.name}</NavLink></>} />)}</div>}
    </section>

    <Card className="p-5">
      <h2 className="m-0 text-lg font-semibold">School reporting completeness</h2>
      <p className="mb-0 mt-2 text-sm text-[var(--fs-muted)]">Not available. {reportingCompleteness.state === "unavailable" ? reportingCompleteness.reason : ""}</p>
    </Card>
  </div>;
}

function LoadError({ label, retry }: { label: string; retry: () => void }) {
  return <div role="alert" className="mb-3 text-sm text-[var(--fs-danger)]">Unable to load {label}. <button type="button" onClick={retry} className="min-h-11 px-2 font-semibold underline">Retry {label}</button></div>;
}
