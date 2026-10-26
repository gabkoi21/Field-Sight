import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Database,
  FolderKanban,
  RefreshCw,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LoadingSkeleton, LoadingState, MetricCard, PageHeader, Panel } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient } from "../../services/apiClient";
import { controlClass } from "../../components/ui/controlStyles";
import { formatLocation } from "../../utils/location";

const periodLabels: Record<string, string> = { today: "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days" };
function FilterSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0 max-w-full">
      <select
        className={`${controlClass} appearance-none pr-9`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8492a4]"
      />
    </div>
  );
}

export function OrganizationDashboardPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [filters, setFilters] = useSearchParams();
  // Overview filters never change the workspace's current project.
  const projectId = filters.get("overview_project") ?? "";
  const period = ["today", "7d", "30d"].includes(filters.get("period") ?? "") ? filters.get("period")! : "7d";
  const location = filters.get("location") ?? "";
  function setFilter(key: string, value: string) {
    setFilters((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
  }

  const organizationId = (user?.memberships.find((item) => item.role === "organization_admin") ?? user?.memberships[0])?.organization_id;

  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(organizationId),
  });

  const overviewQuery = useQuery({
    queryKey: ["organization-dashboard-overview", projectId, location, period],
    queryFn: () =>
      apiClient.dashboardOverview({ projectId: projectId || undefined, location: location || undefined, period }),
    staleTime: 30_000,
  });

  const pendingSyncQuery = useQuery({
    queryKey: ["organization-pending-kobo-sync", organizationId],
    queryFn: apiClient.pendingKoboSync,
    enabled: overviewQuery.isSuccess,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const enumeratorsQuery = useQuery({ queryKey: ["organization-enumerators"], queryFn: apiClient.enumerators });
  const submissionsQuery = useQuery({
    queryKey: ["dashboard-recent-submissions"],
    queryFn: apiClient.submissions,
    enabled: !authLoading,
    staleTime: 30_000,
  });

  const isLoading = authLoading || (overviewQuery.isLoading && projectsQuery.isLoading);

  if (isLoading) {
    return <LoadingSkeleton layout="dashboard" label="Preparing overview…" />;
  }

  if (overviewQuery.isError && !overviewQuery.data) return <div className="space-y-6"><PageHeader eyebrow="FieldSight / Organization" title="Overview" description="Track collection progress and data quality across projects." /><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><p>Unable to load overview: {overviewQuery.error.message}</p><button className="min-h-11 rounded-lg px-3 font-semibold underline" onClick={() => void overviewQuery.refetch()}>Retry overview</button></div></div>;

  const storedOverview = overviewQuery.data;
  const pendingSync = pendingSyncQuery.data;
  const overview =
    storedOverview && pendingSync
      ? {
        ...storedOverview,
        pending_sync_count: pendingSync.pending_count,
        sync_status: {
          ...storedOverview.sync_status,
          pending_count: pendingSync.pending_count,
          sources: pendingSync.sources,
        },
      }
      : storedOverview;
  const projectListLoading = projectsQuery.isLoading;
  const enumeratorsLoading = enumeratorsQuery.isLoading;
  const showSecondaryLoading = projectListLoading || enumeratorsLoading || pendingSyncQuery.isFetching;
  const projectSummary = overview?.projects ?? [];
  const projectOptions = (projectsQuery.data ?? []).map((item) => ({ label: item.name, value: item.id }));
  const locationOptions = (overview?.available_locations ?? []).map((item) => ({
    label: formatLocation(item),
    value: item,
  }));

  const activeEnumerators = (enumeratorsQuery.data ?? []).filter((item) => item.is_active).length;
  const totalEnumeratorsCount = (enumeratorsQuery.data ?? []).length;
  const totalSubmissionsVal = overview?.total_submissions ?? 0;
  const qualityRate = overview?.total_submissions
    ? Math.round((overview.ready_records / overview.total_submissions) * 100)
    : 0;

  const submissionsTrendContext = overview?.submission_change_percent != null
    ? `${overview.submission_change_percent >= 0 ? "+" : ""}${overview.submission_change_percent}% vs previous period`
    : "No previous-period comparison available";

  const activeProjectsDisplay = overview?.active_projects ?? 0;
  const scopeLabel = projectId ? (projectsQuery.data?.find((item) => item.id === projectId)?.name ?? "Selected project") : "All organization projects";
  const locationLabel = location ? formatLocation(location) : "All locations";
  const updatedAt = overviewQuery.dataUpdatedAt || Date.now();
  const cutoff = updatedAt - ({ today: 1, "7d": 7, "30d": 30 }[period] ?? 7) * 86400000;
  const dateLabel = `${new Date(cutoff).toLocaleDateString(undefined, { timeZone: "UTC" })} – ${new Date(updatedAt).toLocaleDateString(undefined, { timeZone: "UTC" })} (UTC)`;
  const scopedSubmissions = (submissionsQuery.data ?? []).filter((item) => (!projectId || item.project_id === projectId) && (!location || item.location === location));
  const periodSubmissions = scopedSubmissions.filter((item) => item.submitted_at && new Date(item.submitted_at).getTime() >= cutoff);
  const submissionReportData = (overview?.trend ?? []).map((item) => ({
    label: item.day,
    received: item.submissions,
    ready: item.approved,
    issues: Math.max(0, item.submissions - item.approved),
  }));
  const regionalBreakdownData = Object.values(
    periodSubmissions
      .reduce<Record<string, { region: string; ready: number; review: number; invalid: number }>>((acc, submission) => {
        const region = formatLocation(submission.location || "Unspecified location");
        const current = acc[region] ?? { region, ready: 0, review: 0, invalid: 0 };
        if (submission.review_status === "ready") current.ready += 1;
        else if (submission.review_status === "needs_review") current.review += 1;
        else if (submission.review_status === "invalid") current.invalid += 1;
        else current.review += 1;
        acc[region] = current;
        return acc;
      }, {}),
  )
    .sort((a, b) => b.ready + b.review + b.invalid - (a.ready + a.review + a.invalid) || a.region.localeCompare(b.region))
    .slice(0, 5);
  const leadingProjects = [...projectSummary]
    .sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .slice(0, 5);

  const topEnumerators = Object.values(
    periodSubmissions
      .reduce<
        Record<
          string,
          {
            name: string;
            total: number;
            ready: number;
            review: number;
            invalid: number;
            lastSubmitted: string | null;
            projects: Set<string>;
          }
        >
      >((acc, submission) => {
        const name = submission.enumerator?.trim() || "Unassigned";
        const current = acc[name] ?? {
          name,
          total: 0,
          ready: 0,
          review: 0,
          invalid: 0,
          lastSubmitted: null,
          projects: new Set<string>(),
        };
        current.total += 1;
        if (submission.review_status === "ready") current.ready += 1;
        if (submission.review_status === "needs_review") current.review += 1;
        if (submission.review_status === "invalid") current.invalid += 1;
        if (submission.project_name) current.projects.add(submission.project_name);
        if (
          submission.submitted_at &&
          (!current.lastSubmitted || new Date(submission.submitted_at).getTime() > new Date(current.lastSubmitted).getTime())
        ) {
          current.lastSubmitted = submission.submitted_at;
        }
        acc[name] = current;
        return acc;
      }, {}),
  )
    .sort((a, b) => b.total - a.total || b.ready - a.ready || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((item) => ({ ...item, projectCount: item.projects.size }));
  const refreshDashboard = () => void Promise.all([overviewQuery.refetch(), pendingSyncQuery.refetch(), submissionsQuery.refetch(), projectsQuery.refetch()]);

  return (
    <div className="flex min-w-0 flex-col gap-6 text-[var(--fs-text)]">
      <PageHeader
        eyebrow="FieldSight / Organization"
        title="Overview"
        description="Track collection progress, data quality, sync status, and recent activity across projects."
      >
        {showSecondaryLoading && (
          <span className="rounded-full border border-[#dfe8f5] bg-[#f3f8ff] px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3667c8]">
            Updating data…
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={overviewQuery.isFetching || pendingSyncQuery.isFetching}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#dce5ef] bg-white px-2.5 py-2 text-[12px] font-semibold text-brand hover:bg-[#f3f8ff] disabled:opacity-50"
          >
            <RefreshCw size={13} className={overviewQuery.isFetching ? "animate-spin" : ""} /> Refresh
          </button>

        </div>
      </PageHeader>

      <section aria-label="Organization overview filters" className="rounded-xl border border-[var(--fs-border)] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">Overview project filter<FilterSelect value={projectId} placeholder="All organization projects" options={projectOptions} onChange={(id) => setFilter("overview_project", id)} /></label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">Reporting period<FilterSelect value={period} placeholder="Reporting period" options={Object.entries(periodLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => setFilter("period", value)} /></label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">Location<FilterSelect value={location} placeholder="All locations" options={locationOptions} onChange={(value) => setFilter("location", value)} /></label>
        </div>
        <p className="mb-0 mt-3 text-xs text-[var(--fs-muted)]">{scopeLabel} · {locationLabel} · {periodLabels[period]} · {dateLabel}. These filters apply to this overview only; the annual report keeps its full-year range.</p>
      </section>
      {overviewQuery.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Unable to load overview: {overviewQuery.error.message}. Use Refresh to retry.</p>}
      {submissionsQuery.isLoading && <p role="status" className="text-sm text-[var(--fs-muted)]">Loading chart and ranking data…</p>}
      {submissionsQuery.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Unable to load chart and ranking data. Use Refresh to retry.</p>}
      {overviewQuery.isLoading ? <LoadingSkeleton layout="dashboard" label="Loading overview for selected filters…" /> : <>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Submissions in period" value={totalSubmissionsVal} context={submissionsTrendContext} icon={Database} />
        <MetricCard
          label="Needs review"
          value={overview?.needs_review ?? 0}
          context={`${overview?.invalid_records ?? 0} invalid • ${qualityRate}% ready in period`}
          icon={Clock3}
          tone={(overview?.needs_review ?? 0) > 0 || (overview?.invalid_records ?? 0) > 0 ? "warning" : "brand"}
        />
        <MetricCard
          label="Active projects"
          value={activeProjectsDisplay}
          context={`${scopeLabel} · Current project status, independent of dates`}
          icon={FolderKanban}
        />
      </section>

      <DashboardSnapshotCards
        regionalData={regionalBreakdownData}
        reportData={submissionReportData}
        allSubmissions={scopedSubmissions}
        scopeLabel={`${scopeLabel} · ${locationLabel}`}
        dateLabel={`${periodLabels[period]} · ${dateLabel}`}
        allProjects={projectsQuery.data ?? []}
      />

      <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] gap-4 max-[1000px]:grid-cols-1">
        <TopEnumerators enumerators={topEnumerators} loading={submissionsQuery.isLoading} scopeLabel={`${scopeLabel} · ${locationLabel} · ${periodLabels[period]}`} />

        <Panel
          title="Top projects"
          subtitle={`${scopeLabel} · ${periodLabels[period]} · ${dateLabel}. Period submissions compared with the overall project target.`}
          action={
            <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-blue-50" onClick={() => navigate("/projects")}>
              View all <ArrowRight className="inline" size={13} />
            </button>
          }
        >
          {leadingProjects.length > 0 ? (
            <ol className="m-0 list-none divide-y divide-slate-100 p-0">
              {leadingProjects.map((project, index) => (
                <li key={project.id} className="flex items-center gap-3 py-4 first:pt-2 last:pb-2">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${index === 0 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-sm font-semibold text-slate-800">{project.name}</span>
                    </div>
                    <p className="mb-0 mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-[var(--fs-muted)]"><span>Actual: {project.actual.toLocaleString()}</span><span>Target: {project.target > 0 ? project.target.toLocaleString() : "Not set"}</span></p>
                    <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
                        style={{
                          width: `${project.target > 0 ? Math.min(100, Math.max(0, (project.actual / project.target) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex h-[180px] items-center justify-center text-xs text-[var(--fs-muted)]">
              No projects for the selected filters.
            </div>
          )}
        </Panel>
      </section>
      </>}
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function DashboardSnapshotCards({
  regionalData,
  allSubmissions,
  scopeLabel,
  dateLabel,
}: {
  regionalData: Array<{ region: string; ready: number; review: number; invalid: number }>;
  scopeLabel: string;
  dateLabel: string;
  reportData?: Array<{ label: string; received: number; ready: number; issues: number }>;
  allSubmissions: Array<{ submitted_at?: string | null; project_id?: string }>;
  allProjects?: Array<{ id: string }>;
}) {
  const hasRegionalData = regionalData.some((item) => item.ready > 0 || item.review > 0 || item.invalid > 0);

  // ── Annual data: aggregate submissions + active projects per month ──────
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const annualData = MONTH_LABELS.map((month, idx) => {
    const monthSubs = allSubmissions.filter((s) => {
      if (!s.submitted_at) return false;
      const d = new Date(s.submitted_at);
      return d.getFullYear() === currentYear && d.getMonth() === idx;
    });
    const activeProjects = new Set(monthSubs.map((s) => s.project_id).filter(Boolean)).size;
    return {
      month,
      submissions: monthSubs.length,
      projects: activeProjects,         // always real count — 0 if nothing submitted
      isCurrent: idx === currentMonth,
      isFuture: idx > currentMonth,
    };
  });

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,.7fr)_minmax(0,1fr)]">
      <article className="min-w-0 rounded-xl border border-[var(--fs-border)] bg-white p-5 shadow-[0_2px_8px_rgba(23,40,70,.03)]">
        <div>
          <h2 className="m-0 text-lg font-semibold text-[#1e293b]">Submissions by location</h2>
          <p className="m-0 mt-1 text-xs text-[#64748b]">{scopeLabel} · {dateLabel} · Top five locations</p>
        </div>
        <ChartLegend
          items={[
            { label: "Ready", color: "#0b51b7" },
            { label: "Review", color: "#a86612" },
            { label: "Invalid", color: "#ba4055" },
          ]}
        />
        <div className="mt-5 h-[270px]">
          {hasRegionalData ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={regionalData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="region"
                  type="category"
                  width={112}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(11, 81, 183, .04)" }}
                  formatter={(value: number, name: string) => [
                    Number(value).toLocaleString(),
                    name === "ready" ? "Ready" : name === "review" ? "Needs review" : "Invalid",
                  ]}
                  contentStyle={{
                    border: "1px solid #e3e9f1",
                    borderRadius: "8px",
                    boxShadow: "0 8px 22px rgba(23, 40, 70, .08)",
                  }}
                />
                <Bar dataKey="ready" stackId="quality" fill="#0b51b7" barSize={12} radius={[0, 0, 0, 0]} />
                <Bar dataKey="review" stackId="quality" fill="#a86612" barSize={12} radius={[0, 0, 0, 0]} />
                <Bar dataKey="invalid" stackId="quality" fill="#ba4055" barSize={12} radius={[0, 6, 6, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState label="No location submissions yet." />
          )}
        </div>
        <details className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
          <summary className="cursor-pointer py-2 font-medium text-brand">View location data</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Submissions by location and quality status</caption>
              <thead><tr><th scope="col" className="py-3">Location</th><th scope="col" className="px-2 text-right">Ready</th><th scope="col" className="px-2 text-right">Review</th><th scope="col" className="px-2 text-right">Invalid</th></tr></thead>
              <tbody>{regionalData.map((row) => <tr key={row.region} className="border-t border-slate-100"><th scope="row" className="py-3 font-medium">{row.region}</th><td className="px-2 text-right">{row.ready.toLocaleString()}</td><td className="px-2 text-right">{row.review.toLocaleString()}</td><td className="px-2 text-right">{row.invalid.toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </article>

      {/* ── Submission Report card ─────────────────────────────────────────── */}
      <article className="min-w-0 rounded-xl border border-[var(--fs-border)] bg-white p-5 shadow-[0_2px_8px_rgba(23,40,70,.03)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold text-[#1e293b]">Submission report</h2>
            <p className="m-0 mt-1 text-xs text-[#64748b]">
              {scopeLabel} · Jan 1 – Dec 31, {currentYear} · Monthly submissions and projects with submissions; independent of reporting period
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/* ── Period: Year only ── */}
            <span className="rounded-md border border-[#bdd0eb] bg-[#f3f8ff] px-3 py-1.5 text-xs font-semibold text-brand">
              Year
            </span>
          </div>
        </div>

        <div className="mt-5 h-[270px]">
          <AnnualSubmissionReportChart data={annualData} currentMonth={currentMonth} />
        </div>

        <div className="mt-3 flex justify-center">
          <ChartLegend
            align="center"
            items={[
              { label: "Total Submissions", color: "#0b51b7" },
              { label: "Projects with submissions", color: "#a86612" },
            ]}
          />
        </div>
        <details className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
          <summary className="cursor-pointer py-2 font-medium text-brand">View monthly data</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Monthly submissions and projects with submissions for {currentYear}</caption>
              <thead><tr><th scope="col" className="py-3">Month</th><th scope="col" className="px-2 text-right">Submissions</th><th scope="col" className="px-2 text-right">Projects</th></tr></thead>
              <tbody>{annualData.map((row) => <tr key={row.month} className="border-t border-slate-100"><th scope="row" className="py-3 font-medium">{row.month}</th><td className="px-2 text-right">{row.submissions.toLocaleString()}</td><td className="px-2 text-right">{row.projects.toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </article>
    </section>
  );
}

// ─── Annual macro chart — custom tooltip ────────────────────────────────────
function AnnualTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const meta: Record<string, { color: string; label: string; suffix?: string }> = {
    submissions: { color: "#0b51b7", label: "Total Submissions" },
    projects: { color: "#a86612", label: "Projects with submissions", suffix: "active" },
  };
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.98)",
        border: "1px solid #e3e9f1",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(23,40,70,.14)",
        padding: "10px 14px",
        minWidth: 168,
      }}
    >
      <p style={{ margin: "0 0 9px", fontSize: 13, fontWeight: 700, color: "#1e293b", letterSpacing: "0.02em" }}>
        {label}
      </p>
      {payload.map((entry) => {
        const m = meta[entry.dataKey] ?? { color: "#888", label: entry.name };
        return (
          <div key={entry.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 13 }}>
            <span
              style={{
                width: 9, height: 9, borderRadius: "50%",
                backgroundColor: m.color, flexShrink: 0,
                boxShadow: `0 0 0 2.5px ${m.color}30`,
              }}
            />
            <span style={{ color: "#475569", flex: 1 }}>{m.label}</span>
            <span style={{ fontWeight: 700, color: "#1e293b" }}>
              {Number(entry.value).toLocaleString()}
              {m.suffix ? <span style={{ fontWeight: 400, color: "#64748b", marginLeft: 4, fontSize: 12 }}>{m.suffix}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Annual macro view: line across all 12 months + project bars ─────────────
function AnnualSubmissionReportChart({
  data,
  currentMonth,
}: {
  data: Array<{ month: string; submissions: number; projects: number; isCurrent: boolean; isFuture: boolean }>;
  currentMonth: number;
}) {
  const currentLabel = data[currentMonth]?.month ?? "";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 20, left: -8, bottom: 4 }} barCategoryGap="40%">
        <defs>
          <linearGradient id="gradSubsArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b51b7" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#0b51b7" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradProjects" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a86612" stopOpacity={1} />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="gradProjectsFuture" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a86612" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#a86612" stopOpacity={0.10} />
          </linearGradient>
          <filter id="annualDotGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <CartesianGrid vertical={false} stroke="#edf1f5" strokeDasharray="3 3" />

        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          yAxisId="subs"
          domain={[0, (dataMax: number) => Math.max(dataMax || 0, 5)]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
          allowDecimals={false}
          width={30}
        />
        <YAxis
          yAxisId="proj"
          orientation="right"
          domain={[0, (dataMax: number) => Math.max(dataMax || 0, 5)]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#d97706", fontWeight: 500 }}
          allowDecimals={false}
          width={26}
        />

        <Tooltip
          content={<AnnualTooltip />}
          cursor={{ stroke: "#c8d6e8", strokeWidth: 1, strokeDasharray: "4 3", fill: "rgba(11,81,183,0.035)" }}
        />

        {currentLabel && (
          <ReferenceLine
            yAxisId="subs"
            x={currentLabel}
            stroke="#4338ca"
            strokeDasharray="4 3"
            strokeOpacity={0.4}
            strokeWidth={1.5}
            label={{ value: "Now", position: "insideTopRight", fontSize: 12, fill: "#4338ca", opacity: 0.6, dy: -4 }}
          />
        )}

        {/* Total Projects — slim bars on right axis */}
        <Bar
          yAxisId="proj"
          dataKey="projects"
          name="Total Projects"
          radius={[4, 4, 0, 0]}
          maxBarSize={14}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={entry.isFuture ? "url(#gradProjectsFuture)" : "url(#gradProjects)"}
              opacity={entry.isCurrent ? 1 : entry.isFuture ? 0.45 : 0.85}
            />
          ))}
        </Bar>

        {/* Total Submissions — continuous line spanning all 12 months; sits at 0 for empty months */}
        <Area
          yAxisId="subs"
          type="monotone"
          dataKey="submissions"
          name="Total Submissions"
          stroke="#0b51b7"
          strokeWidth={2.5}
          fill="url(#gradSubsArea)"
          dot={(props) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isFuture: boolean } };
            if (payload.isFuture) {
              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#0b51b7" fillOpacity={0.25} stroke="none" />;
            }
            return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#0b51b7" stroke="#fff" strokeWidth={1.5} />;
          }}
          activeDot={{ r: 5, fill: "#0b51b7", stroke: "#fff", strokeWidth: 2, filter: "url(#annualDotGlow)" }}
          isAnimationActive
          animationDuration={1100}
          animationEasing="ease-out"
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}


function ChartLegend({
  items,
  align = "center",
}: {
  items: Array<{ label: string; color: string }>;
  align?: "center" | "right";
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[#475569] ${align === "right" ? "justify-end" : "justify-center"}`}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return <div className="grid h-full place-items-center text-center text-xs text-[var(--fs-muted)]">{label}</div>;
}

function TopEnumerators({
  enumerators,
  loading,
  scopeLabel,
}: {
  enumerators: Array<{
    name: string;
    total: number;
    ready: number;
    review: number;
    invalid: number;
    lastSubmitted: string | null;
    projectCount: number;
  }>;
  loading: boolean;
  scopeLabel: string;
}) {
  return (
    <Panel title="Top three enumerators" subtitle={`${scopeLabel} · Ranked by period submissions`}>
      {loading ? (
        <div className="grid h-[200px] place-items-center text-xs text-[var(--fs-muted)]">Loading enumerator rankings...</div>
      ) : enumerators.length ? (
        <ol className="m-0 list-none divide-y divide-[#edf1f5] p-0">
          {enumerators.map((enumerator, index) => {
            const readyRate = enumerator.total ? Math.round((enumerator.ready / enumerator.total) * 100) : 0;
            return (
              <li key={enumerator.name} className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1">
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${index === 0 ? "bg-brand text-white" : "bg-[#f1f5f9] text-[#607086]"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold text-[#1e293b]">{enumerator.name}</strong>
                      <span className="block text-xs text-[#64748b]">
                        {enumerator.projectCount} project{enumerator.projectCount === 1 ? "" : "s"} • Last active{" "}
                        {formatSubmissionDate(enumerator.lastSubmitted)}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block text-sm font-bold text-[#1e293b]">{enumerator.total}</strong>
                      <span className="text-xs text-[#64748b]">submissions</span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf2f7]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${readyRate}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#64748b]">
                    <span>{readyRate}% ready</span>
                    <span>{enumerator.review} review</span>
                    <span>{enumerator.invalid} invalid</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="grid h-[200px] place-items-center text-center text-xs text-[var(--fs-muted)]">
          No enumerator activity matches the current filters.
        </div>
      )}
    </Panel>
  );
}

function formatSubmissionDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
