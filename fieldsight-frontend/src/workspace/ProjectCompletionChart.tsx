import { useId } from "react";
import { FileCheck2 } from "lucide-react";
import type { ApiProject } from "../services/apiClient";

/** Saved lifecycle state has no validated work-completion denominator. */
export function ProjectCompletionChart({ project }: { project: Pick<ApiProject, "name" | "status"> }) {
  const heading = useId();
  return <section aria-labelledby={heading} className="min-w-0 border border-[var(--fs-metric-border)] bg-white p-5">
    <header className="flex items-center gap-2"><FileCheck2 size={19} aria-hidden="true" className="text-[var(--fs-primary)]" /><h2 id={heading} className="m-0 text-lg font-semibold">Project status</h2></header>
    <p className="mt-3 break-words text-sm text-[var(--fs-muted)]">{project.name}</p>
    <p className="my-5 text-2xl font-semibold capitalize">{project.status.replaceAll("_", " ")}</p>
    <p className="text-sm text-[var(--fs-muted)]">Saved project lifecycle state. Work progress is not measured here.</p>
  </section>;
}
