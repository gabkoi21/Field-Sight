import { ProjectTimeline } from "../../workspace/ProjectTimeline";
import { ProjectCompletionChart } from "../../workspace/ProjectCompletionChart";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, ChevronDown,
  CircleAlert, Clock3, Database, Link2, MapPin, Users,
  Pencil, RefreshCw, Target, type LucideIcon,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button, LoadingSkeleton, LoadingState, MetricCard } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, type ApiProject } from "../../services/apiClient";
import { reportingCompleteness } from "./projectOverview";
import { CollectionTrend, ReviewBreakdown, type TrendPeriod } from "./ProjectOverviewCharts";

const textLink = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--fs-primary)] hover:underline";
const secondaryLink = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--fs-control-border)] bg-[var(--fs-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--fs-text)] transition-colors hover:border-[var(--fs-primary)] hover:bg-blue-50";
const muted = "text-[var(--fs-muted)]";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "Not set" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}
function timestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not recorded" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(parsed) + " UTC";
}
function locationLabel(project: ApiProject) {
  return project.workspace_details?.countries?.filter(Boolean).join(", ") || project.country || "Location not set";
}
function Status({ value }: { value: string }) {
  const tone = value === "active" || value === "completed" ? "text-[var(--fs-success)] bg-emerald-50" : "text-[var(--fs-muted)] bg-[var(--fs-canvas)]";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{value.replaceAll("_", " ")}</span>;
}

export function ProjectWorkspacePage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const cache = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const organizationId = user?.memberships.find(member => member.role === "organization_admin")?.organization_id;
  const enabled = Boolean(!authLoading && organizationId && projectId);
  const scope = `project_id=${encodeURIComponent(projectId)}`;
  const [syncMessage, setSyncMessage] = useState<{ projectId: string; text: string } | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("30d");
  const projectQuery = useQuery({
    queryKey: ["project", organizationId, projectId],
    queryFn: () => apiClient.getProject(organizationId!, projectId), enabled,
  });
  // Metadata authorizes every project-scoped child request before it can run.
  const authorized = enabled && projectQuery.isSuccess;
  const trendQuery = useQuery({
    queryKey: ["project-overview", organizationId, projectId, "trend", trendPeriod],
    queryFn: () => apiClient.analyticsOverview({ projectId, period: trendPeriod }), enabled: authorized,
  });
  const submissionsQuery = useQuery({
    queryKey: ["project-overview", organizationId, projectId, "submissions"],
    queryFn: () => apiClient.submissionPage(new URLSearchParams({ project_id: projectId, limit: "5" })), enabled: authorized,
  });
  const syncQuery = useQuery({
    queryKey: ["project-overview", organizationId, projectId, "sync"],
    queryFn: () => apiClient.syncSettings(projectId), enabled: authorized, meta: { backgroundRefresh: true }, refetchInterval: 15000,
  });
  const indicatorsQuery = useQuery({
    queryKey: ["indicators", projectId, "overview", organizationId],
    queryFn: () => apiClient.indicators(projectId), enabled: authorized,
  });
  const teamQuery = useQuery({
    queryKey: ["project-team", organizationId, projectId],
    queryFn: () => apiClient.projectTeam(projectId), enabled: authorized,
  });
  const hasSector = authorized && Boolean(projectQuery.data?.organization_sector_id);
  const organizationSectors = useQuery({
    queryKey: ["organization-sectors", organizationId],
    queryFn: () => apiClient.organizationSectors(organizationId!), enabled: hasSector,
  });
  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => apiClient.sectors(), enabled: hasSector, staleTime: 300000 });
  const sectorId = organizationSectors.data?.find(item => item.id === projectQuery.data?.organization_sector_id)?.sector_id;
  const sectorName = sectors.data?.find(item => item.id === sectorId)?.name;
  const sectorError = organizationSectors.isError || sectors.isError;
  const sectorLabel = sectorName || (sectorError ? "Sector unavailable" : hasSector && (organizationSectors.isPending || sectors.isPending) ? "Loading sector…" : "Sector not set");
  const syncMutation = useMutation({
    mutationFn: (id: string) => apiClient.syncProjectKoboForm(id),
    onSuccess: async (result, id) => {
      setSyncMessage({ projectId: id, text: `Sync complete: ${result.received} received, ${result.created} new, ${result.updated} updated.` });
      await Promise.all(["project-overview", "submissions", "sync-settings", "sync-runs", "kobo-pending-sync", "indicators", "dashboard-widget"].map(key => cache.invalidateQueries({ queryKey: [key] })));
    },
  });
  const refresh = () => Promise.all([
    projectQuery.refetch(), submissionsQuery.refetch(), syncQuery.refetch(), indicatorsQuery.refetch(), trendQuery.refetch(), teamQuery.refetch(),
    ...(hasSector ? [organizationSectors.refetch(), sectors.refetch()] : []),
  ]);

  if (authLoading || (enabled && projectQuery.isPending)) return <div className="space-y-6"><LoadingState variant="inline" label="Loading project…" /><LoadingSkeleton layout="metrics" metricCount={4} label="Loading project summary…" announce={false} /></div>;
  if (!organizationId) return <Card className="p-6"><p role="alert">An active organization administrator membership is required to view this project.</p><NavLink to="/projects" className={textLink}>Back to projects</NavLink></Card>;
  if (projectQuery.error || !projectQuery.data) return <Card className="p-6"><div role="alert"><h1 className="m-0 text-xl font-semibold">Project unavailable</h1><p className={muted}>The project could not be loaded. Try again or return to your projects.</p><div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => void projectQuery.refetch()}>Retry project</Button><NavLink to="/projects" className={textLink}>Back to projects</NavLink></div></div></Card>;
  const project = projectQuery.data;
  const connected = Boolean(project.kobo_connection_id && project.kobo_form_id);
  const enumeratorCount = new Set((teamQuery.data ?? [])
    .filter(member => member.is_active && member.role === "enumerator")
    .map(member => member.user_id)).size;
  const activeIndicators = indicatorsQuery.data?.filter(item => item.is_active);


  return <div className="mx-auto flex max-w-[1440px] flex-col gap-5 pb-6 text-[var(--fs-text)]">
    <header className="space-y-3">
      <NavLink to="/projects" className={`inline-flex min-h-11 items-center gap-2 text-sm ${muted} hover:text-[var(--fs-primary)]`}><ArrowLeft size={15} aria-hidden="true" />Projects</NavLink>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="hidden size-14 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-[var(--fs-primary)] sm:grid" aria-hidden="true"><Building2 size={25} strokeWidth={1.6} /></span>
          <div className="min-w-0 space-y-2">
            {project.workspace_details?.code && <p className={`m-0 text-xs font-medium tracking-wide ${muted}`}>{project.workspace_details.code}</p>}
            <div className="flex flex-wrap items-center gap-3"><h1 className="m-0 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{project.name}</h1></div>
            <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${muted}`}>
              <span className="inline-flex items-center gap-1.5"><Building2 size={14} aria-hidden="true" />{sectorLabel}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" />{locationLabel(project)}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{dateLabel(project.start_date)}<span aria-hidden="true">–</span><span className="sr-only">to</span>{dateLabel(project.end_date)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="!px-3" aria-label="Refresh overview" title="Refresh overview" onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" /></Button>
          <NavLink className={secondaryLink} to={`/projects/${projectId}/details`}><Pencil size={15} aria-hidden="true" />Edit project</NavLink>
          <Button disabled={!connected || project.status === "archived" || syncMutation.isPending} onClick={() => { setSyncMessage(null); syncMutation.mutate(projectId); }}><RefreshCw size={15} aria-hidden="true" />{syncMutation.isPending ? "Syncing…" : "Sync data"}</Button>
        </div>
      </div>
      {syncMessage?.projectId === projectId && <p role="status" className="m-0 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-[var(--fs-success)]">{syncMessage.text}</p>}
      {syncMutation.error && syncMutation.variables === projectId && <p role="alert" className="m-0 text-sm text-[var(--fs-danger)]">Synchronization failed. Check the source connection and try again.</p>}
    </header>


    <section aria-label="Project summary" aria-describedby="overview-data-note" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {submissionsQuery.isPending ? <div className="sm:col-span-2 xl:col-span-3"><LoadingSkeleton layout="metrics" label="Loading collection counts…" /></div> : submissionsQuery.error ? <div className="sm:col-span-2 xl:col-span-3"><Card className="h-full p-5"><LoadError label="collection counts" retry={() => void submissionsQuery.refetch()} /></Card></div> : <>
        <OverviewMetric label="Submitted records" value={submissionsQuery.data!.total} note="All saved submissions" icon={Database} />
        <OverviewMetric label="Connected forms" value={connected ? 1 : 0} note="Project’s connected Kobo form" icon={Link2} />
        {teamQuery.isPending ? <Card className="p-5"><LoadingState variant="inline" label="Loading enumerators…" /></Card> : teamQuery.error ? <Card className="p-5"><LoadError label="enumerator count" retry={() => void teamQuery.refetch()} /></Card> : <OverviewMetric label="Total enumerators" value={enumeratorCount} note="Active enumerators assigned to this project" icon={Users} />}
      </>}
      {indicatorsQuery.isPending ? <Card className="p-5"><LoadingState variant="inline" label="Loading indicators…" /></Card> : indicatorsQuery.error ? <Card className="p-5"><LoadError label="indicator results" retry={() => void indicatorsQuery.refetch()} /></Card> : <OverviewMetric label="Active indicators" value={activeIndicators?.length ?? 0} note="Active indicators in this project" icon={Target} />}
    </section>

    <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
      <CollectionTrend data={trendQuery.data} loading={trendQuery.isPending} error={trendQuery.isError} retry={() => void trendQuery.refetch()} period={trendPeriod} onPeriod={setTrendPeriod} />
      <ReviewBreakdown counts={submissionsQuery.data?.counts} loading={submissionsQuery.isPending} error={submissionsQuery.isError} retry={() => void submissionsQuery.refetch()} scope={scope} />
    </div>
    <div className="grid items-stretch gap-5 lg:grid-cols-2">
      <ProjectCompletionChart project={project} />
      <ProjectTimeline project={project} />
    </div>
    <p id="overview-data-note" className="sr-only">Collection counts include all saved records. Ready is a data-review status, not M&E result approval. Indicator results use their saved definitions; they are not frozen, approved reporting results. Reporting completeness is not available. {reportingCompleteness.state === "unavailable" ? reportingCompleteness.reason : ""}</p>
  </div>;
}

function OverviewMetric({ label, value, note, icon: Icon }: { label: string; value: number | string; note: string; icon: LucideIcon }) {
  return <MetricCard label={label} value={value} title={note} icon={Icon} valueClassName={typeof value === "string" ? "!text-xl" : ""} />;
}


function LoadError({ label, retry }: { label: string; retry: () => void }) {
  return <div role="alert" className="mb-3 text-sm text-[var(--fs-danger)]">Unable to load {label}. <button type="button" onClick={retry} className="min-h-11 px-2 font-semibold underline">Retry {label}</button></div>;
}
