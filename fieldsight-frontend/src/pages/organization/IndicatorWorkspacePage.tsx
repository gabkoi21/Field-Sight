import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  TrendingUp,
  ChevronDown,
  GitBranch,
  Link2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Target,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { CollectedDataPanel } from "../../workspace/CollectedDataPanel";
import { WorkspaceTabs } from "../../workspace/WorkspaceUI";
import { Button, LoadingSkeleton, LoadingState, PageHeader } from "../../components/ui";
import {
  apiClient,
  type FrameworkNode,
  type FrameworkNodeInput,
  type Indicator,
  type IndicatorInput,
  type IndicatorMappingInput,
} from "../../services/apiClient";
import {
  Dialog,
  calculations,
  FrameworkForm,
  IndicatorDefinitionForm,
  IndicatorMappingForm,
  inputClass,
  PeriodTargetsForm,
  units,
} from "./IndicatorForms";

const accents: Record<FrameworkNode["node_type"], string> = {
  goal: "#006b85",
  objective: "#008da8",
  outcome: "#09bce8",
  output: "#10cba5",
  activity: "#f3c000",
};
const registerGroups = {
  goal: { border: "#c4a227", background: "#fffbed" },
  objective: { border: "#c4a227", background: "#fffbed" },
  outcome: { border: "#298977", background: "#eaf9f4" },
  output: { border: "#7259bd", background: "#f5f2fc" },
  activity: { border: "#218eaa", background: "#edf7fb" },
};
const amount = (value: number | null, unit = "number") =>
  value === null
    ? "Not reported"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit === "percentage" ? "%" : ""}`;
const frequency = (value: string) =>
  ({
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    semi_annual: "Semi-annual",
    annual: "Annual",
  })[value] ?? value;

export function IndicatorWorkspacePage() {
  const workspace = useWorkspace();
  const { projectId: routeProject } = useParams<{ projectId: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const org = user?.memberships.find(
    (item) => item.role === "organization_admin",
  )?.organization_id;
  const cache = useQueryClient();
  const [dateFrom, setFrom] = useState("");
  const [dateTo, setTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [review, setReview] = useState<{ kind: "definition" | "mapping" | "targets" | "unmapping"; input: IndicatorInput | IndicatorMappingInput | Array<{period: string; target_value: number}>; preview: Awaited<ReturnType<typeof apiClient.indicatorPreview>> } | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  async function reviewDefinition(input: IndicatorInput) {
    if (editing === "new") { definition.mutate(input); return; }
    try {
      const preview = await apiClient.indicatorPreview((editing as Indicator).id, input);
      setReason(""); setConfirmed(false); setReview({kind: "definition", input, preview});
    } catch (cause) { setError((cause as Error).message); }
  }
  async function reviewMapping(input: IndicatorMappingInput) {
    try {
      const preview = await apiClient.indicatorMappingPreview(mapping!.id, input);
      setReason(""); setConfirmed(false); setReview({kind: "mapping", input, preview});
    } catch (cause) { setError((cause as Error).message); }
  }
  async function reviewTargets(input: Array<{period: string; target_value: number}>) {
    try {
      const preview = await apiClient.indicatorTargetsPreview(periodTargets!.id, input);
      setReason(""); setConfirmed(false); setReview({kind: "targets", input, preview});
    } catch (cause) { setError((cause as Error).message); }
  }
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Indicator | "new" | null>(null);
  const [mapping, setMapping] = useState<Indicator | null>(null);
  const [periodTargets, setPeriodTargets] = useState<Indicator | null>(null);
  const [nodeEditor, setNodeEditor] = useState<{
    node: FrameworkNode | null;
    parentId: string | null;
  } | null>(null);
  const [selectedId, setSelected] = useState("");
  const [detailsTab, setDetailsTab] = useState("summary");
  const view = params.get("view") ?? "register";
  const projects = useQuery({
    queryKey: ["organization-projects", org],
    queryFn: () => apiClient.organizationProjects(org!),
    enabled: Boolean(org),
  });
  const projectId = routeProject || workspace.projectId || "";
  const project = projects.data?.find((item) => item.id === projectId);
  useEffect(() => {
    setSelected("");
    setEditing(null);
    setMapping(null);
    setPeriodTargets(null);
    setNodeEditor(null);
    setError("");
    setSourceFilter("all");
    setCollapsedGroups(new Set());
  }, [projectId]);
  const invalidDates = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const indicators = useQuery({
    queryKey: ["indicators", projectId, dateFrom, dateTo],
    queryFn: () => apiClient.indicators(projectId, dateFrom, dateTo),
    enabled: Boolean(org && projectId && !invalidDates),
  });
  const framework = useQuery({
    queryKey: ["results-framework", projectId],
    queryFn: () => apiClient.resultsFramework(projectId),
    enabled: Boolean(org && projectId),
  });
  const nodes = framework.data ?? [];
  const items = indicators.data ?? [];
  const visibleItems = items.filter((item) => {
    const matchesSource =
      sourceFilter === "all" ||
      (sourceFilter === "mapped" && item.result_source === "table") ||
      (sourceFilter === "unmapped" && item.result_source !== "table") ||
      (sourceFilter === "achieved" && item.target_achieved === true);
    return matchesSource;
  });
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const sourceQuestions = useQuery({
    queryKey: ["indicator-fields", projectId, selected?.source_form_id],
    queryFn: () => apiClient.indicatorFields(projectId, selected?.source_form_id),
    enabled: Boolean(projectId && selected?.mapping && detailsTab === "sources"),
  });
  const sourceQuestion = sourceQuestions.data?.find(
    (field) => field.source_field === selected?.mapping?.source_field,
  );
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["indicators", projectId] }),
      cache.invalidateQueries({ queryKey: ["results-framework", projectId] }),
      cache.invalidateQueries({ queryKey: ["indicator-period-targets"] }),
      cache.invalidateQueries({ queryKey: ["indicator-evidence"] }),
      cache.invalidateQueries({ queryKey: ["indicator-versions"] }),
      cache.invalidateQueries({ queryKey: ["dashboard"] }),
      cache.invalidateQueries({ queryKey: ["dashboard-widget"] }),
    ]);
  }
  function tab(value: string) {
    setParams({ view: value });
    setError("");
  }
  function showResult(item: Indicator) {
    setSelected(item.id);
    setDetailsTab("summary");
    tab("results");
  }
  const definition = useMutation({
    mutationFn: (input: IndicatorInput) =>
      editing === "new"
        ? apiClient.createIndicator(projectId, input)
        : apiClient.updateIndicator((editing as Indicator).id, input),
    onSuccess: async (data) => {
      const created = editing === "new";
      await refresh();
      setReview(null);
      setEditing(null);
      setError("");
      if (created) {
        setSelected(data.id);
        tab("register");
      }
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const map = useMutation({
    mutationFn: (input: IndicatorMappingInput) =>
      apiClient.saveIndicatorMapping(mapping!.id, input),
    onSuccess: async () => {
      await refresh();
      setReview(null);
      setMapping(null);
      setError("");
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const unmap = useMutation({
    mutationFn: (controls: {confirm_change: boolean; change_reason: string; expected_version: number; preview_token: string}) => apiClient.deleteIndicatorMapping(mapping!.id, controls),
    onSuccess: async () => {
      await refresh();
      setReview(null);
      setMapping(null);
      setError("");
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const remove = useMutation({
    mutationFn: apiClient.deleteIndicator,
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const regroup = useMutation({
    mutationFn: ({ id, group }: { id: string; group: string | null }) =>
      apiClient.updateIndicator(id, { framework_node_id: group }),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const saveNode = useMutation({
    mutationFn: (input: FrameworkNodeInput) =>
      nodeEditor?.node
        ? apiClient.updateFrameworkNode(projectId, nodeEditor.node.id, input)
        : apiClient.createFrameworkNode(projectId, input),
    onSuccess: async () => {
      await refresh();
      setNodeEditor(null);
      setError("");
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const removeNode = useMutation({
    mutationFn: (id: string) => apiClient.deleteFrameworkNode(projectId, id),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const targets = useMutation({
    mutationFn: (input: {rows: Array<{ period: string; target_value: number }>; controls: {confirm_change: boolean; change_reason: string; expected_version: number; preview_token: string}}) =>
      apiClient.saveIndicatorPeriodTargets(periodTargets!.id, input.rows, input.controls),
    onSuccess: async () => {
      await refresh();
      setReview(null);
      setPeriodTargets(null);
      setError("");
    },
    onError: (cause: Error) => setError(cause.message),
  });
  function addNode(
    node: FrameworkNode | null = null,
    parentId: string | null = null,
  ) {
    setError("");
    setNodeEditor({ node, parentId });
  }
  function editMap(item: Indicator) {
    setError("");
    setMapping(item);
  }
  function editItem(item: Indicator | "new") {
    setError("");
    setEditing(item);
  }
  const groups: Array<{
    id: string | null;
    title: string;
    type?: FrameworkNode["node_type"];
    depth: number;
  }> = [];
  function walk(parentId: string | null, depth = 0) {
    nodes
      .filter((node) => node.parent_id === parentId)
      .forEach((node) => {
        groups.push({
          id: node.id,
          title: node.title,
          type: node.node_type,
          depth,
        });
        walk(node.id, depth + 1);
      });
  }
  walk(null);
  groups.push({ id: null, title: "Ungrouped indicators", depth: 0 });
  function tree(parentId: string | null): ReactNode {
    return (
      <ul className="results-framework-tree">
        {nodes
          .filter((node) => node.parent_id === parentId)
          .map((node) => (
            <li key={node.id} className="results-framework-branch">
              
              <div
                className="results-framework-card"
                style={{ borderLeftColor: accents[node.node_type] }}
              >
                <div className="flex items-center justify-between gap-2 px-3 pt-3">
                  <span
                    className="text-xs font-semibold capitalize text-[#17204c]"
                    
                  >
                    {node.node_type}
                  </span>
                  <div className="flex gap-2">
                    <Icon
                      label={`Edit ${node.title}`}
                      onClick={() => addNode(node)}
                    >
                      <Pencil size={12} />
                    </Icon>
                    <Icon
                      label={`Delete ${node.title}`}
                      destructive
                      disabled={removeNode.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete framework item “${node.title}”? Linked children and indicators must be moved first.`,
                          )
                        )
                          removeNode.mutate(node.id);
                      }}
                    >
                      <Trash2 size={12} />
                    </Icon>
                  </div>
                </div>
                <strong className="block px-3 pt-2 text-xs font-medium leading-5 text-[#24434c]">
                  {node.title}
                </strong>
                <span className="block px-3 pb-3 pt-1 text-xs text-[var(--fs-muted)]">
                  {
                    items.filter((item) => item.framework_node_id === node.id)
                      .length
                  }{" "}
                  linked indicators
                </span>
                {node.node_type !== "activity" && (
                  <button
                    onClick={() => addNode(null, node.id)}
                    aria-label={`Add child result to ${node.title}`} title="Add child result" className="flex min-h-11 w-full items-center justify-center border-0 bg-[#eff5f7] text-[#006b85] hover:bg-[#dfeef2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#006b85]"
                  >
                    <Plus size={20} aria-hidden="true" />
                  </button>
                )}
              </div>
              {nodes.some((child) => child.parent_id === node.id) && (
                tree(node.id)
              )}
            </li>
          ))}
      </ul>
    );
  }

  if (loading || projects.isLoading) return <LoadingState variant="panel" label="Loading indicators…" />;
  return (
    <div className="space-y-5 text-[#24434c]">
      <Link
        to={projectId ? `/projects/${projectId}` : "/projects"}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#117e8f] no-underline hover:underline"
      >
        <ArrowLeft size={15} /> Project overview
      </Link>
      <PageHeader eyebrow={`FieldSight / ${project?.name ?? "Project"} / Monitoring & evaluation`} title="Indicators" description="Connect project results to measurable evidence and targets.">
        <Button disabled={!projectId || !org} onClick={() => editItem("new")}>
          <Plus size={15} />
          Add indicator
        </Button>
      </PageHeader>
      {projectId && <WorkspaceTabs />}
      {!org ? (
        <Panel>
          <Empty
            title="Sign in to your organization"
            description="An organization administrator account is required to define indicators and view project evidence."
          >
            <Link to="/login" className="text-sm text-[#0c8593]">
              Open login →
            </Link>
          </Empty>
        </Panel>
      ) : projects.error ? (
        <Notice error>{projects.error.message}</Notice>
      ) : !projects.data?.length ? (
        <Panel>
          <Empty
            title="Start with a project"
            description="Create a project and assign a Kobo form before defining its results."
          >
            <Link to="/projects" className="text-sm text-[#0c8593]">
              Open projects →
            </Link>
          </Empty>
        </Panel>
      ) : (
        <>
          <Panel>
            <div className={`flex flex-wrap items-center gap-3 ${routeProject ? "justify-end px-4 py-1.5" : "p-5"}`}>
              <div className="mr-auto flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <p className="m-0 text-sm font-medium text-[#24434c]">Indicator filters</p>
                  <p className="m-0 text-xs text-[var(--fs-muted)]">Filter by source mapping, target achievement or submission date.</p>
                </div>
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-controls="indicator-date-filters"
                onClick={() => setFiltersOpen((open) => !open)}
                className="inline-flex min-h-11 shrink-0 self-center items-center justify-center gap-2 rounded-lg border border-[var(--fs-control-border)] bg-white px-2.5 py-0 text-xs text-[#3f7a86] hover:bg-[#f7fafb]"
              >
                <SlidersHorizontal size={15} aria-hidden="true" /> Filters
                {(dateFrom || dateTo || sourceFilter !== "all") && (
                  <span className="rounded bg-[#eaf5f6] px-1.5 text-xs">
                    Active
                  </span>
                )}
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={filtersOpen ? "rotate-180" : ""}
                />
              </button>
            </div>
            {filtersOpen && (
              <section
                id="indicator-date-filters"
                aria-label="Indicator filters"
                className="border-t border-[#e7edef] bg-[#fafcfd] pt-4"
              >
                <div className="grid max-w-[900px] grid-cols-3 items-end gap-4 px-5 pb-4 max-[700px]:grid-cols-1">
                  <label className="grid min-w-0 gap-2">
                    <span className="block text-[12px] uppercase tracking-wide text-[var(--fs-muted)]">
                      Indicator status
                    </span>
                    <select
                      aria-label="Filter indicators"
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      className={`${inputClass} h-10`}
                    >
                      <option value="all">All indicators</option>
                      <option value="mapped">Source mapped</option>
                      <option value="unmapped">Needs mapping attention</option>
                      <option value="achieved">Target achieved</option>
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-2">
                    <span className="block text-[12px] uppercase tracking-wide text-[var(--fs-muted)]">
                      Submitted from (UTC)
                    </span>
                    <input
                      aria-label="Submitted from"
                      type="date"
                      className={`${inputClass} h-10`}
                      value={dateFrom}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label className="grid min-w-0 gap-2">
                    <span className="block text-[12px] uppercase tracking-wide text-[var(--fs-muted)]">
                      Submitted through (UTC)
                    </span>
                    <input
                      aria-label="Submitted through"
                      type="date"
                      className={`${inputClass} h-10`}
                      value={dateTo}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 text-xs text-[var(--fs-muted)]">
                  <span>
                    Filter actual results by submission date. Indicator targets
                    stay unchanged.
                  </span>
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFrom("");
                        setTo("");
                      }}
                      className="border-0 bg-transparent p-0 font-medium text-[#0c8593]"
                    >
                      Clear dates
                    </button>
                  )}
                </div>
              </section>
            )}
            <nav
              aria-label="Indicator project"
              className="flex overflow-x-auto border-t border-[#e7edef] px-4"
            >
              {[
                {
                  id: "register",
                  label: "Indicators",
                  icon: BarChart3,
                },
                {
                  id: "framework",
                  label: "Results framework",
                  icon: GitBranch,
                },
                { id: "results", label: "Results summary", icon: Target },
              ].map(({ id, label, icon: Symbol }) => (
                <button
                  key={id}
                  onClick={() => tab(id)}
                  aria-current={view === id ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 border-0 border-b-2 px-4 py-3.5 text-sm transition-colors ${view === id ? "border-[#0c8593] bg-[#f0f8f9] font-semibold text-[#0c7180]" : "border-transparent bg-transparent text-[var(--fs-muted)] hover:bg-[#f7fafb]"}`}
                >
                  <Symbol size={15} />
                  {label}
                </button>
              ))}
            </nav>
          </Panel>
          {error && <Notice error>{error}</Notice>}
          {invalidDates && (
            <Notice error>Start date must be on or before end date.</Notice>
          )}
          {indicators.error && (
            <Notice error>{indicators.error.message} <button className="min-h-11 px-3 font-semibold underline" onClick={() => void indicators.refetch()}>Retry indicators</button></Notice>
          )}
          {framework.error && <Notice error>{framework.error.message} <button className="min-h-11 px-3 font-semibold underline" onClick={() => void framework.refetch()}>Retry framework</button></Notice>}
          {(dateFrom || dateTo) && (
            <Notice>
              Actuals use the selected submission window. Overall and
              reporting-period targets are not prorated.
            </Notice>
          )}
          {((indicators.isFetching && indicators.data) || (framework.isFetching && framework.data)) && <LoadingState variant="inline" label="Updating indicators…" />}
          {indicators.isLoading || framework.isLoading ? (
            <LoadingSkeleton label="Loading indicators…" columns={7} />
          ) : (
            !invalidDates &&
            (!indicators.error || indicators.data) &&
            (!framework.error || framework.data) && (
              <>
                {view === "framework" ? (
                  <Panel>
                    <div className="flex items-center justify-between gap-4 border-b border-[#e7edef] px-5 py-4">
                      <div>
                        <h2 className="m-0 text-sm">
                          Project results framework
                        </h2>
                        <p className="mb-0 mt-1 text-xs text-[var(--fs-muted)]">
                          Arrange intended results and link indicators from the
                          register.
                        </p>
                      </div>
                      <Button variant="secondary" onClick={() => addNode()}>
                        <Plus size={14} />
                        Add result
                      </Button>
                    </div>
                    {!nodes.length ? (
                      <Empty
                        title="Build your results framework"
                        description="Start with a goal or objective, then add outcomes, outputs and activities. Your indicators can be linked to any result."
                      >
                        <Button onClick={() => addNode()}>
                          <Plus size={14} />
                          Add first result
                        </Button>
                      </Empty>
                    ) : (
                      <div className="overflow-x-auto bg-[#f6f4ee] p-4 sm:p-8" role="region" aria-label="Results framework diagram" tabIndex={0}>
                        <div className="mx-auto w-max min-w-full bg-white px-6 pb-10 pt-6">
                          <h3 className="mb-8 mt-0 text-center text-lg font-bold text-[#20265b]">Results framework</h3>
                          {tree(null)}
                        </div>
                      </div>                    )}
                  </Panel>
                ) : view === "results" ? (
                  <>
                    {!items.length ? (
                      <Panel>
                        <Empty
                          title="No indicator results yet"
                          description="Define an indicator and map a survey question to start tracking actuals against targets."
                        >
                          <Button onClick={() => editItem("new")}>
                            <Plus size={14} />
                            Add first indicator
                          </Button>
                        </Empty>
                      </Panel>
                    ) : (
                      selected && (
                        <>
                          <Panel>
                            <div className="flex flex-wrap items-end justify-between gap-4 p-4">
                              <label className="min-w-[240px] flex-1">
                                <span className="mb-1.5 block text-[12px] uppercase text-[var(--fs-muted)]">
                                  Indicator
                                </span>
                                <select
                                  aria-label="Indicator"
                                  className={inputClass}
                                  value={selected.id}
                                  onChange={(e) => setSelected(e.target.value)}
                                >
                                  {items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.code} · {item.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Button
                                variant="secondary"
                                onClick={() => editMap(selected)}
                              >
                                <Link2 size={14} />
                                Source mapping
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setError("");
                                  setPeriodTargets(selected);
                                }}
                              >
                                Period targets
                              </Button>
                            </div>
                            <div className="flex flex-wrap border-t border-[#e7edef] px-4">
                              {["summary", "details", "sources"].map((id) => (
                                <button
                                  key={id}
                                  onClick={() => setDetailsTab(id)}
                                  className={`border-0 border-b-2 bg-transparent px-4 py-3 text-xs capitalize ${detailsTab === id ? "border-[#0c8593] text-[#0c7180]" : "border-transparent text-[var(--fs-muted)]"}`}
                                >
                                  {id === "summary"
                                    ? "Results summary"
                                    : id === "sources"
                                      ? "Mapping & sources"
                                      : "Indicator details"}
                                </button>
                              ))}
                            </div>
                          </Panel>
                          <nav aria-label="Indicator evidence tools" className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setDetailsTab("collected")}>Collected data</Button>
                            <Button variant="secondary" onClick={() => setDetailsTab("evidence")}>Evidence &amp; versions</Button>
                          </nav>
                          {detailsTab === "evidence" ? <IndicatorEvidence indicator={selected} from={dateFrom} to={dateTo} /> : detailsTab === "collected" ? <CollectedDataPanel indicator={selected} onMap={() => editMap(selected)} /> : detailsTab === "details" ? (
                            <Panel>
                              <div className="grid grid-cols-2 gap-5 p-5 text-xs max-[600px]:grid-cols-1">
                                <Detail
                                  label="Definition"
                                  value={
                                    selected.description ??
                                    "No description provided"
                                  }
                                />
                                <Detail
                                  label="Unit & direction"
                                  value={`${selected.unit} · ${selected.direction} is better`}
                                />
                                <Detail
                                  label="Baseline"
                                  value={amount(
                                    selected.baseline_value,
                                    selected.unit,
                                  )}
                                />
                                <Detail
                                  label="Overall target"
                                  value={amount(
                                    selected.target_value,
                                    selected.unit,
                                  )}
                                />
                                <Detail
                                  label="Deadline"
                                  value={
                                    selected.target_date ?? "No deadline set"
                                  }
                                />
                                <Detail
                                  label="Reporting frequency"
                                  value={frequency(
                                    selected.reporting_frequency,
                                  )}
                                />
                              </div>
                              <div className="border-t border-[#e7edef] p-4">
                                <Button
                                  variant="secondary"
                                  onClick={() => editItem(selected)}
                                >
                                  <Pencil size={14} />
                                  Edit definition
                                </Button>
                              </div>
                            </Panel>
                          ) : detailsTab === "sources" ? (
                            <Panel>
                              <div className="grid gap-5 p-5 text-sm sm:grid-cols-2">
                                <Detail
                                  label="Linked form ID"
                                  value={
                                    selected.source_form_id ?? "No form mapped"
                                  }
                                />
                                <Detail
                                  label="Question used for this indicator"
                                  value={
                                    sourceQuestion?.label ||
                                    selected.mapping?.source_field ||
                                    "No question mapped"
                                  }
                                />
                                <Detail
                                  label="Calculation method"
                                  value={
                                    selected.mapping
                                      ? selected.mapping.calculation === "count_matching"
                                        ? `Count submissions answered “${sourceQuestion?.choices?.find((choice) => choice.value === selected.mapping?.match_value)?.label ?? selected.mapping.match_value ?? "Selected answer"}”`
                                        : calculations[
                                          selected.mapping.calculation
                                        ]
                                      : "Choose a calculation"
                                  }
                                />
                                <Detail
                                  label="Answer included in the count"
                                  value={
                                    sourceQuestion?.choices?.find(
                                      (choice) => choice.value === selected.mapping?.match_value,
                                    )?.label ??
                                    selected.mapping?.match_value ??
                                    "Not required for this calculation"
                                  }
                                />
                                <Detail
                                  label="Source connection"
                                  value={selected.mapping_health === "healthy"
                                    ? "Form and question connected"
                                    : selected.mapping_health.replaceAll("_", " ")}
                                />
                                {selected.source_form_id && (
                                  <Link
                                    to={`/analytics?project_id=${projectId}`}
                                    className="inline-block text-[#0c8593]"
                                  >
                                    View question responses →
                                  </Link>
                                )}
                              </div>
                            </Panel>
                          ) : (
                            <IndicatorResults
                              indicator={selected}
                              onMap={() => editMap(selected)}
                            />
                          )}
                        </>
                      )
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 max-[650px]:grid-cols-1">
                      {[
                        ["Indicators", items.length],
                        [
                          "With source mappings",
                          items.filter(
                            (item) => item.mapping_health === "healthy",
                          ).length,
                        ],
                        [
                          "Overall targets achieved",
                          items.filter((item) => item.target_achieved === true)
                            .length,
                        ],
                      ].map(([label, value]) => (
                        <Panel key={label}>
                          <div className="flex items-center justify-between gap-4 p-5">
                            <div>
                              <span className="text-xs font-medium text-[var(--fs-muted)]">
                                {label}
                              </span>
                              <strong className="mt-1.5 block text-[28px] font-semibold leading-tight tabular-nums text-[#24434c]">
                                {value}
                              </strong>
                            </div>
                            <span
                              className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#f0f6f8] text-[#4f8491]"
                              aria-hidden="true"
                            >
                              {label === "Indicators" ? (
                                <BarChart3 size={21} />
                              ) : label === "With source mappings" ? (
                                <Link2 size={21} />
                              ) : (
                                <Target size={21} />
                              )}
                            </span>
                          </div>
                        </Panel>
                      ))}
                    </div>
                    <Panel>
                      {!items.length ? (
                        <Empty
                          title="No indicators yet"
                          description="Add the measures this project is accountable for, then explicitly choose the source question and calculation."
                        >
                          <Button onClick={() => editItem("new")}>
                            <Plus size={14} />
                            Add first indicator
                          </Button>
                        </Empty>
                      ) : (
                        <div className="indicator-register-container" role="region" aria-label="Scrollable indicator list" tabIndex={0}>
                          <table className="indicator-register w-full table-auto border-collapse text-left text-xs text-[#24434c]">
                            <colgroup>
                              <col className="w-[24%]" />
                              <col className="w-[22%]" />
                              <col className="w-[10%]" />
                              <col className="w-[14%]" />
                              <col className="w-[14%]" />
                              <col className="w-[16%]" />
                            </colgroup>
                            <thead className="bg-[#f7f8fa] text-[10px] font-medium uppercase tracking-wide text-[#87939d]">
                              <tr>
                                {[
                                  "Name",
                                  "Actual vs target",
                                  "Format",
                                  "Collection frequency",
                                  "Status",
                                  "Actions",
                                ].map((label) => (
                                  <th
                                    key={label}
                                    className={`px-4 py-3 font-medium ${label === "Actions" ? "text-right" : ""}`}
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            {groups
                              .filter((group) =>
                                visibleItems.some(
                                  (item) => item.framework_node_id === group.id,
                                ),
                              )
                              .map((group) => (
                                <tbody key={group.id ?? "ungrouped"}>
                                  <tr
                                    onDragOver={(event) =>
                                      event.preventDefault()
                                    }
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const id =
                                        event.dataTransfer.getData(
                                          "text/plain",
                                        );
                                      if (items.some((item) => item.id === id))
                                        regroup.mutate({ id, group: group.id });
                                    }}
                                    className="border-y border-[#e7edef]"
                                    style={{
                                      backgroundColor: group.type
                                        ? registerGroups[group.type].background
                                        : "#f4f7f8",
                                    }}
                                  >
                                    <th colSpan={6} className="p-0 text-left">
                                      <button
                                        type="button"
                                        aria-expanded={Boolean(
                                          sourceFilter !== "all" ||
                                            !collapsedGroups.has(
                                              group.id ?? "ungrouped",
                                            ),
                                        )}
                                        aria-label={`${collapsedGroups.has(group.id ?? "ungrouped") && sourceFilter === "all" ? "Expand" : "Collapse"} ${group.title}`}
                                        onClick={() =>
                                          setCollapsedGroups((previous) => {
                                            const next = new Set(previous);
                                            const key = group.id ?? "ungrouped";
                                            if (next.has(key)) next.delete(key);
                                            else next.add(key);
                                            return next;
                                          })
                                        }
                                        className="flex w-full items-center gap-2 border-0 border-l-[3px] bg-transparent px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#566970]"
                                        style={{
                                          borderLeftColor: group.type
                                            ? registerGroups[group.type].border
                                            : "#9aaeb5",
                                          paddingLeft: 12 + group.depth * 12,
                                        }}
                                      >
                                        <span>
                                          {group.type ? `${group.type}: ` : ""}
                                          {group.title}
                                        </span>
                                        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] tabular-nums">
                                          {
                                            visibleItems.filter(
                                              (item) =>
                                                item.framework_node_id ===
                                                group.id,
                                            ).length
                                          }
                                        </span>
                                        <ChevronDown
                                          size={13}
                                          aria-hidden="true"
                                          className={`ml-auto shrink-0 transition-transform ${collapsedGroups.has(group.id ?? "ungrouped") && sourceFilter === "all" ? "-rotate-90" : ""}`}
                                        />
                                      </button>
                                    </th>
                                  </tr>
                                  {(sourceFilter !== "all" ||
                                    !collapsedGroups.has(
                                      group.id ?? "ungrouped",
                                    )) &&
                                    visibleItems
                                      .filter(
                                        (item) =>
                                          item.framework_node_id === group.id,
                                      )
                                      .map((item) => (
                                        <tr
                                          key={item.id}
                                          draggable={!regroup.isPending}
                                          onDragStart={(event) =>
                                            event.dataTransfer.setData(
                                              "text/plain",
                                              item.id,
                                            )
                                          }
                                          className="border-b border-[#edf1f2] transition-colors last:border-b-0 hover:bg-[#f8fbfc]"
                                        >
                                          <td data-label="Name" className="px-4 py-2.5 align-middle">
                                            <button
                                              title={item.name}
                                              onClick={() => showResult(item)}
                                              className="flex min-h-7 w-full min-w-0 items-center border-0 bg-transparent p-0 text-left font-medium leading-5 text-[#146578] hover:underline"
                                            >
                                              <span className="block break-words">
                                                {item.name}
                                              </span>
                                            </button>
                                          </td>
                                          <td data-label="Actual vs target" className="px-4 py-2.5 align-middle">
                                            {item.unit === "text" ? (
                                              <span className="text-[var(--fs-muted)]">
                                                {item.qualitative_value ??
                                                  "Not reported"}
                                              </span>
                                            ) : (
                                              <Progress indicator={item} />
                                            )}
                                          </td>
                                          <td data-label="Format" className="px-4 py-2.5 align-middle">
                                            {units[item.unit]}
                                          </td>
                                          <td data-label="Collection frequency" className="px-4 py-2.5 align-middle">
                                            {frequency(
                                              item.reporting_frequency,
                                            )}
                                          </td>
                                          <td data-label="Status" className="px-4 py-2.5 align-middle">
                                            <Status item={item} />
                                          </td>
                                          <td data-label="Actions" className="px-4 py-2.5 align-middle">
                                            <div className="flex flex-nowrap justify-end gap-1 [&>button]:shrink-0">
                                              <Icon
                                                label={`View results for ${item.name}`}
                                                onClick={() => showResult(item)}
                                              >
                                                <BarChart3 size={15} />
                                              </Icon>
                                              <Icon
                                                label={`Map source for ${item.name}`}
                                                disabled={
                                                  map.isPending ||
                                                  unmap.isPending
                                                }
                                                onClick={() => editMap(item)}
                                              >
                                                <Link2 size={15} />
                                              </Icon>
                                              <Icon
                                                label={`Edit ${item.name}`}
                                                onClick={() => editItem(item)}
                                              >
                                                <Pencil size={15} />
                                              </Icon>
                                              <Icon
                                                label={`Delete ${item.name}`}
                                                destructive
                                                disabled={remove.isPending}
                                                onClick={() => {
                                                  if (
                                                    window.confirm(
                                                      `Delete indicator “${item.name}” and its saved targets?`,
                                                    )
                                                  )
                                                    remove.mutate(item.id);
                                                }}
                                              >
                                                <Trash2 size={15} />
                                              </Icon>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                </tbody>
                              ))}
                          </table>
                          {!visibleItems.length && (
                            <div className="p-10 text-center">
                              <p className="m-0 text-sm font-medium text-[#24434c]">
                                No indicators match these filters.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSourceFilter("all");
                                }}
                                className="mt-3 border-0 bg-transparent text-xs font-medium text-[#0c8593]"
                              >
                                Clear filters
                              </button>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7edef] bg-[#fafcfd] px-5 py-3 text-xs text-[var(--fs-muted)]">
                            <span aria-live="polite">
                              Showing {visibleItems.length} of {items.length}{" "}
                              indicators
                            </span>
                            <span>
                              Use the link icon to map a survey question.
                            </span>
                          </div>
                        </div>
                      )}
                    </Panel>
                  </>
                )}
              </>
            )
          )}
        </>
      )}
      {review && <Dialog title="Review definition change" onClose={() => setReview(null)} error={error}>
        <p className="text-xs">{review.preview.notice}</p>
        <p className="text-xs">Affected periods: {review.preview.affected_periods.join(", ") || "No dated results"}</p>
        <p>Actual: {amount(review.preview.before.current_value, review.preview.before.unit)} → {amount(review.preview.after.current_value, review.preview.after.unit)}</p>
        <p className="text-xs">Included: {review.preview.after.mapped_records}; missing: {review.preview.after.missing_records}; invalid: {review.preview.after.invalid_answers}; quality excluded: {review.preview.after.quality_excluded_records}; numerator / denominator: {review.preview.after.numerator ?? "—"} / {review.preview.after.denominator}</p>
        <label className="grid gap-2 text-xs">Reason / explanation for target exceptions<textarea className={inputClass} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label className="my-4 flex gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Apply the new definition to current calculations for all reporting periods. Retain the previous definition in history.</label>
        <Button disabled={!confirmed || reason.trim().length < 3 || definition.isPending || map.isPending || targets.isPending || unmap.isPending} onClick={async () => {
          const controls = { change_reason: reason.trim(), confirm_change: true, expected_version: review.preview.expected_version, preview_token: review.preview.preview_token };
          try {
            if (review.kind === "definition") await definition.mutateAsync({ ...review.input as IndicatorInput, ...controls } as IndicatorInput);
            else if (review.kind === "mapping") await map.mutateAsync({ ...review.input as IndicatorMappingInput, ...controls });
            else if (review.kind === "unmapping") await unmap.mutateAsync(controls);
            else await targets.mutateAsync({ rows: review.input as Array<{period: string; target_value: number}>, controls });
          } catch (cause) {
            setConfirmed(false);
            if (cause instanceof Error && /preview|changed since/i.test(cause.message)) {
              try {
                const preview = review.kind === "definition"
                  ? await apiClient.indicatorPreview((editing as Indicator).id, review.input as IndicatorInput)
                  : review.kind === "unmapping" ? await apiClient.indicatorMappingDeletePreview(mapping!.id)
                  : review.kind === "mapping"
                    ? await apiClient.indicatorMappingPreview(mapping!.id, review.input as IndicatorMappingInput)
                    : await apiClient.indicatorTargetsPreview(periodTargets!.id, review.input as Array<{period: string; target_value: number}>);
                setReview({...review, preview});
                setError("The preview was stale. Updated results are shown. Review and confirm again; your reason has been retained.");
              } catch (refreshError) { setError(refreshError instanceof Error ? refreshError.message : "Preview refresh failed. Try again."); }
            }
          }
        }}>Confirm change</Button>
      </Dialog>}
      {editing && !review && (
        <IndicatorDefinitionForm
          indicator={editing === "new" ? null : editing}
          nodes={nodes}
          error={error}
          saving={definition.isPending}
          onClose={() => setEditing(null)}
          onSave={reviewDefinition}
        />
      )}
      {mapping && !review && (
        <IndicatorMappingForm
          indicator={mapping}
          projectId={projectId}
          error={error}
          saving={map.isPending || unmap.isPending}
          onClose={() => setMapping(null)}
          onSave={reviewMapping}
          onRemove={async () => {
            try {
              const preview = await apiClient.indicatorMappingDeletePreview(mapping!.id);
              setReason(""); setConfirmed(false); setReview({kind: "unmapping", input: {} as IndicatorInput, preview});
            } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview failed"); }
          }}
        />
      )}
      {nodeEditor && (
        <FrameworkForm
          node={nodeEditor.node}
          parentId={nodeEditor.parentId}
          nodes={nodes}
          error={error}
          saving={saveNode.isPending}
          onClose={() => setNodeEditor(null)}
          onSave={(input) => saveNode.mutate(input)}
        />
      )}
      {periodTargets && !review && (
        <PeriodTargetsForm
          indicator={periodTargets}
          error={error}
          saving={targets.isPending}
          onClose={() => setPeriodTargets(null)}
          onSave={reviewTargets}
        />
      )}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-[#e0e8eb] bg-white">
      {children}
    </section>
  );
}
function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-xs leading-5 ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#dcebe9] bg-[#f0f8f6] text-[#4d7074]"}`}
    >
      {children}
    </div>
  );
}
function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center px-5 py-12 text-center">
      <Target className="text-[#0c8593]" size={28} />
      <h2 className="mb-1 mt-4 text-base font-semibold">{title}</h2>
      <p className="mb-5 mt-0 max-w-lg text-xs leading-6 text-[var(--fs-muted)]">
        {description}
      </p>
      {children}
    </div>
  );
}
function Icon({
  label,
  children,
  onClick,
  disabled = false,
  destructive = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded border border-[#dce5e8] bg-white p-0 shadow-none transition-colors hover:border-[#b7c7cd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#73868d] disabled:opacity-40 ${destructive ? "text-red-600 hover:text-red-700" : "text-[var(--fs-muted)] hover:text-[#24434c]"}`}
    >
      {children}
    </button>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-[12px] uppercase tracking-wide text-[#8a9ba1]">
        {label}
      </span>
      <span className="leading-5 text-[#24434c]">{value}</span>
    </div>
  );
}
function Status({ item }: { item: Indicator }) {
  const label =
    item.is_active === false ? "Draft" : item.unit === "text" && item.qualitative_value
      ? "Result recorded"
      : item.result_source === "unconfigured"
        ? "Not configured"
        : item.result_source === "table" && item.mapping_health !== "healthy"
          ? "Broken mapping"
        : item.target_achieved
          ? "Target achieved"
          : {
              not_due: "In progress · not due",
              overdue: "Below target · overdue",
              no_deadline: "In progress",
              no_target: "No target set",
              no_data: "No usable data",
              achieved: "Target achieved",
            }[item.schedule_status];
  return (
    <span
      title="Calculated from the indicator's source mapping, results and target."
      className="inline-flex w-full items-center gap-2 rounded border border-[#e6ebee] bg-white px-2.5 py-1.5 text-[11px] leading-4 text-[#557078]"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${item.target_achieved ? "bg-[#38977a]" : item.schedule_status === "overdue" || item.mapping_health !== "healthy" ? "bg-[#d5ac28]" : "bg-[#6599a5]"}`}
      />
      {label}
    </span>
  );
}
function Progress({ indicator }: { indicator: Indicator }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px]">
        <strong className="font-semibold text-[#0c8593]">
          {amount(indicator.current_value, indicator.unit)}
        </strong>{" "}
        /{" "}
        {indicator.target_value === null
          ? "No target"
          : amount(indicator.target_value, indicator.unit)}
      </div>
      {indicator.progress_percent !== null && (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e3edf0]">
            <div
              className="h-full rounded-full bg-[#20a8bd]"
              style={{
                width: `${Math.max(0, Math.min(100, indicator.progress_percent))}%`,
              }}
            />
          </div>
          <span className="mt-1 block text-[11px] text-[#8a9ba1]">
            {indicator.progress_percent}%{" "}
            {indicator.baseline_value !== null &&
            indicator.baseline_value !== indicator.target_value
              ? "of planned change"
              : "target attainment"}
          </span>
        </>
      )}
    </div>
  );
}
function IndicatorResults({
  indicator,
  onMap,
}: {
  indicator: Indicator;
  onMap: () => void;
}) {
  if (indicator.unit === "text")
    return (
      <Panel>
        <div className="p-6">
          <h2 className="mt-0 text-base font-semibold">
            Latest qualitative result
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#637d86]">
            {indicator.qualitative_value ??
              "No narrative recorded in this reporting window."}
          </p>
          <p className="text-xs text-[var(--fs-muted)]">
            {indicator.manual_result_count} manual results ·{" "}
            {indicator.calculation_note}
          </p>
        </div>
      </Panel>
    );
  return (
    <div className="space-y-4">
      {indicator.undated_records > 0 && (
        <Notice>
          {indicator.undated_records} ready submissions have no submission date.
          They remain in overall eligibility counts, but are excluded from
          reporting-period results.
        </Notice>
      )}
      {indicator.mapping_health !== "healthy" && (
        <Notice>
          Source status: {indicator.mapping_health.replaceAll("_", " ")}.{" "}
          <button
            onClick={onMap}
            className="border-0 bg-transparent font-semibold text-[#0c8593] underline"
          >
            Configure source mapping
          </button>
        </Notice>
      )}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Starting value", value: amount(indicator.baseline_value, indicator.unit), icon: BarChart3 },
            { label: "Current result", value: indicator.current_value === null ? "Awaiting data" : amount(indicator.current_value, indicator.unit), icon: TrendingUp },
            { label: "Overall target", value: indicator.target_value === null ? "Not set" : amount(indicator.target_value, indicator.unit), icon: Target },
            { label: "Target deadline", value: indicator.target_date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${indicator.target_date}T00:00:00Z`)) : "Not set", icon: CalendarDays },
          ].map(({ label, value, icon: Icon }) => (
            <Panel key={label}>
              <div className="flex min-h-[120px] items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-[var(--fs-muted)]">{label}</span>
                  <strong className={`mt-1.5 block break-words font-semibold leading-tight tabular-nums text-[#24434c] ${label === "Target deadline" ? "text-xl" : "text-[28px]"}`}>
                    {value}
                  </strong>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#f0f6f8] text-[#4f8491]" aria-hidden="true">
                  <Icon size={21} />
                </span>
              </div>
            </Panel>
          ))}
        </div>
        {indicator.current_value !== null && indicator.progress_percent !== null && (
          <Panel>
            <div className="px-5 py-4">
              <p className="mt-0 text-xs font-medium text-[#557078]">Progress toward overall target</p>
              <Progress indicator={indicator} />
            </div>
          </Panel>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">
        <Panel>
          <h3 className="m-0 border-b border-[#e7edef] px-5 py-4 text-sm font-medium">
            {frequency(indicator.reporting_frequency)} results
          </h3>
          <div className="max-h-[340px] overflow-auto">
            <table className="w-full min-w-[400px] border-collapse text-left text-sm tabular-nums text-[#24434c]">
              <thead className="sticky top-0 bg-[#f0f6f8] text-xs text-[#557078]">
                <tr>
                  {["Period", "Target", "Actual", "Answered / eligible"].map(
                    (label) => (
                      <th key={label} scope="col" className="px-5 py-4 font-semibold">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {indicator.history.map((point) => (
                  <tr key={point.period} className="border-t border-[#edf1f2] transition-colors hover:bg-[#f8fbfc]">
                    <th scope="row" className="px-5 py-5 font-semibold">{point.period}</th>
                    <td className="px-5 py-5 font-medium">
                      {amount(point.target_value, indicator.unit)}
                    </td>
                    <td className="px-5 py-5 font-semibold text-[#0c7180]">
                      <span className={point.target_achieved === true ? "inline-flex items-center gap-2 rounded-md bg-[#edf8f3] px-2.5 py-1 text-[#247453]" : ""}>
                      {amount(point.value, indicator.unit)}
                      {point.target_achieved === true && <span aria-label="Target achieved">✓</span>}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-[#557078]">
                      {point.mapped_records} / {point.eligible_records}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!indicator.history.length && (
              <p className="p-6 text-center text-xs text-[var(--fs-muted)]">
                No dated results or saved period targets in this window.
              </p>
            )}
          </div>
        </Panel>
        <Panel>
          <h3 className="m-0 border-b border-[#e7edef] px-5 py-4 text-sm font-medium">
            {frequency(indicator.reporting_frequency)} actuals vs period targets
          </h3>
          {indicator.history.length ? (
            <div className="h-[300px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indicator.history}>
                  <CartesianGrid vertical={false} stroke="#e6edef" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="target_value"
                    name="Period target"
                    fill="#17a7c5"
                    isAnimationActive={false}
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="value"
                    name="Actual"
                    fill="#efb426"
                    isAnimationActive={false}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="p-12 text-center text-xs text-[var(--fs-muted)]">
              Results appear after a source question has usable, ready
              submissions.
            </p>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-4 gap-3 max-[700px]:grid-cols-2">
        {[
          ["Total score", indicator.numerator],
          ["Number of responses", indicator.denominator],
          ["Missing answers", indicator.missing_records],
          ["Invalid answers", indicator.invalid_answers],
        ].map(([label, value]) => (
          <Panel key={label}>
            <div className="flex min-h-[120px] items-center justify-between gap-4 p-5">
              <div className="min-w-0">
              <span className="text-xs font-medium text-[var(--fs-muted)]">
                {label}
              </span>
              <strong className="mt-1.5 block break-words text-[28px] font-semibold leading-tight tabular-nums text-[#24434c]">
                {typeof value === "number" ? amount(value) : "Not reported"}
              </strong>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#f0f6f8] text-[#4f8491]" aria-hidden="true">
                <BarChart3 size={21} />
              </span>
            </div>
          </Panel>
        ))}
      </div>
      <Panel>
        <h3 className="m-0 border-b border-[#e7edef] px-5 py-4 text-sm font-medium">
          Location breakdown
        </h3>
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fbfb] text-[12px] uppercase text-[#8a9ba1]">
              <tr>
                {["Location", "Actual", "Denominator", "Eligible records"].map(
                  (label) => (
                    <th key={label} className="px-5 py-3 font-medium">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {indicator.location_breakdown.map((point) => (
                <tr key={point.location} className="border-t border-[#edf1f2]">
                  <td className="px-5 py-3">{point.location}</td>
                  <td className="px-5 py-3">
                    {amount(point.value, indicator.unit)}
                  </td>
                  <td className="px-5 py-3">{point.denominator}</td>
                  <td className="px-5 py-3">{point.eligible_records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}


export function IndicatorEvidence({ indicator, from, to }: { indicator: Indicator; from: string; to: string }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [indicator.id, from, to]);
  const evidence = useQuery({queryKey: ["indicator-evidence", indicator.id, offset, from, to], queryFn: () => apiClient.indicatorEvidence(indicator.id, offset, from, to)});
  const versions = useQuery({queryKey: ["indicator-versions", indicator.id], queryFn: () => apiClient.indicatorVersions(indicator.id)});
  return <section className="grid gap-3 rounded-lg border bg-white p-5 text-xs">
    <p>Definition v{indicator.definition_version ?? 0} · {indicator.legacy_definition ? "Legacy definition; original approval unknown" : indicator.setup_complete ? "Calculation configured" : "Draft — setup incomplete"}</p>
    {indicator.definition_warnings?.map(warning => <p key={warning} role="status">{warning}</p>)}
    <p>Definition → result source → calculation → baseline/targets → preview. Date filters affect actuals; targets are unchanged. Period results are independent aggregates.</p>
    <p>{evidence.data?.source === "table" ? indicator.mapping_health === "healthy" ? "Linked table" : "Broken mapping" : evidence.data?.source === "manual" ? "Manual results" : "Not configured"} · {evidence.data?.method}</p>
    <p>{evidence.data?.notice}</p>
    {evidence.data && <p>Contributes: {evidence.data.contributing_count ?? "—"} · Superseded: {evidence.data.superseded_count ?? 0} · Total considered and excluded: {evidence.data.total} · Actual: {evidence.data.actual ?? "—"} · Numerator / denominator: {evidence.data.numerator ?? "—"} / {evidence.data.denominator ?? "—"}</p>}
    {evidence.isPending && <p role="status">Loading evidence…</p>}
    {(evidence.error || versions.error) && <div role="alert"><p>{evidence.error?.message || versions.error?.message}</p><Button variant="secondary" onClick={() => { void evidence.refetch(); void versions.refetch(); }}>Retry evidence</Button></div>}
    {evidence.data && !evidence.data.items.length && <p>No evidence in this scope.</p>}
    {evidence.data?.items.map(item => <article className="rounded border p-3" key={String(item.id)}>
      <p className="mb-2 font-semibold">{({contributes: "Contributes", superseded: "Superseded", missing_components: "Missing components", invalid_components: "Invalid components", invalid_answer: "Invalid answer", missing_answer: "Missing answer", quality_excluded: "Quality excluded", broken_mapping: "Broken mapping"} as Record<string, string>)[String(item.contribution_state)] ?? (item.included ? "Contributes" : "Excluded")}</p>
      {Object.entries(item).filter(([key]) => !["included", "contribution_state", "considered"].includes(key)).map(([key, value]) => <div className="break-words" key={key}><strong>{key.replaceAll("_", " ")}: </strong>{value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</div>)}
    </article>)}
    <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={evidence.isFetching || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><span>{evidence.data?.total ? offset + 1 : 0}–{Math.min(offset + 25, evidence.data?.total ?? 0)} of {evidence.data?.total ?? 0}</span><Button variant="secondary" disabled={evidence.isFetching || offset + 25 >= (evidence.data?.total ?? 0)} onClick={() => setOffset(offset + 25)}>Next</Button></div>
    <h3>Observed definition changes</h3>
    {versions.data?.map(version => <p key={version.version}>v{version.version} · {version.occurred_at} · {version.reason} · {version.effective_scope}</p>)}
    {!versions.data?.length && <p>No recorded changes. Legacy history has not been fabricated.</p>}
  </section>;
}
