import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../services/apiClient";
import { useWorkspace } from "./WorkspaceContext";
import { Notice, Panel } from "./WorkspaceUI";

export function ProjectSetupChecklist() {
  const { project, projectId, organizationId } = useWorkspace();
  const sync = useQuery({ queryKey: ["sync-settings", projectId], queryFn: () => apiClient.syncSettings(projectId), enabled: Boolean(project) });
  const indicators = useQuery({ queryKey: ["indicators", projectId], queryFn: () => apiClient.indicators(projectId), enabled: Boolean(project) });
  const dashboards = useQuery({ queryKey: ["workspace-dashboards", organizationId], queryFn: apiClient.dashboards, enabled: Boolean(project) });
  if (!project) return null;
  const error = sync.error ?? indicators.error ?? dashboards.error;
  if (error) return <Notice error>Unable to load project setup: {error.message}</Notice>;
  if (sync.isPending || indicators.isPending || dashboards.isPending) return <Notice>Loading project setup…</Notice>;
  const steps = [
    { label: "Project created", complete: true, to: `/projects/${projectId}` },
    { label: "Kobo form connected", complete: Boolean(project.kobo_connection_id && project.kobo_form_id), to: `/forms?project_id=${projectId}` },
    { label: "First successful sync", complete: Boolean(sync.data?.last_successful_sync), to: `/forms?project_id=${projectId}` },
    { label: "Indicator configured", complete: Boolean(indicators.data?.some(item => item.result_source !== "unconfigured")), to: `/projects/${projectId}/indicators` },
    { label: "Dashboard created", complete: Boolean(dashboards.data?.some(item => item.project_id === projectId)), to: `/dashboards?project_id=${projectId}` },
  ];
  return <Panel className="p-5">
    <h2 className="m-0 text-sm font-semibold">Project setup · {steps.filter(step => step.complete).length} of 5 complete</h2>
    <ul className="mb-0 grid list-none gap-2 p-0 text-sm sm:grid-cols-2">
      {steps.map(step => <li key={step.label}>{step.complete ? <span>✓ {step.label}</span> : <Link className="text-[#0b51b7] underline" to={step.to}>{step.label} →</Link>}</li>)}
    </ul>
  </Panel>;
}
