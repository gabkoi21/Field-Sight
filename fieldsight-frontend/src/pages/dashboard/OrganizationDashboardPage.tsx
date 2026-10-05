import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

import { LoadingState, MetricCard, PageHeader, Panel } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient } from "../../services/apiClient";
import { formatLocation } from "../../utils/location";

const periodLabels: Record<string, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };
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
    <div className="relative">
      <select
        className="appearance-none rounded-[6px] border border-[#dce5ef] bg-white py-[7px] pl-3 pr-8 font-sans text-[12px] font-medium text-[#4e5e74] shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer"
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
  const [projectId, setProjectId] = useState("");
  const [period, setPeriod] = useState("7d");
  const [location, setLocation] = useState("");

  const organizationId = user?.memberships[0]?.organization_id;

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

  const isLoading = authLoading || overviewQuery.isLoading;

  if (isLoading) {
    return <LoadingState label="Loading…" />;
  }

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

  const totalProjectTarget = projectSummary.reduce((acc, p) => acc + (p.target || 0), 0);
  const submissionsTrendContext =
    overview?.submission_change_percent != null
      ? `${overview.submission_change_percent >= 0 ? "+" : ""}${overview.submission_change_percent}% vs previous period`
      : totalProjectTarget > 0
        ? `${totalSubmissionsVal.toLocaleString()} / ${totalProjectTarget.toLocaleString()} target reached`
        : "+0% vs previous period";

  const totalWorkspaceProjects = (projectsQuery.data ?? []).length || projectSummary.length;
  const activeProjectsWithSubs = projectSummary.filter((p) => p.actual > 0).length;
  const activeProjectsDisplay = activeProjectsWithSubs > 0 ? activeProjectsWithSubs : totalWorkspaceProjects;
  const submissionReportData = (overview?.trend ?? []).map((item) => ({
    label: item.day,
    received: item.submissions,
    ready: item.approved,
    issues: Math.max(0, item.submissions - item.approved),
  }));
  const regionalBreakdownData = Object.values(
    (submissionsQuery.data ?? [])
      .filter((item) => (!projectId || item.project_id === projectId) && (!location || item.location === location))
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
    (submissionsQuery.data ?? [])
      .filter(
        (item) =>
          (!projectId || item.project_id === projectId) &&
          (!location || item.location === location),
      )
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
  const refreshDashboard = () => void Promise.all([overviewQuery.refetch(), pendingSyncQuery.refetch()]);

  return (
    <div className="flex flex-col gap-5 text-[#24334a]">
      <PageHeader
        eyebrow="Organization dashboard"
        title="Field operations"
        description="Track collection progress, data quality, sync status, and recent activity across projects."
      >
        {showSecondaryLoading && (
          <span className="rounded-full border border-[#dfe8f5] bg-[#f3f8ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3667c8]">
            Updating data…
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={overviewQuery.isFetching || pendingSyncQuery.isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#dce5ef] bg-white px-2.5 py-2 text-[11px] font-semibold text-brand hover:bg-[#f3f8ff] disabled:opacity-50"
          >
            <RefreshCw size={13} className={overviewQuery.isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <FilterSelect value={projectId} placeholder="All projects" options={projectOptions} onChange={setProjectId} />
        </div>
      </PageHeader>

      <section className="grid grid-cols-3 gap-3 max-[1050px]:grid-cols-3 max-[820px]:grid-cols-1">
        <MetricCard label="Total Submissions" value={totalSubmissionsVal} context={submissionsTrendContext} icon={Database} />
        <MetricCard
          label="Quality Check"
          value={overview?.needs_review ?? 0}
          context={`${overview?.invalid_records ?? 0} invalid • ${qualityRate}% ready overall`}
          icon={Clock3}
          tone={(overview?.needs_review ?? 0) > 0 || (overview?.invalid_records ?? 0) > 0 ? "warning" : "brand"}
        />
        <MetricCard
          label="Active Projects"
          value={activeProjectsDisplay}
          context={`${totalWorkspaceProjects} projects in workspace`}
          icon={FolderKanban}
        />
      </section>

      <DashboardSnapshotCards
        regionalData={regionalBreakdownData}
        reportData={submissionReportData}
        allSubmissions={submissionsQuery.data ?? []}
        allProjects={projectsQuery.data ?? []}
      />

      <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] gap-4 max-[1000px]:grid-cols-1">
        <TopEnumerators enumerators={topEnumerators} loading={submissionsQuery.isLoading} />

        <Panel
          title="Top projects"
          subtitle="Ranked by total submissions"
          action={
            <button className="text-xs font-semibold text-brand" onClick={() => navigate("/projects")}>
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
            <div className="flex h-[180px] items-center justify-center text-xs text-[#8491a3]">
              No projects for the selected filters.
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function DashboardSnapshotCards({
  regionalData,
  allSubmissions,
}: {
  regionalData: Array<{ region: string; ready: number; review: number; invalid: number }>;
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
    <section className="grid grid-cols-[minmax(280px,.42fr)_minmax(0,1fr)] gap-4 max-[940px]:grid-cols-1">
      <article className="min-w-0 rounded-lg border border-[#edf0f4] bg-white px-5 pb-5 pt-5 shadow-[0_4px_14px_rgba(23,40,70,.04)]">
        <div>
          <h2 className="m-0 text-base font-semibold text-[#1e293b]">Submissions by location</h2>
          <p className="m-0 mt-1 text-xs text-[#64748b]">Volume and quality mix by field area</p>
        </div>
        <ChartLegend
          items={[
            { label: "Ready", color: "#0b51b7" },
            { label: "Review", color: "#f0a640" },
            { label: "Invalid", color: "#db5b66" },
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
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="region"
                  type="category"
                  width={112}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
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
                <Bar dataKey="review" stackId="quality" fill="#f0a640" barSize={12} radius={[0, 0, 0, 0]} />
                <Bar dataKey="invalid" stackId="quality" fill="#db5b66" barSize={12} radius={[0, 6, 6, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState label="No location submissions yet." />
          )}
        </div>
      </article>

      {/* ── Submission Report card ─────────────────────────────────────────── */}
      <article className="min-w-0 rounded-lg border border-[#edf0f4] bg-white px-5 pb-5 pt-5 shadow-[0_4px_14px_rgba(23,40,70,.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#1e293b]">Submission report</h2>
            <p className="m-0 mt-1 text-xs text-[#64748b]">
              Monthly submissions & active projects — {currentYear}
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
              { label: "Total Projects", color: "#f0a640" },
            ]}
          />
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
    submissions: { color: "#0b51b7", label: "Total Submissions" },
    projects: { color: "#f0a640", label: "Total Projects", suffix: "active" },
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
              {m.suffix ? <span style={{ fontWeight: 400, color: "#64748b", marginLeft: 4, fontSize: 11 }}>{m.suffix}</span> : null}
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
            <stop offset="0%" stopColor="#f0a640" stopOpacity={1} />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="gradProjectsFuture" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0a640" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#f0a640" stopOpacity={0.10} />
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
        />
        <YAxis
          yAxisId="subs"
          domain={[0, (dataMax: number) => Math.max(dataMax || 0, 5)]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
          allowDecimals={false}
          width={30}
        />
        <YAxis
          yAxisId="proj"
          orientation="right"
          domain={[0, (dataMax: number) => Math.max(dataMax || 0, 5)]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#d97706", fontWeight: 500 }}
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
            label={{ value: "Now", position: "insideTopRight", fontSize: 9, fill: "#4338ca", opacity: 0.6, dy: -4 }}
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
  return <div className="grid h-full place-items-center text-center text-xs text-[#8491a3]">{label}</div>;
}

function TopEnumerators({
  enumerators,
  loading,
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
}) {
  return (
    <Panel title="Top three enumerators" subtitle="Highest submission volume in this view">
      {loading ? (
        <div className="grid h-[200px] place-items-center text-xs text-[#8491a3]">Loading enumerator rankings...</div>
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
        <div className="grid h-[200px] place-items-center text-center text-xs text-[#8491a3]">
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
