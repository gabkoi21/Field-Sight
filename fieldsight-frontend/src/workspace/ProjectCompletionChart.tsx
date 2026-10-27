import { useId } from "react";
import { FileCheck2 } from "lucide-react";
import type { ApiProject } from "../services/apiClient";

/** Completion is the selected project’s saved status, not inferred work progress. */
export function ProjectCompletionChart({ project }: { project: Pick<ApiProject, "name" | "status"> }) {
  const heading = useId();
  const completed = project.status === "completed" ? 1 : 0;
  const total = 1;
  const rows = [
    { label: "Completed", value: completed, color: "#29984b" },
    { label: "Not completed", value: total - completed, color: "#0860b4" },
  ];
  return <section aria-labelledby={heading} className="w-full max-w-[760px] border border-[var(--fs-metric-border)] bg-white p-5">
    <header className="flex items-center gap-2"><FileCheck2 size={19} className="text-[#29984b]" aria-hidden="true" /><h2 id={heading} className="m-0 text-lg font-semibold">Project completion</h2></header>
    <p className="mb-0 mt-2 text-xs text-[var(--fs-muted)]">{project.name} · saved completion status</p>
    <>
      <svg viewBox="0 0 240 240" role="img" aria-label={`${project.name}: ${completed ? "Completed" : "Not completed"}. Saved project status: ${project.status.replaceAll("_", " ")}.`} className="mx-auto my-3 block size-[180px] max-w-full">
        <circle cx="120" cy="120" r="82" fill="none" stroke="#0860b4" strokeWidth="24" />
      </svg>
      <ul className="m-0 flex list-none flex-wrap justify-center gap-x-6 gap-y-3 p-0 text-sm">{rows.map(row => <li key={row.label} className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: row.color }} /><span>{row.label}</span><span className="tabular-nums text-[var(--fs-muted)]">{(row.value / total * 100).toFixed(1)}%</span></li>)}</ul>
    </>
    <p className="mb-0 mt-4 border-t border-[var(--fs-border)] pt-3 text-center text-sm">Project status: <strong className="capitalize">{project.status.replaceAll("_", " ")}</strong></p>
  </section>;
}
