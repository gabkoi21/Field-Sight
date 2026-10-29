import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, LoadingState, Panel } from "../ui";
import { apiClient } from "../../services/apiClient";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyOrganizationActivity() {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const activity = useQuery({
    queryKey: ["platform-monthly-activity", year],
    queryFn: () => apiClient.monthlyOrganizationActivity(year),
    staleTime: 60_000,
  });
  const years = Array.from(new Set([currentYear, year, ...(activity.data?.available_years ?? []), ...Array.from({ length: 5 }, (_, i) => currentYear - i)])).sort((a, b) => b - a);
  const months = (activity.data?.months ?? []).map(item => ({ ...item, label: monthNames[item.month - 1] }));
  const hasActivity = months.some(item => item.submissions > 0);

  return <Panel
    className="h-full"
    title="Most active organizations"
    subtitle="Monthly leader by recorded submissions · UTC submission dates"
    action={<label className="flex items-center gap-2 whitespace-nowrap text-sm text-[var(--fs-muted)]">Year<select aria-label="Activity year" className="min-h-11 rounded-md border border-[var(--fs-control-border)] bg-white px-3 text-[var(--fs-text)]" value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
  >
    {activity.isPending && <LoadingState label="Loading monthly organization activity…" />}
    {activity.isError && <div role="alert" className="py-5 text-sm text-[var(--fs-danger)]">Unable to load monthly activity. <Button variant="secondary" onClick={() => void activity.refetch()}>Retry activity</Button></div>}
    {activity.data && !activity.isError && <>
      {hasActivity ? <div role="img" aria-label={`Monthly leading organization submission counts for ${year}. Organization names and submission counts are available in the chart tooltips.`} className="mt-4 h-[360px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={months} margin={{ top: 28, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--fs-border)" strokeDasharray="4 5" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--fs-muted)", fontSize: 12 }} minTickGap={8} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--fs-muted)", fontSize: 12 }} width={44} />
            <Tooltip cursor={{ stroke: "var(--fs-primary-border)", strokeDasharray: "4 4" }} content={({ active, payload }) => {
              const item = payload?.[0]?.payload as typeof months[number] | undefined;
              if (!active || !item) return null;
              return <div className="max-w-[260px] rounded-lg border border-line bg-white p-3 text-sm shadow-lg"><strong>{item.label} {year}</strong><p className="my-1">{item.organization_name || "No dated submissions"}</p><p className="m-0">{item.submissions.toLocaleString()} submissions</p>{item.tied_organizations > 1 && <p className="mb-0">{item.tied_organizations} organizations tied for first</p>}</div>;
            }} />
            <Line type="linear" dataKey="submissions" name="Submissions" stroke="var(--fs-primary)" strokeWidth={3} dot={{ r: 3, fill: "var(--fs-primary)", strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div> : <p className="py-10 text-center text-sm text-[var(--fs-muted)]">No dated submissions recorded for {year}.</p>}

    </>}
  </Panel>;
}
