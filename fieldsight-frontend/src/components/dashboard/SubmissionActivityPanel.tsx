import { useState, useMemo } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ApiSubmission } from "../../services/apiClient";
import { Card, CardHeader } from "../ui/Card";

export interface SubmissionActivityPoint {
  day: string;
  submissions: number;
  approved: number;
}

const PERIODS = [
  { label: "Past 7 days", days: 7 },
  { label: "Past 31 days", days: 31 },
  { label: "Past 3 months", days: 91 },
  { label: "Past 12 months", days: 365 },
] as const;


function buildBarData(
  data: SubmissionActivityPoint[],
  days: number,
): { label: string; count: number }[] {
  if (!data.length) return [];

  // For 7/31 days → group by day label directly from trend data
  // For 91/365 → group by week or month
  if (days <= 31) {
    return data.slice(-days).map((d) => ({ label: d.day, count: d.submissions }));
  }
  if (days <= 91) {
    // Group into weeks (every 7 items)
    const sliced = data.slice(-days);
    const result: { label: string; count: number }[] = [];
    for (let i = 0; i < sliced.length; i += 7) {
      const chunk = sliced.slice(i, i + 7);
      result.push({ label: chunk[0].day, count: chunk.reduce((s, d) => s + d.submissions, 0) });
    }
    return result;
  }
  // Group by month (~30 day chunks)
  const sliced = data.slice(-days);
  const result: { label: string; count: number }[] = [];
  for (let i = 0; i < sliced.length; i += 30) {
    const chunk = sliced.slice(i, i + 30);
    result.push({ label: chunk[0].day, count: chunk.reduce((s, d) => s + d.submissions, 0) });
  }
  return result;
}

export function SubmissionActivityPanel({
  data = [],
  submissions, target = 0, startDate, endDate,
}: {
  data?: SubmissionActivityPoint[];
  submissions?: ApiSubmission[];
  target?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  totalSubmissions?: number; // kept for API compat
  subtitle?: string;         // kept for API compat
}) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = PERIODS[periodIdx];

  const [view, setView] = useState<"pace" | "daily" | "quality" | "productivity">("pace");
  const barData = useMemo(() => {
    if (!submissions) return buildBarData(data, period.days);
    const DAY = 86400000;
    const normalized = submissions.filter(item => item.submitted_at).sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = startDate ? new Date(startDate) : normalized[0]?.submitted_at ? new Date(normalized[0].submitted_at) : new Date(today);
    const deadline = endDate ? new Date(endDate) : new Date(today); start.setHours(0, 0, 0, 0); deadline.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, Math.round((deadline.getTime() - start.getTime()) / DAY) + 1);
    const elapsed = Math.max(0, Math.min(totalDays, Math.round((today.getTime() - start.getTime()) / DAY) + 1));
    const quota = target ? Math.max(0, Math.ceil((target - normalized.length) / Math.max(1, totalDays - elapsed))) : 0;
    const result: Array<{ date: string; label: string; count: number; cumulative: number; targetPace: number; quota: number; ready: number; flagged: number; productivity: number; version?: string }> = [];
    let cumulative = 0; let previousVersion: string | undefined;
    const finalDate = new Date(Math.max(today.getTime(), deadline.getTime()));
    for (let time = start.getTime(), index = 0; time <= finalDate.getTime(); time += DAY, index += 1) {
      const date = new Date(time); const dateKey = date.toISOString().slice(0, 10);
      const items = normalized.filter(item => new Date(item.submitted_at!).toISOString().slice(0, 10) === dateKey); cumulative += items.length;
      const workers = new Set(items.map(item => item.enumerator).filter(Boolean)).size;
      const versions = items.map(item => item.raw_answers._version ?? item.raw_answers.__version__ ?? item.raw_answers.form_version).filter(value => typeof value === "string") as string[];
      const version = versions.find(value => value !== previousVersion); if (version) previousVersion = version;
      result.push({ date: dateKey, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: items.length, cumulative, targetPace: target ? Math.min(target, Math.round(target * Math.min(index + 1, totalDays) / totalDays)) : 0, quota, ready: items.filter(item => item.review_status === "ready").length, flagged: items.filter(item => item.review_status !== "ready").length, productivity: workers ? Number((items.length / workers).toFixed(1)) : 0, version });
    }
    return result;
  }, [data, period.days, submissions, target, startDate, endDate]);
  const current = [...barData].reverse().find(point => !("date" in point) || String(point.date) <= new Date().toISOString().slice(0, 10)) as (typeof barData[number] & { cumulative?: number; targetPace?: number; quota?: number }) | undefined;
  const paceDelta = (current?.cumulative ?? 0) - (current?.targetPace ?? 0);

  return (
    <Card>
      <CardHeader title="Collection performance" subtitle={submissions && target ? `${Math.abs(paceDelta)} submissions ${paceDelta >= 0 ? "ahead of" : "behind"} target pace` : "Project submission pace and quality"}>{submissions && current?.quota ? <span className="rounded-md bg-[#edf3fc] px-2 py-1 text-[10px] font-semibold text-brand">Goal: {current.quota}/day</span> : null}</CardHeader>

      {/* Period tabs */}
      <div className="flex gap-1 border-b border-[#edf0f2] px-5 py-3">
        {(submissions ? [{ label: "Cumulative pace", id: "pace" }, { label: "Daily rate", id: "daily" }, { label: "Clean vs flagged", id: "quality" }, { label: "Enumerator output", id: "productivity" }] : PERIODS).map((p, i) => (
          <button
            key={p.label}
            onClick={() => submissions ? setView((p as { id: typeof view }).id) : setPeriodIdx(i)}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              submissions ? view === (p as { id: string }).id : i === periodIdx
                ? "bg-[#e8f1ff] text-[#0b51b7] font-semibold"
                : "bg-transparent text-[#748299] hover:text-[#344562]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="px-4 pt-4" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={barData} margin={{ top: 10, right: 8, left: -28, bottom: 0 }} barCategoryGap="35%">
            <CartesianGrid vertical={false} stroke="#eef1f4" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8491a5", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9aa4ae", fontSize: 10 }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "#f0f5ff" }}
              contentStyle={{ border: "1px solid #e5e8ec", borderRadius: 6, fontSize: 12 }}
            />
            {!submissions && <Bar dataKey="count" name="Submissions" fill="#0b51b7" radius={[3, 3, 0, 0]} />}
            {submissions && view === "pace" && <><Line type="monotone" dataKey="cumulative" name="Actual cumulative" stroke="#0b51b7" strokeWidth={2.5} dot={false} /><Line type="linear" dataKey="targetPace" name="Target pace" stroke="#8a96a7" strokeWidth={2} strokeDasharray="6 5" dot={false} /></>}
            {submissions && view === "daily" && <><Bar dataKey="count" name="Daily submissions" fill="#5c9af5" radius={[3, 3, 0, 0]} /><Line type="step" dataKey="quota" name="Required daily quota" stroke="#d88935" strokeWidth={2} dot={false} /></>}
            {submissions && view === "quality" && <><Area type="monotone" dataKey="ready" name="Ready" stackId="quality" stroke="#0b51b7" fill="#5c9af5" /><Area type="monotone" dataKey="flagged" name="Flagged / incomplete" stackId="quality" stroke="#d88935" fill="#f4b45e" /></>}
            {submissions && view === "productivity" && <><Bar dataKey="count" name="Daily submissions" fill="#dbe9fc" radius={[3, 3, 0, 0]} /><Line type="monotone" dataKey="productivity" name="Average per active enumerator" stroke="#7868b8" strokeWidth={2.5} dot={false} /></>}
            {submissions && barData.filter(point => "version" in point && point.version).map(point => <ReferenceLine key={`${point.label}-${"version" in point ? point.version : ""}`} x={point.label} stroke="#7868b8" strokeDasharray="3 3" label={{ value: String("version" in point ? point.version ?? "" : ""), position: "insideTopRight", fontSize: 9, fill: "#7868b8" }} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </Card>
  );
}
