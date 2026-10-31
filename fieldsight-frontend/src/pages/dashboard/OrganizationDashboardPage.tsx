import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Clock3,
  Database,
  FolderKanban,
  CheckCircle2,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  Area,
  CartesianGrid,
  ComposedChart,
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

const periodLabels: Record<string, string> = { "7d": "Last 7 days", "30d": "Last 30 days" };
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
  const { user, loading: authLoading } = useAuth();
  const [filters, setFilters] = useSearchParams();
  // Overview filters never change the workspace's current project.
  const projectId = filters.get("overview_project") ?? "";
  const period = ["7d", "30d"].includes(filters.get("period") ?? "") ? filters.get("period")! : "7d";
  const location = filters.get("location") ?? "";
  const enumeratorProjectFilter = filters.get("enumerator_project") ?? projectId;
  const enumeratorProjectId = enumeratorProjectFilter === "all" ? "" : enumeratorProjectFilter;
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

  if (overviewQuery.isError && !overviewQuery.data) return <div className="space-y-6"><PageHeader eyebrow="FieldSight / Organization" title="Dashboard" /><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><p>Unable to load overview: {overviewQuery.error.message}</p><button className="min-h-11 rounded-lg px-3 font-semibold underline" onClick={() => void overviewQuery.refetch()}>Retry overview</button></div></div>;

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
  const projectOptions = (projectsQuery.data ?? []).map((item) => ({ label: item.name, value: item.id }));


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
  const updatedAt = overviewQuery.dataUpdatedAt || Date.now();
  const cutoff = updatedAt - ({ today: 1, "7d": 7, "30d": 30 }[period] ?? 7) * 86400000;
  const scopedSubmissions = (submissionsQuery.data ?? []).filter((item) => (!projectId || item.project_id === projectId) && (!location || item.location === location));
  const submissionReportData = (overview?.trend ?? []).map((item) => ({
    label: item.day,
    received: item.submissions,
    ready: item.approved,
    issues: Math.max(0, item.submissions - item.approved),
  }));
  const enumeratorSubmissions = (submissionsQuery.data ?? []).filter(item =>
    (!enumeratorProjectId || item.project_id === enumeratorProjectId) &&
    (!location || item.location === location) &&
    item.submitted_at && new Date(item.submitted_at).getTime() >= cutoff);
  const topEnumerators = Object.values(
    enumeratorSubmissions
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
        if (submission.project_id) current.projects.add(submission.project_id);
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

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-6 text-[var(--fs-text)]">
      <PageHeader eyebrow="FieldSight / Organization" title="Dashboard" />

      {overviewQuery.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Unable to load overview: {overviewQuery.error.message}. <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={() => void overviewQuery.refetch()}>Retry overview</button></p>}
      {submissionsQuery.isLoading && <LoadingState variant="panel" label="Loading chart and ranking data…" />}
      {submissionsQuery.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Unable to load chart and ranking data. <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={() => void submissionsQuery.refetch()}>Retry chart data</button></p>}
      {overviewQuery.isLoading ? <LoadingSkeleton layout="dashboard" label="Loading overview for selected filters…" /> : <>
      <section aria-label="Organization summary" className="workspace-metrics">
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
        <MetricCard label="Data readiness" value={`${qualityRate}%`} context={`${overview?.ready_records ?? 0} records ready for analysis`} icon={CheckCircle2} />
      </section>

      <section aria-label="Collection charts" className="organization-chart-pair items-stretch">
        <MonthlyCollectionPerformance allSubmissions={scopedSubmissions} />
        <ProjectStatusChart projects={projectsQuery.data ?? []} loading={projectsQuery.isLoading} error={projectsQuery.isError} retry={() => void projectsQuery.refetch()} />
      </section>

      <TopEnumerators enumerators={topEnumerators} loading={submissionsQuery.isLoading} projectId={enumeratorProjectId} projects={projectOptions} onProjectChange={id => setFilter("enumerator_project", id || "all")} />
      </>}
    </div>
  );
}

function ProjectStatusChart({ projects, loading, error, retry }: {
  projects: Array<{ status: string }>; loading: boolean; error: boolean; retry: () => void;
}) {
  const rows = [
    { name: "Active", value: projects.filter(project => project.status === "active").length, color: "var(--fs-primary)" },
    { name: "Completed", value: projects.filter(project => project.status === "completed").length, color: "#10b981" },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const slices = rows.filter(row => row.value > 0);
  return <Panel title="Project Status" subtitle={null} className="h-full !rounded-none !border !border-[#d8e0e9] !shadow-none">
    {loading ? <LoadingState variant="panel" label="Loading project status�" /> : error ? <p role="alert" className="py-8 text-sm text-[var(--fs-danger)]">Unable to load project status. <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={retry}>Retry project status</button></p> : <>
      <div className="relative h-[250px]" role="img" aria-label={`Project status: Active ${rows[0].value}, Completed ${rows[1].value}.`}>
        {total > 0 ? <><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={72} outerRadius={96} startAngle={90} endAngle={-270} paddingAngle={slices.length > 1 ? 4 : 0} stroke="none" isAnimationActive={false}>{slices.map(row => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--fs-border)", fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-4xl font-semibold tabular-nums">{total.toLocaleString()}</strong><span className="mt-1 text-xs text-[var(--fs-muted)]">Active + completed</span></div></> : <>
          <svg viewBox="0 0 240 250" className="h-full w-full" aria-hidden="true"><circle cx="120" cy="125" r="84" fill="none" stroke="var(--fs-border)" strokeWidth="24" /></svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-4xl font-semibold tabular-nums">0</strong><span className="mt-1 text-xs text-[var(--fs-muted)]">Active + completed</span></div>
        </>}
      </div>
      {total === 0 && <p className="mb-3 mt-0 text-center text-xs text-[var(--fs-muted)]">No active or completed projects yet.</p>}
      <ul className="m-0 list-none space-y-1 p-0">{rows.map(row => <li key={row.name} className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm"><span className="inline-flex items-center gap-2.5 text-[var(--fs-muted)]"><span className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />{row.name}</span><strong className="min-w-8 rounded-md bg-[var(--fs-canvas)] px-2 py-1 text-center text-xs tabular-nums">{row.value.toLocaleString()}</strong></li>)}</ul>
    </>}
  </Panel>;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthlyCollectionPerformance({ allSubmissions }: {
  allSubmissions: Array<{ submitted_at?: string | null; review_status?: string }>;
}) {
  // Group records by submission month and count their current ready status.
  const currentYear = new Date().getUTCFullYear();
  const currentMonth = new Date().getUTCMonth(); // 0-indexed
  const annualData = MONTH_LABELS.map((month, idx) => {
    const monthSubs = allSubmissions.filter((s) => {
      if (!s.submitted_at) return false;
      const d = new Date(s.submitted_at);
      return d.getUTCFullYear() === currentYear && d.getUTCMonth() === idx;
    });
    const readyRecords = monthSubs.filter(record => record.review_status === "ready").length;
    return {
      month,
      submissions: monthSubs.length,
      ready: readyRecords,
      isCurrent: idx === currentMonth,
      isFuture: idx > currentMonth,
    };
  });

  return (
    <section aria-label="Monthly collection performance" className="min-w-0">
      <article className="h-full min-w-0 rounded-none border border-[#d8e0e9] bg-[var(--fs-surface)] p-5 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold text-[#1e293b]">Monthly Collection Performance</h2>
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
              { label: "Monthly Submissions", color: "#0b51b7" },
              { label: "Ready for Analysis", color: "#10b981" },
            ]}
          />
        </div>
        <div className="sr-only">
          <div className="overflow-x-auto">
            <table className="fs-data-table w-full text-left text-sm">
              <caption className="sr-only">Monthly collection performance for {currentYear}</caption>
              <thead><tr><th scope="col" className="py-3">Month</th><th scope="col" className="px-2 text-right">Submissions</th><th scope="col" className="px-2 text-right">Ready for Analysis</th></tr></thead>
              <tbody>{annualData.map((row) => <tr key={row.month} className="border-t border-slate-100"><th scope="row" className="py-3 font-medium">{row.month}</th><td className="px-2 text-right">{row.submissions.toLocaleString()}</td><td className="px-2 text-right">{row.ready.toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
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
    submissions: { color: "#0b51b7", label: "Monthly Submissions" },
    ready: { color: "#10b981", label: "Ready for Analysis" },
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

// Compare both monthly record counts on the same axis.
function AnnualSubmissionReportChart({ data, currentMonth }: {
  data: Array<{ month: string; submissions: number; ready: number; isCurrent: boolean; isFuture: boolean }>;
  currentMonth: number;
}) {
  return <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={data} margin={{ top: 12, right: 16, left: -8, bottom: 4 }} accessibilityLayer>
      <defs><linearGradient id="monthlySubmissionArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0b51b7" stopOpacity={0.14} /><stop offset="100%" stopColor="#0b51b7" stopOpacity={0.01} /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="var(--fs-border)" strokeDasharray="3 4" />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--fs-muted)" }} minTickGap={24} />
      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--fs-muted)" }} width={38} domain={[0, (max: number) => Math.max(max, 5)]} />
      <Tooltip content={<AnnualTooltip />} />
      <ReferenceLine x={data[currentMonth]?.month} stroke="var(--fs-primary)" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "Now", position: "insideTopRight", fontSize: 11, fill: "var(--fs-muted)" }} />
      <Area type="monotone" dataKey="submissions" name="Monthly Submissions" stroke="#0b51b7" strokeWidth={2.5} fill="url(#monthlySubmissionArea)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      <Line type="monotone" dataKey="ready" name="Ready for Analysis" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer>;
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
  projectId,
  projects,
  onProjectChange,
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
  projectId: string;
  projects: Array<{ label: string; value: string }>;
  onProjectChange: (id: string) => void;
}) {
  return (
    <Panel className="h-full !rounded-none !border !border-[#d8e0e9] !shadow-none" title="Top three enumerators" subtitle={null} action={<label className="ml-auto w-full sm:w-60"><span className="sr-only">Enumerator project</span><FilterSelect value={projectId} placeholder="All Project" options={projects} onChange={onProjectChange} /></label>}>
      {loading ? (
        <div className="p-4"><LoadingSkeleton columns={3} rows={3} label="Loading enumerator rankings�" /></div>
      ) : enumerators.length ? (
        <div className="overflow-x-auto">
          <table className="fs-data-table w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Top three enumerators ranked by period submissions</caption>
            <thead><tr className="border-b border-[var(--fs-border)] bg-[var(--fs-canvas)] text-xs text-[var(--fs-muted)]">
              <th scope="col" className="px-4 py-3">Rank</th><th scope="col" className="px-4 py-3">Enumerator</th><th scope="col" className="px-4 py-3 text-right">Projects</th><th scope="col" className="px-4 py-3 text-right">Submissions</th><th scope="col" className="px-4 py-3 text-right">Ready</th><th scope="col" className="px-4 py-3 text-right">Review</th><th scope="col" className="px-4 py-3 text-right">Invalid</th><th scope="col" className="whitespace-nowrap px-4 py-3">Last active</th>
            </tr></thead>
            <tbody>{enumerators.map((enumerator, index) => <tr key={enumerator.name} className="border-b border-[var(--fs-border)] last:border-0 hover:bg-[var(--fs-canvas)]">
              <td className="px-4 py-4"><span className={`inline-grid size-7 place-items-center rounded-md text-xs font-semibold ${index === 0 ? "bg-[var(--fs-primary)] text-white" : "bg-[var(--fs-canvas)] text-[var(--fs-muted)]"}`}>{index + 1}</span></td>
              <th scope="row" className="px-4 py-4 font-semibold">{enumerator.name}</th>
              <td className="px-4 py-4 text-right">{enumerator.projectCount}</td>
              <td className="px-4 py-4 text-right font-semibold">{enumerator.total.toLocaleString()}</td>
              <td className="whitespace-nowrap px-4 py-4 text-right">{enumerator.total ? Math.round(enumerator.ready / enumerator.total * 100) : 0}%</td>
              <td className="px-4 py-4 text-right">{enumerator.review}</td>
              <td className="px-4 py-4 text-right">{enumerator.invalid}</td>
              <td className="whitespace-nowrap px-4 py-4 text-[var(--fs-muted)]">{formatSubmissionDate(enumerator.lastSubmitted)}</td>
            </tr>)}</tbody>
          </table>
        </div>
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
