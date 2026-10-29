import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";
import { MetricCard } from "../ui/MetricCard";

export type MetricTone = "blue" | "green" | "orange" | "violet" | "red";

export function AdminMetric({ label, value, detail, icon, tone: _tone }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: MetricTone }) {
  return <MetricCard label={label} value={value} context={detail} icon={icon} />;
}

export function AdminPanel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={`p-4 ${className}`}><header className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-base font-semibold text-[var(--fs-text)]">{title}</h2>{description && <p className="mb-0 mt-1 text-sm text-[var(--fs-muted)]">{description}</p>}</div>{action}</header>{children}</Card>;
}

export function AdminStatus({ value }: { value: string }) {
  const green = ["Active", "Healthy", "Paid", "Completed", "Operational"];
  const red = ["Suspended", "Overdue", "Blocked", "Failed", "Critical", "Unavailable"];
  const orange = ["Trial", "Pending", "Invited", "Degraded", "Warning"];
  const tone = green.includes(value) ? "bg-emerald-50 text-[var(--fs-success)]" : red.includes(value) ? "bg-red-50 text-[var(--fs-danger)]" : orange.includes(value) ? "bg-amber-50 text-[var(--fs-warning)]" : "bg-[var(--fs-primary-soft)] text-[var(--fs-info-text)]";
  return <span className={`inline-flex items-center rounded-[3px] px-2 py-[3px] text-[12px] font-semibold ${tone}`}>{value}</span>;
}

export function AdminTableFooter({ shown, total, page = 1, pageSize = 10, onPageChange }: { shown: number; total: number; page?: number; pageSize?: number; onPageChange?: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm text-[var(--fs-muted)]"><span>{total ? `${(page - 1) * pageSize + 1}-${(page - 1) * pageSize + shown}` : "0"} of {total} matching records</span>{onPageChange && <div className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button></div>}</footer>;
}

export const adminInputClass = "min-h-11 w-full rounded-md border border-[var(--fs-control-border)] bg-[var(--fs-surface)] px-3 text-sm text-[var(--fs-text)] transition-colors focus:border-[var(--fs-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--fs-primary)]";
