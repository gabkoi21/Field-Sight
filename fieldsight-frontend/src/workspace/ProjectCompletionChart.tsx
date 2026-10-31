import { LoadingState } from "../components/ui/LoadingState";
import { useId } from "react";
import type { ApiProject } from "../services/apiClient";

type Props = {
  project: Pick<ApiProject, "name" | "status">;
  enumerators?: number;
  collected?: number;
  teamLoading?: boolean;
  teamError?: boolean;
  dataLoading?: boolean;
  dataError?: boolean;
  retryTeam?: () => void;
  retryData?: () => void;
};

/** Status and operational counts share a card, but never a mixed-unit pie. */
export function ProjectCompletionChart({ project, enumerators, collected, teamLoading, teamError, dataLoading, dataError, retryTeam, retryData }: Props) {
  const heading = useId();
  const completed = project.status === "completed";
  const inProgress = project.status === "active" || project.status === "in_review";
  const savedLabel = project.status?.replaceAll("_", " ") || "Not set";
  const currentLabel = savedLabel[0].toUpperCase() + savedLabel.slice(1);
  const color = completed ? "#16a34a" : inProgress ? "#2563eb" : project.status === "archived" ? "#e5484d" : "#2563eb";
  const rows = [
    { label: completed ? "Completed" : "Not completed", value: completed ? 1 : 0, unit: "project", color: completed ? "#16a34a" : color, current: true },
    { label: "Enumerators", value: enumerators, unit: "assigned", color: "#2563eb", loading: teamLoading, error: teamError, retry: retryTeam },
    { label: "Data collected so far", value: collected, unit: "records", color: "#f15b64", loading: dataLoading, error: dataError, retry: retryData },
  ];
  return <section aria-labelledby={heading} className="min-w-0 overflow-hidden rounded-lg border border-[var(--fs-border)] bg-white">
    <header className="flex items-center justify-between gap-3 border-b border-[var(--fs-border)] px-5 py-4"><h2 id={heading} className="m-0 text-base font-semibold">Project status</h2><span className="text-xs text-[var(--fs-muted)]">All time</span></header>
    <div className="px-5 pb-4">
      <div className="mx-auto my-5 size-[210px] max-w-full">
        <svg viewBox="0 0 220 220" className="size-full" role="img" aria-label={`Project status: ${currentLabel}. Ring represents the saved status of this one project; enumerator and record counts are listed separately.`}>
          <circle cx="110" cy="110" r="94" fill="none" stroke="var(--fs-border)" strokeWidth="10" />
          <circle data-status={project.status} cx="110" cy="110" r="94" fill="none" stroke={color} strokeWidth="16" />
        </svg>
      </div>
      <div className="mb-5 flex items-center justify-center gap-3"><strong className="text-2xl font-semibold tabular-nums">{completed ? 1 : 0}</strong><div className="text-xs text-[var(--fs-muted)]"><span className="block">{completed ? "Completed project" : "Not completed yet"}</span><span className="font-medium" style={{ color }}>{completed ? "Completed" : "Not completed"}</span></div></div>
      <ul aria-label="Project status and collection totals" className="m-0 list-none divide-y divide-dashed divide-[var(--fs-border)] p-0">
        {rows.map(row => <li key={row.label} aria-current={row.current ? "true" : undefined} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <span className="flex items-center gap-3"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />{row.label}</span>
          <span className="text-right text-xs text-[var(--fs-muted)]">{row.loading ? <LoadingState variant="inline" label={`Loading ${row.label.toLowerCase()}...`} /> : row.error ? <span role="alert">Unavailable{row.retry && <button type="button" className="ml-2 min-h-8 text-[var(--fs-primary)] underline" onClick={row.retry}>Retry {row.label.toLowerCase()}</button>}</span> : row.value == null ? "Not available" : <><strong className="font-medium tabular-nums text-[var(--fs-text)]">{row.value.toLocaleString()}</strong> {row.unit}</>}</span>
        </li>)}
      </ul>
    </div>
  </section>;
}
