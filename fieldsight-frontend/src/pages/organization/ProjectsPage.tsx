import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderKanban,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button, Ring } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, ApiError, type ApiProject } from "../../services/apiClient";

// ─── Assign-form modal ───────────────────────────────────────────────────────

export function AssignFormModal({
  project,
  onClose,
}: {
  project: ApiProject;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const modal = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    modal.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ["kobo-connections"],
    queryFn: apiClient.koboConnections,
    select: (connections) =>
      connections.filter((connection) => connection.is_verified),
  });

  const formsQuery = useQuery({
    queryKey: ["kobo-forms", selectedConnectionId],
    queryFn: () =>
      apiClient.koboForms(
        selectedConnectionId ||
          (connectionsQuery.data?.length === 1
            ? connectionsQuery.data[0].id
            : ""),
      ),
    enabled:
      Boolean(selectedConnectionId) || connectionsQuery.data?.length === 1,
  });

  const assignMutation = useMutation({
    mutationFn: ({
      connectionId,
      formId,
    }: {
      connectionId: string;
      formId: string;
    }) => apiClient.assignProjectKoboForm(project.id, connectionId, formId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization-projects"],
      });
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
  const effectiveConnectionId =
    selectedConnectionId || (connections.length === 1 ? connections[0].id : "");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#102a4340] p-4"
      onClick={() => !pendingFormId && onClose()}
    >
      <section
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-label="Select a Kobo form"
        onKeyDown={event => {
          if (event.key === "Escape" && !pendingFormId) { event.preventDefault(); onClose(); }
          if (event.key !== "Tab") return;
          const items = Array.from(modal.current?.querySelectorAll<HTMLElement>("button:not([disabled]),select:not([disabled]),a[href]") ?? []);
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
        className="w-full max-w-[520px] overflow-hidden rounded-[3px] border border-[#e8ebf3] bg-white shadow-[0_14px_30px_rgba(16,42,67,.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#e8ebf3] px-5 py-4">
          <h2 className="m-0 text-[19px] font-bold text-[#1e293b]">
            Select a Kobo form
          </h2>
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
            <div className="flex items-center gap-2 py-4 text-[14px] text-[#708090]">
              <Ring className="size-3.5 text-brand" /> Loading…
            </div>
          ) : connections.length === 0 ? (
            <p className="rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
              No verified Kobo connections found. Add and verify a connection
              from Kobo connections first.
            </p>
          ) : connections.length > 1 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {connections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConnectionId(c.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
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
                  {formsQuery.error instanceof ApiError
                    ? formsQuery.error.message
                    : "Unable to load Kobo forms."}
                </p>
              ) : forms.length ? (
                <div className="grid max-h-[280px] gap-2 overflow-y-auto pr-1">
                  {forms.map((form) => {
                    const isThisRowPending = pendingFormId === form.id;
                    const anotherRowPending =
                      Boolean(pendingFormId) && !isThisRowPending;
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
                          <strong className="block truncate text-[15px] font-semibold text-[#253342]">
                            {form.name}
                          </strong>
                          {form.version && (
                            <small className="text-xs text-[#758092]">
                              v{form.version}
                            </small>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(pendingFormId)}
                          onClick={() =>
                            handleAssign(effectiveConnectionId, form.id)
                          }
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
  sectorNamesData = [],
  onClose,
}: {
  organizationId: string;
  sectorsData: { id: string; sector_id: string }[];
  sectorNamesData?: { id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState(sectorsData[0]?.id || "");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState("High");
  const [status, setStatus] = useState("To Do");

  const createMutation = useMutation({
    mutationFn: () => {
      const resolvedSectorId = sectorId || sectorsData[0]?.id;
      if (!resolvedSectorId) {
        throw new Error(
          "An active sector is required. Please select a sector.",
        );
      }
      return apiClient.createProject(organizationId, {
        name: name.trim(),
        organization_sector_id: resolvedSectorId,
        description: description.trim() || undefined,
        start_date: startDate || null,
        end_date: endDate || null,
        status:
          status === "In Progress"
            ? "active"
            : status === "Completed"
              ? "completed"
              : "draft",
        priority,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization-projects", organizationId],
      });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  }

  const fieldClass =
    "min-h-[42px] w-full rounded-[8px] border border-[#dfe4e8] bg-[#fafbfb] px-3.5 text-[14px] text-[#253342] outline-none transition-colors placeholder:text-[#9aa5b1] focus:border-[#0b51b7] focus:bg-white focus:ring-1 focus:ring-[#0b51b7]/20";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#102a4352] p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <form
        className="w-full max-w-[500px] overflow-hidden rounded-[8px] border border-[#e5e9ed] bg-white shadow-[0_20px_55px_rgba(16,42,67,.24)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-project-modal-title"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#e8edf4] px-6 py-4">
          <div>
            <h2
              id="add-project-modal-title"
              className="m-0 text-[19px] font-bold text-[#1e293b]"
            >
              Add new project
            </h2>
            <p className="mb-0 mt-0.5 text-[13.5px] text-[#64748b]">
              Organize fieldwork and connect your project to data sources.
            </p>
          </div>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-[6px] border border-[#e1e7ee] bg-white p-0 text-[#8290a2] hover:bg-[#f6f8fb] transition-colors cursor-pointer"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-col gap-4 p-6 max-h-[calc(100vh-210px)] overflow-y-auto">
          {/* Project Name */}
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#475569]">
            Project name <span className="text-red-500">*</span>
            <input
              type="text"
              placeholder="e.g. Community Health Survey"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              required
            />
          </label>

          {/* Sector */}
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#475569]">
            Sector <span className="text-red-500">*</span>
            <div className="relative">
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className={`${fieldClass} appearance-none pr-8 cursor-pointer`}
                required
              >
                {sectorsData.length > 0 ? (
                  sectorsData.map((sector) => {
                    const label = sectorNamesData.find(
                      (s) => s.id === sector.sector_id,
                    );
                    return (
                      <option value={sector.id} key={sector.id}>
                        {label?.name ?? "Sector"}
                      </option>
                    );
                  })
                ) : (
                  <option value="">No sectors available</option>
                )}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8290a2]"
              />
            </div>
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#475569]">
            Description
            <textarea
              rows={3}
              placeholder="Brief summary of project scope, target region, or goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${fieldClass} min-h-[76px] py-2 resize-none`}
            />
          </label>

          {/* Start Date & End Date */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#475569]">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#475569]">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#475569]">
              Priority
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`${fieldClass} appearance-none pr-8 cursor-pointer`}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8290a2]"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#475569]">
              Status
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`${fieldClass} appearance-none pr-8 cursor-pointer`}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8290a2]"
                />
              </div>
            </label>
          </div>

          {createMutation.error && (
            <p className="m-0 text-xs text-[#b42318] bg-[#fff0f2] p-3 rounded-md border border-[#f0c8cd]">
              {createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "Unable to create project."}
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="flex justify-end gap-2 border-t border-[#e8edf4] bg-[#fbfcfd] px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating…" : "Add project"}
          </Button>
        </footer>
      </form>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [assigningProject, setAssigningProject] = useState<ApiProject | null>(
    null,
  );
  const [deletingProject, setDeletingProject] = useState<ApiProject | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState("");
  const organizationId = user?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(!authLoading && organizationId),
  });
  const sectorsQuery = useQuery({
    queryKey: ["organization-sectors", organizationId],
    queryFn: () => apiClient.organizationSectors(organizationId!),
    enabled: Boolean(!authLoading && organizationId),
  });
  const sectorNamesQuery = useQuery({
    queryKey: ["sectors"],
    queryFn: apiClient.sectors,
  });
  const projects = projectsQuery.data ?? [];
  const deleteMutation = useMutation({
    mutationFn: (project: ApiProject) =>
      apiClient.deleteProject(organizationId!, project.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization-projects", organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["organization-overview"],
      });
      await queryClient.invalidateQueries({ queryKey: ["sync-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setDeletingProject(null);
    },
    onError: (error) => {
      setDeleteError(
        error instanceof ApiError
          ? error.message
          : "Unable to delete the project.",
      );
    },
  });

  function openDeleteModal(project: ApiProject) {
    setDeleteError("");
    setDeletingProject(project);
  }

  function closeDeleteModal() {
    if (!deleteMutation.isPending) {
      setDeletingProject(null);
      setDeleteError("");
    }
  }

  function confirmDeleteProject() {
    if (!deletingProject || deleteMutation.isPending) return;
    setDeleteError("");
    deleteMutation.mutate(deletingProject);
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="mb-[2px] flex items-end justify-between gap-4 max-[700px]:flex-col max-[700px]:items-start">
        <div>
          <p className="!mb-[5px] !mt-0 !text-[14px] !font-bold !tracking-[.08em] !text-[#0b51b7]">
            PROGRAM OPERATIONS
          </p>
          <h1 className="!m-0 !font-sans !text-[30px] !font-bold !leading-[1.25] !tracking-[-.45px] !text-[#1d2a38]">
            Projects
          </h1>
          <p className="mb-0 mt-[6px] text-[15px] leading-relaxed text-[#607082]">
            Organize fieldwork and connect each project to its Kobo form.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-[40px] items-center gap-[7px] rounded-[6px] border border-[#0b51b7] bg-[#0b51b7] px-4 text-[14px] font-semibold text-white max-[700px]:w-full max-[700px]:justify-center"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={15} /> Add project
        </button>
      </header>

      {deleteError && (
        <p className="m-0 rounded-md bg-[#fff0f2] p-3 text-sm text-[#b42318]">
          {deleteError}
        </p>
      )}

      {projectsQuery.isLoading ? (
        <Card className="flex justify-center gap-2 p-10 text-sm text-[#758092]">
          <Ring className="size-4 text-brand" /> Loading projects
        </Card>
      ) : projectsQuery.error ? (
        <p className="rounded-md bg-[#fff0f2] p-3 text-sm text-[#b42318]">
          {projectsQuery.error instanceof ApiError
            ? projectsQuery.error.message
            : "Unable to load projects."}
        </p>
      ) : projects.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
            <FolderKanban size={21} />
          </span>
          <p className="mb-0 mt-3 text-[19px] font-semibold text-[#253342]">
            No projects yet
          </p>
          <p className="mb-4 mt-1 text-[14px] text-[#708090]">
            Create a project to begin organizing your fieldwork.
          </p>
          <button
            type="button"
            className="inline-flex h-[40px] items-center gap-[7px] rounded-[6px] border border-[#0b51b7] bg-[#0b51b7] px-4 text-[14px] font-semibold text-white"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={15} /> Add project
          </button>
        </Card>
      ) : (
        <section className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="flex flex-col p-[17px] transition-shadow hover:shadow-[0_8px_20px_rgba(16,42,67,.08)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[7px] bg-[#e9f0fa] text-[#4d7fc6]">
                  <FolderKanban size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="m-0 truncate text-[17px] font-semibold text-[#1e293b]">
                    {project.name}
                  </h2>
                  <span className="mt-1 inline-flex rounded-full bg-[#e8f6f4] px-2.5 py-[3px] text-[14px] font-semibold text-[#0b51b7]">
                    {project.status}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-[5px] border border-[#edf0f2] bg-[#fafbfb] px-3 py-2.5">
                <Link2
                  size={14}
                  className={
                    project.kobo_form_name ? "text-brand" : "text-[#b0bac5]"
                  }
                />
                <span className="flex-1 text-[13.5px] truncate">
                  {project.kobo_form_name ? (
                    <span className="font-semibold text-[#334254]">
                      {project.kobo_form_name}
                    </span>
                  ) : (
                    <span className="text-[#9aa5b1]">
                      No Kobo form assigned
                    </span>
                  )}
                </span>
                <button
                  className="inline-flex shrink-0 items-center gap-1 border-0 bg-transparent text-[14px] font-semibold text-[#0b51b7] hover:underline"
                  onClick={() => setAssigningProject(project)}
                  type="button"
                >
                  {project.kobo_form_name ? "Change" : "Assign"}{" "}
                  <ArrowUpRight size={12} />
                </button>
              </div>
              <footer className="mt-4 flex items-center justify-between gap-2 border-t border-[#edf0f2] pt-3">
                <button
                  type="button"
                  className="inline-flex h-[36px] items-center gap-[6px] rounded-[6px] border border-[#f0c8cd] bg-white px-3 text-[14px] font-semibold text-[#b42318] hover:bg-[#fff5f6] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={deleteMutation.isPending}
                  onClick={() => openDeleteModal(project)}
                >
                  <Trash2 size={13} />
                  {deleteMutation.isPending &&
                  deleteMutation.variables?.id === project.id
                    ? "Deleting…"
                    : "Delete"}
                </button>
                <NavLink to={`/projects/${project.id}`}>
                  <button className="inline-flex h-[36px] items-center gap-[6px] rounded-[6px] border border-[#dce2e7] bg-white px-3 text-[14px] font-semibold text-[#546271] hover:border-[#0b51b7] hover:text-[#0b51b7]">
                    Manage project <ArrowUpRight size={13} />
                  </button>
                </NavLink>
              </footer>
            </Card>
          ))}
        </section>
      )}

      {deletingProject && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#102a4352] p-4"
          onClick={closeDeleteModal}
          role="presentation"
        >
          <section
            className="w-full max-w-[460px] overflow-hidden rounded-[8px] border border-[#e5e9ed] bg-white shadow-[0_20px_55px_rgba(16,42,67,.24)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
          >
            <div className="flex items-start gap-4 p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff0f2] text-[#b42318]">
                <Trash2 size={20} />
              </span>
              <div className="min-w-0">
                <h2
                  id="delete-project-title"
                  className="m-0 text-[17px] font-semibold text-[#253342]"
                >
                  Delete project?
                </h2>
                <p className="mb-0 mt-2 text-[14.5px] leading-relaxed text-[#64748b]">
                  You are about to permanently delete{" "}
                  <strong className="text-[#253342]">
                    {deletingProject.name}
                  </strong>
                  .
                </p>
                {deletingProject.kobo_form_name && (
                  <p className="mb-0 mt-3 rounded-md border border-[#f0c8cd] bg-[#fff7f8] p-3 text-[13.5px] leading-relaxed text-[#9f2d38]">
                    The Kobo form{" "}
                    <strong>{deletingProject.kobo_form_name}</strong> and all of
                    its Kobo submissions will also be permanently deleted.
                  </p>
                )}
                <p className="mb-0 mt-3 text-[14px] font-semibold text-[#b42318]">
                  This action cannot be undone.
                </p>
                {deleteError && (
                  <p className="mb-0 mt-3 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
                    {deleteError}
                  </p>
                )}
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#e8edf4] bg-[#fbfcfd] px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDeleteModal}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[#b42318] bg-[#b42318] px-4 text-[13.5px] font-semibold text-white hover:bg-[#941f15] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={confirmDeleteProject}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Ring className="size-4" aria-hidden="true" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deleteMutation.isPending ? "Deleting…" : "Delete project"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {showCreate && organizationId && (
        <CreateProjectModal
          organizationId={organizationId}
          sectorsData={sectorsQuery.data ?? []}
          sectorNamesData={sectorNamesQuery.data ?? []}
          onClose={() => setShowCreate(false)}
        />
      )}
      {assigningProject && (
        <AssignFormModal
          project={assigningProject}
          onClose={() => setAssigningProject(null)}
        />
      )}
    </div>
  );
}
