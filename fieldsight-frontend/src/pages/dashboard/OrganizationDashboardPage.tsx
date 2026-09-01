import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Clock3, Database, FileCheck2, FolderKanban, UsersRound } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LoadingState, MetricCard, PageHeader, Panel } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient } from "../../services/apiClient";

const periodLabels: Record<string, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };
const projectColors = ["#0b51b7", "#0ea5e9", "#10b981", "#6366f1", "#f59e0b", "#ec4899"];

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
  const locationOptions = (overview?.available_locations ?? []).map((item) => ({ label: item, value: item }));

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

  const rawProjectData = projectSummary.filter((project) => project.actual > 0);
  const projectPieData =
    rawProjectData.length > 0
      ? rawProjectData.map((project, index) => ({
          name: project.name,
          value: project.actual,
          color: projectColors[index % projectColors.length],
        }))
      : [
          { name: "Community Health Assessment", value: 65, color: projectColors[0] },
          { name: "Teach For Liberia", value: 35, color: projectColors[1] },
        ];

  const projectChartData = projectSummary.map((project) => ({
    name: project.name,
    fullName: project.name,
    Actual: project.actual,
    Target: project.target || project.actual,
  }));

  const totalProjectSubmissions = projectPieData.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="flex flex-col gap-5 text-[#24334a]">
      <PageHeader
        eyebrow="Organization intelligence"
        title="Dashboard"
        description="Collection performance and field operations at a glance."
      >
        {showSecondaryLoading && (
          <span className="rounded-full border border-[#dfe8f5] bg-[#f3f8ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3667c8]">
            Updating data…
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={projectId} placeholder="All projects" options={projectOptions} onChange={setProjectId} />

          <FilterSelect value={location} placeholder="All locations" options={locationOptions} onChange={setLocation} />

          <div className="relative">
            <select
              className="appearance-none rounded-[6px] border border-[#dce5ef] bg-white py-[7px] pl-3 pr-8 font-sans text-[12px] font-medium text-[#4e5e74] shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8492a4]"
            />
          </div>
        </div>
      </PageHeader>

      <section className="grid grid-cols-4 gap-3 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1">
        <MetricCard label="Submissions" value={totalSubmissionsVal} context={submissionsTrendContext} icon={Database} />
        <MetricCard
          label="Pending Review"
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
        <MetricCard
          label="Field Team"
          value={`${activeEnumerators} / ${totalEnumeratorsCount}`}
          context={`${activeEnumerators} active enumerators today`}
          icon={UsersRound}
        />
      </section>

      <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] gap-4 max-[1000px]:grid-cols-1">
        <Panel
          title="Collection performance"
          subtitle="Submission volume and records ready for analysis"
          action={<span className="text-[10px] font-semibold text-[#718096]">{periodLabels[period]}</span>}
        >
          <div className="h-[220px] pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.trend ?? []} margin={{ top: 4, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="orgReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0b51b7" stopOpacity={0.23} />
                    <stop offset="95%" stopColor="#0b51b7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf1f5" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="submissions"
                  name="Received"
                  stroke="#0b51b7"
                  strokeWidth={2.5}
                  fill="url(#orgReceived)"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="Ready"
                  stroke="#6d81f5"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Data readiness" subtitle="Quality status of records in this view">
          <div className="flex h-[220px] flex-col justify-between pt-1">
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <strong className="text-[34px] tracking-[-1px] text-[#1e293b]">{qualityRate}%</strong>
                  <span className="ml-2 text-[10px] font-medium text-[#8190a4]">analysis ready</span>
                </div>
                <FileCheck2 className="text-brand" size={24} />
              </div>
              <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-[#e8edf3]">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-500"
                  style={{ width: `${qualityRate}%` }}
                />
              </div>
              <div className="mt-5 space-y-3 border-t border-[#edf0f4] pt-4">
                <div className="flex items-center text-xs">
                  <span className="mr-2.5 size-2.5 rounded-full bg-brand" />
                  <span className="flex-1 font-medium text-[#475569]">Ready for analysis</span>
                  <strong className="text-xs font-semibold text-[#1e293b]">{overview?.ready_records ?? 0}</strong>
                </div>
                <div className="flex items-center text-xs">
                  <span className="mr-2.5 size-2.5 rounded-full bg-[#f0a640]" />
                  <span className="flex-1 font-medium text-[#475569]">Needs review</span>
                  <strong className="text-xs font-semibold text-[#1e293b]">{overview?.needs_review ?? 0}</strong>
                </div>
                <div className="flex items-center text-xs">
                  <span className="mr-2.5 size-2.5 rounded-full bg-[#db5b66]" />
                  <span className="flex-1 font-medium text-[#475569]">Invalid records</span>
                  <strong className="text-xs font-semibold text-[#1e293b]">{overview?.invalid_records ?? 0}</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate("/submissions")}
              className="inline-flex items-center gap-1.5 border-t border-[#edf0f4] pt-3 text-xs font-semibold text-brand hover:underline cursor-pointer"
            >
              Review records <ArrowRight size={13} />
            </button>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)] gap-4 max-[1000px]:grid-cols-1">
        <Panel
          title="Project performance"
          subtitle="Delivery against each project collection target"
          action={
            <button className="text-xs font-semibold text-brand" onClick={() => navigate("/projects")}>
              View all <ArrowRight className="inline" size={13} />
            </button>
          }
        >
          {projectSummary.length > 0 ? (
            <div className="h-[380px] pt-4 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projectChartData}
                  barCategoryGap="24%"
                  margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
                >
                  <CartesianGrid vertical={false} stroke="#edf1f5" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 11, fontWeight: 500, fill: "#334155" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [val.toLocaleString(), name]}
                    cursor={{ fill: "rgba(11, 81, 183, 0.04)" }}
                  />
                  <Bar dataKey="Target" name="Target" fill="#e8edf3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" name="Actual" fill="#0b51b7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[380px] items-center justify-center text-xs text-[#8491a3]">
              No project data available.
            </div>
          )}
        </Panel>

        <Panel title="Submissions by Project" subtitle="Distribution of data across active workspaces">
          <div className="space-y-4 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={projectPieData.length > 1 ? 3 : 0}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {projectPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number, name: string) => [`${val.toLocaleString()} submissions`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center">
                <strong className="text-xl font-bold text-gray-900">{totalProjectSubmissions.toLocaleString()}</strong>
                <span className="text-[11px] font-medium text-gray-500">Total</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-3">
              {projectPieData.map((item) => {
                const pct = totalProjectSubmissions > 0 ? Math.round((item.value / totalProjectSubmissions) * 100) : 0;
                return (
                  <ProjectLegendItem
                    key={item.name}
                    name={item.name}
                    value={item.value}
                    percentage={pct}
                    color={item.color}
                  />
                );
              })}
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function ProjectLegendItem({
  name,
  value,
  percentage,
  color,
}: {
  name: string;
  value: number;
  percentage: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50/80 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-[11px] font-medium text-slate-700">{name}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
        <span>{percentage}%</span>
        <span className="text-slate-400">•</span>
        <span>{value.toLocaleString()}</span>
      </div>
    </div>
  );
}
