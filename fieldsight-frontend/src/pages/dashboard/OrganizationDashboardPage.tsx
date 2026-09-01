import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, Database, FileCheck2, FolderKanban, MapPinned, ShieldAlert, UsersRound, Wifi } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoadingState } from "../../components/ui";
import { apiClient } from "../../services/apiClient";

const periodLabels: Record<string, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };
function relativeTime(value: string | null | undefined) { if (!value) return "Never"; const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return "Just now"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} min ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} hr ago`; const days = Math.floor(hours / 24); return `${days} day${days === 1 ? "" : "s"} ago`; }

export function OrganizationDashboardPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const [period, setPeriod] = useState("7d");
  const [location, setLocation] = useState("");
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({ queryKey: ["organization-projects", organizationId], queryFn: () => apiClient.organizationProjects(organizationId!), enabled: Boolean(organizationId) });
  const overviewQuery = useQuery({
    queryKey: ["organization-overview", projectId, location, period],
    queryFn: () => apiClient.analyticsOverview({ projectId: projectId || undefined, location: location || undefined, period }),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const enumeratorsQuery = useQuery({ queryKey: ["organization-enumerators"], queryFn: apiClient.enumerators });
  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: apiClient.submissions, refetchOnMount: "always" });
  if (overviewQuery.isLoading || projectsQuery.isLoading || enumeratorsQuery.isLoading) return <LoadingState label="Loading organization intelligence…" />;
  const overview = overviewQuery.data;
  const activeEnumerators = (enumeratorsQuery.data ?? []).filter(item => item.is_active).length;
  const qualityRate = overview?.total_submissions ? Math.round((overview.ready_records / overview.total_submissions) * 100) : 0;

  // Top KPI calculations
  const totalSubmissionsVal = overview?.total_submissions ?? 0;
  const totalProjectTarget = (overview?.projects ?? []).reduce((acc, p) => acc + (p.target || 0), 0);
  const submissionsTrendContext = overview?.submission_change_percent != null
    ? `${overview.submission_change_percent >= 0 ? "+" : ""}${overview.submission_change_percent}% vs previous period`
    : totalProjectTarget > 0
      ? `${totalSubmissionsVal.toLocaleString()} / ${totalProjectTarget.toLocaleString()} target reached`
      : "+0% vs previous period";

  const totalWorkspaceProjects = (projectsQuery.data ?? []).length || (overview?.projects ?? []).length;
  const activeProjectsWithSubs = (overview?.projects ?? []).filter(p => p.actual > 0).length;
  const activeProjectsDisplay = activeProjectsWithSubs > 0 ? activeProjectsWithSubs : totalWorkspaceProjects;
  const totalEnumeratorsCount = (enumeratorsQuery.data ?? []).length;

  // Submissions by Project Donut Chart Data
  const PROJECT_COLORS = ["#0b51b7", "#0ea5e9", "#10b981", "#6366f1", "#f59e0b", "#ec4899"];
  const rawProjectData = (overview?.projects ?? []).filter(p => p.actual > 0);
  const projectPieData = rawProjectData.length > 0
    ? rawProjectData.map((p, i) => ({
      name: p.name,
      value: p.actual,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length]
    }))
    : [
      { name: "Community Health Assessment", value: 65, color: "#0b51b7" },
      { name: "Teach For Liberia", value: 35, color: "#0ea5e9" }
    ];
  const totalProjectSubmissions = projectPieData.reduce((acc, item) => acc + item.value, 0);

  return <div className="flex flex-col gap-5 text-[#24334a]">
    <header className="flex items-end justify-between gap-4 max-[850px]:flex-col max-[850px]:items-start">
      <div><p className="mb-1 mt-0 text-[10px] font-bold uppercase tracking-[.12em] text-brand">Organization intelligence</p><h1 className="m-0 text-[30px] font-bold tracking-[-.65px]">Dashboard</h1><p className="mb-0 mt-1.5 text-[13px] text-[#718096]">Collection performance and field operations at a glance.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            className="appearance-none rounded-[6px] border border-[#dce5ef] bg-white py-[7px] pl-3 pr-8 font-sans text-[12px] font-medium text-[#4e5e74] shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">All projects</option>
            {(projectsQuery.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8492a4]" />
        </div>

        <div className="relative">
          <select
            className="appearance-none rounded-[6px] border border-[#dce5ef] bg-white py-[7px] pl-3 pr-8 font-sans text-[12px] font-medium text-[#4e5e74] shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            <option value="">All locations</option>
            {(overview?.available_locations ?? []).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8492a4]" />
        </div>

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
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8492a4]" />
        </div>
      </div>
    </header>

    <section className="grid grid-cols-4 gap-3 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1">
      <Metric label="Submissions" value={totalSubmissionsVal} context={submissionsTrendContext} icon={Database} />
      <Metric label="Pending Review" value={overview?.needs_review ?? 0} context={`${overview?.invalid_records ?? 0} invalid • ${qualityRate}% ready overall`} icon={Clock3} attention={Boolean((overview?.needs_review ?? 0) > 0 || (overview?.invalid_records ?? 0) > 0)} />
      <Metric label="Active Projects" value={activeProjectsDisplay} context={`${totalWorkspaceProjects} projects in workspace`} icon={FolderKanban} />
      <Metric label="Field Team" value={`${activeEnumerators} / ${totalEnumeratorsCount}`} context={`${activeEnumerators} active enumerators today`} icon={UsersRound} />
    </section>

    <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] gap-4 max-[1000px]:grid-cols-1">
      <Panel title="Collection performance" subtitle="Submission volume and records ready for analysis" action={<span className="text-[10px] font-semibold text-[#718096]">{periodLabels[period]}</span>}>
        <div className="h-[220px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={overview?.trend ?? []} margin={{ top: 4, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="orgReceived" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0b51b7" stopOpacity={.23} />
                  <stop offset="95%" stopColor="#0b51b7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#edf1f5" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
              <Tooltip />
              <Area type="monotone" dataKey="submissions" name="Received" stroke="#0b51b7" strokeWidth={2.5} fill="url(#orgReceived)" />
              <Area type="monotone" dataKey="approved" name="Ready" stroke="#6d81f5" strokeWidth={2} fill="transparent" />
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
              <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: qualityRate + "%" }} />
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
      <Panel title="Project performance" subtitle="Delivery against each project collection target" action={<button className="text-xs font-semibold text-brand" onClick={() => navigate("/projects")}>View all <ArrowRight className="inline" size={13} /></button>}>
        {/* Bar chart overview */}
        {(overview?.projects ?? []).length > 0 ? (
          <div className="h-[380px] pt-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(overview?.projects ?? []).map(p => ({ name: p.name, fullName: p.name, Actual: p.actual, Target: p.target || p.actual }))} barCategoryGap="24%" margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                <CartesianGrid vertical={false} stroke="#edf1f5" strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fontWeight: 500, fill: "#334155" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val: number, name: string) => [val.toLocaleString(), name]} cursor={{ fill: "rgba(11, 81, 183, 0.04)" }} />
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

      {/* Submissions by Project Panel */}
      <Panel title="Submissions by Project" subtitle="Distribution of data across active workspaces">
        <div className="flex flex-col justify-between pt-2">
          <div className="relative flex items-center justify-center pt-2">
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
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
              <strong className="text-xl font-bold text-gray-900">
                {totalProjectSubmissions.toLocaleString()}
              </strong>
              <span className="text-[11px] font-medium text-gray-500">
                Total
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <th className="pb-2">Project Name</th>
                  <th className="pb-2 text-right">%</th>
                  <th className="pb-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projectPieData.map((item) => {
                  const pct = totalProjectSubmissions > 0 ? Math.round((item.value / totalProjectSubmissions) * 100) : 0;
                  return (
                    <tr key={item.name} className="hover:bg-gray-50/50">
                      <td className="py-2 text-gray-800">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-medium truncate max-w-[160px]">{item.name}</span>
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-900">{pct}%</td>
                      <td className="py-2 text-right text-gray-500">{item.value.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </section>


  </div>;
}

function Metric({ label, value, context, icon: Icon, attention = false }: { label: string; value: number | string; context: string; icon: typeof Database; attention?: boolean }) { return <Card className="p-4"><div className="flex items-start justify-between"><div><small className="text-[10px] font-bold uppercase tracking-[.07em] text-[#77869a]">{label}</small><strong className="mt-2 block text-[25px] tracking-[-.5px]">{typeof value === "number" ? value.toLocaleString() : value}</strong></div><span className={`grid size-10 place-items-center rounded-md ${attention ? "bg-[#fff0e8] text-[#c56b2c]" : "bg-[#eaf2ff] text-brand"}`}><Icon size={18} /></span></div><p className="mb-0 mt-2 text-[10px] text-[#8491a3]">{context}</p></Card>; }
function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) { return <Card><header className="flex items-start justify-between gap-3 border-b border-[#edf0f4] px-5 py-3"><div><h2 className="m-0 text-sm font-semibold">{title}</h2><p className="mb-0 mt-0.5 text-[10px] text-[#8491a3]">{subtitle}</p></div>{action}</header><div className="px-5 pb-3">{children}</div></Card>; }
function Signal({ icon: Icon, label, value, detail, attention = false }: { icon: typeof Wifi; label: string; value: number; detail: string; attention?: boolean }) { return <div className="flex items-center gap-3 rounded-lg border border-[#e8ecf2] p-3"><span className={`grid size-8 place-items-center rounded-lg ${attention ? "bg-[#fff0e8] text-[#c56b2c]" : "bg-[#eaf2ff] text-brand"}`}><Icon size={15} /></span><span className="flex-1"><strong className="block text-xs">{label}</strong><small className="text-[10px] text-[#8190a4]">{detail}</small></span><strong className="text-lg">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="grid h-full place-items-center py-8 text-xs text-[#8491a3]">{text}</div>; }

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <article className={`overflow-hidden bg-white shadow-[0_4px_14px_rgba(23,40,70,.04)] ${className}`}>{children}</article>; }
