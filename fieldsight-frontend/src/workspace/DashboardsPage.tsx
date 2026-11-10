import { DescriptionEditor, descriptionMarkup } from "../components/ui/DescriptionEditor";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { confirmDeletion } from "../components/ui/DeleteConfirmation";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectLink as Link, useProjectSearchParams as useSearchParams } from "./projectRouting";
import {
  Copy,
  Download,
  LayoutDashboard,
  FileText,
  Settings,
  Palette,
  Users,
  MessageSquare,
  Maximize2,
  GripVertical,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { SurveyResultChart } from "../components/charts/SurveyResultChart";
import { Button, LoadingSkeleton, LoadingState, MetricCard } from "../components/ui";
import {
  apiClient,
  type DashboardWidget,
  type WorkspaceDashboard,
  type WorkspaceDashboardInput,
} from "../services/apiClient";
import { Dialog } from "../pages/organization/IndicatorForms";
import { useWorkspace } from "./WorkspaceContext";
import { projectUrlKey } from "./projectRouting";
import {
  Field,
  Notice,
  Page,
  Panel,
  WorkspaceGate,
  fieldClass,
} from "./WorkspaceUI";

const indicatorChartTypes = [
  ["overall_target", "Actuals vs Targets: Overall target"],
  ["periodic_targets", "Actuals vs Targets: Periodic targets"],
  ["by_date", "Time-based results: actuals by date collected"],
  ["by_period", "Time-based results: actuals by period"],
  ["achievement", "Time-based results: % achieved over time"],
  ["disaggregated", "Disaggregated results"],
  ["status", "Status of selected indicators"],
] as const;

const value = (n: number | null | undefined) =>
  n == null
    ? "Not reported"
    : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
export function DashboardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedVisualization = searchParams.get("add_visualization");
  const [titleEdited, setTitleEdited] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const { projectId, project, organizationId } =
    useWorkspace();
  const cache = useQueryClient();
  const [selected, setSelected] = useState("");
  const [dashboardTab, setDashboardTab] = useState("Dashboard");
  const [editor, setEditor] = useState<"new" | WorkspaceDashboard | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [presentedDashboard, setPresentedDashboard] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const pointerCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => pointerCleanup.current?.(), []);
  const [widgetEditor, setWidgetEditor] = useState(false);
  const [widgetCreation, setWidgetCreation] = useState(false);
  const [creationCategory, setCreationCategory] = useState<"indicator" | "analysis" | "">("");
  const [kind, setKind] = useState<DashboardWidget["kind"]>("indicator");
  const [source, setSource] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [text, setText] = useState("");
  const [widgetWidth, setWidgetWidth] = useState<1 | 2>(1);
  const [chartType, setChartType] = useState<NonNullable<DashboardWidget["chart_type"]> | "">("");
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("vertical");
  const [chartLayout, setChartLayout] = useState<"stacked" | "grouped">("grouped");
  const [valueMode, setValueMode] = useState<"absolute" | "percentage">("absolute");
  const [hideTargets, setHideTargets] = useState(false);
  const [showIndicatorKey, setShowIndicatorKey] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [filterDates, setFilterDates] = useState(false);
  const [widgetFrom, setWidgetFrom] = useState("");
  const [widgetTo, setWidgetTo] = useState("");
  const [widgetHeight, setWidgetHeight] = useState(480);
  const [widgetDescription, setWidgetDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [imageOnly, setImageOnly] = useState(false);
  const widgetFormRef = useRef<HTMLElement>(null);
  useEffect(() => { if (widgetEditor) widgetFormRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [widgetEditor]);
  const [filterDashboard, setFilterDashboard] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const dashboards = useQuery({
    queryKey: ["dashboards", organizationId],
    queryFn: apiClient.dashboards,
  });
  const available =
    dashboards.data?.filter((d) => d.project_id === projectId) ?? [];
  const linkedDashboard = searchParams.get("dashboard");
  const dashboard = available.find((d) => d.id === (selected || linkedDashboard)) ?? (linkedDashboard && !selected ? undefined : available[0]);
  const download = useMutation({
    mutationFn: () => apiClient.dashboardPdf(dashboard!.id, from, through),
    onSuccess: data => {
      const url = URL.createObjectURL(new Blob([data], {type: "application/pdf"}));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${dashboard?.title.replace(/[^a-zA-Z0-9_-]+/g, "-") || "dashboard"}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
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
    setWidgetCreation(false);
    setEditingWidget(null);
  }, [projectId]);
  useEffect(() => {
    setDashboardTab("Dashboard");
    setWidgetCreation(false);
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
    enabled: Boolean(projectId && ((widgetEditor && kind === "analysis") || requestedVisualization)),
  });
  useEffect(() => {
    if (!dashboard || !requestedVisualization || !analyses.data) return;
    const visualization = analyses.data.find(item => item.id === requestedVisualization);
    if (!visualization) return;
    setWidgetEditor(true);
    setEditingWidget(null);
    setKind("analysis");
    setSource(visualization.id);
    setWidgetTitle(visualization.title);
    setTitleEdited(false);
    const next = new URLSearchParams(searchParams);
    next.delete("add_visualization");
    setSearchParams(next, {replace: true});
  }, [dashboard?.id, requestedVisualization, analyses.data, searchParams, setSearchParams]);
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
  function openWidget(widget?: DashboardWidget) {
    setTitleEdited(Boolean(widget));
    setWidgetEditor(Boolean(widget));
    setWidgetCreation(!widget);
    setCreationCategory("");
    setEditingWidget(widget?.id ?? null);
    setKind(widget?.kind ?? "indicator");
    setSource(widget?.source_id ?? "");
    setWidgetTitle(widget?.title ?? "");
    setText(widget?.text ?? "");
    setWidgetWidth(widget?.width ?? 1);
    setChartType(widget ? widget.chart_type ?? "overall_target" : "");
    setOrientation(widget?.orientation ?? "vertical");
    setChartLayout(widget?.chart_layout ?? "grouped");
    setValueMode(widget?.value_mode ?? "absolute");
    setHideTargets(widget?.hide_targets ?? false);
    setShowIndicatorKey(widget?.show_indicator_key ?? false);
    setShowProject(widget?.show_project ?? false);
    setFilterDates(widget?.filter_dates ?? false);
    setWidgetFrom(widget?.date_from ?? "");
    setWidgetTo(widget?.date_to ?? "");
    setWidgetHeight(widget?.height ?? 480);
    setWidgetDescription(widget?.description ?? "");
    setShowDescription(widget?.show_description ?? false);
    setImageOnly(widget?.image_only ?? false);
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
      className="mx-auto w-full max-w-[1680px] !space-y-5 [&>a:first-child]:min-h-8 [&>header]:!flex-row [&>header]:flex-wrap [&>header]:items-center [&>header>div:first-child]:min-w-[220px] [&>header>div:last-child]:shrink-0 [&>header>div:last-child]:ml-auto max-sm:!space-y-4"
      backTo={projectId ? `/projects/${projectUrlKey(project ?? { id: projectId })}/details` : "/projects"}
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
        {shareNotice && <p role="status" className="text-sm text-[var(--fs-primary)]">{shareNotice}</p>}
        {[dashboards.error, create.error, save.error, remove.error, download.error]
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
          <LoadingSkeleton layout="chart" label="Preparing dashboard…" />
        ) : !dashboard ? (
          <Panel className="grid justify-items-center p-12 text-center">
            <LayoutDashboard size={32} className="text-[var(--fs-primary)]" />
            <h2 className="mb-1 mt-5 text-lg">{linkedDashboard ? "Dashboard unavailable" : "Your results, together"}</h2>
            <p className="max-w-md text-sm leading-6 text-[var(--fs-muted)]">
              Create a dashboard for {project?.name}. Add indicator progress,
              saved survey charts and explanatory notes.
            </p>
            {requestedVisualization && <p className="text-sm text-[var(--fs-primary)]">Your visualization is saved. Create a dashboard to add it.</p>}
            <Button onClick={() => edit("new")}>Create first dashboard</Button>
            <Link to="/projects" className="mt-5 text-xs text-[var(--fs-primary)]">
              Manage projects →
            </Link>
          </Panel>
        ) : (
          <>
            <Panel className="overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fs-border)] px-5 py-4 max-sm:px-3 max-sm:py-3">
                <div className="min-w-0 basis-[230px] flex-1 max-sm:basis-full">
                  <label className="sr-only" htmlFor="dashboard-picker">
                    Dashboard
                  </label>
                  <select
                    id="dashboard-picker"
                    className="min-h-10 w-full max-w-md cursor-pointer rounded-lg border border-[var(--fs-control-border)] bg-[var(--fs-surface)] px-3 py-2 text-sm font-semibold text-[var(--fs-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-primary)]"
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
                </div>
                <div className="flex flex-wrap items-center gap-1.5 print:hidden max-sm:w-full">
                  <Button
                    disabled={save.isPending}
                    onClick={() => openWidget()}
                    className="!min-h-10 !rounded-lg !px-4 !py-2 !text-sm max-sm:w-full"
                  >
                    <Plus size={14} />
                    Add new widget
                  </Button>
                </div>
              </header>
              <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-[var(--fs-border)] px-5 print:hidden max-sm:px-3">
              <nav aria-label="Dashboard sections" className="flex min-w-0 max-w-full overflow-x-auto max-xl:w-full">
                {([
                  ["Dashboard", LayoutDashboard], ["Details", FileText],
                  ["Settings", Settings], ["Styles", Palette],
                  ["Team", Users], ["Discussions", MessageSquare],
                ] as const).map(([label, Icon]) => (
                  <button key={label} type="button" aria-current={dashboardTab === label ? "page" : undefined}
                    onClick={() => setDashboardTab(label)}
                    className={`flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-medium ${dashboardTab === label ? "border-[var(--fs-primary)] text-[var(--fs-primary)]" : "border-transparent text-[var(--fs-muted)] hover:text-[var(--fs-primary)]"}`}>
                    <Icon size={14} aria-hidden="true" />{label}
                  </button>
                ))}
              </nav>
              <div aria-label="Dashboard actions" className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5 py-1.5 max-xl:w-full max-xl:justify-end max-xl:border-t max-xl:border-[var(--fs-border)]">
                  <Tool
                    title="Expand dashboard"
                    compact
                    onClick={() => setPresentedDashboard(dashboard.id)}
                  >
                    <Maximize2 size={14} />
                  </Tool>
                  <Tool
                    title="Rename dashboard"
                    compact
                    onClick={() => edit(dashboard)}
                  >
                    <Pencil size={14} />
                  </Tool>
                  <Tool
                    title="Copy dashboard link"
                    compact
                    onClick={async () => {
                      const url = new URL(`/projects/${projectUrlKey(project ?? { id: projectId })}/dashboards`, window.location.origin);
                      url.searchParams.set("dashboard", dashboard.id);
                      try {await navigator.clipboard.writeText(url.toString()); setShareNotice("Dashboard link copied. Project access is required to open it.");}
                      catch {setShareNotice(`Copy this dashboard link: ${url.toString()}`);}
                    }}
                  >
                    <Copy size={14} />
                  </Tool>
                  <Tool title="Download PDF" compact disabled={download.isPending || invalid || save.isPending} onClick={() => download.mutate()}>
                    <Download size={14} />
                  </Tool>
                  {download.isPending && <span role="status" className="text-xs">Preparing PDF…</span>}
                  <Tool
                    title="Delete dashboard"
                    compact
                    destructive
                    onClick={() => void confirmDeletion({ title: "Delete dashboard", name: dashboard.title, description: "Delete this saved dashboard and its widgets. The source data will remain.", phrase: "delete dashboard", actionLabel: "Delete dashboard", onConfirm: () => remove.mutateAsync(dashboard.id) })}
                    disabled={remove.isPending}
                  >
                    <Trash2 size={14} />
                  </Tool>
              </div>
              </div>
            </Panel>
            {dashboardTab === "Details" && <Panel className="space-y-4 p-5">
              <h2 className="text-base font-semibold">Dashboard details</h2>
              <dl className="grid gap-3 text-sm">
                <div><dt className="text-[var(--fs-muted)]">Name</dt><dd className="m-0">{dashboard.title}</dd></div>
                <div><dt className="text-[var(--fs-muted)]">Description</dt><dd className="m-0 whitespace-pre-wrap">{dashboard.description || "No description added."}</dd></div>
                <div><dt className="text-[var(--fs-muted)]">Project</dt><dd className="m-0">{project?.name}</dd></div>
                <div><dt className="text-[var(--fs-muted)]">Widgets</dt><dd className="m-0">{dashboard.widgets.length}</dd></div>
              </dl>
              <Button variant="secondary" onClick={() => edit(dashboard)}>Edit details</Button>
            </Panel>}
            {dashboardTab === "Settings" && <Panel className="space-y-3 p-5"><h2 className="text-base font-semibold">Dashboard settings</h2><p className="text-sm text-[var(--fs-muted)]">Update this dashboard's name and description. Set a reporting period in each widget’s Data source section.</p><Button variant="secondary" onClick={() => edit(dashboard)}>Edit dashboard</Button></Panel>}
            {dashboardTab === "Styles" && <Panel className="space-y-3 p-5"><h2 className="text-base font-semibold">Dashboard styles</h2><p className="text-sm text-[var(--fs-muted)]">Use each widget's height control and drag handle on the Dashboard tab to adjust its size and position.</p><Button variant="secondary" onClick={() => setDashboardTab("Dashboard")}>Arrange widgets</Button></Panel>}
            {dashboardTab === "Team" && <Panel className="space-y-3 p-5"><h2 className="text-base font-semibold">Dashboard team</h2><p className="text-sm text-[var(--fs-muted)]">This dashboard is shared within {project?.name}. Manage the team through the project.</p><Link className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--fs-primary)]" to={`/projects/${projectUrlKey(project ?? { id: projectId })}/team`}>Open project team</Link></Panel>}
            {dashboardTab === "Discussions" && <Panel className="p-5"><h2 className="text-base font-semibold">Discussions</h2><p className="text-sm text-[var(--fs-muted)]">Dashboard discussions are not available yet.</p></Panel>}
            <div hidden={dashboardTab !== "Dashboard" || widgetCreation || widgetEditor} className="space-y-5">
            {save.isPending && (
              <p role="status" className="text-xs text-[var(--fs-muted)]">
                Saving dashboard…
              </p>
            )}
            {syncStatus.error && (
              <p role="status" className="text-xs text-[var(--fs-muted)]">
                Automatic refresh status is unavailable. Reload the page to load current results.
              </p>
            )}
            {invalid ? (
              <Notice error>Start date must be on or before end date.</Notice>
            ) : filterDashboard !== dashboard.id ? (
              <LoadingState variant="panel" label="Preparing selected dashboard…" />
            ) : (
              <div className="grid grid-cols-2 items-start gap-6 max-lg:grid-cols-1 max-sm:gap-4">
                {dashboard.widgets.map((widget) => (
                  <div
                    key={widget.id}
                    data-widget-id={widget.id}
                    className={`max-lg:!h-[420px] print:!h-auto min-w-0 ${widget.width === 2 ? "col-span-2 max-lg:col-span-1" : ""} ${dragging === widget.id ? "opacity-60" : ""} ${dropTarget === widget.id && dragging !== widget.id ? "rounded-lg ring-2 ring-[var(--fs-primary)]" : ""}`}
                    style={{
                      height: widget.height ?? 480,
                    }}
                  >
                    <Panel className="flex h-full flex-col overflow-hidden print:overflow-visible">
                      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-[var(--fs-border)] px-4 py-3 max-sm:flex-wrap">
                        <button
                          type="button"
                          aria-label={`Drag ${widget.title}`}
                          disabled={save.isPending}
                          className="grid size-8 shrink-0 place-items-center touch-none cursor-grab border-0 print:hidden bg-transparent p-1 text-[var(--fs-muted)] active:cursor-grabbing"
                          onPointerDown={(event) => startPointer(event, widget)}
                        >
                          <GripVertical size={16} />
                        </button>
                        <h2 className="m-0 min-w-0 flex-1 break-words text-sm font-medium leading-5">
                          {widget.title}
                        </h2>
                        <div className="ml-auto flex shrink-0 items-center gap-1 print:hidden">
                          <Tool
                            title={`Edit ${widget.title}`}
                            compact
                            disabled={save.isPending}
                            onClick={() => openWidget(widget)}
                          >
                            <Pencil size={16} />
                          </Tool>
                          <Tool
                            title={`Remove ${widget.title}`}
                            compact
                            destructive
                            disabled={save.isPending}
                            onClick={() => void confirmDeletion({ title: "Remove dashboard widget", name: widget.title, description: "Remove this widget from the saved dashboard. Source data will remain.", phrase: "remove widget", actionLabel: "Remove widget", warning: "This removes the saved widget. You can add a new widget later.", onConfirm: () => save.mutateAsync({ id: dashboard.id, input: { ...dashboard, widgets: dashboard.widgets.filter(w => w.id !== widget.id) } }) })}
                          >
                            <Trash2 size={16} />
                          </Tool>
                        </div>
                      </header>
                      {widget.show_project && <p className="m-0 px-5 pt-3 text-xs text-[var(--fs-muted)]">{project?.name}</p>}
                      {widget.show_description && widget.description && <p className="m-0 whitespace-pre-wrap px-5 pt-3 text-xs text-[var(--fs-muted)]">{widget.description}</p>}
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
                      <div className="mt-auto flex items-center justify-end gap-2 border-t border-[var(--fs-border)] bg-slate-50/60 px-4 py-2 print:hidden">
                        <label className="flex items-center gap-2 text-xs text-[var(--fs-muted)]">
                          Height{" "}
                          <select
                            aria-label={`Height of ${widget.title}`}
                            className="min-h-8 rounded-md border border-[var(--fs-control-border)] bg-white px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-primary)]"
                            disabled={save.isPending}
                            value={widget.height ?? 480}
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
                                widget.height ?? 480,
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
              <Panel className="px-5 py-3">
                <p className="m-0 text-xs italic text-[var(--fs-muted)]">There are no dashboard widgets added yet.</p>
              </Panel>
            )}
            </div>
          </>
        )}
      </WorkspaceGate>
      {dashboard && presentedDashboard === dashboard.id && (
        <Dialog
          title={dashboard.title}
          description={dashboard.description || undefined}
          presentation
          headerActions={<Button variant="secondary" disabled={download.isPending || invalid} onClick={() => download.mutate()} className="!min-h-8 !px-3 !py-1 !text-xs"><Download size={14} />{download.isPending ? "Preparing PDF…" : "Download PDF"}</Button>}
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
                className={`flex min-w-0 flex-col overflow-hidden ${widget.width === 2 ? "col-span-2 max-lg:col-span-1" : ""}`}
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
      {editor && (
        <Dialog
          title={editor === "new" ? "Create dashboard" : "Edit dashboard"}
          compact
          onClose={() => setEditor(null)}
          error={create.error?.message ?? save.error?.message}
        >
          <form
            className="grid gap-3"
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
                rows={2}
                maxLength={1000}
                className={fieldClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              className="justify-self-end"
              disabled={!projectId || create.isPending || save.isPending}
            >
              Save dashboard
            </Button>
          </form>
        </Dialog>
      )}
      {widgetCreation && dashboard && (
        <Dialog title="Add new widget" compact onClose={() => setWidgetCreation(false)}>
          <form className="grid gap-4" onSubmit={event => {
            event.preventDefault();
            if (!creationCategory) return;
            setKind(creationCategory);
            setWidgetTitle(widgetTitle.trim() || (creationCategory === "indicator" ? "Project indicators" : "Project visualization"));
            setTitleEdited(true);
            setWidgetCreation(false);
            setWidgetEditor(true);
          }}>
            <Field label="Widget category"><select required className={fieldClass} value={creationCategory} onChange={event => setCreationCategory(event.target.value as "indicator" | "analysis" | "")}>
              <option value="">Choose a category</option>
              <option value="indicator">Project indicators</option>
              <option value="analysis">Project visualization</option>
            </select></Field>
            <Field label="Widget title"><input className={fieldClass} maxLength={200} placeholder="Title" value={widgetTitle} onChange={event => setWidgetTitle(event.target.value)} /></Field>
            <p className="m-0 text-xs leading-5 text-[var(--fs-muted)]">If left blank, the widget title will default to the category name.</p>
            <div className="flex justify-end gap-2 border-t border-[var(--fs-border)] pt-4">
              <Button type="button" variant="secondary" onClick={() => setWidgetCreation(false)}>Cancel</Button>
              <Button type="submit" disabled={!creationCategory}>Continue</Button>
            </div>
          </form>
        </Dialog>
      )}
      {widgetEditor && dashboard && (
        <section ref={widgetFormRef} aria-labelledby="widget-information-heading" className="scroll-mt-5 overflow-hidden rounded-lg border border-[var(--fs-border)] bg-white">
          <header className="border-b border-[var(--fs-border)] px-5 py-4"><h2 id="widget-information-heading" className="m-0 text-sm font-semibold">Widget information</h2></header>
          {(save.error || indicators.error || analyses.error) && <Notice error>{save.error?.message ?? indicators.error?.message ?? analyses.error?.message}</Notice>}
          <form
            className="grid gap-5 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const updated: DashboardWidget = {
                id: editingWidget ?? crypto.randomUUID(),
                title: widgetTitle.trim(),
                kind,
                source_id: kind === "text" ? null : source,
                text,
                description: widgetDescription,
                show_description: showDescription,
                image_only: imageOnly,
                chart_type: kind === "indicator" && chartType ? chartType : undefined,
                orientation,
                chart_layout: chartLayout,
                value_mode: valueMode,
                hide_targets: hideTargets,
                show_indicator_key: showIndicatorKey,
                show_project: showProject,
                filter_dates: filterDates,
                date_from: widgetFrom || null,
                date_to: widgetTo || null,
                width: widgetWidth,
                height: widgetHeight,
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
            <div className="grid grid-cols-[minmax(180px,1fr)_3fr] gap-5 max-sm:grid-cols-1">
            <Field label="Widget type">
              <select
                className={fieldClass}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as DashboardWidget["kind"]);
                  setSource("");
                }}
              >
                <option value="indicator">Project indicators</option>
                <option value="analysis">Project visualization</option>
                {kind === "text" && <option value="text">Text & image</option>}
              </select>
            </Field>
            <Field label="Widget title">
              <input
                required
                maxLength={200}
                className={fieldClass}
                value={widgetTitle}
                onChange={(e) => {setWidgetTitle(e.target.value); setTitleEdited(true);}}
              />
            </Field>
            </div>
            <Field label="Description"><textarea className={fieldClass} rows={4} maxLength={1000} value={widgetDescription} onChange={event => setWidgetDescription(event.target.value)} placeholder="Enter text" /></Field>
            {kind === "indicator" && <section className="grid gap-4 rounded-lg border border-[var(--fs-border)] p-5">
              <h3 className="m-0 border-b border-[var(--fs-border)] pb-4 text-lg font-semibold">Charts & orientation</h3>
              <Field label="Widget Type"><select required className={fieldClass} value={chartType} onChange={event => setChartType(event.target.value as typeof chartType)}>
                <option value="">Select a widget type</option>
                {indicatorChartTypes.map(([key, label]) => <option key={key} value={key} disabled={key === "by_date" || key === "disaggregated"}>{label}</option>)}
              </select></Field>
              {["overall_target", "periodic_targets"].includes(chartType) && <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                {(["absolute", "percentage"] as const).map(mode => <fieldset key={mode} className="min-w-0 rounded-lg border border-[var(--fs-border)] p-4">
                  <legend className="px-1 text-xs font-semibold">{mode === "absolute" ? "Absolute value charts" : "% achieved charts"}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(["stacked", "grouped"] as const).flatMap(layout => (["horizontal", "vertical"] as const).map(direction => {
                      const selected = valueMode === mode && chartLayout === layout && orientation === direction;
                      const label = `${layout === "stacked" ? "Stacked" : "Grouped"} ${direction}`;
                      return <label key={`${layout}-${direction}`} className={`cursor-pointer rounded-md border p-2 ${selected ? "border-[var(--fs-primary)] bg-[var(--fs-primary-soft)]" : "border-transparent hover:bg-slate-50"}`}>
                        <ChartChoicePreview layout={layout} orientation={direction} />
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-[var(--fs-muted)]"><input type="radio" name="indicator-chart-choice" aria-label={`${mode === "absolute" ? "Absolute values" : "Percentage achieved"}: ${label}`} checked={selected} onChange={() => { setValueMode(mode); setChartLayout(layout); setOrientation(direction); }} />{label}</span>
                      </label>;
                    }))}
                  </div>
                </fieldset>)}
              </div>}
              {["by_period", "achievement"].includes(chartType) && <p className="m-0 text-sm text-[var(--fs-muted)]">Line chart · reporting periods on the horizontal axis</p>}
              {chartType === "status" && <p className="m-0 text-sm text-[var(--fs-muted)]">Status summary for the selected indicator</p>}
            </section>}
            {kind === "indicator" && <section className="grid gap-4 rounded-lg border border-[var(--fs-border)] p-5">
              <h3 className="m-0 border-b border-[var(--fs-border)] pb-4 text-lg font-semibold">Data source</h3>
              <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
                <div className="grid content-start gap-3">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideTargets} onChange={event => setHideTargets(event.target.checked)} />Don't show target values</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showIndicatorKey} onChange={event => setShowIndicatorKey(event.target.checked)} />Show indicators key</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filterDates} onChange={event => setFilterDates(event.target.checked)} />Filter data by date range</label>
                  {filterDates && <div className="grid grid-cols-2 gap-3"><Field label="From date"><input type="date" className={fieldClass} value={widgetFrom} max={widgetTo || undefined} onChange={event => setWidgetFrom(event.target.value)} /></Field><Field label="Through date"><input type="date" className={fieldClass} value={widgetTo} min={widgetFrom || undefined} onChange={event => setWidgetTo(event.target.value)} /></Field></div>}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showProject} onChange={event => setShowProject(event.target.checked)} />Show Project under title</label>
                </div>
                <div><Field label="Select indicators to add to the widget"><select required className={fieldClass} value={source} onChange={event => setSource(event.target.value)} disabled={indicators.isLoading || indicators.isError}>
                  <option value="">Select an indicator</option>
                  {source && !indicators.data?.some(item => item.id === source) && <option value={source}>Existing indicator (unavailable)</option>}
                  {(indicators.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                {indicators.isLoading && <LoadingState variant="inline" label="Loading indicators…" />}
                {indicators.isError && <p role="alert" className="text-sm text-red-700">Could not load indicators. <button type="button" className="underline" onClick={() => void indicators.refetch()}>Retry</button></p>}
                {!indicators.isLoading && !indicators.isError && !indicators.data?.length && <p className="text-xs text-[var(--fs-muted)]">No indicators are available in this project.</p>}
                </div>
              </div>
            </section>}
            {kind !== "indicator" && <section className="grid gap-3 rounded-lg border border-[var(--fs-border)] p-5">
            <h3 className="m-0 text-lg font-semibold">{kind === "text" ? "Widget content" : "Data selection"}</h3>
            {kind === "text" ? (
              <div className="grid gap-3">
                <fieldset className="flex gap-5 border-0 p-0 text-xs"><legend className="mb-2 text-[var(--fs-muted)]">Content</legend><label className="flex items-center gap-2"><input type="radio" name="widget-content" checked={!imageOnly} onChange={() => setImageOnly(false)} />Text & image</label><label className="flex items-center gap-2"><input type="radio" name="widget-content" checked={imageOnly} onChange={() => setImageOnly(true)} />Image only</label></fieldset>
                <DescriptionEditor value={text} onChange={setText} disabled={save.isPending} label="Text" maxLength={4000} allowImages imageOnly={imageOnly} />
              </div>
            ) : (
              <Field
                label={
                  "Saved visualization"
                }
              >
                <select
                  required
                  className={fieldClass}
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    const item = analyses.data?.find(item => item.id === e.target.value);
                    if (!titleEdited && item) setWidgetTitle(item.title);
                  }}
                >
                  <option value="">Choose a source</option>
                  {editingWidget &&
                    source &&
                    !analyses.data?.some((item) => item.id === source) && (
                      <option value={source}>
                        Existing source (unavailable)
                      </option>
                    )}
                  {(analyses.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {kind === "analysis" && <Link className="text-xs font-medium text-[var(--fs-primary)]" to={`/projects/${projectUrlKey(project ?? { id: projectId })}/analytics`}>Open survey analysis to create or configure charts</Link>}
            </section>}
            {kind === "analysis" && analyses.isLoading && <LoadingState variant="panel" label="Loading widget sources…" />}
            {kind === "analysis" && !analyses.isError && !analyses.isLoading && !analyses.data?.length && <p className="text-xs text-[var(--fs-muted)]">No saved visualizations are available in this project. Create a source before adding this widget.</p>}
            {kind === "analysis" && analyses.isError && (
              <div role="alert" className="text-sm text-red-700">
                Could not load saved visualizations: {analyses.error.message}
                <button type="button" className="ml-2 font-semibold underline" onClick={() => void analyses.refetch()}>Retry</button>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-[var(--fs-border)] pt-3">
            <Button variant="secondary" type="button" onClick={() => setWidgetEditor(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={
                save.isPending ||
                !widgetTitle.trim() ||
                (kind === "indicator" && !chartType) ||
                (kind !== "text" && !source) ||
                (filterDates && Boolean(widgetFrom && widgetTo && widgetFrom > widgetTo))
              }
            >
              {save.isPending ? "Saving…" : editingWidget ? "Save widget" : "Add widget"}
            </Button>
            </div>
          </form>
        </section>
      )}
    </Page>
  );
}
function ChartChoicePreview({ layout, orientation }: { layout: "stacked" | "grouped"; orientation: "horizontal" | "vertical" }) {
  const stacked = layout === "stacked";
  return <svg viewBox="0 0 150 90" className="h-24 w-full" aria-hidden="true">
    {[68, 52, 44, 35].map((length, index) => {
      const position = 8 + index * 19;
      return <g key={index}>
        {orientation === "horizontal" ? <>
          <rect x={5} y={position} width={stacked ? length * 0.35 : length * 0.8} height={stacked ? 11 : 5} fill="#57bda9" />
          <rect x={stacked ? 5 + length * 0.35 : 5} y={stacked ? position : position + 6} width={stacked ? length * 0.65 : length} height={stacked ? 11 : 5} fill="#a9dcd1" />
        </> : <>
          <rect x={position + 20} y={80 - (stacked ? length * 0.35 : length * 0.8)} width={stacked ? 11 : 5} height={stacked ? length * 0.35 : length * 0.8} fill="#57bda9" />
          <rect x={stacked ? position + 20 : position + 26} y={80 - length} width={stacked ? 11 : 5} height={stacked ? length * 0.65 : length} fill="#a9dcd1" />
        </>}
      </g>;
    })}
  </svg>;
}

function Tool({
  title,
  onClick,
  children,
  disabled = false,
  destructive = false,
  compact = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid ${compact ? "size-8 rounded-md" : "size-11 rounded-lg"} place-items-center border border-[var(--fs-control-border)] bg-white hover:bg-[#f1f7f8] disabled:opacity-30 ${destructive ? "text-red-600 hover:text-red-700" : "text-[var(--fs-muted)]"}`}
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
  if (widget.filter_dates) {
    from = widget.date_from ?? "";
    through = widget.date_to ?? "";
  }
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
    return <div className="p-5 text-sm leading-7 [&_img]:max-w-full [&_img]:h-auto [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-blue-700 [&_a]:underline" dangerouslySetInnerHTML={{ __html: descriptionMarkup(widget.text || "No text provided.", true) }} />;
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
    const indicatorLabel = widget.show_indicator_key && item.code ? `${item.code} - ${item.name}` : item.name;
    if (widget.chart_type) {
      if (widget.chart_type === "status") return <div className="space-y-3 p-5">{feedback}<p className="m-0 text-sm font-medium">{item.name}</p><p className="m-0 text-lg capitalize">{item.status.replaceAll("_", " ")}</p><p className="m-0 text-sm text-[var(--fs-muted)]">{item.target_achieved == null ? "Target achievement not reported" : item.target_achieved ? "Target achieved" : "Target not achieved"}</p></div>;
      if (item.unit === "text") return <div className="p-5">{feedback}<p className="text-sm">This chart requires a numeric indicator. Choose a numeric indicator or use the status widget.</p></div>;
      const chartData = widget.chart_type === "overall_target"
        ? [{ name: indicatorLabel, actual: item.current_value, target: item.target_value }]
        : (item.history ?? []).map(point => ({ name: point.period, actual: point.value, target: point.target_value,
            achieved: point.value == null || point.target_value == null ? null
              : item.baseline_value != null && point.target_value !== item.baseline_value
                && ((item.direction === "decrease" && point.target_value < item.baseline_value) || (item.direction !== "decrease" && point.target_value > item.baseline_value))
                ? 100 * (point.value - item.baseline_value) / (point.target_value - item.baseline_value)
                : item.direction === "decrease" ? (point.value > 0 && point.target_value > 0 ? point.target_value / point.value * 100 : point.target_achieved ? 100 : null)
                : point.target_value > 0 && point.value >= 0 ? point.value / point.target_value * 100 : point.target_achieved ? 100 : null }));
      if (!chartData.length) return <div className="p-5">{feedback}<p className="text-sm text-[var(--fs-muted)]">No reporting-period results are available for this chart.</p></div>;
      const bars = widget.chart_type === "overall_target" || widget.chart_type === "periodic_targets";
      const horizontal = widget.orientation === "horizontal" && bars;
      const percentage = widget.value_mode === "percentage";
      const stacked = widget.chart_layout === "stacked";
      const barData = chartData.map(point => {
        const achieved = "achieved" in point ? point.achieved : item.progress_percent;
        const actual = percentage ? achieved : point.actual;
        const target = percentage ? (point.target != null ? 100 : null) : point.target;
        return { ...point, actual, target: stacked && target != null && actual != null ? Math.max(0, target - actual) : target };
      });
      return <div className="h-full min-h-[200px] p-5" aria-label={indicatorChartTypes.find(([key]) => key === widget.chart_type)?.[1]}>
        {feedback}
        <ResponsiveContainer width="100%" height="90%">
          {bars ? <BarChart data={barData} layout={horizontal ? "vertical" : "horizontal"}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type={horizontal ? "number" : "category"} dataKey={horizontal ? undefined : "name"} unit={horizontal && percentage ? "%" : undefined} />
            <YAxis type={horizontal ? "category" : "number"} dataKey={horizontal ? "name" : undefined} width={horizontal ? 120 : 55} unit={!horizontal && percentage ? "%" : undefined} />
            <Tooltip /><Legend /><Bar dataKey="actual" name={percentage ? "% achieved" : "Actual"} stackId={stacked ? "results" : undefined} fill="#57bda9" />{!widget.hide_targets && <Bar dataKey="target" name={stacked ? "Remaining to target" : percentage ? "Target (100%)" : "Target"} stackId={stacked ? "results" : undefined} fill="#a9dcd1" />}
          </BarChart> : <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis unit={widget.chart_type === "achievement" ? "%" : undefined} /><Tooltip /><Legend />
            <Line type="monotone" dataKey={widget.chart_type === "achievement" ? "achieved" : "actual"} name={widget.chart_type === "achievement" ? "% achieved" : "Actual"} stroke="var(--fs-primary)" />
          </LineChart>}
        </ResponsiveContainer>
      </div>;
    }
    return (
      <div className="p-5" aria-busy={response.isFetching}>
        {feedback}
        {item.result_source === "unconfigured" ||
        !["healthy", "unmapped"].includes(item.mapping_health) ? (
          <p className="text-xs text-amber-700">
            Source unavailable or not configured:{" "}
            {item.mapping_health.replaceAll("_", " ")}. Check the indicator
            mapping.
          </p>
        ) : null}
        <MetricCard label={indicatorLabel} icon={Target} value={
          item.unit === "text"
            ? (item.qualitative_value ?? "Not reported")
            : value(item.current_value) + (item.current_value != null && item.unit === "percentage" ? "%" : "")
        } />
        {item.unit !== "text" && !widget.hide_targets && (
          <>
            <p className="text-xs text-[var(--fs-muted)]">
              Overall target: {value(item.target_value)}
              {from || through ? " (unchanged by date filters)" : ""}
            </p>
            {item.progress_percent !== null && (
              <div className="h-2 overflow-hidden rounded bg-[#edf2f4]">
                <div
                  className="h-full bg-[var(--fs-primary)]"
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
          className="text-xs text-[var(--fs-primary)]"
          to={`/projects/${project}/indicators?view=results`}
        >
          Open indicator results →
        </Link>
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
  return (
    <div aria-busy={response.isFetching} className={presentation ? "flex min-w-0 flex-1 flex-col p-6 max-sm:p-3" : "flex h-full min-h-[240px] flex-col p-5 max-sm:p-3"}>
      {feedback}
      <div className={presentation ? "" : "min-h-[200px] flex-1"} style={{ height: presentation ? compactPresentation ? "clamp(250px, 36dvh, 380px)" : "clamp(280px, calc(100dvh - 400px), 540px)" : undefined }}>
        <SurveyResultChart result={result.data} chart={saved.chart} />
      </div>
    </div>
  );
}
