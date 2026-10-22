import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText, RefreshCw } from "lucide-react";
import { Button } from "../components/ui";
import { AssignFormModal } from "../pages/organization/ProjectsPage";
import { apiClient } from "../services/apiClient";
import { useWorkspace } from "./WorkspaceContext";
import { Notice, Page, Panel, WorkspaceGate, WorkspaceTabs } from "./WorkspaceUI";

export function WorkspaceFormsPage() {
  const { projectId, project } = useWorkspace();
  const [assigning, setAssigning] = useState(false);
  const cache = useQueryClient();
  const connections = useQuery({ queryKey: ["kobo-connections"], queryFn: apiClient.koboConnections });
  const runs = useQuery({ queryKey: ["sync-runs"], queryFn: apiClient.syncRuns });
  const connection = connections.data?.find((item) => item.id === project?.kobo_connection_id);
  const lastRun = runs.data?.filter((item) => item.project_id === projectId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  const sync = useMutation({
    mutationFn: (id: string) => apiClient.syncProjectKoboForm(id),
    onSuccess: async () => {
      await Promise.all(["sync-runs", "workspace-tables", "submissions", "indicators", "kobo-pending-sync"].map(
        (key) => cache.invalidateQueries({ queryKey: [key] }),
      ));
    },
  });
  const syncHere = sync.variables === projectId;
  return (
    <Page title="Forms" description="Manage the questionnaires used to collect data for this workspace."
      actions={<Link className="text-sm text-[#168596]" to="/forms/connections">Manage Kobo connections →</Link>}>
      <WorkspaceGate>
        <WorkspaceTabs />
        <Panel className="p-5">
          <p className="mb-4 mt-0 text-xs text-[#73868d]">Workspace: {project?.name}</p>
          <div className="flex items-start gap-3">
            <FileText size={24} className="shrink-0 text-[#168596]" />
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-base font-semibold">{project?.kobo_form_name ?? project?.kobo_form_id ?? "No questionnaire assigned"}</h2>
              {project?.kobo_form_id ? (
                <dl className="grid gap-3 text-xs sm:grid-cols-2">
                  <div><dt className="text-[#73868d]">Form ID</dt><dd className="m-0 mt-1 break-all">{project.kobo_form_id}</dd></div>
                  <div><dt className="text-[#73868d]">Kobo connection</dt><dd className="m-0 mt-1">{connection?.name ?? (project.kobo_connection_id ? "Loading connection…" : "No live connection")}</dd></div>
                  <div><dt className="text-[#73868d]">Connection status</dt><dd className="m-0 mt-1">{connections.error ? "Unable to check" : !project.kobo_connection_id ? "Stored sample form" : connections.isLoading ? "Loading…" : connection?.is_verified ? "Verified" : "Not verified"}</dd></div>
                  <div><dt className="text-[#73868d]">Latest sync</dt><dd className="m-0 mt-1">{runs.error ? "Unable to load sync status" : runs.isLoading ? "Loading…" : lastRun ? `${lastRun.status.replaceAll("_", " ")} · ${new Date(lastRun.started_at).toLocaleString()}` : "No sync recorded"}</dd></div>
                </dl>
              ) : <p className="text-sm text-[#73868d]">Assign a Kobo questionnaire to start collecting data for this workspace.</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setAssigning(true)}>{project?.kobo_form_id ? "Change assigned form" : "Assign Kobo form"}</Button>
                <Button disabled={!project?.kobo_connection_id || !project?.kobo_form_id || sync.isPending}
                  onClick={() => sync.mutate(projectId)}><RefreshCw size={14} />{sync.isPending && syncHere ? "Syncing…" : "Sync form"}</Button>
              </div>
            </div>
          </div>
        </Panel>
        {connections.error && <Notice error>{connections.error.message}</Notice>}
        {syncHere && sync.error && <Notice error>{sync.error.message}</Notice>}
        {syncHere && sync.isSuccess && <Notice>Sync complete: {sync.data.created} new, {sync.data.updated} updated, {sync.data.skipped} unchanged.</Notice>}
      </WorkspaceGate>
      {assigning && project && <AssignFormModal key={projectId} project={project} onClose={() => setAssigning(false)} />}
    </Page>
  );
}
