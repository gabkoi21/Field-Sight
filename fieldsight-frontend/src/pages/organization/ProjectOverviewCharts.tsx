import { useId } from "react";
import { ProjectNavLink as NavLink } from "../../workspace/projectRouting";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Card } from "../../components/ui/Card";
import { LoadingState } from "../../components/ui";
import type { ApiAnalyticsOverview, Indicator } from "../../services/apiClient";

export type TrendPeriod = "7d" | "30d";
const muted = "text-[var(--fs-muted)]";
const link = "inline-flex min-h-11 items-center text-xs font-semibold text-[var(--fs-primary)] hover:underline";

function ChartError({ retry }: { retry: () => void }) {
  return <div role="alert" className="px-5 py-10 text-sm text-[var(--fs-danger)]">Chart data is unavailable. <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={retry}>Retry chart</button></div>;
}

export function CollectionTrend({ data, loading, error, retry, period, onPeriod }: {
  data?: ApiAnalyticsOverview; loading: boolean; error: boolean; retry: () => void;
  period: TrendPeriod; onPeriod: (value: TrendPeriod) => void;
}) {
  const gradientId = useId().replaceAll(":", "");
  const rows = data?.trend ?? [];
  const submitted = rows.reduce((sum, row) => sum + row.submissions, 0);
  const ready = rows.reduce((sum, row) => sum + row.approved, 0);
  return <section aria-labelledby="collection-trend-heading" className="min-w-0"><Card className="h-full !rounded-none !border !border-[#d8e0e9] !shadow-none">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf5] px-4 py-3">
      <h2 id="collection-trend-heading" className="m-0 text-sm font-medium">Collection trend</h2>
      <div className="inline-flex rounded border border-[#e3eaf5] bg-white p-0.5" role="group" aria-label="Collection trend period">{(["7d", "30d"] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => onPeriod(value)} className={`min-h-9 rounded-md px-3 text-xs font-medium transition-colors ${period === value ? "bg-[#edf4ff] text-[var(--fs-primary)]" : muted}`}>{value === "7d" ? "7 days" : "30 days"}</button>)}</div>
    </header>
    {loading ? <div className="p-8"><LoadingState variant="panel" label="Loading collection trend…" /></div> : error ? <ChartError retry={retry} /> : !rows.length ? <div className={`flex min-h-[260px] flex-col items-center justify-center px-6 text-center text-sm ${muted}`}><p className="mb-1 font-medium text-[var(--fs-text)]">No dated submissions in this period</p><p className="m-0">Try a longer period or synchronize your source.</p></div> : <>
      <p className="mb-0 px-5 pt-5 text-xs text-[var(--fs-muted)]">{submitted.toLocaleString()} submitted / {ready.toLocaleString()} ready for use / {period === "7d" ? "last 7 days" : "last 30 days"} (UTC)</p>
      <div className="flex flex-wrap items-center justify-end gap-4 px-5 pt-3 text-xs text-[#6e87af]"><span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#337cff]" aria-hidden="true" />Submitted</span><span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#a5c4f4]" aria-hidden="true" />Ready records</span></div>
      <div className="h-[250px] px-2 pb-3 pt-4 sm:px-4" role="img" aria-label={`Daily submitted and ready record counts for the last ${period === "7d" ? "7" : "30"} days. Exact values are available in the chart data table.`}>
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={rows} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} accessibilityLayer>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#337cff" stopOpacity={0.14} /><stop offset="100%" stopColor="#337cff" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#e5edf9" strokeDasharray="3 4" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--fs-muted)" }} minTickGap={30} dy={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--fs-muted)" }} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--fs-border)", fontSize: 12 }} />
          <Area type="monotone" dataKey="submissions" name="Submitted" stroke="#337cff" strokeWidth={1.8} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Area type="monotone" dataKey="approved" name="Ready records" stroke="#a5c4f4" strokeWidth={1.6} strokeDasharray="5 4" fill="#a5c4f4" fillOpacity={0.04} dot={false} isAnimationActive={false} />
        </AreaChart></ResponsiveContainer>
      </div>
    </>}
    {!loading && !error && rows.length > 0 && <div className="sr-only"><table className="fs-data-table w-full text-left tabular-nums" aria-label="Daily collection counts"><thead><tr><th scope="col" className="pr-5 py-2">Day (UTC)</th><th scope="col" className="pr-5 py-2">Submitted</th><th scope="col" className="py-2">Ready records</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.day}-${index}`}><th scope="row" className="pr-5 py-1 font-normal">{row.day}</th><td className="pr-5 py-1">{row.submissions}</td><td className="py-1">{row.approved}</td></tr>)}</tbody></table></div>}

  </Card></section>;
}

export function ReviewBreakdown({ counts, loading, error, retry, scope, subtitle = "All saved records � all dates" }: {
  counts?: Record<string, number>; loading: boolean; error: boolean; retry: () => void; scope: string; subtitle?: string;
}) {
  const rows = [
    { name: "Ready", value: counts?.ready ?? 0, color: "var(--fs-primary)", status: "ready" },
    { name: "Awaiting review", value: counts?.needs_review ?? 0, color: "#6c99cf", status: "needs_review" },
    { name: "Invalid", value: counts?.invalid ?? 0, color: "var(--fs-danger)", status: "invalid" },
  ];
  const other = Object.entries(counts ?? {}).filter(([key]) => !["ready", "needs_review", "invalid"].includes(key)).reduce((sum, [, value]) => sum + value, 0);
  if (other) rows.push({ name: "Other statuses", value: other, color: "var(--fs-muted)", status: "" });
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return <section aria-labelledby="review-breakdown-heading" className="min-w-0"><Card className="flex h-full flex-col !rounded-none !border !border-[#d8e0e9] !shadow-none">
    <header className="px-5 pt-5"><h2 id="review-breakdown-heading" className="m-0 text-base font-semibold">Review status</h2><p className={`mb-0 mt-1 text-xs ${muted}`}>All saved records · all dates</p></header>
    {loading ? <div className="p-8"><LoadingState variant="panel" label="Loading review breakdown…" /></div> : error ? <ChartError retry={retry} /> : total === 0 ? <div className={`flex min-h-[260px] items-center justify-center p-6 text-center text-sm ${muted}`}>No saved records to chart yet.</div> : <div className="flex flex-1 flex-col justify-center px-5 pb-4">
      <div className="relative h-[205px] w-full shrink-0" role="img" aria-label={`Review status: ${rows.map(row => `${row.name} ${row.value}`).join(", ")}.`}>
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows.filter(row => row.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={63} outerRadius={82} startAngle={90} endAngle={-270} paddingAngle={rows.filter(row => row.value > 0).length > 1 ? 4 : 0} stroke="none" isAnimationActive={false}>{rows.filter(row => row.value > 0).map(row => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--fs-border)", fontSize: 12 }} /></PieChart></ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-[30px] font-semibold leading-tight tabular-nums">{total.toLocaleString()}</strong><span className={`mt-1 text-xs ${muted}`}>{total === 1 ? "record" : "records"}</span></div>
      </div>
      <ul className="m-0 list-none space-y-1 p-0">{rows.map(row => <li key={row.name}><NavLink to={`/submissions?${scope}${row.status ? `&review_status=${row.status}` : ""}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-[var(--fs-canvas)]"><span className={`inline-flex items-center gap-2.5 ${muted}`}><i className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />{row.name}</span><strong className="min-w-8 rounded-md bg-[var(--fs-canvas)] px-2 py-1 text-center text-xs font-semibold tabular-nums">{row.value.toLocaleString()}</strong></NavLink></li>)}</ul>
    </div>}
  </Card></section>;
}

export function IndicatorReadiness({ items, loading, error, retry, projectId }: {
  items?: Indicator[]; loading: boolean; error: boolean; retry: () => void; projectId: string;
}) {
  const configured = items?.filter(item => item.setup_complete && item.result_source !== "unconfigured").length ?? 0;
  const rows = [
    { name: "Configured", value: configured, color: "var(--fs-primary)" },
    { name: "Needs setup", value: (items?.length ?? 0) - configured, color: "#bd872d" },
    { name: "Overdue targets", value: items?.filter(item => item.schedule_status === "overdue").length ?? 0, color: "var(--fs-danger)" },
  ];
  return <section aria-labelledby="indicator-readiness-heading" className="min-w-0"><Card className="h-full !rounded-none !border !border-[var(--fs-metric-border)] !shadow-none">
    <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4"><h2 id="indicator-readiness-heading" className="m-0 text-base font-semibold">Indicator status</h2><NavLink to={`/projects/${projectId}/indicators`} className={link}>{items?.length ? "View all indicators →" : "Configure indicators →"}</NavLink></header>
    {loading ? <div className="p-5"><LoadingState variant="inline" label="Loading indicator chart…" /></div> : error ? <ChartError retry={retry} /> : !items?.length ? <p className={`px-5 pb-5 text-sm ${muted}`}>No active indicators configured</p> : <>
      <div className="h-[155px] px-4 pb-3" role="img" aria-label={`Active indicator status: ${rows.map(row => `${row.name} ${row.value}`).join(", ")}. Overdue targets may also be configured.`}>
        <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={rows} margin={{ left: 0, right: 35, top: 3, bottom: 0 }} accessibilityLayer>
          <XAxis type="number" allowDecimals={false} domain={[0, Math.max(1, items.length)]} hide />
          <YAxis type="category" dataKey="name" width={108} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--fs-muted)" }} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--fs-border)", fontSize: 12 }} cursor={{ fill: "var(--fs-canvas)" }} />
          <Bar dataKey="value" name="Indicators" barSize={13} radius={[0, 4, 4, 0]} background={{ fill: "var(--fs-canvas)", radius: 4 }} label={{ position: "right", fill: "var(--fs-text)", fontSize: 12 }} isAnimationActive={false}>{rows.map(row => <Cell key={row.name} fill={row.color} />)}</Bar>
        </BarChart></ResponsiveContainer>
      </div>
      <div className="sr-only"><dl>{rows.map(row => <div key={row.name}><dt>{row.name}</dt><dd>{row.value}</dd></div>)}</dl></div>
    </>}
  </Card></section>;
}
