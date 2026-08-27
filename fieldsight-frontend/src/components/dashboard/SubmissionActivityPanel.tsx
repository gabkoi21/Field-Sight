import { useState, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
}: {
  data?: SubmissionActivityPoint[];
  totalSubmissions?: number; // kept for API compat
  subtitle?: string;         // kept for API compat
}) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = PERIODS[periodIdx];

  const barData = useMemo(() => buildBarData(data, period.days), [data, period.days]);

  return (
    <section className="min-w-0 overflow-hidden rounded-[6px] border border-[#e5e9ed] bg-white">
      {/* Header */}
      <div className="border-b border-[#edf0f2] px-5 py-4">
        <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Submissions</h2>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 border-b border-[#edf0f2] px-5 py-3">
        {PERIODS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPeriodIdx(i)}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              i === periodIdx
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
          <BarChart data={barData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="35%">
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
              formatter={(value: number) => [value, "Submissions"]}
            />
            <Bar dataKey="count" fill="#0b51b7" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </section>
  );
}
