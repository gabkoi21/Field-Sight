import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, FileText, FolderKanban, Link2, Plus, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button, Ring } from "../../components/ui";
import { apiClient, ApiError, type ApiProject } from "../../services/apiClient";

// ─── Assign-form modal ───────────────────────────────────────────────────────

function AssignFormModal({ project, onClose }: { project: ApiProject; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ["kobo-connections"],
    queryFn: apiClient.koboConnections,
  });

  const formsQuery = useQuery({
    queryKey: ["kobo-forms", selectedConnectionId],
    queryFn: () =>
      apiClient.koboForms(
        selectedConnectionId || (connectionsQuery.data?.length === 1 ? connectionsQuery.data[0].id : ""),
      ),
    enabled: Boolean(selectedConnectionId) || connectionsQuery.data?.length === 1,
  });

  const assignMutation = useMutation({
    mutationFn: ({ connectionId, formId }: { connectionId: string; formId: string }) =>
      apiClient.assignProjectKoboForm(project.id, connectionId, formId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-projects"] });
      onClose();
    },
    onSettled: () => setPendingFormId(null),
  });

  function handleAssign(connectionId: string, formId: string) {
    setPendingFormId(formId);
    assignMutation.mutate({ connectionId, formId });
  }

  const connections = connectionsQuery.data ?? [];
  const forms = formsQuery.data ?? [];

  // Auto-select when there's exactly one connection
  const effectiveConnectionId = selectedConnectionId || (connections.length === 1 ? connections[0].id : "");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#102a4340] p-4"
      onClick={() => !pendingFormId && onClose()}
    >
      <section
        className="w-full max-w-[520px] overflow-hidden rounded-[3px] border border-[#e8ebf3] bg-white shadow-[0_14px_30px_rgba(16,42,67,.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#e8ebf3] px-5 py-4">
          <h2 className="m-0 text-lg font-semibold text-[#303e67]">Select a Kobo form</h2>
          <button
            className="border-0 bg-transparent text-[#8290a2] hover:text-[#445367]"
            type="button"
            onClick={onClose}
            disabled={Boolean(pendingFormId)}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>

        <div className="p-5">
          {/* Connection picker — only shown when there are multiple connections */}
          {connectionsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[#758092]">
              <Ring className="size-3.5 text-brand" /> Loading…
            </div>
          ) : connections.length === 0 ? (
            <p className="rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
              No Kobo connections found. Add one from Kobo connections first.
            </p>
          ) : connections.length > 1 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {connections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConnectionId(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    effectiveConnectionId === c.id
                      ? "border-brand bg-brand text-white"
                      : "border-[#dfe4e8] bg-white text-[#526177] hover:border-brand hover:text-brand"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}

          {/* Forms list */}
          {effectiveConnectionId && (
            <>
              {formsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#758092]">
                  <Ring className="size-4 text-brand" /> Loading forms…
                </div>
              ) : formsQuery.error ? (
                <p className="rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
                  {formsQuery.error instanceof ApiError ? formsQuery.error.message : "Unable to load Kobo forms."}
                </p>
              ) : forms.length ? (
                <div className="grid max-h-[280px] gap-2 overflow-y-auto pr-1">
                  {forms.map((form) => {
                    const isThisRowPending = pendingFormId === form.id;
                    const anotherRowPending = Boolean(pendingFormId) && !isThisRowPending;
                    return (
                      <div
                        key={form.id}
                        className={`flex items-center gap-3 rounded-lg border p-3.5 transition-colors ${
                          isThisRowPending
                            ? "border-brand bg-[#f0f6ff]"
                            : anotherRowPending
                              ? "border-[#e5e8ec] opacity-50"
                              : "border-[#e5e8ec] hover:border-[#bfcfe8]"
                        }`}
                      >
                        <FileText
                          className={`shrink-0 ${isThisRowPending ? "text-brand" : "text-[#9aabbc]"}`}
                          size={17}
                        />
                        <div className="flex-1 min-w-0">
                          <strong className="block truncate text-sm text-[#334254]">{form.name}</strong>
                          {form.version && <small className="text-xs text-[#758092]">v{form.version}</small>}
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(pendingFormId)}
                          onClick={() => handleAssign(effectiveConnectionId, form.id)}
                          className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            isThisRowPending
                              ? "border-brand bg-brand text-white"
                              : "border-[#dfe4e8] bg-white text-[#526177] hover:border-brand hover:text-brand"
                          } disabled:cursor-not-allowed`}
                        >
                          {isThisRowPending ? (
                            <span className="flex items-center gap-1.5">
                              <Ring className="size-3.5" aria-hidden="true" />
                              Assigning…
                            </span>
                          ) : (
                            "Assign"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[#758092]">
                  No Kobo survey forms found in this connection.
                </p>
              )}
            </>
          )}

          {assignMutation.error && (
            <p className="mt-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
              {assignMutation.error instanceof ApiError
                ? assignMutation.error.message
                : "Unable to assign the form. Please try again."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Create-project modal ─────────────────────────────────────────────────────

function CreateProjectModal({
  organizationId,
  sectorsData,
  sectorNamesData,
  onClose,
}: {
  organizationId: string;
  sectorsData: { id: string; sector_id: string }[];
  sectorNamesData: { id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createProject(organizationId, {
        name,
        organization_sector_id: sectorId,
        description,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization-projects", organizationId],
      });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#102a4340] p-4">
      <form
        className="w-full max-w-md rounded-[3px] border border-[#e8ebf3] bg-white p-5 shadow-[0_14px_30px_rgba(16,42,67,.16)]"
        onSubmit={handleSubmit}
      >
        <header className="flex justify-between">
          <h2 className="m-0 text-lg">Add project</h2>
          <button type="button" className="bg-transparent border-0" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="grid gap-4 mt-5">
          <label className="grid gap-1 text-xs font-semibold">
            Project name
            <input
              className="rounded-[3px] border border-[#e8ebf3] bg-[#fafbfb] p-2.5 outline-none focus:border-brand"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Sector
            <select
              className="rounded-[3px] border border-[#e8ebf3] bg-[#fafbfb] p-2.5 outline-none focus:border-brand"
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              required
            >
              <option value="">Select sector</option>
              {sectorsData.map((sector) => {
                const label = sectorNamesData.find((s) => s.id === sector.sector_id);
                return (
                  <option value={sector.id} key={sector.id}>
                    {label?.name ?? "Sector"}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Description
            <textarea
              className="rounded-[3px] border border-[#e8ebf3] bg-[#fafbfb] p-2.5 outline-none focus:border-brand"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {createMutation.error && (
            <p className="text-xs text-[#b42318]">
              {createMutation.error instanceof ApiError ? createMutation.error.message : "Unable to create project."}
            </p>
          )}
          <div className="text-right">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [assigningProject, setAssigningProject] = useState<ApiProject | null>(null);
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(organizationId),
  });
  const sectorsQuery = useQuery({
    queryKey: ["organization-sectors", organizationId],
    queryFn: () => apiClient.organizationSectors(organizationId!),
    enabled: Boolean(organizationId),
  });
  const sectorNamesQuery = useQuery({ queryKey: ["sectors"], queryFn: apiClient.sectors });
  const projects = projectsQuery.data ?? [];
  const projectsWithForms = projects.filter((project) => project.kobo_form_name).length;

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="mb-[2px] flex items-end justify-between gap-4 max-[700px]:flex-col max-[700px]:items-start">
        <div>
          <p className="!mb-[5px] !mt-0 !text-[10px] !font-bold !tracking-[.09em] !text-[#0b51b7]">
            PROGRAM OPERATIONS
          </p>
          <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px] !text-[#1d2a38]">
            Projects
          </h1>
          <p className="mb-0 mt-[6px] text-[13px] text-[#73808d]">
            Organize fieldwork and connect each project to its Kobo form.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-[36px] items-center gap-[6px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] text-[12px] font-semibold text-white max-[700px]:w-full max-[700px]:justify-center"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={15} /> Add project
        </button>
      </header>

      {!projectsQuery.isLoading && !projectsQuery.error && projects.length > 0 && (
        <section className="grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
          <article className="grid grid-cols-[40px_1fr] gap-x-3 rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
            <span className="row-span-2 grid size-10 place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
              <FolderKanban size={19} />
            </span>
            <span className="text-[11px] font-medium text-[#6f7d8a]">Active projects</span>
            <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">{projects.length}</strong>
          </article>
          <article className="grid grid-cols-[40px_1fr] gap-x-3 rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
            <span className="row-span-2 grid size-10 place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]">
              <CheckCircle2 size={19} />
            </span>
            <span className="text-[11px] font-medium text-[#6f7d8a]">Kobo forms connected</span>
            <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">
              {projectsWithForms}
              <small className="ml-1 text-[11px] font-medium text-[#88939d]">of {projects.length}</small>
            </strong>
          </article>
        </section>
      )}

      {projectsQuery.isLoading ? (
        <div className="flex justify-center gap-2 rounded-[6px] border border-[#e5e9ed] bg-white p-10 text-sm text-[#758092]">
          <Ring className="size-4 text-brand" /> Loading projects�
        </div>
      ) : projectsQuery.error ? (
        <p className="rounded-md bg-[#fff0f2] p-3 text-sm text-[#b42318]">
          {projectsQuery.error instanceof ApiError ? projectsQuery.error.message : "Unable to load projects."}
        </p>
      ) : projects.length === 0 ? (
        <div className="rounded-[6px] border border-[#e5e9ed] bg-white p-10 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
            <FolderKanban size={21} />
          </span>
          <p className="mb-0 mt-3 text-sm font-semibold text-[#253342]">No projects yet</p>
          <p className="mb-4 mt-1 text-xs text-[#84909b]">Create a project to begin organizing your fieldwork.</p>
          <button
            type="button"
            className="inline-flex h-[36px] items-center gap-[6px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] text-[12px] font-semibold text-white"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={15} /> Add project
          </button>
        </div>
      ) : (
        <section className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="flex flex-col overflow-hidden rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] transition-shadow hover:shadow-[0_8px_20px_rgba(16,42,67,.08)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[7px] bg-[#e9f0fa] text-[#4d7fc6]">
                  <FolderKanban size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="m-0 truncate text-[15px] font-semibold text-[#253342]">{project.name}</h2>
                  <span className="mt-1 inline-flex rounded-full bg-[#e8f6f4] px-2 py-[2px] text-[10px] font-semibold text-[#0b51b7]">
                    {project.status}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-[5px] border border-[#edf0f2] bg-[#fafbfb] px-3 py-2.5">
                <Link2 size={14} className={project.kobo_form_name ? "text-brand" : "text-[#b0bac5]"} />
                <span className="flex-1 text-xs truncate">
                  {project.kobo_form_name ? (
                    <span className="font-semibold text-[#334254]">{project.kobo_form_name}</span>
                  ) : (
                    <span className="text-[#9aa5b1]">No Kobo form assigned</span>
                  )}
                </span>
                <button
                  className="inline-flex shrink-0 items-center gap-1 border-0 bg-transparent text-[11px] font-semibold text-[#0b51b7] hover:underline"
                  onClick={() => setAssigningProject(project)}
                  type="button"
                >
                  {project.kobo_form_name ? "Change" : "Assign"} <ArrowUpRight size={12} />
                </button>
              </div>
              <footer className="mt-4 flex justify-end border-t border-[#edf0f2] pt-3">
                <NavLink to={`/projects/${project.id}`}>
                  <button className="inline-flex h-[32px] items-center gap-[6px] rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[11px] font-semibold text-[#546271] hover:border-[#0b51b7] hover:text-[#0b51b7]">
                    Manage project <ArrowUpRight size={13} />
                  </button>
                </NavLink>
              </footer>
            </article>
          ))}
        </section>
      )}

      {showCreate && organizationId && (
        <CreateProjectModal
          organizationId={organizationId}
          sectorsData={sectorsQuery.data ?? []}
          sectorNamesData={sectorNamesQuery.data ?? []}
          onClose={() => setShowCreate(false)}
        />
      )}
      {assigningProject && <AssignFormModal project={assigningProject} onClose={() => setAssigningProject(null)} />}
    </div>
  );
}
