import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Copy,
  LayoutDashboard,
  Maximize2,
  GripVertical,
  RefreshCw,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, LoadingState } from "../components/ui";
import {
  apiClient,
  type DashboardWidget,
  type WorkspaceDashboard,
  type WorkspaceDashboardInput,
} from "../services/apiClient";
import { Dialog } from "../pages/organization/IndicatorForms";
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

const value = (n: number | null | undefined) =>
  n == null
    ? "Not reported"
    : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
export function DashboardsPage() {
  const { projectId, project, projects, selectProject, organizationId } =
    useWorkspace();
  const cache = useQueryClient();
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState<"new" | WorkspaceDashboard | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [sizing, setSizing] = useState<{
    id: string;
    width: 1 | 2;
    height: number;
  } | null>(null);
  const pointerCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => pointerCleanup.current?.(), []);
  const [widgetEditor, setWidgetEditor] = useState(false);
  const [kind, setKind] = useState<DashboardWidget["kind"]>("indicator");
  const [source, setSource] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [text, setText] = useState("");
  const [filterDashboard, setFilterDashboard] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const dashboards = useQuery({
    queryKey: ["dashboards", organizationId],
    queryFn: apiClient.dashboards,
  });
  const available =
    dashboards.data?.filter((d) => d.project_id === projectId) ?? [];
  const dashboard = available.find((d) => d.id === selected) ?? available[0];
  const syncStatus = useQuery({
    queryKey: ["sync-settings", projectId],
    queryFn: () => apiClient.syncSettings(projectId),
    enabled: Boolean(projectId),
    refetchInterval: 5000,
  });
  useEffect(() => {
    pointerCleanup.current?.();
    setSelected("");
    setEditor(null);
    setWidgetEditor(false);
    setEditingWidget(null);
  }, [projectId]);
  useEffect(() => {
    setFrom(dashboard?.date_from ?? "");
    setThrough(dashboard?.date_to ?? "");
    setFilterDashboard(dashboard?.id ?? "");
  }, [dashboard?.id, dashboard?.date_from, dashboard?.date_to]);
  const indicators = useQuery({
    queryKey: ["indicators", projectId, "", ""],
    queryFn: () => apiClient.indicators(projectId),
    enabled: Boolean(projectId && widgetEditor && kind === "indicator"),
  });
  const analyses = useQuery({
    queryKey: ["saved-analysis", projectId],
    queryFn: () => apiClient.savedAnalyses(projectId),
    enabled: Boolean(projectId && widgetEditor && kind === "analysis"),
  });
  async function refresh(data?: WorkspaceDashboard) {
    if (data) {
      cache.setQueryData<WorkspaceDashboard[]>(
        ["dashboards", organizationId],
        (old) =>
          old ? [...old.filter((item) => item.id !== data.id), data] : [data],
      );
      setSelected(data.id);
    }
    await cache.invalidateQueries({ queryKey: ["dashboards"] });
  }
  const create = useMutation({
    mutationFn: (input: WorkspaceDashboardInput) =>
      apiClient.createDashboard(input),
    onSuccess: async (data) => {
      await refresh(data);
      setEditor(null);
    },
  });
  const save = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: WorkspaceDashboardInput;
    }) => apiClient.saveDashboard(id, input),
    onSuccess: async (data) => {
      await refresh(data);
      setEditor(null);
      setWidgetEditor(false);
    },
  });
  const remove = useMutation({
    mutationFn: apiClient.deleteDashboard,
    onSuccess: () => refresh(),
  });
  function persist(widgets: DashboardWidget[]) {
    if (dashboard)
      save.mutate({ id: dashboard.id, input: { ...dashboard, widgets } });
  }
  function edit(target: "new" | WorkspaceDashboard) {
    setEditor(target);
    setTitle(target === "new" ? "" : target.title);
    setDescription(target === "new" ? "" : target.description);
    create.reset();
    save.reset();
  }
  function reorder(index: number, direction: number) {
    if (
      !dashboard ||
      save.isPending ||
      index + direction < 0 ||
      index + direction >= dashboard.widgets.length
    )
      return;
    const widgets = [...dashboard.widgets];
    [widgets[index], widgets[index + direction]] = [
      widgets[index + direction],
      widgets[index],
    ];
    persist(widgets);
  }
  function openWidget(widget?: DashboardWidget) {
    setWidgetEditor(true);
    setEditingWidget(widget?.id ?? null);
    setKind(widget?.kind ?? "indicator");
    setSource(widget?.source_id ?? "");
    setWidgetTitle(widget?.title ?? "");
    setText(widget?.text ?? "");
    save.reset();
  }
  function startPointer(
    event: ReactPointerEvent<HTMLButtonElement>,
    widget: DashboardWidget,
    resize = false,
  ) {
    if (event.button !== 0 || save.isPending || !dashboard) return;
    event.preventDefault();
    pointerCleanup.current?.();
    const origin = {
      x: event.clientX,
      y: event.clientY,
      height: widget.height ?? 360,
    };
    const card = event.currentTarget.closest<HTMLElement>("[data-widget-id]");
    const columnWidth =
      (card?.parentElement?.getBoundingClientRect().width || 800) / 2;
    let target: string | null = null;
    let size = { id: widget.id, width: widget.width, height: origin.height };
    if (!resize) setDragging(widget.id);
    function move(e: PointerEvent) {
      if (resize) {
        size = {
          id: widget.id,
          width: Math.max(
            1,
            Math.min(
              2,
              widget.width + Math.round((e.clientX - origin.x) / columnWidth),
            ),
          ) as 1 | 2,
          height: Math.max(
            240,
            Math.min(900, Math.round(origin.height + e.clientY - origin.y)),
          ),
        };
        setSizing(size);
      } else {
        target =
          document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLElement>("[data-widget-id]")?.dataset.widgetId ??
          null;
        setDropTarget(target);
      }
    }
    function clear() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", keyboardCancel);
      pointerCleanup.current = null;
      setDragging(null);
      setDropTarget(null);
      setSizing(null);
    }
    function finish() {
      clear();
      if (resize)
        persist(
          dashboard!.widgets.map((w) =>
            w.id === widget.id
              ? { ...w, width: size.width, height: size.height }
              : w,
          ),
        );
      else if (target && target !== widget.id) {
        const widgets = [...dashboard!.widgets];
        const start = widgets.findIndex((w) => w.id === widget.id),
          end = widgets.findIndex((w) => w.id === target);
        if (start >= 0 && end >= 0) {
          const [moving] = widgets.splice(start, 1);
          widgets.splice(end, 0, moving);
          persist(widgets);
        }
      }
    }
    function cancel() {
      clear();
    }
    function keyboardCancel(e: KeyboardEvent) {
      if (e.key === "Escape") cancel();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", keyboardCancel);
    pointerCleanup.current = clear;
  }
  const invalid = Boolean(from && through && from > through);
  return (
    <Page
      breadcrumb={project?.name ?? "Select a project"}
      title="Dashboards"
      description="Build a shared view of your project's results and evidence."
      actions={
        <Button
          disabled={!projectId || save.isPending}
          onClick={() => edit("new")}
        >
          <Plus size={14} />
          Create dashboard
        </Button>
      }
    >
      <WorkspaceGate>
        <WorkspaceTabs />
        <Panel className="flex items-end gap-3 p-4">
          {" "}
          <Field label="Project">
            <select
              className={fieldClass}
              value={projectId}
              disabled={save.isPending}
              onChange={(event) => selectProject(event.target.value)}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </Panel>
        {[dashboards.error, create.error, save.error, remove.error]
          .filter(Boolean)
          .map((e, i) => (
            <Notice error key={i}>
              {e?.message}
            </Notice>
          ))}
        {save.error && (
          <Button
            variant="secondary"
            onClick={() => {
              save.reset();
              dashboards.refetch();
            }}
          >
            Reload saved dashboard
          </Button>
        )}
        {dashboards.error ? (
          <Panel className="p-5">
            <Button variant="secondary" onClick={() => dashboards.refetch()}>
              Retry loading dashboards
            </Button>
          </Panel>
        ) : dashboards.isLoading ? (
          <LoadingState />
        ) : !dashboard ? (
          <Panel className="grid justify-items-center p-12 text-center">
            <LayoutDashboard size={32} className="text-[#7ea9b1]" />
            <h2 className="mb-1 mt-5 text-lg">Your results, together</h2>
            <p className="max-w-md text-sm leading-6 text-[#87969d]">
              Create a dashboard for {project?.name}. Add indicator progress,
              saved survey charts and explanatory notes.
            </p>
            <Button onClick={() => edit("new")}>Create first dashboard</Button>
            <Link to="/" className="mt-5 text-xs text-[#168596]">
              Open automatic collection overview →
            </Link>
          </Panel>
        ) : (
          <>
            <Panel>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebed] p-4">
                <div className="min-w-[230px] flex-1">
                  <label className="sr-only" htmlFor="dashboard-picker">
                    Dashboard
                  </label>
                  <select
                    id="dashboard-picker"
                    className="max-w-full border-0 bg-transparent text-base font-semibold"
                    value={dashboard.id}
                    disabled={save.isPending}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setWidgetEditor(false);
                    }}
                  >
                    {available.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                  {dashboard.description && (
                    <p className="mb-0 mt-1 text-xs text-[#87969d]">
                      {dashboard.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 print:hidden">
                  <Tool
                    title="Rename dashboard"
                    onClick={() => edit(dashboard)}
                  >
                    <Pencil size={14} />
                  </Tool>
                  <Tool
                    title="Duplicate dashboard"
                    onClick={() =>
                      create.mutate({
                        title: `${dashboard.title} copy`.slice(0, 200),
                        description: dashboard.description,
                        project_id: projectId,
                        date_from: dashboard.date_from,
                        date_to: dashboard.date_to,
                        widgets: dashboard.widgets.map((w) => ({
                          ...w,
                          id: crypto.randomUUID(),
                        })),
                      })
                    }
                    disabled={create.isPending}
                  >
                    <Copy size={14} />
                  </Tool>
                  <Tool title="Print dashboard" onClick={() => window.print()}>
                    <Printer size={14} />
                  </Tool>
                  <Tool
                    title="Delete dashboard"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete dashboard “${dashboard.title}”? The source data will remain.`,
                        )
                      )
                        remove.mutate(dashboard.id);
                    }}
                    disabled={remove.isPending}
                  >
                    <Trash2 size={14} />
                  </Tool>
                  <Button
                    disabled={save.isPending}
                    onClick={() => openWidget()}
                  >
                    <Plus size={14} />
                    Add widget
                  </Button>
                </div>
              </header>
              <div className="flex flex-wrap items-end gap-3 px-5 py-4 print:hidden">
                <Field label="Results from">
                  <input
                    type="date"
                    className={fieldClass}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </Field>
                <Field label="Results through">
                  <input
                    type="date"
                    className={fieldClass}
                    value={through}
                    onChange={(e) => setThrough(e.target.value)}
                  />
                </Field>
                <button
                  onClick={() => {
                    setFrom("");
                    setThrough("");
                  }}
                  className="mb-2 border-0 bg-transparent text-xs text-[#168596]"
                >
                  Clear filters
                </button>
                <Button
                  variant="secondary"
                  disabled={invalid || save.isPending}
                  onClick={() =>
                    save.mutate({
                      id: dashboard.id,
                      input: {
                        ...dashboard,
                        date_from: from || null,
                        date_to: through || null,
                      },
                    })
                  }
                >
                  Save filters
                </Button>
                <Tool
                  title="Refresh dashboard data"
                  onClick={() =>
                    cache.invalidateQueries({ queryKey: ["dashboard-widget"] })
                  }
                >
                  <RefreshCw size={14} />
                </Tool>
                <span className="mb-2 ml-auto text-[12px] text-[#87969d]">
                  Saved within {project?.name}
                </span>
              </div>
              <p className="m-0 px-5 pb-4 text-xs leading-5 text-[#87969d]">
                Dates filter results, not overall indicator targets. Dashboard
                dates override each saved chart's date bounds; unset bounds keep
                that chart's saved dates. Other chart filters stay unchanged.
                Changes preview immediately; Save filters keeps them after
                reload.
              </p>
            </Panel>
            {save.isPending && (
              <p role="status" className="text-xs text-[#73868d]">
                Saving dashboard…
              </p>
            )}
            {syncStatus.error && (
              <p role="status" className="text-xs text-[#87969d]">
                Automatic refresh status is unavailable. Use Refresh dashboard
                data to load current results.
              </p>
            )}
            <p className="text-xs text-[#87969d]">
              Drag a widget by its grip to reorder. Drag its lower-right handle
              to resize, or use the move and width buttons.
            </p>
            {invalid ? (
              <Notice error>Start date must be on or before end date.</Notice>
            ) : filterDashboard !== dashboard.id ? (
              <LoadingState />
            ) : (
              <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
                {dashboard.widgets.map((widget, index) => (
                  <div
                    key={widget.id}
                    data-widget-id={widget.id}
                    className={`print:!h-auto ${(sizing?.id === widget.id ? sizing.width : widget.width) === 2 ? "col-span-2 max-lg:col-span-1" : ""} ${dragging === widget.id ? "opacity-60" : ""} ${dropTarget === widget.id && dragging !== widget.id ? "rounded-lg ring-2 ring-[#168596]" : ""}`}
                    style={{
                      height:
                        sizing?.id === widget.id
                          ? sizing.height
                          : (widget.height ?? 360),
                    }}
                  >
                    <Panel className="flex h-full flex-col overflow-hidden print:overflow-visible">
                      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#edf0f2] px-5 py-4">
                        <button
                          type="button"
                          aria-label={`Drag ${widget.title}`}
                          disabled={save.isPending}
                          className="touch-none cursor-grab border-0 print:hidden bg-transparent p-1 text-[#78939c] active:cursor-grabbing"
                          onPointerDown={(event) => startPointer(event, widget)}
                        >
                          <GripVertical size={16} />
                        </button>
                        <h2 className="m-0 flex-1 text-sm font-medium">
                          {widget.title}
                        </h2>
                        <div className="flex shrink-0 gap-1 print:hidden">
                          <Tool
                            title={`Move ${widget.title} up`}
                            disabled={index === 0 || save.isPending}
                            onClick={() => reorder(index, -1)}
                          >
                            <ArrowUp size={12} />
                          </Tool>
                          <Tool
                            title={`Move ${widget.title} down`}
                            disabled={
                              index === dashboard.widgets.length - 1 ||
                              save.isPending
                            }
                            onClick={() => reorder(index, 1)}
                          >
                            <ArrowDown size={12} />
                          </Tool>
                          <Tool
                            title={`Resize ${widget.title}`}
                            disabled={save.isPending}
                            onClick={() =>
                              persist(
                                dashboard.widgets.map((w) =>
                                  w.id === widget.id
                                    ? { ...w, width: w.width === 1 ? 2 : 1 }
                                    : w,
                                ),
                              )
                            }
                          >
                            <Maximize2 size={12} />
                          </Tool>
                          <Tool
                            title={`Edit ${widget.title}`}
                            disabled={save.isPending}
                            onClick={() => openWidget(widget)}
                          >
                            <Pencil size={12} />
                          </Tool>
                          <Tool
                            title={`Remove ${widget.title}`}
                            disabled={save.isPending}
                            onClick={() =>
                              persist(
                                dashboard.widgets.filter(
                                  (w) => w.id !== widget.id,
                                ),
                              )
                            }
                          >
                            <Trash2 size={12} />
                          </Tool>
                        </div>
                      </header>
                      <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
                        <Widget
                          widget={
                            sizing?.id === widget.id
                              ? { ...widget, height: sizing.height }
                              : widget
                          }
                          project={projectId}
                          dashboardId={dashboard.id}
                          version={dashboard.version}
                          revision={syncStatus.data?.last_successful_sync}
                          from={from}
                          through={through}
                        />
                      </div>
                      <div className="mt-auto flex items-center justify-end gap-2 px-3 pb-2 print:hidden">
                        <label className="text-[11px] text-[#87969d]">
                          Height{" "}
                          <select
                            aria-label={`Height of ${widget.title}`}
                            disabled={save.isPending}
                            value={widget.height ?? 360}
                            onChange={(event) =>
                              persist(
                                dashboard.widgets.map((w) =>
                                  w.id === widget.id
                                    ? {
                                        ...w,
                                        height: Number(event.target.value),
                                      }
                                    : w,
                                ),
                              )
                            }
                          >
                            {[
                              ...new Set([
                                240,
                                360,
                                480,
                                600,
                                900,
                                widget.height ?? 360,
                              ]),
                            ]
                              .sort((a, b) => a - b)
                              .map((height) => (
                                <option key={height} value={height}>
                                  {height}px
                                </option>
                              ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          aria-label={`Drag to resize ${widget.title}`}
                          disabled={save.isPending}
                          className="touch-none cursor-se-resize rounded border border-[#e2e9ec] bg-white p-1 text-[#78939c]"
                          onPointerDown={(event) =>
                            startPointer(event, widget, true)
                          }
                        >
                          <Maximize2 size={13} />
                        </button>
                      </div>
                    </Panel>
                  </div>
                ))}
              </div>
            )}
            {!dashboard.widgets.length && (
              <Panel className="p-12 text-center">
                <BarChart3 className="mx-auto text-[#8aadb5]" size={30} />
                <h2 className="text-lg">Add your first widget</h2>
                <p className="text-sm text-[#87969d]">
                  Choose an indicator, a saved analysis, or a text note.
                </p>
              </Panel>
            )}
          </>
        )}
      </WorkspaceGate>
      {editor && (
        <Dialog
          title={editor === "new" ? "Create dashboard" : "Edit dashboard"}
          onClose={() => setEditor(null)}
          error={create.error?.message ?? save.error?.message}
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const input = {
                title,
                description,
                project_id: projectId,
                widgets: editor === "new" ? [] : editor.widgets,
                version: editor === "new" ? undefined : editor.version,
                date_from: editor === "new" ? null : editor.date_from,
                date_to: editor === "new" ? null : editor.date_to,
              };
              if (editor === "new") create.mutate(input);
              else save.mutate({ id: editor.id, input });
            }}
          >
            <Field label="Dashboard name">
              <input
                required
                minLength={2}
                maxLength={200}
                className={fieldClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Description">
              <textarea
                maxLength={1000}
                className={fieldClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Notice>
              Visible to organization administrators with access to this
              project. Public sharing is not enabled.
            </Notice>
            <Button
              type="submit"
              disabled={!projectId || create.isPending || save.isPending}
            >
              Save dashboard
            </Button>
          </form>
        </Dialog>
      )}
      {widgetEditor && dashboard && (
        <Dialog
          title={
            editingWidget ? "Edit dashboard widget" : "Add dashboard widget"
          }
          onClose={() => setWidgetEditor(false)}
          error={
            save.error?.message ??
            indicators.error?.message ??
            analyses.error?.message
          }
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const original = dashboard.widgets.find(
                (w) => w.id === editingWidget,
              );
              const updated: DashboardWidget = {
                id: editingWidget ?? crypto.randomUUID(),
                title: widgetTitle,
                kind,
                source_id: kind === "text" ? null : source,
                text,
                width: original?.width ?? 1,
                height: original?.height ?? 360,
              };
              persist(
                editingWidget
                  ? dashboard.widgets.map((w) =>
                      w.id === editingWidget ? updated : w,
                    )
                  : [...dashboard.widgets, updated],
              );
            }}
          >
            <Field label="Widget type">
              <select
                className={fieldClass}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as DashboardWidget["kind"]);
                  setSource("");
                }}
              >
                <option value="indicator">Indicator progress</option>
                <option value="analysis">Saved survey visualization</option>
                <option value="text">Text & context</option>
              </select>
            </Field>
            <Field label="Widget title">
              <input
                required
                maxLength={200}
                className={fieldClass}
                value={widgetTitle}
                onChange={(e) => setWidgetTitle(e.target.value)}
              />
            </Field>
            {kind === "text" ? (
              <Field label="Text">
                <textarea
                  className={fieldClass}
                  rows={5}
                  maxLength={4000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
            ) : (
              <Field
                label={
                  kind === "indicator" ? "Indicator" : "Saved visualization"
                }
              >
                <select
                  required
                  className={fieldClass}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">Choose a source</option>
                  {editingWidget &&
                    source &&
                    !(
                      kind === "indicator" ? indicators.data : analyses.data
                    )?.some((item) => item.id === source) && (
                      <option value={source}>
                        Existing source (unavailable)
                      </option>
                    )}
                  {(kind === "indicator"
                    ? (indicators.data ?? [])
                    : (analyses.data ?? [])
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {"name" in item ? item.name : item.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {kind !== "text" &&
              (kind === "indicator"
                ? indicators.isLoading
                : analyses.isLoading) && (
                <p className="text-xs text-[#87969d]">
                  Loading widget sources…
                </p>
              )}
            {kind !== "text" &&
              !(kind === "indicator"
                ? indicators.isLoading
                : analyses.isLoading) &&
              !(kind === "indicator" ? indicators.data : analyses.data)
                ?.length && (
                <p className="text-xs text-[#87969d]">
                  No{" "}
                  {kind === "indicator" ? "indicators" : "saved visualizations"}{" "}
                  are available in this project. Create a source before adding
                  this widget.
                </p>
              )}
            {kind === "analysis" && (
              <p className="text-xs text-[#87969d]">
                Save a visualization in{" "}
                <Link to="/analytics" className="text-[#168596]">
                  Explore & analyze
                </Link>{" "}
                to use it here. Dashboard dates override that visualization's
                date filters; other filters are preserved.
              </p>
            )}
            <Button
              type="submit"
              disabled={
                save.isPending ||
                !widgetTitle.trim() ||
                (kind !== "text" && !source)
              }
            >
              {editingWidget ? "Save widget" : "Add widget"}
            </Button>
          </form>
        </Dialog>
      )}
    </Page>
  );
}
function Tool({
  title,
  onClick,
  children,
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="grid size-7 place-items-center rounded border border-[#e2e9ec] bg-white text-[#78939c] hover:bg-[#f1f7f8] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
function Widget({
  widget,
  project,
  from,
  through,
  dashboardId,
  version,
  revision,
}: {
  dashboardId: string;
  version?: number;
  revision?: string | null;
  widget: DashboardWidget;
  project: string;
  from: string;
  through: string;
}) {
  const response = useQuery({
    queryKey: [
      "dashboard-widget",
      project,
      dashboardId,
      widget.id,
      version,
      from,
      through,
      revision,
    ],
    queryFn: () =>
      apiClient.dashboardWidgetResult(dashboardId, widget.id, from, through),
    enabled: widget.kind !== "text",
    retry: false,
  });
  const result = {
    data:
      response.data?.kind === "analysis" ? response.data.analysis : undefined,
  };
  const saved =
    response.data?.kind === "analysis"
      ? { chart: response.data.chart }
      : undefined;
  const error = response.error;
  if (widget.kind === "text")
    return (
      <p className="m-0 whitespace-pre-wrap p-5 text-sm leading-7 text-[#73868d]">
        {widget.text || "No text provided."}
      </p>
    );
  if (error)
    return (
      <div className="p-5">
        <Notice error>{error.message}</Notice>
        <Button variant="secondary" onClick={() => response.refetch()}>
          Retry widget
        </Button>
      </div>
    );
  if (response.isLoading) return <LoadingState />;
  if (widget.kind === "indicator") {
    const item =
      response.data?.kind === "indicator" ? response.data.indicator : undefined;
    if (!item)
      return (
        <p className="p-5 text-sm text-[#87969d]">
          The source indicator is no longer available.
        </p>
      );
    return (
      <div className="p-5">
        <p className="mb-1 text-xs text-[#87969d]">{item.name}</p>
        {item.result_source === "unconfigured" ||
        !["healthy", "unmapped"].includes(item.mapping_health) ? (
          <p className="text-xs text-amber-700">
            Source unavailable or not configured:{" "}
            {item.mapping_health.replaceAll("_", " ")}. Check the indicator
            mapping.
          </p>
        ) : null}
        <strong className="block text-3xl font-semibold text-[#168596]">
          {item.unit === "text"
            ? (item.qualitative_value ?? "Not reported")
            : value(item.current_value) +
              (item.current_value != null && item.unit === "percentage"
                ? "%"
                : "")}
        </strong>
        {item.unit !== "text" && (
          <>
            <p className="text-xs text-[#87969d]">
              Overall target: {value(item.target_value)}
              {from || through ? " (unchanged by date filters)" : ""}
            </p>
            {item.progress_percent !== null && (
              <div className="h-2 overflow-hidden rounded bg-[#edf2f4]">
                <div
                  className="h-full bg-[#27a9b7]"
                  style={{
                    width: `${Math.max(0, Math.min(100, item.progress_percent))}%`,
                  }}
                />
              </div>
            )}
          </>
        )}
        <p className="mt-4 text-[12px] text-[#87969d]">
          {item.result_source === "manual"
            ? `${item.manual_result_count} manual results`
            : `${item.eligible_records} ready records`}{" "}
          ·{" "}
          {item.target_achieved
            ? "Target achieved"
            : item.status.replaceAll("_", " ")}
        </p>
        <Link
          className="text-xs text-[#168596]"
          to={`/projects/${project}/indicators?view=results`}
        >
          Open indicator results →
        </Link>
      </div>
    );
  }
  if (!saved)
    return (
      <p className="p-5 text-sm text-[#87969d]">
        The saved visualization is no longer available.
      </p>
    );
  if (!result.data)
    return (
      <p className="p-5 text-sm text-[#87969d]">
        Visualization data is unavailable.
      </p>
    );
  if (!result.data.series.length)
    return (
      <p className="p-5 text-sm text-[#87969d]">
        No answered records match this chart's source and filters.
      </p>
    );
  const data = result.data.series.map((p) => ({
    ...p,
    name: p.group ? `${p.name} · ${p.group}` : p.name,
  }));
  return (
    <div className="p-5">
      <div style={{ height: Math.max(160, (widget.height ?? 420) - 170) }}>
        {saved.chart === "table" ? (
          <div className="max-h-[250px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="py-2">Category</th>
                  <th>Value</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => (
                  <tr key={i} className="border-t border-[#edf0f2]">
                    <td className="py-2">{p.name}</td>
                    <td>{value(p.value)}</td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {saved.chart === "donut" ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={85}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        ["#25a6b4", "#69c4b5", "#a2dcd1", "#d5b76b", "#698fa8"][
                          i % 5
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            ) : saved.chart === "line" ? (
              <LineChart data={data}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line dataKey="value" stroke="#25a6b4" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#25a6b4" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      <p className="mb-2 text-[12px] text-[#87969d]">
        {result.data.answered_records} answered / {result.data.eligible_records}{" "}
        eligible · {result.data.missing_records} missing ·{" "}
        {result.data.invalid_answers} invalid
      </p>
      <Link
        to={`/analytics?project_id=${project}`}
        className="text-xs text-[#168596]"
      >
        Explore source data →
      </Link>
    </div>
  );
}
