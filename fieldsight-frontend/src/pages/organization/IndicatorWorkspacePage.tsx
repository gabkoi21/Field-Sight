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
  GitBranch,
  Link2,
  Pencil,
  Plus,
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
import { WorkspaceTabs } from "../../workspace/WorkspaceUI";
import { CollectedDataPanel } from "../../workspace/CollectedDataPanel";
import { Button, LoadingState } from "../../components/ui";
import {
  apiClient,
  type FrameworkNode,
  type FrameworkNodeInput,
  type Indicator,
  type IndicatorInput,
  type IndicatorMappingInput,
} from "../../services/apiClient";
import {
  calculations,
  FrameworkForm,
  IndicatorDefinitionForm,
  IndicatorMappingForm,
  inputClass,
  PeriodTargetsForm,
  units,
} from "./IndicatorForms";

const accents: Record<FrameworkNode["node_type"], string> = {
  goal: "#e4a52b",
  objective: "#137f91",
  outcome: "#e45865",
  output: "#289bae",
  activity: "#36b89e",
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
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["indicators", projectId] }),
      cache.invalidateQueries({ queryKey: ["results-framework", projectId] }),
      cache.invalidateQueries({ queryKey: ["indicator-period-targets"] }),
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
      setMapping(null);
      setError("");
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const unmap = useMutation({
    mutationFn: () => apiClient.deleteIndicatorMapping(mapping!.id),
    onSuccess: async () => {
      await refresh();
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
    mutationFn: (input: Array<{ period: string; target_value: number }>) =>
      apiClient.saveIndicatorPeriodTargets(periodTargets!.id, input),
    onSuccess: async () => {
      await refresh();
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
      <ul className="m-0 flex list-none items-start justify-center gap-5 p-0">
        {nodes
          .filter((node) => node.parent_id === parentId)
          .map((node) => (
            <li key={node.id} className="flex flex-col items-center">
              <div className="h-6 border-l border-[#8db9c0]" />
              <div
                className="w-[235px] border border-[#dce5e8] border-l-[3px] bg-white p-4 shadow-sm"
                style={{ borderLeftColor: accents[node.node_type] }}
              >
                <div className="mb-2 flex justify-between gap-3">
                  <span
                    className="text-[12px] font-semibold uppercase tracking-wide"
                    style={{ color: accents[node.node_type] }}
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
                <strong className="block text-xs leading-5 text-[#24434c]">
                  {node.title}
                </strong>
                <span className="mt-3 block text-[12px] text-[#73868d]">
                  {
                    items.filter((item) => item.framework_node_id === node.id)
                      .length
                  }{" "}
                  linked indicators
                </span>
                {node.node_type !== "activity" && (
                  <button
                    onClick={() => addNode(null, node.id)}
                    className="mt-3 flex w-full items-center justify-center gap-1 border-0 bg-[#edf5f5] py-1.5 text-[12px] text-[#0c8593]"
                  >
                    <Plus size={12} />
                    Add child result
                  </button>
                )}
              </div>
              {nodes.some((child) => child.parent_id === node.id) && (
                <>
                  <div className="h-5 border-l border-[#8db9c0]" />
                  <div className="border-t border-[#8db9c0]">
                    {tree(node.id)}
                  </div>
                </>
              )}
            </li>
          ))}
      </ul>
    );
  }

  if (loading || projects.isLoading) return <LoadingState />;
  return (
    <div className="space-y-5 text-[#24434c]">
      <Link
        to={projectId ? `/projects/${projectId}` : "/projects"}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#117e8f] no-underline hover:underline"
      >
        <ArrowLeft size={15} /> Back to project
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 mt-0 text-[12px] font-semibold uppercase tracking-[.16em] text-[#0c8593]">
            FieldSight / Monitoring & evaluation
          </p>
          <h1 className="m-0 text-[28px] font-semibold tracking-tight">
            Indicators
          </h1>
          <p className="mb-0 mt-1 text-[14px] text-[#73868d]">
            Connect project results to measurable evidence and targets.
          </p>
        </div>
        <Button disabled={!projectId || !org} onClick={() => editItem("new")}>
          <Plus size={15} />
          Add indicator
        </Button>
      </header>
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
            <div className="flex flex-wrap items-end gap-4 p-4">
              <label className="min-w-[220px] flex-1">
                <span className="mb-1.5 block text-[12px] uppercase tracking-wide text-[#73868d]">
                  Project
                </span>
                <select
                  aria-label="Project"
                  className={inputClass}
                  value={projectId}
                  onChange={(e) => {
                    workspace.selectProject(e.target.value);
                    navigate(
                      `/projects/${e.target.value}/indicators?view=${view}`,
                    );
                    setSelected("");
                    setError("");
                  }}
                >
                  {!project && (
                    <option value={projectId}>Project unavailable</option>
                  )}
                  {projects.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-[12px] uppercase tracking-wide text-[#73868d]">
                  Submitted from (UTC)
                </span>
                <input
                  aria-label="Submitted from"
                  type="date"
                  className={inputClass}
                  value={dateFrom}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[12px] uppercase tracking-wide text-[#73868d]">
                  Submitted through (UTC)
                </span>
                <input
                  aria-label="Submitted through"
                  type="date"
                  className={inputClass}
                  value={dateTo}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              {project && (
                <Link
                  to={`/projects/${project.id}`}
                  className="pb-2 text-xs text-[#0c8593] no-underline"
                >
                  Project overview →
                </Link>
              )}
            </div>
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
                  className={`flex shrink-0 items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-xs ${view === id ? "border-[#0c8593] font-semibold text-[#0c7180]" : "border-transparent text-[#73868d]"}`}
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
            <Notice error>{indicators.error.message}</Notice>
          )}
          {framework.error && <Notice error>{framework.error.message}</Notice>}
          {(dateFrom || dateTo) && (
            <Notice>
              Actuals use the selected submission window. Overall and
              reporting-period targets are not prorated.
            </Notice>
          )}
          {indicators.isLoading || framework.isLoading ? (
            <LoadingState />
          ) : (
            !invalidDates &&
            !indicators.error &&
            !framework.error && (
              <>
                {view === "framework" ? (
                  <Panel>
                    <div className="flex items-center justify-between gap-4 border-b border-[#e7edef] px-5 py-4">
                      <div>
                        <h2 className="m-0 text-sm">
                          Project results framework
                        </h2>
                        <p className="mb-0 mt-1 text-xs text-[#73868d]">
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
                      <div className="overflow-x-auto bg-[#eef3f4] px-8 py-10">
                        <div className="flex min-w-max flex-col items-center">
                          <div className="w-[235px] bg-[#126f82] px-5 py-4 text-center text-sm font-semibold text-white">
                            {project?.name ?? "Project"}
                            <span className="mt-1 block text-[12px] font-normal opacity-75">
                              Results framework
                            </span>
                          </div>
                          {tree(null)}
                        </div>
                      </div>
                    )}
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
                                <span className="mb-1.5 block text-[12px] uppercase text-[#73868d]">
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
                            <div className="flex border-t border-[#e7edef] px-4">
                              {[
                                "details",
                                "collected",
                                "summary",
                                "sources",
                              ].map((id) => (
                                <button
                                  key={id}
                                  onClick={() => setDetailsTab(id)}
                                  className={`border-0 border-b-2 bg-transparent px-4 py-3 text-xs capitalize ${detailsTab === id ? "border-[#0c8593] text-[#0c7180]" : "border-transparent text-[#73868d]"}`}
                                >
                                  {id === "collected"
                                    ? "Collected data"
                                    : id === "summary"
                                      ? "Results summary"
                                      : id === "sources"
                                        ? "Mapping & sources"
                                        : "Indicator details"}
                                </button>
                              ))}
                            </div>
                          </Panel>
                          {detailsTab === "collected" ? (
                            <CollectedDataPanel
                              indicator={selected}
                              onMap={() => editMap(selected)}
                            />
                          ) : detailsTab === "details" ? (
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
                              <div className="space-y-4 p-5 text-xs">
                                <Detail
                                  label="Source form"
                                  value={
                                    selected.source_form_id ?? "No form mapped"
                                  }
                                />
                                <Detail
                                  label="Source field"
                                  value={
                                    selected.mapping?.source_field ??
                                    "No question mapped"
                                  }
                                />
                                <Detail
                                  label="Calculation"
                                  value={
                                    selected.mapping
                                      ? calculations[
                                          selected.mapping.calculation
                                        ]
                                      : "Choose a calculation"
                                  }
                                />
                                <Detail
                                  label="Expected answer"
                                  value={
                                    selected.mapping?.match_value ??
                                    "Not required for this calculation"
                                  }
                                />
                                <Detail
                                  label="Mapping health"
                                  value={selected.mapping_health.replaceAll(
                                    "_",
                                    " ",
                                  )}
                                />
                                <p className="m-0 rounded-md bg-[#f0f8f6] p-4 leading-6 text-[#526d75]">
                                  {selected.calculation_note}
                                </p>
                                {selected.source_form_id && (
                                  <Link
                                    to={`/analytics?project_id=${projectId}`}
                                    className="inline-block text-[#0c8593]"
                                  >
                                    Open survey question explorer →
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
                          <div className="p-4">
                            <span className="text-[12px] uppercase tracking-wide text-[#73868d]">
                              {label}
                            </span>
                            <strong className="mt-2 block text-2xl font-semibold">
                              {value}
                            </strong>
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
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[940px] border-collapse text-left text-xs">
                            <thead className="bg-[#f8fbfb] text-[12px] font-medium uppercase tracking-wide text-[#73868d]">
                              <tr>
                                {[
                                  "Indicator",
                                  "Actual vs target",
                                  "Format",
                                  "Collection frequency",
                                  "Status",
                                  "Actions",
                                ].map((label) => (
                                  <th
                                    key={label}
                                    className="px-4 py-3 font-medium"
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            {groups.map((group) => (
                              <tbody key={group.id ?? "ungrouped"}>
                                <tr
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    const id =
                                      event.dataTransfer.getData("text/plain");
                                    if (items.some((item) => item.id === id))
                                      regroup.mutate({ id, group: group.id });
                                  }}
                                  className="border-y border-[#e7edef]"
                                  style={{
                                    backgroundColor: group.type
                                      ? `${accents[group.type]}12`
                                      : "#f6f8f8",
                                  }}
                                >
                                  <th
                                    colSpan={6}
                                    className="px-4 py-2.5 font-semibold"
                                  >
                                    <span
                                      className="border-l-[3px] pl-3"
                                      style={{
                                        borderColor: group.type
                                          ? accents[group.type]
                                          : "#9aaeb5",
                                        marginLeft: group.depth * 12,
                                      }}
                                    >
                                      {group.type
                                        ? `${group.type[0].toUpperCase() + group.type.slice(1)} · `
                                        : ""}
                                      {group.title}
                                      <span className="ml-3 text-[12px] font-normal text-[#73868d]">
                                        {
                                          items.filter(
                                            (item) =>
                                              item.framework_node_id ===
                                              group.id,
                                          ).length
                                        }
                                      </span>
                                    </span>
                                  </th>
                                </tr>
                                {items
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
                                      className="border-b border-[#edf1f2]"
                                    >
                                      <td className="max-w-[290px] px-4 py-4">
                                        <button
                                          onClick={() => showResult(item)}
                                          className="border-0 bg-transparent p-0 text-left font-medium leading-5 text-[#146578]"
                                        >
                                          {item.name}
                                        </button>
                                        <small className="mt-1 block text-[12px] text-[#8a9ba1]">
                                          {item.code}
                                        </small>
                                      </td>
                                      <td className="min-w-[230px] px-4 py-3">
                                        {item.unit === "text" ? (
                                          <span className="text-[#73868d]">
                                            {item.qualitative_value ??
                                              "Not reported"}
                                          </span>
                                        ) : (
                                          <Progress indicator={item} />
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        {units[item.unit]}
                                      </td>
                                      <td className="px-4 py-4">
                                        {frequency(item.reporting_frequency)}
                                      </td>
                                      <td className="px-4 py-4">
                                        <Status item={item} />
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="flex gap-2">
                                          <Icon
                                            label={`View results for ${item.name}`}
                                            onClick={() => showResult(item)}
                                          >
                                            <BarChart3 size={15} />
                                          </Icon>
                                          <Icon
                                            label={`Collected data for ${item.name}`}
                                            onClick={() => {
                                              showResult(item);
                                              setDetailsTab("collected");
                                            }}
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
      {editing && (
        <IndicatorDefinitionForm
          indicator={editing === "new" ? null : editing}
          nodes={nodes}
          error={error}
          saving={definition.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => definition.mutate(input)}
        />
      )}
      {mapping && (
        <IndicatorMappingForm
          indicator={mapping}
          projectId={projectId}
          error={error}
          saving={map.isPending || unmap.isPending}
          onClose={() => setMapping(null)}
          onSave={(input) => map.mutate(input)}
          onRemove={() => unmap.mutate()}
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
      {periodTargets && (
        <PeriodTargetsForm
          indicator={periodTargets}
          error={error}
          saving={targets.isPending}
          onClose={() => setPeriodTargets(null)}
          onSave={(input) => targets.mutate(input)}
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
      <p className="mb-5 mt-0 max-w-lg text-xs leading-6 text-[#73868d]">
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
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center border border-[#dce5e8] bg-white text-[#3f7a86] disabled:opacity-40"
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
    item.unit === "text" && item.qualitative_value
      ? "Result recorded"
      : item.mapping_health !== "healthy"
        ? item.mapping_health === "unmapped"
          ? "Not mapped"
          : "Check source"
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
      className={`inline-block rounded px-2 py-1 text-[12px] ${item.target_achieved ? "bg-[#e6f5ec] text-[#207554]" : item.schedule_status === "overdue" ? "bg-[#fff1e8] text-[#a9592c]" : "bg-[#eef4f5] text-[#55737c]"}`}
    >
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
          <div className="h-2 overflow-hidden bg-[#e3edf0]">
            <div
              className="h-full bg-[#20a8bd]"
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
              "No narrative recorded in this reporting window. Add a dated narrative under Collected data."}
          </p>
          <p className="text-xs text-[#87969d]">
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
      <Panel>
        <div className="grid grid-cols-3 gap-5 p-5 max-[700px]:grid-cols-1">
          <Detail
            label="Baseline"
            value={amount(indicator.baseline_value, indicator.unit)}
          />
          <div>
            <span className="mb-2 block text-[12px] uppercase tracking-wide text-[#8a9ba1]">
              Actual vs overall target
            </span>
            <Progress indicator={indicator} />
          </div>
          <div>
            <span className="mb-2 block text-[12px] uppercase tracking-wide text-[#8a9ba1]">
              Deadline · {indicator.target_date ?? "Not set"}
            </span>
            <Status item={indicator} />
          </div>
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">
        <Panel>
          <h3 className="m-0 border-b border-[#e7edef] px-5 py-4 text-sm font-medium">
            {frequency(indicator.reporting_frequency)} results
          </h3>
          <div className="max-h-[340px] overflow-auto">
            <table className="w-full min-w-[400px] border-collapse text-left text-xs">
              <thead className="bg-[#f8fbfb] text-[12px] uppercase text-[#8a9ba1]">
                <tr>
                  {["Period", "Target", "Actual", "Answered / eligible"].map(
                    (label) => (
                      <th key={label} className="px-4 py-3 font-medium">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {indicator.history.map((point) => (
                  <tr key={point.period} className="border-t border-[#edf1f2]">
                    <td className="px-4 py-3">{point.period}</td>
                    <td className="px-4 py-3">
                      {amount(point.target_value, indicator.unit)}
                    </td>
                    <td className="px-4 py-3 text-[#0c8593]">
                      {amount(point.value, indicator.unit)}
                      {point.target_achieved === true ? " ✓" : ""}
                    </td>
                    <td className="px-4 py-3">
                      {point.mapped_records} / {point.eligible_records}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!indicator.history.length && (
              <p className="p-6 text-center text-xs text-[#73868d]">
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
            <p className="p-12 text-center text-xs text-[#73868d]">
              Results appear after a source question has usable, ready
              submissions.
            </p>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-4 gap-3 max-[700px]:grid-cols-2">
        {[
          ["Numerator", indicator.numerator],
          ["Denominator", indicator.denominator],
          ["Missing answers", indicator.missing_records],
          ["Invalid answers", indicator.invalid_answers],
        ].map(([label, value]) => (
          <Panel key={label}>
            <div className="p-4">
              <span className="text-[12px] uppercase tracking-wide text-[#8a9ba1]">
                {label}
              </span>
              <strong className="mt-2 block text-xl font-semibold">
                {typeof value === "number" ? amount(value) : "Not reported"}
              </strong>
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
        <div className="border-t border-[#e7edef] bg-[#f8fbfb] px-5 py-4 text-[12px] leading-6 text-[#6f858d]">
          <strong>
            {indicator.eligible_records} ready submissions included;{" "}
            {indicator.quality_excluded_records} excluded by quality status.
          </strong>{" "}
          {indicator.calculation_note}
          <br />
          Form: {indicator.source_form_id ?? "Not mapped"} · Question:{" "}
          {indicator.mapping?.source_field ?? "Not mapped"}
        </div>
      </Panel>
    </div>
  );
}
