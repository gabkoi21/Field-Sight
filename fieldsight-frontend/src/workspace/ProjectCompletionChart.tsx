import { useId } from "react";
import { Check, FileCheck2 } from "lucide-react";
import type { ApiProject } from "../services/apiClient";

const statuses = [
  { value: "active", label: "Active", color: "#dc2626" },
  { value: "completed", label: "Completed", color: "#0860b4" },
];

function segment(index: number) {
  const start = (index * 180 - 86) * Math.PI / 180;
  const end = (index * 180 + 86) * Math.PI / 180;
  return `M ${90 + 69 * Math.cos(start)} ${90 + 69 * Math.sin(start)} A 69 69 0 0 1 ${90 + 69 * Math.cos(end)} ${90 + 69 * Math.sin(end)}`;
}

/** Categorical status dial; segment sizes never represent completion. */
export function ProjectCompletionChart({ project }: { project: Pick<ApiProject, "name" | "status"> }) {
  const heading = useId();
  const current = statuses.find(status => status.value === project.status);
  const savedLabel = project.status?.replaceAll("_", " ") || "Not set";
  const currentLabel = current?.label ?? savedLabel[0].toUpperCase() + savedLabel.slice(1);
  return <section aria-labelledby={heading} className="min-w-0 border border-[var(--fs-metric-border)] bg-white p-5">
    <header className="flex items-center gap-2"><FileCheck2 size={19} aria-hidden="true" className="text-[var(--fs-primary)]" /><h2 id={heading} className="m-0 text-lg font-semibold">Project status</h2></header>
    <p className="mb-0 mt-2 break-words text-sm text-[var(--fs-muted)]">{project.name}</p>
    <div className="flex flex-col items-center gap-4 py-5">
      <div className="relative size-[210px] max-w-full">
        <svg viewBox="0 0 180 180" className="size-full" role="img" aria-label={`Project status: ${currentLabel}. Highlight shows the saved status, not completion or previous stages.`}>
          {statuses.map((status, index) => <path key={status.value} d={segment(index)} fill="none" stroke={status === current ? status.color : "var(--fs-border)"} strokeWidth={status === current ? 15 : 11} strokeLinecap="round" />)}
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-xs text-[var(--fs-muted)]">Current status</span>
          <strong className="mt-1 break-words text-xl font-semibold text-[var(--fs-text)]">{currentLabel}</strong>
        </div>
      </div>
      <ul aria-label="Project lifecycle states" className="m-0 flex list-none flex-wrap justify-center gap-x-6 gap-y-2 p-0">
        {statuses.map(status => <li key={status.value} aria-current={status === current ? "true" : undefined} className={`flex items-center gap-2 text-sm ${status === current ? "font-semibold text-[var(--fs-text)]" : "text-[var(--fs-muted)]"}`}>
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
          <span>{status.label}</span>{status === current && <span className="inline-flex shrink-0"><Check size={14} aria-hidden="true" /><span className="sr-only">Current</span></span>}
        </li>)}
      </ul>
    </div>
  </section>;
}
