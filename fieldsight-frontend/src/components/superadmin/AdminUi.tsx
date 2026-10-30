import { useId, useState, type ReactNode } from "react";
import { ChevronsUpDown, ChevronUp, ChevronDown, Search, Filter } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";
import { MetricCard } from "../ui/MetricCard";

export type MetricTone = "blue" | "green" | "orange" | "violet" | "red";

export function AdminMetric({ label, value, detail, icon, tone: _tone }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: MetricTone }) {
  return <MetricCard label={label} value={value} context={detail} icon={icon} />;
}

export function AdminPanel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={`p-4 sm:p-6 ${className}`}><header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="m-0 text-base font-semibold text-[var(--fs-text)]">{title}</h2>{description && <p className="mb-0 mt-1 max-w-prose text-sm leading-6 text-[var(--fs-muted)]">{description}</p>}</div>{action}</header>{children}</Card>;
}

export function AdminStatus({ value }: { value: string }) {
  const green = ["Active", "Healthy", "Paid", "Completed", "Operational"];
  const red = ["Suspended", "Overdue", "Blocked", "Failed", "Critical", "Unavailable"];
  const orange = ["Trial", "Pending", "Invited", "Degraded", "Warning"];
  const tone = green.includes(value) ? "bg-emerald-50 text-[var(--fs-success)]" : red.includes(value) ? "bg-red-50 text-[var(--fs-danger)]" : orange.includes(value) ? "bg-amber-50 text-[var(--fs-warning)]" : "bg-[var(--fs-primary-soft)] text-[var(--fs-info-text)]";
  return <span className={`inline-flex items-center rounded-[3px] px-2 py-[3px] text-[12px] font-semibold ${tone}`}>{value}</span>;
}

export function AdminTableToolbar({ label, search, onSearch, children }: { label: string; search: string; onSearch: (value: string) => void; children?: ReactNode }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const id = useId();
  return <div className="sa-table-tools"><div className="sa-table-search-row"><label className="sa-table-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search {label}</span><input type="search" placeholder={`Search ${label}…`} value={search} onChange={event => onSearch(event.target.value)} /></label>{children && <button type="button" className="sa-table-filter-toggle" aria-label={`Filter ${label}`} aria-expanded={filtersOpen} aria-controls={id} onClick={() => setFiltersOpen(open => !open)}><Filter size={15} aria-hidden="true" /></button>}</div>{children && <div id={id} className="sa-table-filters" hidden={!filtersOpen}>{children}</div>}</div>;
}

export function AdminTable({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fs-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

type TableSort = { key: string; direction: "ascending" | "descending" };
export function useAdminTableSort(onChange: () => void) {
  const [columnSort, setColumnSort] = useState<TableSort | null>(null);
  function changeSort(key: string) {
    setColumnSort(previous => ({ key, direction: previous?.key === key && previous.direction === "ascending" ? "descending" : "ascending" }));
    onChange();
  }
  function sortRows<T>(rows: T[], value: (row: T, key: string) => string | number): T[] {
    if (!columnSort) return rows;
    return [...rows].sort((a, b) => {
      const first = value(a, columnSort.key), second = value(b, columnSort.key);
      const comparison = typeof first === "number" && typeof second === "number" ? first - second : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: "base" });
      return columnSort.direction === "ascending" ? comparison : -comparison;
    });
  }
  return { columnSort, changeSort, sortRows, resetSort: () => setColumnSort(null) };
}

export function AdminSortHeader({ children, column, sorting }: { children: string; column: string; sorting: ReturnType<typeof useAdminTableSort> }) {
  const direction = sorting.columnSort?.key === column ? sorting.columnSort.direction : "none";
  const Icon = direction === "ascending" ? ChevronUp : direction === "descending" ? ChevronDown : ChevronsUpDown;
  return <th scope="col" aria-sort={direction}><button type="button" className="sa-table-sort" onClick={() => sorting.changeSort(column)}>{children}<Icon size={13} aria-hidden="true" /></button></th>;
}

export function AdminTableFooter({ shown, total, page = 1, pageSize = 10, onPageChange }: { shown: number; total: number; page?: number; pageSize?: number; onPageChange?: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageNumbers = [...new Set([1, page - 1, page, page + 1, pages])].filter(number => number >= 1 && number <= pages);
  return <footer className="sa-table-footer"><span role="status">Showing {total && shown ? (page - 1) * pageSize + 1 : 0} to {total && shown ? (page - 1) * pageSize + shown : 0} of {total} results</span>{onPageChange && <nav aria-label="Table pagination"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>{pageNumbers.map((number, index) => <span className="sa-page-item" key={number}>{index > 0 && number - pageNumbers[index - 1] > 1 && <span className="sa-page-gap">…</span>}<button type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => onPageChange(number)}>{number}</button></span>)}<button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button></nav>}</footer>;
}

export const adminInputClass = "min-h-11 w-full rounded-md border border-[var(--fs-control-border)] bg-[var(--fs-surface)] px-3 text-sm text-[var(--fs-text)] transition-colors focus:border-[var(--fs-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--fs-primary)]";
