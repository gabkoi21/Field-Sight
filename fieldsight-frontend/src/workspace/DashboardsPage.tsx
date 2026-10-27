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
  ChevronDown,
  Copy,
  LayoutDashboard,
  Maximize2,
  GripVertical,
  RefreshCw,
  SlidersHorizontal,
  Pencil,
  Plus,
  Printer,
  Target,
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
import { Button, LoadingSkeleton, LoadingState, MetricCard } from "../components/ui";
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
  const { projectId, project, organizationId } =
    useWorkspace();
  const cache = useQueryClient();
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState<"new" | WorkspaceDashboard | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const [presentedDashboard, setPresentedDashboard] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const pointerCleanup = useRef<(() => void) | null>(null);
  const filtersRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeFilters = (event: PointerEvent) => {
      const filters = filtersRef.current;
      if (filters?.open && event.target instanceof Node && !filters.contains(event.target)) {
        filters.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && filtersRef.current?.open) {
        filtersRef.current.open = false;
        filtersRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeFilters);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFilters);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
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
  const expanded = dashboard?.widgets.find((w) => w.id === expandedWidget);
  const syncStatus = useQuery({
    queryKey: ["sync-settings", projectId],
    queryFn: () => apiClient.syncSettings(projectId),
    enabled: Boolean(projectId),
    meta: { backgroundRefresh: true }, refetchInterval: 5000,
  });
  useEffect(() => {
    pointerCleanup.current?.();
    setSelected("");
    setEditor(null);
    setWidgetEditor(false);
    setEditingWidget(null);
  }, [projectId]);
  useEffect(() => {
    setExpandedWidget(null);
    setPresentedDashboard(null);
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
  ) {
    if (event.button !== 0 || save.isPending || !dashboard) return;
    event.preventDefault();
    pointerCleanup.current?.();
    let target: string | null = null;
    setDragging(widget.id);
    function move(e: PointerEvent) {
      target = document.elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-widget-id]")?.dataset.widgetId ?? null;
      setDropTarget(target);
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
    }
    function finish() {
      clear();
      if (target && target !== widget.id) {
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
      title="Project dashboards"
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
        {dashboards.error && dashboards.data && <Button variant="secondary" onClick={() => void dashboards.refetch()}>Retry loading dashboards</Button>}
        {dashboards.isFetching && dashboards.data && <LoadingState variant="inline" label="Updating dashboards…" />}
        {dashboards.error && !dashboards.data ? (
          <Panel className="p-5">
            <Button variant="secondary" onClick={() => dashboards.refetch()}>
              Retry loading dashboards
            </Button>
          </Panel>
        ) : dashboards.isLoading ? (
          <LoadingSkeleton layout="dashboard" label="Preparing dashboard…" />
        ) : !dashboard ? (
          <Panel className="grid justify-items-center p-12 text-center">
            <LayoutDashboard size={32} className="text-[#7ea9b1]" />
            <h2 className="mb-1 mt-5 text-lg">Your results, together</h2>
            <p className="max-w-md text-sm leading-6 text-[var(--fs-muted)]">
              Create a dashboard for {project?.name}. Add indicator progress,
              saved survey charts and explanatory notes.
            </p>
            <Button onClick={() => edit("new")}>Create first dashboard</Button>
            <Link to="/projects" className="mt-5 text-xs text-[#0e7180]">
              Manage projects →
            </Link>
          </Panel>
        ) : (
          <>
            <Panel>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebed] p-4">
                <div className="min-w-0 basis-[230px] flex-1">
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
                    <p className="mb-0 mt-0.5 text-xs text-[var(--fs-muted)]">
                      {dashboard.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 print:hidden">
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
                    title="Expand dashboard"
                    onClick={() => setPresentedDashboard(dashboard.id)}
                  >
                    <Maximize2 size={14} />
                  </Tool>
                  <Tool
                    title="Delete dashboard"
                    destructive
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
              <div className="flex flex-wrap items-center gap-3 px-5 py-4 print:hidden">
                <details ref={filtersRef} className="group relative">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--fs-control-border)] bg-white px-3 text-xs font-medium text-[#3f7a86] hover:bg-[#f7fafb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-primary)] [&::-webkit-details-marker]:hidden">
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    Filters
                    <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="absolute left-0 top-full z-30 mt-2 flex w-[min(340px,calc(100vw-3rem))] flex-wrap items-end gap-3 rounded-lg border border-[var(--fs-border)] bg-white p-4 shadow-lg [&>label]:w-full">
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
                  className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand hover:bg-blue-50"
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
                  </div>
                </details>
                <Tool
                  title="Refresh dashboard data"
                  onClick={() =>
                    cache.invalidateQueries({ queryKey: ["dashboard-widget"] })
                  }
                >
                  <RefreshCw size={14} />
                </Tool>
                <span className="ml-auto text-[12px] text-[var(--fs-muted)]">
                  Saved within {project?.name}
                </span>
              </div>
            </Panel>
            {save.isPending && (
              <p role="status" className="text-xs text-[var(--fs-muted)]">
                Saving dashboard…
              </p>
            )}
            {syncStatus.error && (
              <p role="status" className="text-xs text-[var(--fs-muted)]">
                Automatic refresh status is unavailable. Use Refresh dashboard
                data to load current results.
              </p>
            )}
            {invalid ? (
              <Notice error>Start date must be on or before end date.</Notice>
            ) : filterDashboard !== dashboard.id ? (
              <LoadingState variant="panel" label="Preparing selected dashboard…" />
            ) : (
              <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
                {dashboard.widgets.map((widget, index) => (
                  <div
                    key={widget.id}
                    data-widget-id={widget.id}
                    className={`max-lg:!h-auto print:!h-auto min-w-0 ${dragging === widget.id ? "opacity-60" : ""} ${dropTarget === widget.id && dragging !== widget.id ? "rounded-lg ring-2 ring-[#168596]" : ""}`}
                    style={{
                      height: widget.height ?? 360,
                    }}
                  >
                    <Panel className="flex h-full flex-col overflow-hidden print:overflow-visible">
                      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#edf0f2] px-5 py-4">
                        <button
                          type="button"
                          aria-label={`Drag ${widget.title}`}
                          disabled={save.isPending}
                          className="grid size-11 shrink-0 place-items-center touch-none cursor-grab border-0 print:hidden bg-transparent p-1 text-[#78939c] active:cursor-grabbing"
                          onPointerDown={(event) => startPointer(event, widget)}
                        >
                          <GripVertical size={16} />
                        </button>
                        <h2 className="m-0 flex-1 text-sm font-medium">
                          {widget.title}
                        </h2>
                        <div className="flex max-w-full flex-wrap gap-1 print:hidden">
                          <Tool
                            title={`Expand ${widget.title}`}
                            onClick={() => setExpandedWidget(widget.id)}
                          >
                            <Maximize2 size={16} />
                          </Tool>
                          <Tool
                            title={`Move ${widget.title} up`}
                            disabled={index === 0 || save.isPending}
                            onClick={() => reorder(index, -1)}
                          >
                            <ArrowUp size={16} />
                          </Tool>
                          <Tool
                            title={`Move ${widget.title} down`}
                            disabled={
                              index === dashboard.widgets.length - 1 ||
                              save.isPending
                            }
                            onClick={() => reorder(index, 1)}
                          >
                            <ArrowDown size={16} />
                          </Tool>
                          <Tool
                            title={`Edit ${widget.title}`}
                            disabled={save.isPending}
                            onClick={() => openWidget(widget)}
                          >
                            <Pencil size={16} />
                          </Tool>
                          <Tool
                            title={`Remove ${widget.title}`}
                            destructive
                            disabled={save.isPending}
                            onClick={() =>
                              persist(
                                dashboard.widgets.filter(
                                  (w) => w.id !== widget.id,
                                ),
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </Tool>
                        </div>
                      </header>
                      <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
                        <Widget
                          widget={widget}
                          project={projectId}
                          dashboardId={dashboard.id}
                          version={dashboard.version}
                          revision={syncStatus.data?.last_successful_sync}
                          from={from}
                          through={through}
                        />
                      </div>
                      <div className="mt-auto flex items-center justify-end gap-2 px-3 pb-2 print:hidden">
                        <label className="text-[11px] text-[var(--fs-muted)]">
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
                <p className="text-sm text-[var(--fs-muted)]">
                  Choose an indicator, a saved analysis, or a text note.
                </p>
              </Panel>
            )}
          </>
        )}
      </WorkspaceGate>
      {dashboard && presentedDashboard === dashboard.id && (
        <Dialog
          title={dashboard.title}
          description={dashboard.description || undefined}
          presentation
          onClose={() => setPresentedDashboard(null)}
        >
          {from || through ? (
            <p className="mb-4 text-sm text-[var(--fs-muted)]">
              Results: {from || "All dates"} – {through || "Present"}
            </p>
          ) : null}
          <div className="mx-auto grid w-full max-w-[1800px] grid-cols-2 items-stretch gap-6 max-lg:grid-cols-1">
            {dashboard.widgets.map((widget) => (
              <Panel
                key={widget.id}
                className="flex min-w-0 flex-col overflow-hidden"
              >
                <h2 className="m-0 flex min-h-16 items-center border-b border-[#edf0f2] px-6 py-4 text-base font-medium">
                  {widget.title}
                </h2>
                <Widget
                  widget={widget}
                  presentation
                  compactPresentation={dashboard.widgets.length > 2}
                  project={projectId}
                  dashboardId={dashboard.id}
                  version={dashboard.version}
                  revision={syncStatus.data?.last_successful_sync}
                  from={from}
                  through={through}
                />
              </Panel>
            ))}
          </div>
          {!dashboard.widgets.length && (
            <p className="text-sm text-[var(--fs-muted)]">Add widgets to present this dashboard.</p>
          )}
        </Dialog>
      )}
      {expanded && dashboard && (
        <Dialog
          title={expanded.title}
          presentation
          onClose={() => setExpandedWidget(null)}
        >
          <Widget
            widget={expanded}
            presentation
            project={projectId}
            dashboardId={dashboard.id}
            version={dashboard.version}
            revision={syncStatus.data?.last_successful_sync}
            from={from}
            through={through}
          />
        </Dialog>
      )}
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
                <p className="text-xs text-[var(--fs-muted)]">
                  Loading widget sources…
                </p>
              )}
            {kind !== "text" &&
              !(kind === "indicator"
                ? indicators.isLoading
                : analyses.isLoading) &&
              !(kind === "indicator" ? indicators.data : analyses.data)
                ?.length && (
                <p className="text-xs text-[var(--fs-muted)]">
                  No{" "}
                  {kind === "indicator" ? "indicators" : "saved visualizations"}{" "}
                  are available in this project. Create a source before adding
                  this widget.
                </p>
              )}
            {kind === "analysis" && (
              <p className="text-xs text-[var(--fs-muted)]">
                Save a visualization in{" "}
                <Link to="/analytics" className="text-[#0e7180]">
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
  destructive = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-11 place-items-center rounded-lg border border-[var(--fs-control-border)] bg-white hover:bg-[#f1f7f8] disabled:opacity-30 ${destructive ? "text-red-600 hover:text-red-700" : "text-[#78939c]"}`}
    >
      {children}
    </button>
  );
}
function Widget({
  presentation = false,
  compactPresentation = false,
  widget,
  project,
  from,
  through,
  dashboardId,
  version,
  revision,
}: {
  presentation?: boolean;
  compactPresentation?: boolean;
  dashboardId: string;
  version?: number;
  revision?: string | null;
  widget: DashboardWidget;
  project: string;
  from: string;
  through: string;
}) {
  const { project: currentProject } = useWorkspace();
  const response = useQuery({
    queryKey: [
      "dashboard-widget",
      project,
      dashboardId,
      widget.id,
      version,
      from,
      through,
    ],
    queryFn: () =>
      apiClient.dashboardWidgetResult(dashboardId, widget.id, from, through),
    enabled: widget.kind !== "text",
    retry: false,
  });
  const previousRevision = useRef(revision);
  const { refetch } = response;
  useEffect(() => {
    if (previousRevision.current === revision) return;
    previousRevision.current = revision;
    if (revision && widget.kind !== "text") void refetch();
  }, [revision, widget.kind, refetch]);
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
      <p className="m-0 whitespace-pre-wrap p-5 text-sm leading-7 text-[var(--fs-muted)]">
        {widget.text || "No text provided."}
      </p>
    );
  if (error && !response.data)
    return (
      <div className="p-5">
        <Notice error>{error.message}</Notice>
        <Button variant="secondary" onClick={() => response.refetch()}>
          Retry widget
        </Button>
      </div>
    );
  if (response.isLoading) return <LoadingSkeleton layout="chart" label={`Loading ${widget.title}…`} />;
  const feedback = <>
    {response.isFetching && <LoadingState variant="inline" label="Updating widget…" />}
    {error && <Notice error>Unable to update this widget. Showing its last loaded result. <button className="min-h-11 px-2 font-semibold underline" onClick={() => void response.refetch()}>Retry widget</button></Notice>}
  </>;
  if (widget.kind === "indicator") {
    const item =
      response.data?.kind === "indicator" ? response.data.indicator : undefined;
    if (!item)
      return (
        <p className="p-5 text-sm text-[var(--fs-muted)]">
          The source indicator is no longer available.
        </p>
      );
    return (
      <div className="p-5" aria-busy={response.isFetching}>
        {feedback}
        <p className="mb-2 text-xs text-[var(--fs-muted)]">{currentProject?.name ?? project} · {from || "All dates"} – {through || "Present"} (UTC)</p>
        {item.result_source === "unconfigured" ||
        !["healthy", "unmapped"].includes(item.mapping_health) ? (
          <p className="text-xs text-amber-700">
            Source unavailable or not configured:{" "}
            {item.mapping_health.replaceAll("_", " ")}. Check the indicator
            mapping.
          </p>
        ) : null}
        <MetricCard label={item.name} icon={Target} value={
          item.unit === "text"
            ? (item.qualitative_value ?? "Not reported")
            : value(item.current_value) + (item.current_value != null && item.unit === "percentage" ? "%" : "")
        } />
        {item.unit !== "text" && (
          <>
            <p className="text-xs text-[var(--fs-muted)]">
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
        <p className="mt-4 text-[12px] text-[var(--fs-muted)]">
          {item.result_source === "manual"
            ? `${item.manual_result_count} manual results`
            : `${item.eligible_records} ready records`}{" "}
          ·{" "}
          {item.target_achieved
            ? "Target achieved"
            : item.status.replaceAll("_", " ")}
        </p>
        <Link
          className="text-xs text-[#0e7180]"
          to={`/projects/${project}/indicators?view=results`}
        >
          Open indicator results →
        </Link>
        <p className="text-xs text-[#637580]">Missing: {item.missing_records}; invalid answers: {item.invalid_answers}; excluded by review: {item.quality_excluded_records}. {item.calculation_note}</p>
      </div>
    );
  }
  if (!saved)
    return (
      <p className="p-5 text-sm text-[var(--fs-muted)]">
        The saved visualization is no longer available.
      </p>
    );
  if (!result.data)
    return (
      <p className="p-5 text-sm text-[var(--fs-muted)]">
        Visualization data is unavailable.
      </p>
    );
  if (!result.data.series.length)
    return (
      <p className="p-5 text-sm text-[var(--fs-muted)]">
        No answered records match this chart's source and filters.
      </p>
    );
  const data = result.data.series.map((p) => ({
    ...p,
    name: p.group ? `${p.name} · ${p.group}` : p.name,
  }));
  return (
    <div aria-busy={response.isFetching} className={presentation ? "flex min-w-0 flex-1 flex-col p-6 max-sm:p-3" : "p-5"}>
      {feedback}
      <p className="mb-3 mt-0 text-xs text-[var(--fs-muted)]">{currentProject?.name ?? project} · {result.data.filters?.date_from || "All dates"} – {result.data.filters?.date_to || "Present"} (UTC) · Ready records{result.data.filters?.location ? ` · ${result.data.filters.location}` : ""}</p>
      <div style={{ height: presentation ? compactPresentation ? "clamp(250px, 36dvh, 380px)" : "clamp(280px, calc(100dvh - 400px), 540px)" : Math.max(160, (widget.height ?? 420) - 170) }}>
        {saved.chart === "table" ? (
          <div className={`overflow-auto ${presentation ? "h-full" : "max-h-[250px]"}`}>
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
                  innerRadius="40%"
                  outerRadius="70%"
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        ["#0b51b7", "#0e7180", "#7756a8", "#a86612", "#ba4055"][
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
              <LineChart data={data} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} minTickGap={32} tickMargin={8} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line dataKey="value" stroke="#0e7180" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} minTickGap={32} tickMargin={8} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0e7180" maxBarSize={presentation ? 80 : undefined} radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      {saved.chart !== "table" && (
        <details className="my-3 border-t border-slate-200 pt-2 text-sm text-slate-600">
          <summary className="cursor-pointer py-2 font-medium text-brand">View chart data</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Data for {widget.title}</caption>
              <thead><tr><th scope="col" className="py-2">Category</th><th scope="col" className="px-2 text-right">Value</th><th scope="col" className="px-2 text-right">Count</th></tr></thead>
              <tbody>{data.map((row, i) => <tr key={i} className="border-t border-slate-100"><th scope="row" className="py-2 font-medium">{row.name}</th><td className="px-2 text-right tabular-nums">{value(row.value)}</td><td className="px-2 text-right tabular-nums">{row.count.toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
      <p className="mb-2 text-[12px] text-[var(--fs-muted)]">
        {result.data.answered_records} answered / {result.data.eligible_records}{" "}
        eligible · {result.data.missing_records} missing ·{" "}
        {result.data.invalid_answers} invalid
      </p>
      <Link
        to={`/analytics?project_id=${project}`}
        className="text-xs text-[#0e7180]"
      >
        Explore source data →
      </Link>
    </div>
  );
}
