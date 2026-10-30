import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  MoreVertical,
  Filter,
  MapPin,
  Users,
  FolderKanban,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button, LoadingSkeleton, LoadingState, PageHeader } from "../components/ui";
import { apiClient } from "../services/apiClient";
import { Dialog } from "../pages/organization/IndicatorForms";
import { useWorkspace } from "./WorkspaceContext";
import { Field, Notice, Panel, fieldClass } from "./WorkspaceUI";

export function WorkspacesPage() {
  const workspace = useWorkspace();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("workspace");
  const [sort, setSort] = useState<{
    key: "name" | "id" | "start_date" | "end_date" | "created_at" | "status";
    ascending: boolean;
  }>({ key: "created_at", ascending: false });
  const [actionProject, setActionProject] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const deletingProject = workspace.projects.find(
    (p) => p.id === actionProject,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const sectors = useQuery({
    queryKey: ["organization-sectors", workspace.organizationId],
    queryFn: () => apiClient.organizationSectors(workspace.organizationId),
    enabled: Boolean(workspace.organizationId),
  });
  const create = useMutation({
    mutationFn: () =>
      apiClient.createProject(workspace.organizationId, {
        name: name.trim(),
        start_date: start || null,
        end_date: end || null,
        organization_sector_id:
          sectors.data?.find((s) => s.is_active)?.id || "",
        status: "draft",
      }),
    onSuccess: async (data) => {
      await cache.invalidateQueries({ queryKey: ["organization-projects"] });
      workspace.selectProject(data.id);
      setAdding(false);
      navigate(`/projects/${data.id}`);
    },
  });
  const update = useMutation({
    mutationFn: () =>
      apiClient.updateProject(workspace.organizationId, actionProject!, {
        name: name.trim(),
        start_date: start || null,
        end_date: end || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["organization-projects"] }),
        cache.invalidateQueries({
          queryKey: ["project", workspace.organizationId, actionProject],
        }),
      ]);
      setActionProject(null);
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      apiClient.updateProject(workspace.organizationId, actionProject!, { status: deletingProject?.status === "archived" ? "active" : "archived" }),
    onSuccess: async () => {
      setConfirmDelete(false);
      setActionProject(null);
      // Discard project data retained by inactive workspace queries, too.
      cache.removeQueries({ predicate: (query) => !query.isActive() });
      await cache.invalidateQueries();
    },
  });
  const saving = create.isPending || update.isPending || remove.isPending;
  function closeForm() {
    if (!saving) {
      setAdding(false);
      setActionProject(null);
    }
  }
  function openWorkspace(id: string) {
    workspace.selectProject(id);
    navigate(`/projects/${id}`);
  }
  const filtered = workspace.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (!status || p.status === status),
  );
  const submissions = useQuery({
    queryKey: ["submissions"],
    queryFn: apiClient.submissions,
    enabled: tab === "sites",
  });
  const sites = new Map<string, number>();
  for (const row of submissions.data ?? []) {
    if (row.project_id === workspace.projectId && row.location)
      sites.set(row.location, (sites.get(row.location) ?? 0) + 1);
  }
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader eyebrow="FieldSight / Organization" title="Projects" description="Manage organization projects. Open a project to view its forms, indicators, and results." descriptionClassName="font-medium">
        <Button
          onClick={() => {
            setActionProject(null);
            setAdding(true);
            setName("");
            setStart("");
            setEnd("");
            create.reset();
          }}
        >
          <Plus size={14} />
          Add new project
        </Button>
      </PageHeader>
      <div className="flex items-center gap-2">
        <label className="relative w-full max-w-lg">
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-[var(--fs-muted)]" />
          <span className="sr-only">Search projects</span>
          <input type="search" placeholder="Search projects…" className={`${fieldClass} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <button
          aria-label="Filter projects"
          aria-expanded={showFilters}
          aria-controls="project-filters"
          className={`grid size-11 shrink-0 place-items-center rounded-lg border border-[var(--fs-control-border)] ${showFilters ? "bg-[#edf4ff]" : "bg-white"} text-[#0b51b7]`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={14} />
        </button>
      </div>
      {showFilters && (
        <div id="project-filters"><Panel className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Project status">
          <select
            aria-label="Project status"
            className={fieldClass + " max-w-[180px]"}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "draft",
              "active",
              "in_review",
              "paused",
              "completed",
              "archived",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          </Field>
          <button
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand hover:bg-blue-50"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
          >
            Clear filters
          </button>
        </Panel></div>
      )}
      <nav
        aria-label="Project tabs"
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-[#dddfe5]"
      >
        {[
          { id: "workspace", label: "Projects", icon: FolderKanban },
          { id: "sites", label: "Sites", icon: MapPin },
          { id: "stakeholders", label: "Stakeholders", icon: Users },
        ].map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            role="tab"
            id={`workspace-tab-${id}`}
            aria-controls={`workspace-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
              if (next === null) return;
              event.preventDefault();
              const button = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
              button?.focus();
              button?.click();
            }}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 border-0 border-b-2 px-4 py-3 text-xs ${tab === id ? "border-[#0b51b7] bg-white font-medium text-[#0b51b7]" : "border-transparent bg-transparent text-[var(--fs-muted)] hover:text-[#0b51b7]"}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>
      {tab !== "workspace" && <p className="text-sm text-[var(--fs-muted)]">Current project: <strong>{workspace.project?.name ?? "None selected"}</strong>. Choose a project from the Projects tab to switch projects.</p>}
      {workspace.refreshing && <LoadingState variant="inline" label="Updating projects…" />}
      {workspace.error && <Notice error>{workspace.error.message} <button className="min-h-11 px-3 font-semibold underline" onClick={workspace.reload}>Retry projects</button></Notice>}
      <div
        role="tabpanel"
        id={`workspace-panel-${tab}`}
        aria-labelledby={`workspace-tab-${tab}`}
        aria-busy={workspace.refreshing || workspace.loading}
      >
        {workspace.loading ? (
          <LoadingSkeleton label="Loading projects…" columns={7} />
        ) : workspace.error && !workspace.project ? <Panel className="p-5"><Button variant="secondary" onClick={workspace.reload}>Retry loading projects</Button></Panel> : !workspace.project ? (
          <Panel className="p-10 text-center">
            <h2 className="text-lg">Create your first project</h2>
            <p className="text-sm text-[var(--fs-muted)]">
              Start with the project you want to monitor.
            </p>
          </Panel>
        ) : tab === "workspace" ? (
          <div className="relative max-w-full overflow-x-auto rounded-xl border border-[var(--fs-border)] bg-white" role="region" aria-label="Projects table" tabIndex={0}>
            <table className="fs-data-table w-full min-w-[970px] border-collapse text-left text-sm">
              <thead className="bg-[#f6f6f8] text-[12px] uppercase tracking-[.04em] text-[var(--fs-muted)]">
                <tr>
                  {[
                    { label: "Name", key: "name" },
                    { label: "Project ID code", key: "id" },
                    { label: "Stage", key: null },
                    { label: "Group", key: null },
                    { label: "Start date", key: null },
                    { label: "End date", key: null },
                    { label: "Created At", key: null },
                    { label: "Status", key: "status" },
                  ].map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className="px-3 py-2 font-medium"
                      aria-sort={
                        sort.key === column.key
                          ? sort.ascending
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {column.key ? (
                        <button
                          className="flex items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-medium uppercase tracking-[.04em] text-inherit"
                          onClick={() =>
                            setSort((current) => ({
                              key: column.key as typeof sort.key,
                              ascending:
                                current.key === column.key
                                  ? !current.ascending
                                  : true,
                            }))
                          }
                        >
                          {column.label}
                          <ChevronDown
                            size={10}
                            className={
                              sort.key === column.key && !sort.ascending
                                ? "rotate-180"
                                : ""
                            }
                          />
                        </button>
                      ) : (
                        <span>{column.label}</span>
                      )}
                    </th>
                  ))}
                  <th scope="col" className="w-10">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...filtered]
                  .sort(
                    (a, b) =>
                      String(a[sort.key] ?? "").localeCompare(
                        String(b[sort.key] ?? ""),
                      ) * (sort.ascending ? 1 : -1),
                  )
                  .map((project) => (
                    <tr
                      key={project.id}
                      tabIndex={0}
                      aria-label={`Open project ${project.name}`}
                      onClick={(event) => {
                        if (
                          !(event.target as HTMLElement).closest(
                            "a,button,input,select",
                          )
                        )
                          openWorkspace(project.id);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          openWorkspace(project.id);
                        }
                      }}
                      className="cursor-pointer border-t border-[#ececf1] odd:bg-[#f5f6f8] even:bg-white outline-none focus-visible:bg-[#edf4ff] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b51b7]"
                    >
                      <td className="max-w-[310px] px-3 py-2">
                        <Link
                          onClick={() => workspace.selectProject(project.id)}
                          to={`/projects/${project.id}`}
                          className="font-medium leading-5 text-[#0b51b7] no-underline"
                        >
                          {project.name}
                        </Link>
                        {project.id === workspace.projectId && <span className="mt-1 block text-xs font-medium text-[var(--fs-muted)]">Current project</span>}
                      </td>
                      <td className="px-3 py-2 text-[#49515c]">
                        <span className="font-medium text-[var(--fs-primary)]" title={`Project ID: ${project.id}`}>
                          {project.workspace_details?.code ||
                            project.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#49515c]">
                        {project.workspace_details?.stage || "Not set"}
                      </td>
                      <td className="px-3 py-2 text-[#49515c]">
                        {project.workspace_details?.group || "Not set"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#49515c]">
                        {displayDate(project.start_date)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#49515c]">
                        {displayDate(project.end_date)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#49515c]">
                        {displayCreatedAt(project.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center"
                          title={
                            project.workspace_details?.health_status ||
                            project.status.replaceAll("_", " ")
                          }
                        >
                          <span
                            role="img"
                            aria-label={`Status: ${project.workspace_details?.health_status || project.status.replaceAll("_", " ")}`}
                            className="inline-block size-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                ((
                                  {
                                    red: "#e34e4e",
                                    amber: "#e9b34b",
                                    green: "#48ad83",
                                  } as Record<string, string>
                                )[
                                  project.workspace_details?.health_status ?? ""
                                ] ||
                                  (
                                    {
                                      active: "#43ad80",
                                      draft: "#a0a6b0",
                                      paused: "#e6ad48",
                                      in_review: "#8970d6",
                                      completed: "#5599cc",
                                      archived: "#b7bdc5",
                                    } as Record<string, string>
                                  )[project.status]) ??
                                "#a0a6b0",
                            }}
                          />
                          <span className="ml-2 text-sm capitalize text-[var(--fs-text)]">{project.status.replaceAll("_", " ")}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          aria-label={`Actions for ${project.name}`}
                          title="Update project"
                          className="grid size-11 place-items-center rounded-lg border-0 bg-transparent text-[#0b51b7]"
                          onClick={(event) => {
                            event.stopPropagation();
                            workspace.selectProject(project.id);
                            setAdding(false);
                            setName(project.name);
                            setStart(project.start_date ?? "");
                            setEnd(project.end_date ?? "");
                            update.reset();
                            setActionProject(project.id);
                          }}
                        >
                          <MoreVertical size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="p-6 text-center text-xs text-[#92949f]">
                No projects match your filters.
              </p>
            )}
          </div>
        ) : tab === "sites" ? (
          <Panel>
            <h2 className="m-0 border-b border-[#edf0f2] px-5 py-4 text-sm font-semibold">
              Project sites
            </h2>
            <p className="px-5 text-xs leading-6 text-[var(--fs-muted)]">
              Locations recorded in this project's stored responses.
            </p>
            {submissions.isLoading ? (
              <LoadingState variant="panel" label="Loading project sites…" />
            ) : submissions.error ? (
              <div className="p-5">
                <Notice error>{submissions.error.message} <button className="min-h-11 px-3 font-semibold underline" onClick={() => void submissions.refetch()}>Retry project sites</button></Notice>
              </div>
            ) : sites.size ? (
              <table className="fs-data-table w-full text-left text-xs">
                <thead className="bg-[#f8fafb] text-[12px] uppercase text-[#92949f]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Site / location</th>
                    <th className="px-5 py-3 font-medium">Stored responses</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sites]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([site, count]) => (
                      <tr key={site} className="border-t border-[#edf0f2]">
                        <td className="px-5 py-4">{site}</td>
                        <td className="px-5 py-4">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-sm text-[var(--fs-muted)]">
                No site locations are recorded in this project's responses yet.
              </p>
            )}
          </Panel>
        ) : (
          <Panel className="p-6">
            <h2 className="mt-0 text-sm font-semibold">Stakeholders</h2>
            <p className="text-sm leading-7 text-[var(--fs-muted)]">
              Partner and external stakeholder records are not connected yet.
              Internal project members are managed separately in Team &
              invitations.
            </p>
            <Link to="/team?scope=workspace" className="text-xs text-[#0b51b7]">
              View project team →
            </Link>
          </Panel>
        )}
      </div>
      {(adding || actionProject) && !confirmDelete && (
        <Dialog
          title={actionProject ? "Update Project" : "Add new project"}
          compact
          error={
            actionProject
              ? update.error?.message
              : (create.error?.message ?? sectors.error?.message)
          }
          onClose={closeForm}
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (actionProject) update.mutate();
              else create.mutate();
            }}
          >
            <Field label="Name *">
              <input
                required
                minLength={2}
                maxLength={200}
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {!actionProject &&
              !sectors.isLoading &&
              !sectors.error &&
              !sectors.data?.some((s) => s.is_active) && (
                <Notice error>
                  An enabled organization sector is required before creating a
                  project.{" "}
                  <Link to="/settings" className="text-inherit underline">
                    Open organization settings
                  </Link>
                </Notice>
              )}
            <div className="mt-4 flex justify-end gap-3 border-t border-[#e8e8ee] pt-4">
              {actionProject && workspace.isAdmin && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    remove.reset();
                    setDeleteName("");
                    setConfirmDelete(true);
                  }}
                  className="mr-auto inline-flex items-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={14} /> {deletingProject?.status === "archived" ? "Restore" : "Archive"}
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="rounded border border-[#0b51b7] bg-white px-5 py-2 text-sm font-medium text-[#0b51b7] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  name.trim().length < 2 ||
                  (!actionProject && !sectors.data?.some((s) => s.is_active))
                }
                className="rounded border border-[#0b51b7] bg-[#0b51b7] px-6 py-2 text-sm font-medium text-white hover:bg-[#084394] disabled:opacity-50"
              >
                {saving ? "Saving…" : actionProject ? "Save changes" : "Save"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {confirmDelete && deletingProject && (
        <Dialog
          title={deletingProject.status === "archived" ? "Restore project?" : "Archive project?"}
          compact
          error={remove.error?.message}
          onClose={() => {
            if (!remove.isPending) setConfirmDelete(false);
          }}
        >
          <p className="text-sm leading-6 text-[var(--fs-muted)]">
            {deletingProject.status === "archived" ? "Restore" : "Archive"} <strong>{deletingProject.name}</strong>?
            All FieldSight records and Kobo assets are retained. Archiving stops queued and scheduled synchronization.
            Restoration keeps synchronization manual until you enable it again.
          </p>
          <Field label="Type the project name to confirm">
            <input
              className={fieldClass}
              value={deleteName}
              onBlur={() => setDeleteName((value) => value.trim())}
              disabled={remove.isPending}
              onChange={(e) => setDeleteName(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <div className="mt-5 flex justify-end gap-3 border-t border-[#e8e8ee] pt-4">
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => setConfirmDelete(false)}
              className="rounded border border-[#dce5e8] bg-white px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={remove.isPending || deleteName.trim() !== deletingProject.name.trim()}
              onClick={() => remove.mutate()}
              className="rounded border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {remove.isPending ? "Saving…" : deletingProject.status === "archived" ? "Restore project" : "Archive project"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function displayDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function displayCreatedAt(value?: string) {
  if (!value) return "—";
  // SQLite can return UTC timestamps without an explicit offset.
  const timestamp = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  if (Number.isNaN(timestamp.getTime())) return "—";
  return timestamp.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
