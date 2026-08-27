import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Database, FileCheck2, FolderKanban, MapPinned, RefreshCw, ShieldAlert, UsersRound, Wifi } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  const overviewQuery = useQuery({ queryKey: ["organization-overview", projectId, location, period], queryFn: () => apiClient.analyticsOverview({ projectId: projectId || undefined, location: location || undefined, period }) });
  const enumeratorsQuery = useQuery({ queryKey: ["organization-enumerators"], queryFn: apiClient.enumerators });
  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: apiClient.submissions });
  const [locView, setLocView] = useState<"counties" | "communities">("counties");
  if (overviewQuery.isLoading || projectsQuery.isLoading || enumeratorsQuery.isLoading) return <LoadingState label="Loading organization intelligence…" />;
  const overview = overviewQuery.data;
  const activeEnumerators = (enumeratorsQuery.data ?? []).filter(item => item.is_active).length;
  const qualityRate = overview?.total_submissions ? Math.round((overview.ready_records / overview.total_submissions) * 100) : 0;

  // Build top-location counts from raw_answers
  const allSubs = submissionsQuery.data ?? [];
  const locCounts = new Map<string, number>();
  for (const s of allSubs) {
    const raw = s.raw_answers as Record<string, unknown>;
    const key = locView === "counties"
      ? (raw["household/county"] as string | undefined)
      : ((raw["household/community"] as string | undefined) ?? (raw["household/community_or_settlement"] as string | undefined));
    if (key && typeof key === "string" && key.trim())
      locCounts.set(key.trim(), (locCounts.get(key.trim()) ?? 0) + 1);
  }
  const topLocs = [...locCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const LOC_COLORS = ["#0b51b7", "#5c9af5", "#93bbfb"];

  return <div className="flex flex-col gap-5 text-[#24334a]">
    <header className="flex items-end justify-between gap-4 max-[850px]:flex-col max-[850px]:items-start">
      <div><p className="mb-1 mt-0 text-[10px] font-bold uppercase tracking-[.12em] text-brand">Organization intelligence</p><h1 className="m-0 text-[30px] font-bold tracking-[-.65px]">Dashboard</h1><p className="mb-0 mt-1.5 text-[13px] text-[#718096]">Collection performance and field operations at a glance.</p></div>
      <div className="flex flex-wrap gap-2"><select className="rounded-lg border border-[#dce4ed] bg-white px-3 py-2 text-xs" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">All projects</option>{(projectsQuery.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="rounded-lg border border-[#dce4ed] bg-white px-3 py-2 text-xs" value={location} onChange={event => setLocation(event.target.value)}><option value="">All locations</option>{(overview?.available_locations ?? []).map(item => <option key={item}>{item}</option>)}</select><select className="rounded-lg border border-[#dce4ed] bg-white px-3 py-2 text-xs" value={period} onChange={event => setPeriod(event.target.value)}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><button className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white" onClick={() => navigate("/sync")}><RefreshCw size={14} /> Sync data</button></div>
    </header>

    <section className="grid grid-cols-4 gap-3 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1">
      <Metric label="Submissions" value={overview?.total_submissions ?? 0} context={overview?.submission_change_percent == null ? "No prior-period comparison" : `${overview.submission_change_percent >= 0 ? "+" : ""}${overview.submission_change_percent}% from previous period`} icon={Database} />
      <Metric label="Analysis ready" value={overview?.ready_records ?? 0} context={`${qualityRate}% of records in view`} icon={FileCheck2} />
      <Metric label="Active projects" value={overview?.active_projects ?? 0} context={`${(projectsQuery.data ?? []).length} projects in workspace`} icon={FolderKanban} />
      <Metric label="Field team" value={activeEnumerators} context={`${(enumeratorsQuery.data ?? []).length} enumerator accounts`} icon={UsersRound} />
    </section>

    <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] gap-4 max-[1000px]:grid-cols-1">
      <Panel title="Collection performance" subtitle="Submission volume and records ready for analysis" action={<span className="text-[10px] font-semibold text-[#718096]">{periodLabels[period]}</span>}><div className="h-[290px] pt-4"><ResponsiveContainer><AreaChart data={overview?.trend ?? []}><defs><linearGradient id="orgReceived" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0b51b7" stopOpacity={.23} /><stop offset="95%" stopColor="#0b51b7" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf1f5" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="submissions" name="Received" stroke="#0b51b7" strokeWidth={2.5} fill="url(#orgReceived)" /><Area type="monotone" dataKey="approved" name="Ready" stroke="#6d81f5" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer></div></Panel>
      <Panel title="Data readiness" subtitle="Quality status of records in this view"><div className="pt-5"><div className="flex items-end justify-between"><div><strong className="text-[34px] tracking-[-1px]">{qualityRate}%</strong><span className="ml-2 text-[10px] text-[#8190a4]">analysis ready</span></div><FileCheck2 className="text-brand" size={22} /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8edf3]"><div className="h-full rounded-full bg-brand transition-all" style={{ width: qualityRate + "%" }} /></div><div className="mt-6 space-y-3 border-t border-[#edf0f4] pt-4"><div className="flex items-center text-xs"><span className="mr-2 size-2 rounded-full bg-brand" /><span className="flex-1 text-[#66758a]">Ready</span><strong>{overview?.ready_records ?? 0}</strong></div><div className="flex items-center text-xs"><span className="mr-2 size-2 rounded-full bg-[#f0a640]" /><span className="flex-1 text-[#66758a]">Needs review</span><strong>{overview?.needs_review ?? 0}</strong></div><div className="flex items-center text-xs"><span className="mr-2 size-2 rounded-full bg-[#db5b66]" /><span className="flex-1 text-[#66758a]">Invalid</span><strong>{overview?.invalid_records ?? 0}</strong></div></div><button onClick={() => navigate("/submissions")} className="mt-5 inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-semibold text-brand">Review records <ArrowRight size={13} /></button></div></Panel>
    </section>

    <section className="grid grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)] gap-4 max-[1000px]:grid-cols-1">
      <Panel title="Project performance" subtitle="Delivery against each project collection target" action={<button className="text-xs font-semibold text-brand" onClick={() => navigate("/projects")}>View all <ArrowRight className="inline" size={13} /></button>}><div className="mt-2 divide-y divide-[#edf0f4]">{(overview?.projects ?? []).map(project => { const percentage = project.target ? Math.min(100, Math.round((project.actual / project.target) * 100)) : 0; return <div key={project.id} className="grid grid-cols-[minmax(150px,1fr)_minmax(180px,1.15fr)_70px] items-center gap-5 py-4 max-[650px]:grid-cols-1 max-[650px]:gap-2"><div><strong className="block text-xs">{project.name}</strong><small className="mt-1 block text-[10px] text-[#8390a1]">{project.actual.toLocaleString()} of {project.target.toLocaleString()} submissions</small></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e8edf3]"><div className="h-full rounded-full bg-brand" style={{ width: percentage + "%" }} /></div><strong className="text-right text-xs max-[650px]:text-left">{percentage}%</strong></div> })}{!overview?.projects.length && <Empty text="No project targets are available." />}</div></Panel>

      {/* Top Locations Panel */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#e1e7ef] bg-white shadow-[0_5px_18px_rgba(25,43,75,.04)]">
        <header className="flex items-start justify-between gap-3 border-b border-[#edf0f4] px-5 py-4">
          <div>
            <h2 className="m-0 text-sm font-semibold">Top locations</h2>
            <p className="mb-0 mt-1 text-[10px] text-[#8491a3]">Leading {locView} by submission count</p>
          </div>
          <div className="relative">
            <select
              value={locView}
              onChange={(e) => setLocView(e.target.value as "counties" | "communities")}
              className="appearance-none rounded-lg border border-[#dce4ed] bg-white py-1.5 pl-3 pr-7 text-[12px] font-medium text-[#344562] focus:outline-none"
            >
              <option value="counties">Counties</option>
              <option value="communities">Communities</option>
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#748299]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </header>
        <div className="px-5 pb-5">
          {topLocs.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#8491a3]">No location data available. Sync Kobo data to populate.</p>
          ) : (
            <>
              <div className="flex justify-center py-5">
                {(() => {
                  let cum = 0;
                  const stops = topLocs.map(([, n], i) => { const p = allSubs.length ? (n / allSubs.length) * 100 : 0; const st = `${LOC_COLORS[i]} ${cum}% ${cum + p}%`; cum += p; return st; });
                  if (cum < 100) stops.push(`#e8edf3 ${cum}% 100%`);
                  return (
                    <div className="relative size-[120px] rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
                      <span className="absolute inset-[20px] grid place-items-center rounded-full bg-white text-center">
                        <strong className="block text-[18px] leading-none text-[#1d2a38]">{allSubs.length}</strong>
                        <span className="mt-0.5 block text-[9px] text-[#8491a3]">total</span>
                      </span>
                    </div>
                  );
                })()}
              </div>
              <table className="w-full text-left">
                <thead><tr className="border-b border-[#edf0f4] text-[10px] font-semibold uppercase tracking-[.06em] text-[#8491a3]"><th className="pb-2">Location</th><th className="pb-2 text-right">%</th><th className="pb-2 text-right">Count</th></tr></thead>
                <tbody>
                  {topLocs.map(([name, count], i) => (
                    <tr key={name} className="border-b border-[#f4f6f9] last:border-0">
                      <td className="py-2.5 text-[12px] text-[#2e4364]"><span className="flex items-center gap-2"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: LOC_COLORS[i] }} />{name}</span></td>
                      <td className="py-2.5 text-right text-[12px] font-semibold text-[#2e4364]">{allSubs.length ? Math.round((count / allSubs.length) * 100) : 0}%</td>
                      <td className="py-2.5 text-right text-[12px] text-[#8491a3]">{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>
    </section>

    <Panel title="Recent field activity" subtitle="Latest records imported from connected sources" action={<button className="text-xs font-semibold text-brand" onClick={() => navigate("/submissions")}>Review submissions <ArrowRight className="inline" size={13} /></button>}><div className="mt-3 divide-y divide-[#edf0f4]">{(overview?.activity ?? []).map(item => <div key={item.id} className="grid grid-cols-[minmax(180px,.7fr)_minmax(260px,1.3fr)_140px_90px] items-center gap-4 py-3 text-xs max-[800px]:grid-cols-1 max-[800px]:gap-1"><strong>{item.name}</strong><span className="text-[#66758a]">{item.detail}</span><span className="flex items-center gap-1 text-[#7b899c]"><MapPinned size={12} />{item.location ?? "No location"}</span><small className="text-right text-[#8b97a7] max-[800px]:text-left">{relativeTime(item.occurred_at)}</small></div>)}{!overview?.activity.length && <Empty text="No field activity in this view." />}</div></Panel>
  </div>;
}

function Metric({ label, value, context, icon: Icon, attention = false }: { label: string; value: number; context: string; icon: typeof Database; attention?: boolean }) { return <Card className="p-4"><div className="flex items-start justify-between"><div><small className="text-[10px] font-bold uppercase tracking-[.07em] text-[#77869a]">{label}</small><strong className="mt-2 block text-[25px] tracking-[-.5px]">{value.toLocaleString()}</strong></div><span className={`grid size-10 place-items-center rounded-md ${attention ? "bg-[#fff0e8] text-[#c56b2c]" : "bg-[#eaf2ff] text-brand"}`}><Icon size={18} /></span></div><p className="mb-0 mt-2 text-[10px] text-[#8491a3]">{context}</p></Card>; }
function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) { return <Card><header className="flex items-start justify-between gap-3 border-b border-[#edf0f4] px-5 py-4"><div><h2 className="m-0 text-sm font-semibold">{title}</h2><p className="mb-0 mt-1 text-[10px] text-[#8491a3]">{subtitle}</p></div>{action}</header><div className="px-5 pb-5">{children}</div></Card>; }
function Signal({ icon: Icon, label, value, detail, attention = false }: { icon: typeof Wifi; label: string; value: number; detail: string; attention?: boolean }) { return <div className="flex items-center gap-3 rounded-lg border border-[#e8ecf2] p-3"><span className={`grid size-8 place-items-center rounded-lg ${attention ? "bg-[#fff0e8] text-[#c56b2c]" : "bg-[#eaf2ff] text-brand"}`}><Icon size={15} /></span><span className="flex-1"><strong className="block text-xs">{label}</strong><small className="text-[10px] text-[#8190a4]">{detail}</small></span><strong className="text-lg">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="grid h-full place-items-center py-8 text-xs text-[#8491a3]">{text}</div>; }

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <article className={`overflow-hidden bg-white shadow-[0_4px_14px_rgba(23,40,70,.04)] ${className}`}>{children}</article>; }