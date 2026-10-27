import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useId } from "react";
import { CalendarDays } from "lucide-react";
import type { ApiProject } from "../services/apiClient";

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : date;
}
export function ProjectTimeline({ project }: { project: Pick<ApiProject, "start_date" | "end_date"> }) {
  const heading = useId();
  const start = parseDate(project.start_date), end = parseDate(project.end_date);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const valid = start && end && end.getTime() > start.getTime();
  const elapsed = valid ? Math.max(0, Math.min(100, (today - start.getTime()) / (end.getTime() - start.getTime()) * 100)) : null;
  const chartData = valid ? [
    { date: start.getTime(), planned: 0, elapsed: 0 as number | null },
    ...(today > start.getTime() && today < end.getTime() ? [{ date: today, planned: elapsed!, elapsed: elapsed! }] : []),
    { date: end.getTime(), planned: 100, elapsed: elapsed === 100 ? 100 : null },
  ] : [];
  const label = (date: Date | null) => date ? date.toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" }) : "Not set";
  return <section aria-labelledby={heading} className="flex min-w-0 flex-col border border-[var(--fs-metric-border)] bg-white p-5">
    <header className="flex items-center gap-2"><CalendarDays size={19} className="text-[var(--fs-primary)]" aria-hidden="true" /><h2 id={heading} className="m-0 text-lg font-semibold">Project timeline</h2></header>
    <p className="mb-0 mt-2 text-xs text-[var(--fs-muted)]">Selected project · planned schedule</p>
    <div className="flex flex-1 flex-col justify-center py-4">
      <dl className="m-0 grid grid-cols-2 gap-4"><div><dt className="text-xs text-[var(--fs-muted)]">Start date</dt><dd className="m-0 mt-2 text-base font-semibold">{label(start)}</dd></div><div className="text-right"><dt className="text-xs text-[var(--fs-muted)]">End date</dt><dd className="m-0 mt-2 text-base font-semibold">{label(end)}</dd></div></dl>
      {elapsed !== null && <>
        <div role="img" aria-label={"Planned timeline: " + Math.round(elapsed) + "% of planned time elapsed. Schedule only, not work progress."} className="mt-5 h-[190px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 18, bottom: 10, left: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--fs-border)" strokeDasharray="3 5" />
              <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} ticks={valid ? [start.getTime(), end.getTime()] : []} tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} tick={{ fontSize: 12, fill: "var(--fs-muted)" }} tickLine={false} axisLine={false} dy={8} padding={{ left: 8, right: 8 }} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={value => value + "%"} tick={{ fontSize: 12, fill: "var(--fs-muted)" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })} formatter={value => Math.round(Number(value)) + "%"} contentStyle={{ border: "1px solid var(--fs-border)", borderRadius: 6, fontSize: 12 }} />
              <Line type="linear" dataKey="planned" name="Planned timeline" stroke="#a6bdd8" strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="elapsed" name="Time elapsed" stroke="#0860b4" strokeWidth={3} dot={{ r: 4, fill: "#0860b4", stroke: "white", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-5 text-xs text-[var(--fs-muted)]"><span className="inline-flex items-center gap-2"><span className="w-5 border-t-[3px] border-[#0860b4]" aria-hidden="true" />Time elapsed</span><span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-[#a6bdd8]" aria-hidden="true" />Planned timeline</span></div>
      </>}
    </div>
  </section>;
}
