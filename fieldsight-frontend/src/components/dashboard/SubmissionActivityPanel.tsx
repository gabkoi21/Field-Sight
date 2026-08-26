import { ExternalLink } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";

export interface SubmissionActivityPoint {
  day: string;
  submissions: number;
  approved: number;
}

export const defaultSubmissionTrend: SubmissionActivityPoint[] = [
  { day: "Aug 13", submissions: 246, approved: 218 },
  { day: "Aug 14", submissions: 310, approved: 279 },
  { day: "Aug 15", submissions: 284, approved: 260 },
  { day: "Aug 16", submissions: 372, approved: 331 },
  { day: "Aug 17", submissions: 341, approved: 308 },
  { day: "Aug 18", submissions: 448, approved: 402 },
  { day: "Today", submissions: 516, approved: 461 },
];

export function SubmissionActivityPanel({ data = defaultSubmissionTrend, subtitle = "Incoming and approved records across active projects" }: { data?: SubmissionActivityPoint[]; subtitle?: string }) {
  return <section className="min-w-0 rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
    <header className="flex !h-auto items-start justify-between !border-0 !bg-transparent !p-0">
      <div><h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Submission activity</h2><p className="mt-1 text-[11px] text-[#84909b]">{subtitle}</p></div>
      <Link className="inline-flex items-center gap-[6px] text-[11px] font-semibold text-brand no-underline" to="/submissions">View submissions <ExternalLink size={13} /></Link>
    </header>
    <div className="flex h-[24px] justify-end gap-[14px] pt-[5px] text-[10px] text-[#788591]"><span className="flex items-center gap-[5px]"><i className="size-[7px] rounded-full bg-brand" />Submitted</span><span className="flex items-center gap-[5px]"><i className="size-[7px] rounded-full bg-[#6d81f5]" />Approved</span></div>
    <div className="h-[235px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}><defs><linearGradient id="submittedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b51b7" stopOpacity=".22" /><stop offset="1" stopColor="#0b51b7" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f2" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#7d8996", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#9aa4ae", fontSize: 10 }} /><Tooltip contentStyle={{ border: "1px solid #e5e8ec", borderRadius: 6, fontSize: 12 }} /><Area type="monotone" dataKey="submissions" stroke="#0b51b7" strokeWidth={2.4} fill="url(#submittedFill)" /><Area type="monotone" dataKey="approved" stroke="#6d81f5" strokeWidth={2} fill="transparent" strokeDasharray="4 3" /></AreaChart></ResponsiveContainer></div>
  </section>;
}
