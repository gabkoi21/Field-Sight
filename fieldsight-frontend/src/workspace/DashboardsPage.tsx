import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Copy,
  LayoutDashboard,
  Maximize2,
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
  fieldClass,
} from "./WorkspaceUI";

const value = (n: number | null | undefined) =>
  n == null
    ? "Not reported"
    : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
export function DashboardsPage() {
  const { projectId, project } = useWorkspace();
  const cache = useQueryClient();
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState<"new" | WorkspaceDashboard | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [widgetEditor, setWidgetEditor] = useState(false);
  const [kind, setKind] = useState<DashboardWidget["kind"]>("indicator");
  const [source, setSource] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const dashboards = useQuery({
    queryKey: ["dashboards"],
    queryFn: apiClient.dashboards,
  });
  const available =
    dashboards.data?.filter((d) => d.project_id === projectId) ?? [];
  const dashboard = available.find((d) => d.id === selected) ?? available[0];
  const indicators = useQuery({
    queryKey: ["indicators", projectId, "", ""],
    queryFn: () => apiClient.indicators(projectId),
    enabled: Boolean(projectId),
  });
  const analyses = useQuery({
    queryKey: ["saved-analysis", projectId],
    queryFn: () => apiClient.savedAnalyses(projectId),
    enabled: Boolean(projectId),
  });
  async function refresh(data?: WorkspaceDashboard) {
    await cache.invalidateQueries({ queryKey: ["dashboards"] });
    if (data) setSelected(data.id);
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
    if (!dashboard) return;
    const widgets = [...dashboard.widgets];
    [widgets[index], widgets[index + direction]] = [
      widgets[index + direction],
      widgets[index],
    ];
    persist(widgets);
  }
  const invalid = Boolean(from && through && from > through);
  return (
    <Page
      title="Dashboards"
      description="Build a shared view of your workspace's results and evidence."
      actions={
        <Button onClick={() => edit("new")}>
          <Plus size={14} />
          Create dashboard
        </Button>
      }
    >
      <WorkspaceGate>
        {[dashboards.error, create.error, save.error, remove.error]
          .filter(Boolean)
          .map((e, i) => (
            <Notice error key={i}>
              {e?.message}
            </Notice>
          ))}
        {dashboards.isLoading ? (
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
                    onChange={(e) => setSelected(e.target.value)}
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
                    onClick={() => {
                      setWidgetEditor(true);
                      setKind("indicator");
                      setSource("");
                      setWidgetTitle("");
                      setText("");
                      save.reset();
                    }}
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
                <span className="mb-2 ml-auto text-[10px] text-[#87969d]">
                  Saved within {project?.name}
                </span>
              </div>
            </Panel>
            {invalid ? (
              <Notice error>Start date must be on or before end date.</Notice>
            ) : (
              <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
                {dashboard.widgets.map((widget, index) => (
                  <Panel
                    key={widget.id}
                    className={
                      widget.width === 2 ? "col-span-2 max-lg:col-span-1" : ""
                    }
                  >
                    <header className="flex items-center justify-between gap-2 border-b border-[#edf0f2] px-5 py-4">
                      <h2 className="m-0 text-sm font-medium">
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
                    <Widget
                      widget={widget}
                      project={projectId}
                      from={from}
                      through={through}
                    />
                  </Panel>
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
              workspace. Public sharing is not enabled.
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
          title="Add dashboard widget"
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
              persist([
                ...dashboard.widgets,
                {
                  id: crypto.randomUUID(),
                  title: widgetTitle,
                  kind,
                  source_id: kind === "text" ? null : source,
                  text,
                  width: 1,
                },
              ]);
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
            <Button type="submit" disabled={save.isPending}>
              Add widget
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
}: {
  widget: DashboardWidget;
  project: string;
  from: string;
  through: string;
}) {
  const indicators = useQuery({
    queryKey: ["indicators", project, from, through],
    queryFn: () => apiClient.indicators(project, from, through),
    enabled: widget.kind === "indicator",
  });
  const analyses = useQuery({
    queryKey: ["saved-analysis", project],
    queryFn: () => apiClient.savedAnalyses(project),
    enabled: widget.kind === "analysis",
  });
  const saved = analyses.data?.find((item) => item.id === widget.source_id);
  const result = useQuery({
    queryKey: ["dashboard-analysis", saved?.id, from, through, saved?.query],
    queryFn: () =>
      apiClient.queryAnalysis({
        ...saved!.query,
        filters: {
          ...saved!.query.filters,
          date_from: from || saved!.query.filters.date_from,
          date_to: through || saved!.query.filters.date_to,
        },
      }),
    enabled: widget.kind === "analysis" && Boolean(saved),
  });
  const error = indicators.error ?? analyses.error ?? result.error;
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
      </div>
    );
  if (indicators.isLoading || analyses.isLoading || result.isLoading)
    return <LoadingState />;
  if (widget.kind === "indicator") {
    const item = indicators.data?.find((i) => i.id === widget.source_id);
    if (!item)
      return (
        <p className="p-5 text-sm text-[#87969d]">
          The source indicator is no longer available.
        </p>
      );
    return (
      <div className="p-5">
        <p className="mb-1 text-xs text-[#87969d]">{item.name}</p>
        <strong className="block text-3xl font-semibold text-[#168596]">
          {item.unit === "text"
            ? (item.qualitative_value ?? "Not reported")
            : value(item.current_value) +
              (item.unit === "percentage" ? "%" : "")}
        </strong>
        {item.unit !== "text" && (
          <>
            <p className="text-xs text-[#87969d]">
              Overall target: {value(item.target_value)}
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
        <p className="mt-4 text-[10px] text-[#87969d]">
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
  if (!result.data) return null;
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
      <div className="h-[250px]">
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
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            ) : saved.chart === "line" ? (
              <LineChart data={data}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line dataKey="value" stroke="#25a6b4" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#25a6b4" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      <p className="mb-2 text-[10px] text-[#87969d]">
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
