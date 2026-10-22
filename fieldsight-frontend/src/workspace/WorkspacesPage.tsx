import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  Plus,
  Search,
} from "lucide-react";
import { Button, LoadingState } from "../components/ui";
import { apiClient } from "../services/apiClient";
import { Dialog } from "../pages/organization/IndicatorForms";
import { useWorkspace } from "./WorkspaceContext";
import { Field, Notice, Page, Panel, fieldClass } from "./WorkspaceUI";

export function WorkspacesPage() {
  const workspace = useWorkspace();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sector, setSector] = useState("");
  const sectors = useQuery({
    queryKey: ["organization-sectors", workspace.organizationId],
    queryFn: () => apiClient.organizationSectors(workspace.organizationId),
    enabled: Boolean(workspace.organizationId),
  });
  const names = useQuery({ queryKey: ["sectors"], queryFn: apiClient.sectors });
  const create = useMutation({
    mutationFn: () =>
      apiClient.createProject(workspace.organizationId, {
        name: name.trim(),
        description,
        start_date: start || null,
        end_date: end || null,
        organization_sector_id:
          sector || sectors.data?.find((s) => s.is_active)?.id || "",
        status: "draft",
      }),
    onSuccess: async (data) => {
      await cache.invalidateQueries({ queryKey: ["organization-projects"] });
      workspace.selectProject(data.id);
      setAdding(false);
      navigate(`/projects/${data.id}`);
    },
  });
  const filtered = workspace.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (!status || p.status === status),
  );
  return (
    <Page
      title="Workspaces"
      description="Your projects, programmes and country portfolios, organized around results."
      actions={
        <Button
          onClick={() => {
            setAdding(true);
            setName("");
            setDescription("");
            setStart("");
            setEnd("");
            create.reset();
          }}
        >
          <Plus size={15} />
          Add workspace
        </Button>
      }
    >
      <Panel className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-3 text-[#95a2a9]" />
          <input
            aria-label="Search workspaces"
            className={`${fieldClass} pl-9`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a workspace…"
          />
        </div>
        <select
          aria-label="Workspace status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-[#dce4e8] bg-white px-3 py-2.5 text-xs text-[#73868d]"
        >
          <option value="">All statuses</option>
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
        <span className="text-xs text-[#87969d]">
          {filtered.length} workspaces
        </span>
      </Panel>
      {workspace.error && <Notice error>{workspace.error.message}</Notice>}
      {workspace.loading ? (
        <LoadingState />
      ) : filtered.length ? (
        <div className="grid grid-cols-3 gap-5 max-xl:grid-cols-2 max-md:grid-cols-1">
          {filtered.map((project, index) => (
            <Panel key={project.id} className="flex flex-col overflow-hidden">
              <div
                className="h-1"
                style={{
                  backgroundColor: ["#218fa0", "#7db5a0", "#c5a96d"][index % 3],
                }}
              />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-5 flex items-center justify-between">
                  <FolderKanban size={23} className="text-[#78a0a9]" />
                  <span
                    className={`rounded px-2 py-1 text-[10px] capitalize ${project.status === "active" ? "bg-[#e9f6ef] text-[#408569]" : "bg-[#f1f4f6] text-[#87969d]"}`}
                  >
                    {project.status.replaceAll("_", " ")}
                  </span>
                </div>
                <Link
                  onClick={() => workspace.selectProject(project.id)}
                  to={`/projects/${project.id}`}
                  className="text-base font-semibold text-[#28434d] no-underline"
                >
                  {project.name}
                </Link>
                <p className="mb-5 mt-2 line-clamp-2 text-xs leading-6 text-[#87969d]">
                  {project.description ||
                    "Add a description in workspace details."}
                </p>
                <div className="mt-auto flex items-center gap-2 border-t border-[#edf0f2] pt-4 text-[10px] text-[#87969d]">
                  <CalendarDays size={13} />
                  {project.start_date ?? "No start date"} —{" "}
                  {project.end_date ?? "No end date"}
                  <Link
                    aria-label={`Open ${project.name}`}
                    onClick={() => workspace.selectProject(project.id)}
                    className="ml-auto text-[#168596]"
                    to={`/projects/${project.id}`}
                  >
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel className="p-12 text-center">
          <FolderKanban className="mx-auto text-[#8aadb5]" size={32} />
          <h2 className="text-lg">
            {search || status
              ? "No workspaces match"
              : "Create your first workspace"}
          </h2>
          <p className="text-sm text-[#87969d]">
            Start with the project you want to monitor.
          </p>
        </Panel>
      )}
      {adding && (
        <Dialog
          title="Add workspace"
          description="Start with a name, sector and dates. Add your team and indicator plan next."
          error={create.error?.message ?? sectors.error?.message}
          onClose={() => setAdding(false)}
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
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
            <Field label="Sector">
              <select
                required
                className={fieldClass}
                value={
                  sector || sectors.data?.find((s) => s.is_active)?.id || ""
                }
                onChange={(e) => setSector(e.target.value)}
              >
                {!sectors.data?.some((s) => s.is_active) && (
                  <option value="">No enabled sectors</option>
                )}
                {sectors.data
                  ?.filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {names.data?.find((n) => n.id === s.sector_id)?.name ??
                        "Enabled sector"}
                    </option>
                  ))}
              </select>
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
            <Field label="Description">
              <textarea
                className={fieldClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              disabled={
                create.isPending || !sectors.data?.some((s) => s.is_active)
              }
            >
              Save workspace
            </Button>
          </form>
        </Dialog>
      )}
    </Page>
  );
}
