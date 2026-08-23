import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type MetricTone = "blue" | "green" | "orange" | "violet" | "red";

export function AdminMetric({ label, value, detail, icon: Icon, tone = "blue" }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: MetricTone }) {
  const tones: Record<MetricTone, string> = {
    blue: "bg-[#e9f1ff] text-[#0b51b7]",
    green: "bg-[#e6f7f2] text-[#158e7d]",
    orange: "bg-[#fff1e4] text-[#d8792a]",
    violet: "bg-[#f0edff] text-[#6d5bd0]",
    red: "bg-[#fde9eb] text-[#c64e57]",
  };
  return <article className="grid grid-cols-[auto_1fr] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]"><span className={`row-span-2 grid size-[40px] place-items-center rounded-full ${tones[tone]}`}><Icon size={19} /></span><div><p className="m-0 text-[11px] font-medium text-[#6f7d8a]">{label}</p><strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">{value}</strong></div><small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">{detail}</small></article>;
}

export function AdminPanel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <article className={`min-w-0 rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] ${className}`}><header className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">{title}</h2>{description && <p className="mb-0 mt-1 text-[11px] text-[#84909b]">{description}</p>}</div>{action}</header>{children}</article>;
}

export function AdminStatus({ value }: { value: string }) {
  const green = ["Active", "Healthy", "Paid", "Completed", "Operational"];
  const red = ["Suspended", "Overdue", "Blocked", "Failed", "Critical"];
  const orange = ["Trial", "Pending", "Invited", "Degraded", "Warning"];
  const tone = green.includes(value) ? "bg-[#e6f7f2] text-[#158e7d]" : red.includes(value) ? "bg-[#fde9eb] text-[#c64e57]" : orange.includes(value) ? "bg-[#fff1e4] text-[#d8792a]" : "bg-[#e9f1ff] text-[#0b51b7]";
  return <span className={`inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-semibold ${tone}`}>{value}</span>;
}

export function AdminTableFooter({ shown, total }: { shown: number; total: number }) {
  return <footer className="mt-[12px] flex items-center justify-between border-t border-[#edf0f2] pt-3 text-[10px] text-[#84909b]"><span>Showing {shown} of {total} records</span><span className="flex items-center gap-1"><button className="border-0 bg-transparent text-[#8793a2]">Previous</button><b className="grid size-6 place-items-center rounded bg-brand text-white">1</b><button className="border-0 bg-transparent text-[#8793a2]">Next</button></span></footer>;
}

export const adminInputClass = "min-h-[36px] w-full rounded-[5px] border border-transparent bg-[#f7f9fb] px-[9px] text-[12px] text-[#425162] outline-none focus:border-transparent focus:bg-[#f4f7f9] focus:shadow-none";
