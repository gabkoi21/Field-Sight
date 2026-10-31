import { LoadingState } from "../../components/ui/LoadingState";
import { useQuery } from "@tanstack/react-query";
import { ProjectLink as Link } from "../../workspace/projectRouting";
import { apiClient } from "../../services/apiClient";

export function ProjectActionSummary({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  const actions = useQuery({ queryKey: ["project-actions", organizationId, projectId, "summary"], queryFn: () => apiClient.projectActions(projectId, new URLSearchParams({ limit: "1" })) });
  return <div className="mt-4 border-t border-[var(--fs-border)] pt-3 text-sm">
    <h3 className="font-semibold">Actions & Follow-ups</h3>
    {actions.isPending && <LoadingState variant="inline" label="Loading action summary…" />}
    {actions.error && <p role="alert">Action summary unavailable. <button className="min-h-11 px-2 underline" onClick={() => void actions.refetch()}>Retry action summary</button></p>}
    {actions.data && <p>{actions.data.summary.unresolved} unresolved · {actions.data.summary.overdue} overdue · {actions.data.summary.high_priority} unresolved high priority</p>}
    <Link className="inline-flex min-h-11 items-center font-semibold text-[var(--fs-primary)] underline" to={`/projects/${projectId}/actions`}>Open action register →</Link>
  </div>;
}
