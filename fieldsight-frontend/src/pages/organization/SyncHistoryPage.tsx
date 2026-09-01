import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, DataTable, PageHeader, Ring } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, ApiError } from "../../services/apiClient";

function formatTime(value: string | null) {
  if (!value) return "Not completed";
  return new Date(value).toLocaleString();
}

export function SyncHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const organizationId = user?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(organizationId),
  });
  const runsQuery = useQuery({ queryKey: ["sync-runs"], queryFn: apiClient.syncRuns, enabled: !authLoading });
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const projects = (projectsQuery.data ?? []).filter((project) => project.kobo_form_id);
      return Promise.all(projects.map((project) => apiClient.syncProjectKoboForm(project.id)));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sync-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["organization-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["kobo-pending-sync"] });
    },
  });

  const projects = projectsQuery.data ?? [];
  const connectedProjects = projects.filter((project) => project.kobo_form_id);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const runs = runsQuery.data ?? [];
  const failedRuns = runs.filter((run) => run.status === "failed").length;
  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const latestRun = runs[0];
  const loadError = runsQuery.error instanceof ApiError
    ? runsQuery.error.message
    : runsQuery.error
      ? "Unable to load synchronization history."
      : "";

  return (
    <>
      <PageHeader
        eyebrow="Data collection"
        title="Sync history"
        description="Track imports from connected KoboToolbox forms and resolve exceptions."
      >
        <Button
          disabled={!connectedProjects.length || syncAllMutation.isPending}
          onClick={() => syncAllMutation.mutate()}
        >
          {syncAllMutation.isPending ? <Ring className="size-4" aria-hidden="true" /> : <RefreshCw size={16} />}
          {syncAllMutation.isPending ? "Syncing all…" : "Sync all forms"}
        </Button>
      </PageHeader>

      {loadError && <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{loadError}</p>}
      {syncAllMutation.error && (
        <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
          {syncAllMutation.error instanceof ApiError ? syncAllMutation.error.message : "Unable to synchronize all Kobo forms."}
        </p>
      )}
      {syncAllMutation.isSuccess && (
        <p className="mb-4 rounded-md border border-[#bfe4cf] bg-[#f0fbf5] p-3 text-xs text-[#18794e]">
          Synchronization completed for {connectedProjects.length} connected project{connectedProjects.length === 1 ? "" : "s"}.
        </p>
      )}

      <section className={`mb-[18px] flex items-center gap-[13px] rounded-lg border px-5 py-[17px] ${failedRuns ? "border-[#f0c8cd] bg-[#fff7f8]" : "border-[#cbdcf3] bg-[#f2f6fd]"}`}>
        <span className={`grid size-[38px] place-items-center rounded-[9px] ${failedRuns ? "bg-[#fff0f2] text-[#b42318]" : "bg-[rgba(11,81,183,.08)] text-brand"}`}>
          {failedRuns ? <AlertCircle size={20} /> : <Link2 size={20} />}
        </span>
        <div>
          <strong className="text-[13px]">
            {failedRuns ? `${failedRuns} synchronization run${failedRuns === 1 ? "" : "s"} failed` : "KoboToolbox synchronization healthy"}
          </strong>
          <p className="mt-1 text-xs text-[#667688]">
            {connectedProjects.length} connected project form{connectedProjects.length === 1 ? "" : "s"} · {completedRuns} completed run{completedRuns === 1 ? "" : "s"}
            {latestRun ? ` · latest ${formatTime(latestRun.completed_at ?? latestRun.started_at)}` : " · no sync has run yet"}
          </p>
        </div>
        <Button className="ml-auto max-[900px]:hidden" variant="secondary" onClick={() => navigate("/forms/connections")}>
          Manage integration
        </Button>
      </section>

      <DataTable headers={["Project", "Source", "Received", "New", "Updated", "Status", "Completed"]}>
        {runsQuery.isLoading ? (
          <tr><td colSpan={7} className="py-10 text-center text-xs text-[#758092]">Loading synchronization history…</td></tr>
        ) : runs.length ? (
          runs.map((run) => (
            <tr key={run.id}>
              <td><strong>{projectNames.get(run.project_id) ?? "Unknown project"}</strong></td>
              <td>KoboToolbox</td>
              <td>{run.received.toLocaleString()}</td>
              <td>{run.created.toLocaleString()}</td>
              <td>{run.updated.toLocaleString()}</td>
              <td>
                <span className="inline-flex items-center gap-1.5">
                  {run.status === "completed" ? <CheckCircle2 size={14} className="text-[#21834c]" /> : <AlertCircle size={14} className="text-[#b42318]" />}
                  <Badge value={run.status === "completed" ? "Valid" : "Needs attention"} />
                </span>
                {run.error_message && <small className="mt-1 block max-w-[260px] text-[#b42318]">{run.error_message}</small>}
              </td>
              <td>{formatTime(run.completed_at)}</td>
            </tr>
          ))
        ) : (
          <tr><td colSpan={7} className="py-10 text-center text-xs text-[#758092]">No synchronization runs yet. Use Sync all forms or sync a project individually.</td></tr>
        )}
      </DataTable>
    </>
  );
}