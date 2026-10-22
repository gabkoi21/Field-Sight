import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Link2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { AssignFormModal } from "../pages/organization/ProjectsPage";
import { apiClient } from "../services/apiClient";
import { useWorkspace } from "./WorkspaceContext";
import {
  Field,
  Notice,
  Page,
  Panel,
  WorkspaceGate,
  WorkspaceTabs,
  fieldClass,
} from "./WorkspaceUI";

export function WorkspaceDetailsPage() {
  const { project, projectId, organizationId } = useWorkspace();
  const cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("draft");
  const [syncMessage, setSyncMessage] = useState("");
  const submissions = useQuery({
    queryKey: ["submissions"],
    queryFn: apiClient.submissions,
  });
  const records =
    submissions.data?.filter((r) => r.project_id === projectId) ?? [];
  const sync = useMutation({
    mutationFn: () => apiClient.syncProjectKoboForm(projectId),
    onSuccess: async (result) => {
      setSyncMessage(
        `Sync complete: ${result.created} new, ${result.updated} updated, ${result.skipped} unchanged.`,
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["submissions"] }),
        cache.invalidateQueries({ queryKey: ["workspace-tables"] }),
        cache.invalidateQueries({ queryKey: ["indicators", projectId] }),
        cache.invalidateQueries({ queryKey: ["kobo-pending-sync"] }),
      ]);
    },
  });
  const save = useMutation({
    mutationFn: () =>
      apiClient.updateProject(organizationId, projectId, {
        name,
        description,
        start_date: start || null,
        end_date: end || null,
        status,
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["organization-projects"] });
      setEditing(false);
    },
  });
  function edit() {
    if (!project) return;
    setName(project.name);
    setDescription(project.description);
    setStart(project.start_date ?? "");
    setEnd(project.end_date ?? "");
    setStatus(project.status);
    setEditing(true);
    save.reset();
  }
  return (
    <Page
      title={project?.name ?? "Workspace details"}
      description="The team, evidence and results plan for this workspace."
      actions={
        <Button variant="secondary" onClick={edit}>
          <Pencil size={14} />
          Edit details
        </Button>
      }
    >
      <WorkspaceGate>
        <WorkspaceTabs />
        {syncMessage && <Notice>{syncMessage}</Notice>}
        {sync.error && <Notice error>{sync.error.message}</Notice>}
        {submissions.error && (
          <Notice error>{submissions.error.message}</Notice>
        )}
        <div className="grid grid-cols-[1.5fr_1fr] items-start gap-5 max-lg:grid-cols-1">
          <Panel className="p-6">
            <h2 className="mb-5 mt-0 text-base font-semibold">
              Workspace details
            </h2>
            <p className="text-sm leading-7 text-[#73868d]">
              {project?.description ||
                "No description yet. Edit details to explain the purpose of this workspace."}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-6 text-sm">
              {[
                ["Status", project?.status.replaceAll("_", " ")],
                ["Start date", project?.start_date ?? "Not set"],
                ["End date", project?.end_date ?? "Not set"],
                [
                  "Collection target",
                  project?.target_sample_size?.toLocaleString() ?? "Not set",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="mb-1 text-[10px] uppercase tracking-wide text-[#95a2a9]">
                    {label}
                  </dt>
                  <dd className="m-0 capitalize">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel className="p-6">
            <h2 className="mb-5 mt-0 text-base font-semibold">
              Data collection
            </h2>
            <strong className="text-3xl text-[#168596]">
              {records.length}
            </strong>
            <p className="text-xs text-[#87969d]">
              Stored responses ·{" "}
              {records.filter((r) => r.review_status === "ready").length} ready
              for analysis
            </p>
            <p className="mt-5 border-t border-[#edf0f2] pt-4 text-xs leading-6 text-[#73868d]">
              Assigned form: {project?.kobo_form_name ?? "None"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setAssigning(true)}>
                <Link2 size={14} />
                Assign Kobo form
              </Button>
              <Button
                disabled={
                  !project?.kobo_connection_id ||
                  !project?.kobo_form_id ||
                  sync.isPending
                }
                onClick={() => sync.mutate()}
              >
                <RefreshCw size={14} />
                {sync.isPending ? "Syncing…" : "Sync form"}
              </Button>
              <Link
                to="/data-tables"
                className="self-center text-xs text-[#168596]"
              >
                Open data tables →
              </Link>
            </div>
          </Panel>
        </div>
        <Panel>
          <h2 className="m-0 border-b border-[#e4ebed] px-5 py-4 text-sm font-semibold">
            Recent collection activity
          </h2>
          {records.length ? (
            <div className="divide-y divide-[#edf0f2]">
              {[...records]
                .sort((a, b) =>
                  (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""),
                )
                .slice(0, 8)
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 text-xs"
                  >
                    <span className="size-2 rounded-full bg-[#65bbaa]" />
                    <strong>{row.enumerator ?? "Unreported collector"}</strong>
                    <span className="text-[#87969d]">
                      {row.location ?? "Location not reported"}
                    </span>
                    <span className="ml-auto text-[#87969d]">
                      {row.submitted_at
                        ? new Date(row.submitted_at).toLocaleString()
                        : "Date not reported"}
                    </span>
                    <span className="rounded bg-[#f3f6f7] px-2 py-1 text-[10px] text-[#73868d]">
                      {row.review_status.replaceAll("_", " ")}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="p-6 text-sm text-[#87969d]">
              No responses stored yet. Import a table or connect a form to get
              started.
            </p>
          )}
        </Panel>
      </WorkspaceGate>
      {editing && (
        <Dialog
          title="Edit workspace details"
          onClose={() => setEditing(false)}
          error={save.error?.message}
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Workspace name">
              <input
                required
                minLength={2}
                maxLength={200}
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Description">
              <textarea
                className={fieldClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input
                  type="date"
                  className={fieldClass}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  min={start || undefined}
                  className={fieldClass}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Status">
              <select
                className={fieldClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {[
                  "draft",
                  "active",
                  "in_review",
                  "paused",
                  "completed",
                  "archived",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={save.isPending}>
              Save changes
            </Button>
          </form>
        </Dialog>
      )}
      {assigning && project && (
        <AssignFormModal
          project={project}
          onClose={() => setAssigning(false)}
        />
      )}
    </Page>
  );
}
