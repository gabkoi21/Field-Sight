import { useEffect, useState, type ReactNode, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bookmark,
  Database,
  Download,
  Filter,
  RefreshCw,
  Save,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import {
  apiClient,
  type AnalysisQuery,
  type AnalysisResult,
  type SavedAnalysis,
} from "../../services/apiClient";
import { Button, LoadingSkeleton, LoadingState, PageHeader } from "../../components/ui";

import { controlClass } from "../../components/ui/controlStyles";

const control = controlClass;
const initialFilters: AnalysisQuery["filters"] = {
  date_from: null,
  date_to: null,
  location: null,
  enumerator: null,
  review_status: "ready",
  categories: [],
};
type Chart = SavedAnalysis["chart"];
const format = (value: number | null | undefined) =>
  value == null
    ? "Not reported"
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function SurveyQuestionExplorer() {
  const workspace = useWorkspace();
  const { user, loading } = useAuth();
  const org = user?.memberships.find(
    (item) => item.role === "organization_admin",
  )?.organization_id;
  const cache = useQueryClient();
  const projectState = workspace.projectId;
  const setProject = workspace.selectProject;
  const [formState, setForm] = useState<string | null>(null);
  const [fieldState, setField] = useState("");
  const [search, setSearch] = useState("");
  const [measure, setMeasure] = useState<AnalysisQuery["measure"]>("auto");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [grain, setGrain] = useState<AnalysisQuery["time_grain"]>("day");
  const [filters, setFilters] = useState(initialFilters);
  const [chartState, setChart] = useState<Chart | null>(null);
  const [tab, setTab] = useState("explore");
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const projects = useQuery({
    queryKey: ["organization-projects", org],
    queryFn: () => apiClient.organizationProjects(org!),
    enabled: Boolean(org),
  });
  const projectId = projects.data?.some((item) => item.id === projectState)
    ? projectState
    : workspace.projectId;
  useEffect(() => {
    setForm(null);
    setField("");
    setGroupBy(null);
    setFilters(initialFilters);
    setError("");
    setNotice("");
  }, [projectId]);
  const catalogue = useQuery({
    queryKey: ["survey-fields", projectId, formState],
    queryFn: () => apiClient.surveyFields(projectId, formState),
    enabled: Boolean(org && projectId),
  });
  const fields = catalogue.data?.fields ?? [];
  const field = fieldState
    ? fields.find((item) => item.source_field === fieldState)
    : fields.find((item) => item.supported);
  const formId = catalogue.data?.form_id ?? null;
  const invalidDates = Boolean(
    filters.date_from && filters.date_to && filters.date_from > filters.date_to,
  );
  const query: AnalysisQuery = {
    project_id: projectId,
    form_id: formId,
    source_field: field?.source_field ?? "",
    measure,
    group_by: groupBy,
    time_grain: grain,
    filters,
  };
  const results = useQuery({
    queryKey: ["survey-analysis", query, catalogue.dataUpdatedAt],
    queryFn: () => apiClient.queryAnalysis(query),
    enabled: Boolean(
      org &&
        projectId &&
        field?.supported &&
        catalogue.isSuccess &&
        !invalidDates,
    ),
  });
  const saved = useQuery({
    queryKey: ["saved-analysis", projectId],
    queryFn: () => apiClient.savedAnalyses(projectId),
    enabled: Boolean(org && projectId),
  });
  const result = results.data;
  const requestedChart =
    chartState ?? (field?.type === "date" && !groupBy ? "line" : "bar");
  const chart =
    requestedChart === "donut" &&
    (groupBy ||
      field?.type === "select_multiple" ||
      field?.type === "number" ||
      field?.type === "date")
      ? "bar"
      : requestedChart === "line" && (field?.type !== "date" || groupBy)
        ? "bar"
        : requestedChart;
  const charts: Chart[] = [
    "bar",
    ...(field?.type === "date" && !groupBy ? ["line" as const] : []),
    ...(!groupBy &&
    field?.type !== "select_multiple" &&
    field?.type !== "number" &&
    field?.type !== "date"
      ? ["donut" as const]
      : []),
    "table",
  ];
  function dialogKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setSaving(false);
    }
    if (event.key !== "Tab") return;
    const targets = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "input, button:not([disabled])",
      ),
    );
    const first = targets[0],
      last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  const refresh = useMutation({
    mutationFn: () => apiClient.surveyFields(projectId, formId, true),
    onSuccess: (data) => {
      cache.setQueryData(["survey-fields", projectId, formState], data);
      setNotice(data.warning ?? "Kobo question metadata refreshed.");
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const save = useMutation({
    mutationFn: () =>
      apiClient.saveAnalysis({ title: title.trim(), query, chart }),
    onSuccess: async () => {
      await cache.invalidateQueries({
        queryKey: ["saved-analysis", projectId],
      });
      setSaving(false);
      setNotice("Visualization saved. Reopen it from Saved visualizations.");
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const remove = useMutation({
    mutationFn: apiClient.deleteSavedAnalysis,
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["saved-analysis", projectId] }),
    onError: (cause: Error) => setError(cause.message),
  });
  const download = useMutation({
    mutationFn: () => apiClient.exportAnalysis(query),
    onSuccess: (csv) => {
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "fieldsight-analysis.csv";
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (cause: Error) => setError(cause.message),
  });
  function selectField(value: string) {
    setField(value);
    setMeasure("auto");
    setGroupBy(null);
    setChart(null);
    setFilters((current) => ({ ...current, categories: [] }));
  }
  function filter<K extends keyof AnalysisQuery["filters"]>(
    key: K,
    value: AnalysisQuery["filters"][K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function open(view: SavedAnalysis) {
    setProject(view.query.project_id);
    setForm(view.query.form_id);
    setField(view.query.source_field);
    setMeasure(view.query.measure);
    setGroupBy(view.query.group_by);
    setGrain(view.query.time_grain);
    setFilters(view.query.filters);
    setChart(view.chart);
    setTab("explore");
    setNotice(`Viewing ${view.title}`);
  }

  if (loading || projects.isLoading) return <LoadingState variant="panel" label="Loading analysis sources…" />;
  return (
    <div className="space-y-5 text-[#213e47]">
      <PageHeader eyebrow={`FieldSight / ${workspace.project?.name ?? "Project"}`} title="Explore & analyze" description="Ask a question of your field data. See the evidence behind every result.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={
              !result ||
              results.isFetching ||
              invalidDates ||
              download.isPending
            }
            onClick={() => {
              setError("");
              download.mutate();
            }}
          >
            <Download size={14} />
            {download.isPending ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            disabled={!result || results.isFetching || invalidDates}
            onClick={() => {
              setTitle(field?.label ?? "");
              setSaving(true);
              setError("");
            }}
          >
            <Save size={14} />
            Save visualization
          </Button>
        </div>
      </PageHeader>
      {!org ? (
        <Panel>
          <div className="p-12 text-center">
            <Database className="mx-auto text-[#0c8593]" size={30} />
            <h2 className="text-lg">Connect to your project data</h2>
            <p className="text-sm text-[var(--fs-muted)]">
              Sign in with an organization administrator account to explore
              synchronized survey answers.
            </p>
            <Link
              to="/sign-in"
              className="inline-block rounded-md bg-[#0c8593] px-5 py-2.5 text-sm font-semibold text-white no-underline"
            >
              Sign in to load data
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          {projects.error && <Message error>{projects.error.message}</Message>}
          {!projects.isError && !projects.data?.length && (
            <Panel>
              <div className="p-10 text-center">
                <h2 className="text-lg">Your analysis starts with a project</h2>
                <p className="text-sm text-[var(--fs-muted)]">
                  Create a project, assign a Kobo form, and sync its
                  submissions.
                </p>
                <Link
                  to="/projects"
                  className="text-sm font-semibold text-[#0c8593]"
                >
                  Open projects →
                </Link>
              </div>
            </Panel>
          )}
          {projectId && (
            <>
              <Panel>
                <div className="flex flex-wrap items-end gap-4 p-4">
                  <Field label="Survey form">
                    <select
                      className={control}
                      value={formId ?? ""}
                      onChange={(event) => {
                        setForm(event.target.value);
                        selectField("");
                        setFilters(initialFilters);
                      }}
                    >
                      {!catalogue.data?.forms.length && (
                        <option value="">No form</option>
                      )}
                      {catalogue.data?.forms.map((id) => (
                        <option key={id} value={id}>
                          {id === formId && catalogue.data?.form_name
                            ? `${catalogue.data.form_name} (${id})`
                            : id}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    disabled={!formId || refresh.isPending}
                    onClick={() => {
                      setError("");
                      refresh.mutate();
                    }}
                    className="inline-flex items-center gap-2 border border-[#dce5e8] bg-white px-3 py-2 text-xs text-[#0c7180] disabled:opacity-40"
                  >
                    <RefreshCw size={14} />
                    {refresh.isPending ? "Refreshing…" : "Refresh Kobo fields"}
                  </button>
                </div>
                <nav
                  className="flex border-t border-[#e7edef] px-4"
                  aria-label="Analysis project"
                >
                  {["explore", "saved"].map((value) => (
                    <button
                      key={value}
                      onClick={() => setTab(value)}
                      className={`flex items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-xs ${tab === value ? "border-[#0c8593] font-semibold text-[#0c7180]" : "border-transparent text-[var(--fs-muted)]"}`}
                    >
                      <Bookmark size={14} />
                      {value === "explore"
                        ? "Question explorer"
                        : `Saved visualizations (${saved.data?.length ?? 0})`}
                    </button>
                  ))}
                </nav>
              </Panel>
              {error && <Message error>{error}</Message>}
              {notice && <Message>{notice}</Message>}
              {catalogue.error && (
                <Message error>{catalogue.error.message}</Message>
              )}
              {catalogue.data?.warning && (
                <Message>{catalogue.data.warning}</Message>
              )}
              {fieldState && catalogue.isSuccess && !field && (
                <Message error>
                  The saved question is no longer available in this form. Choose
                  another question.
                </Message>
              )}
              {tab === "saved" ? (
                <Panel>
                  <h2 className="m-0 border-b border-[#e7edef] px-5 py-4 text-sm">
                    Saved visualizations
                  </h2>
                  {saved.isLoading ? (
                    <LoadingState variant="panel" label="Loading analysis sources…" />
                  ) : saved.error ? (
                    <Message error>{saved.error.message}</Message>
                  ) : !saved.data?.length ? (
                    <p className="p-10 text-center text-sm text-[var(--fs-muted)]">
                      Save a question's chart, calculation and filters to reopen
                      them here.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#e7edef]">
                      {saved.data.map((view) => (
                        <div
                          key={view.id}
                          className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <button
                            onClick={() => open(view)}
                            className="border-0 bg-transparent text-left"
                          >
                            <strong className="block text-sm text-[#24434c]">
                              {view.title}
                            </strong>
                            <span className="text-xs text-[var(--fs-muted)]">
                              {view.chart} · {view.query.source_field}
                            </span>
                          </button>
                          <button
                            aria-label={`Delete ${view.title}`}
                            disabled={remove.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete saved visualization “${view.title}”?`,
                                )
                              )
                                remove.mutate(view.id);
                            }}
                            className="border-0 bg-transparent p-2 text-[var(--fs-muted)]"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              ) : catalogue.isLoading ? (
                <LoadingState variant="panel" label="Loading analysis sources…" />
              ) : (
                <div className="grid grid-cols-[240px_minmax(0,1fr)] items-start gap-4 max-[1000px]:grid-cols-1">
                  <Panel>
                    <div className="border-b border-[#e7edef] p-4">
                      <h2 className="m-0 text-sm font-semibold">
                        Survey questions
                      </h2>
                      <label className="relative mt-3 block">
                        <span className="sr-only">Search questions</span>
                        <Search
                          className="absolute left-2.5 top-2.5 text-[#91a1a6]"
                          size={14}
                        />
                        <input
                          className={`${control} pl-8`}
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Find a question…"
                        />
                      </label>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto p-2">
                      {fields
                        .filter((item) =>
                          `${item.label} ${item.source_field}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((item) => (
                          <button
                            key={item.source_field}
                            disabled={!item.supported}
                            title={
                              item.supported
                                ? item.source_field
                                : "Repeat groups require a separate repeat dataset"
                            }
                            onClick={() => selectField(item.source_field)}
                            className={`mb-1 block w-full border-0 px-3 py-3 text-left disabled:opacity-40 ${item.source_field === field?.source_field ? "bg-[#e8f5f3] text-[#086f7d]" : "bg-transparent text-[#4f6871] hover:bg-[#f4f8f8]"}`}
                          >
                            <span className="block text-xs font-medium leading-5">
                              {item.label}
                            </span>
                            <small className="mt-1 block text-[12px] uppercase tracking-wide opacity-65">
                              {item.type.replaceAll("_", " ")}
                              {!item.supported ? " · unavailable" : ""}
                            </small>
                          </button>
                        ))}
                      {!fields.length && (
                        <p className="px-3 text-xs leading-5 text-[var(--fs-muted)]">
                          No questions yet. Refresh the Kobo fields or sync
                          submissions to begin.
                        </p>
                      )}
                    </div>
                  </Panel>
                  <div className="min-w-0 space-y-4">
                    <Panel>
                      <div className="flex items-center justify-between gap-4 border-b border-[#e7edef] px-5 py-4">
                        <div>
                          <h2 className="m-0 text-sm font-semibold">
                            {field?.label ?? "Choose a question"}
                          </h2>
                          <p className="mb-0 mt-1 text-[12px] text-[var(--fs-muted)]">
                            {field?.source_field ?? ""}
                          </p>
                        </div>
                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          aria-expanded={showFilters}
                          className="flex items-center gap-2 border-0 bg-transparent text-xs text-[#0c8593]"
                        >
                          <Filter size={14} />
                          Filters
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3 p-4 max-[700px]:grid-cols-1">
                        <Field label="Calculation">
                          <select
                            className={control}
                            value={measure}
                            onChange={(event) =>
                              setMeasure(
                                event.target.value as AnalysisQuery["measure"],
                              )
                            }
                          >
                            <option value="auto">Recommended</option>
                            <option value="count">
                              Count answered records
                            </option>
                            {field?.type === "number" && (
                              <>
                                <option value="sum">Sum</option>
                                <option value="average">Average</option>
                                <option value="min">Minimum</option>
                                <option value="max">Maximum</option>
                              </>
                            )}
                          </select>
                        </Field>
                        <Field label="Disaggregate by">
                          <select
                            className={control}
                            value={groupBy ?? ""}
                            onChange={(event) =>
                              setGroupBy(event.target.value || null)
                            }
                          >
                            <option value="">No disaggregation</option>
                            {fields
                              .filter(
                                (item) =>
                                  item.supported &&
                                  item.source_field !== field?.source_field,
                              )
                              .map((item) => (
                                <option
                                  key={item.source_field}
                                  value={item.source_field}
                                >
                                  {item.label}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field label="Review status">
                          <select
                            className={control}
                            value={filters.review_status}
                            onChange={(event) =>
                              filter(
                                "review_status",
                                event.target
                                  .value as AnalysisQuery["filters"]["review_status"],
                              )
                            }
                          >
                            <option value="ready">Ready only</option>
                            <option value="needs_review">
                              Needs review only
                            </option>
                            <option value="invalid">Invalid only</option>
                            <option value="all">All statuses</option>
                          </select>
                        </Field>
                      </div>
                      {showFilters && (
                        <div className="grid grid-cols-2 gap-3 border-t border-[#e7edef] bg-[#f8fbfb] p-4 max-[700px]:grid-cols-1">
                          <Field label="Submitted from (UTC)">
                            <input
                              type="date"
                              className={control}
                              value={filters.date_from ?? ""}
                              onChange={(event) =>
                                filter("date_from", event.target.value || null)
                              }
                            />
                          </Field>
                          <Field label="Submitted through (UTC)">
                            <input
                              type="date"
                              className={control}
                              value={filters.date_to ?? ""}
                              onChange={(event) =>
                                filter("date_to", event.target.value || null)
                              }
                            />
                          </Field>
                          <Field label="Location">
                            <select
                              className={control}
                              value={filters.location ?? ""}
                              onChange={(event) =>
                                filter("location", event.target.value || null)
                              }
                            >
                              <option value="">All locations</option>
                              {catalogue.data?.locations.map((value) => (
                                <option key={value}>{value}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Enumerator">
                            <select
                              className={control}
                              value={filters.enumerator ?? ""}
                              onChange={(event) =>
                                filter("enumerator", event.target.value || null)
                              }
                            >
                              <option value="">All enumerators</option>
                              {catalogue.data?.enumerators.map((value) => (
                                <option key={value}>{value}</option>
                              ))}
                            </select>
                          </Field>
                          {field?.choices.length ? (
                            <Field label="Include any selected answer">
                              <select
                                multiple
                                className={`${control} min-h-20`}
                                value={filters.categories}
                                onChange={(event) =>
                                  filter(
                                    "categories",
                                    Array.from(
                                      event.target.selectedOptions,
                                      (option) => option.value,
                                    ),
                                  )
                                }
                              >
                                {field.choices.map((choice) => (
                                  <option
                                    key={choice.value}
                                    value={choice.value}
                                  >
                                    {choice.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ) : null}
                          {field?.type === "date" && (
                            <Field label="Time interval">
                              <select
                                className={control}
                                value={grain}
                                onChange={(event) =>
                                  setGrain(
                                    event.target
                                      .value as AnalysisQuery["time_grain"],
                                  )
                                }
                              >
                                <option value="day">Day</option>
                                <option value="month">Month</option>
                                <option value="year">Year</option>
                              </select>
                            </Field>
                          )}
                          <button
                            onClick={() => setFilters(initialFilters)}
                            className="justify-self-start border-0 bg-transparent py-2 text-xs text-[#0c8593]"
                          >
                            Reset filters
                          </button>
                        </div>
                      )}
                    </Panel>
                    {invalidDates && (
                      <Message error>
                        Start date must be on or before end date.
                      </Message>
                    )}
                    {results.error && (
                      <Message error>{results.error.message} <button className="min-h-11 px-3 font-semibold underline" onClick={() => void results.refetch()}>Retry results</button></Message>
                    )}
                    {results.isFetching && result && <LoadingState variant="inline" label="Updating results…" />}
                    {results.isLoading ? (
                      <LoadingSkeleton layout="chart" label="Calculating survey results…" />
                    ) : result && !invalidDates ? (
                      <>
                        <div className="grid grid-cols-4 gap-3 max-[700px]:grid-cols-2">
                          {[
                            ["Eligible records", result.eligible_records],
                            ["Answered", result.answered_records],
                            ["Missing", result.missing_records],
                            ["Invalid answers", result.invalid_answers],
                          ].map(([label, value]) => (
                            <Panel key={label}>
                              <div className="p-4">
                                <small className="text-[12px] uppercase tracking-wide text-[var(--fs-muted)]">
                                  {label}
                                </small>
                                <strong className="mt-2 block text-2xl font-semibold">
                                  {format(Number(value))}
                                </strong>
                              </div>
                            </Panel>
                          ))}
                        </div>
                        <Panel>
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edef] px-5 py-4">
                            <div>
                              <h3 className="m-0 text-sm">
                                {field?.type === "number"
                                  ? `${result.measure}: ${format(result.value)}`
                                  : "Response distribution"}
                              </h3>
                              <small className="text-[12px] text-[var(--fs-muted)]">
                                {result.total_records.toLocaleString()} source
                                records · Review status:{" "}
                                {filters.review_status.replaceAll("_", " ")}
                              </small>
                            </div>
                            <div
                              className="flex gap-1"
                              role="group"
                              aria-label="Visualization type"
                            >
                              {charts.map((type) => (
                                <button
                                  key={type}
                                  aria-pressed={chart === type}
                                  onClick={() => setChart(type)}
                                  className={`border px-2 py-1.5 text-[12px] capitalize ${chart === type ? "border-[#0c8593] bg-[#e8f5f3] text-[#08717c]" : "border-[#e0e8eb] bg-white text-[var(--fs-muted)]"}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>
                          {!result.answered_records ? (
                            <div className="p-12 text-center">
                              <Database
                                className="mx-auto text-[#a5b8bd]"
                                size={28}
                              />
                              <h3 className="text-sm">
                                No usable answers in this selection
                              </h3>
                              <p className="text-xs text-[var(--fs-muted)]">
                                Adjust filters, select another question, or sync
                                project data. Missing responses are never
                                treated as zero.
                              </p>
                            </div>
                          ) : chart === "table" ? (
                            <ResultsTable result={result} />
                          ) : (
                            <div aria-busy={results.isFetching} className="h-[330px] px-3 py-6">
                              <ResultChart result={result} chart={chart} />
                            </div>
                          )}
                          <div className="border-t border-[#e7edef] bg-[#f8fbfb] px-5 py-3 text-[12px] leading-5 text-[var(--fs-muted)]">
                            <strong className="text-[#3d5962]">
                              Denominator: {result.denominator.toLocaleString()}{" "}
                              answered submissions.
                            </strong>{" "}
                            {result.note}
                            <br />
                            Calculated{" "}
                            {new Date(result.generated_at).toLocaleString()}
                            {catalogue.data?.form_version
                              ? ` · Form version ${catalogue.data.form_version}`
                              : ""}
                          </div>
                        </Panel>
                        {chart !== "table" && (
                          <Panel>
                            <h3 className="m-0 flex items-center gap-2 border-b border-[#e7edef] px-5 py-4 text-sm">
                              <Table2 size={15} />
                              Results summary
                            </h3>
                            <ResultsTable result={result} />
                          </Panel>
                        )}
                      </>
                    ) : (
                      !results.error &&
                      !invalidDates && (
                        <Panel>
                          <p className="p-8 text-center text-sm text-[var(--fs-muted)]">
                            Select a question to see its results.
                          </p>
                        </Panel>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {saving && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#12313c]/35 p-5"
          onKeyDown={dialogKey}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-analysis-title"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim()) save.mutate();
            }}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id="save-analysis-title" className="m-0 mb-4 text-lg">
              Save visualization
            </h2>
            <Field label="Title">
              <input
                autoFocus
                required
                maxLength={200}
                className={control}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <p className="text-xs leading-5 text-[var(--fs-muted)]">
              Your question, filters and chart are saved for this project.
              Reopening uses the latest synchronized data.
            </p>
            {error && <Message error>{error}</Message>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSaving(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
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
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wide text-[var(--fs-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-xs leading-5 ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#dcebe9] bg-[#f0f8f6] text-[#486c6f]"}`}
    >
      {children}
    </div>
  );
}
function ResultsTable({ result }: { result: AnalysisResult }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-[#f8fbfb] text-[12px] uppercase tracking-wide text-[var(--fs-muted)]">
          <tr>
            {[
              "Response / period",
              ...(result.group_by ? ["Group"] : []),
              "Value",
              "Records",
              "% answered",
            ].map((label) => (
              <th key={label} className="px-5 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.series.map((point, index) => (
            <tr key={index} className="border-t border-[#edf1f2]">
              <td className="px-5 py-3 text-[#246170]">{point.name}</td>
              {result.group_by && <td className="px-5 py-3">{point.group}</td>}
              <td className="px-5 py-3 font-medium">{format(point.value)}</td>
              <td className="px-5 py-3">{format(point.count)}</td>
              <td className="px-5 py-3">
                {point.percent == null ? "—" : `${format(point.percent)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ResultChart({
  result,
  chart,
}: {
  result: AnalysisResult;
  chart: Chart;
}) {
  const data = result.series.map((point) => ({
    ...point,
    label: point.group ? `${point.name} · ${point.group}` : point.name,
  }));
  if (data.length > 60)
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-[var(--fs-muted)]">
        This result has {data.length} categories. Use the table or narrow your
        filters to chart up to 60 categories.
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height="100%">
      {chart === "donut" ? (
        <PieChart>
          <Pie
            isAnimationActive={false}
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={65}
            outerRadius={108}
          >
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={
                  ["#0c8593", "#27b7a0", "#91d5cc", "#efb849", "#7895b2"][
                    index % 5
                  ]
                }
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      ) : chart === "line" ? (
        <LineChart data={data} margin={{ left: 5, right: 20, bottom: 25 }}>
          <CartesianGrid vertical={false} stroke="#e9eff0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line
            isAnimationActive={false}
            dataKey="value"
            name={result.measure}
            stroke="#0c8593"
            strokeWidth={2}
            connectNulls={false}
          />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ left: 5, right: 20, bottom: 35 }}>
          <CartesianGrid vertical={false} stroke="#e9eff0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar
            isAnimationActive={false}
            dataKey="value"
            name={result.measure}
            fill="#0c8593"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
