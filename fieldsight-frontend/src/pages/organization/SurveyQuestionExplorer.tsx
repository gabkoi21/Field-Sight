import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { WorkspaceTabs } from "../../workspace/WorkspaceUI";
import {
  Bookmark,
  ChevronDown,
  Database,
  Download,
  Filter,
  RefreshCw,
  Save,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { SurveyResultChart as ResultChart, SurveyResultsTable as ResultsTable, surveyChartTypes, defaultSurveyChart } from "../../components/charts/SurveyResultChart";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import {
  apiClient,
  type AnalysisQuery,
  type AnalysisResult,
  type SavedAnalysis,
} from "../../services/apiClient";
import { Button, LoadingSkeleton, LoadingState, MetricCard, PageHeader } from "../../components/ui";

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
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const projectId = routeProjectId ?? workspace.projectId;
  return <ProjectSurveyQuestionExplorer key={projectId} projectId={projectId} />;
}
function ProjectSurveyQuestionExplorer({ projectId }: { projectId: string }) {
  const { user, loading } = useAuth();
  const org = user?.memberships.find(
    (item) => item.role === "organization_admin",
  )?.organization_id;
  const cache = useQueryClient();
  const questionList = useRef<HTMLDivElement>(null);
  const selectedQuestion = useRef<HTMLButtonElement>(null);
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
  const project = projects.data?.find(item => item.id === projectId);
  const authorized = Boolean(!loading && org && project && projects.isSuccess);
  const catalogue = useQuery({
    queryKey: ["survey-fields", projectId, formState],
    queryFn: async () => {
      const current = await apiClient.surveyFields(projectId, formState);
      if (current.form_id && !current.fields.length) {
        try {
          const refreshed = await apiClient.surveyFields(projectId, current.form_id, true);
          void cache.invalidateQueries({queryKey: ["saved-analysis", projectId]});
          return refreshed;
        }
        catch (failure) { return {...current, warning: failure instanceof Error ? failure.message : "Unable to load current Kobo questions. Refresh Kobo fields to retry."}; }
      }
      return current;
    },
    enabled: authorized,
  });
  const isAdditionalComments = (item: {source_field: string; label: string}) =>
    /(^|\/)(remarks|additional_comments|comments)$/i.test(item.source_field) || /^additional comments\b/i.test(item.label);
  const fields = (catalogue.data?.fields ?? []).filter(item => item.source === "kobo").sort((left, right) =>
    Number(right.source === "kobo") - Number(left.source === "kobo") ||
    Number(isAdditionalComments(left)) - Number(isAdditionalComments(right)));

  const field = fieldState
    ? fields.find((item) => item.source_field === fieldState)
    : catalogue.data?.fields.find((item) => item.source === "kobo" && item.supported);
  useEffect(() => {
    const list = questionList.current, button = selectedQuestion.current;
    if (!list || !button) return;
    const listBounds = list.getBoundingClientRect(), buttonBounds = button.getBoundingClientRect();
    if (buttonBounds.top < listBounds.top) list.scrollTop += buttonBounds.top - listBounds.top;
    else if (buttonBounds.bottom > listBounds.bottom) list.scrollTop += buttonBounds.bottom - listBounds.bottom;
  }, [field?.source_field]);
  const categoricalGroup = field?.type === "text" ? fields.find(item => item.source_field === groupBy && item.type === "select_one" && item.supported) : undefined;
  // A categorical choice selected from a narrative view becomes the response question.
  // Never query comment text as the response dimension for this categorical view.
  useEffect(() => {
    if (!categoricalGroup) return;
    setField(categoricalGroup.source_field);
    setGroupBy(null);
    setMeasure("auto");
    setChart("pie");
    setFilters(current => ({...current, categories: []}));
  }, [categoricalGroup?.source_field]);
  const visibleFields = fields.filter(item => `${item.label} ${item.source_field}`.toLowerCase().includes(search.toLowerCase()));
  const fieldGroups = [{ label: "Kobo form questions", fields }];
  const formId = catalogue.data?.form_id ?? null;
  const activeFilterCount = [filters.date_from, filters.date_to, filters.location, filters.enumerator,
    filters.categories.length > 0, filters.review_status !== "ready", grain !== "day"].filter(Boolean).length;
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
      authorized &&
        projectId &&
        field?.supported &&
        catalogue.isSuccess &&
        !categoricalGroup &&
        !invalidDates,
    ),
  });
  const saved = useQuery({
    queryKey: ["saved-analysis", projectId],
    queryFn: () => apiClient.savedAnalyses(projectId),
    enabled: authorized,
  });
  const result = results.data;
  const requestedChart =
    chartState ?? defaultSurveyChart(field, groupBy);
  const charts = surveyChartTypes(field, groupBy);
  const chart: Chart = requestedChart === "donut" && charts.includes("pie") ? "donut" : charts.includes(requestedChart) ? requestedChart : charts[0];
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
      void cache.invalidateQueries({queryKey: ["saved-analysis", projectId]});
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
    if (view.query.project_id !== projectId) { setError("This visualization belongs to a different project."); return; }
    if (view.query.form_id !== catalogue.data?.form_id) { setError("This visualization does not use the current project form."); return; }
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
  if (org && projects.isSuccess && !project) return <Panel><Message error>Choose a project you have access to before exploring survey data.</Message><Link to="/projects" className="inline-flex min-h-11 items-center p-4 text-brand">Open projects</Link></Panel>;
  return (
    <div className="space-y-5 text-[#213e47]">
      <PageHeader eyebrow={`FieldSight / ${project?.name ?? "Project"}`} title="Explore & analyze" description="Ask a question of your field data. See the evidence behind every result.">
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
      {project && <WorkspaceTabs />}
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
                      {catalogue.data?.forms.filter(id => id === catalogue.data.form_id).map((id) => (
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
                      className={`flex items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-xs ${tab === value ? "border-[var(--fs-primary)] font-semibold text-[var(--fs-primary)]" : "border-transparent text-[var(--fs-muted)]"}`}
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
                    <div ref={questionList} className="max-h-[600px] overflow-y-auto p-2">
                      {visibleFields.map((item) => (
                        <div key={item.source_field}>
                          <button
                            key={item.source_field}
                            ref={item.source_field === field?.source_field ? selectedQuestion : undefined}
                            aria-current={item.source_field === field?.source_field ? "true" : undefined}
                            disabled={!item.supported}
                            title={
                              item.supported
                                ? item.source_field
                                : "Repeat groups require a separate repeat dataset"
                            }
                            onClick={() => selectField(item.source_field)}
                            className={`mb-1 block w-full border-0 px-3 py-3 text-left disabled:opacity-40 ${item.source_field === field?.source_field ? "bg-[var(--fs-primary)] text-white" : "bg-transparent text-slate-900 hover:bg-blue-50"}`}
                          >
                            <span className="block text-xs font-semibold leading-5">
                              {item.label}
                            </span>
                            <small className="mt-1 block text-[12px] uppercase tracking-wide opacity-65">
                              {item.type.replaceAll("_", " ")}
                              {!item.supported ? " · unavailable" : ""}
                            </small>
                          </button>
                        </div>
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
                          type="button"
                          aria-label="Filters"
                          aria-expanded={showFilters}
                          aria-controls="survey-result-filters"
                          className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${showFilters ? "border-[var(--fs-primary)] bg-[var(--fs-primary)] text-white" : "border-[var(--fs-border)] bg-white text-[var(--fs-primary)] hover:bg-blue-50"}`}
                        >
                          <Filter size={15} aria-hidden="true" />
                          Filters
                          {activeFilterCount > 0 && <span className={`rounded px-1.5 py-0.5 text-[11px] ${showFilters ? "bg-white/20" : "bg-blue-50"}`} aria-hidden="true">{activeFilterCount}</span>}
                          <ChevronDown size={14} aria-hidden="true" className={showFilters ? "rotate-180" : ""} />
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
                            value={field?.source_field ?? ""}
                            onChange={(event) => selectField(event.target.value)}
                          >
                            <option value="" disabled>Select a question</option>
                            {fieldGroups.map(group => {
                              const options = group.fields.filter(item => item.supported);
                              return options.length ? <optgroup key={group.label} label={group.label}>{options.map(item => <option key={item.source_field} value={item.source_field}>{item.label}</option>)}</optgroup> : null;
                            })}
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
                        <div id="survey-result-filters" role="region" aria-label="Survey filters" className="space-y-3 border-t border-[var(--fs-border)] bg-[#fcfdff] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-[var(--fs-muted)]">Submission dates in UTC</span>
                            <button type="button" disabled={!activeFilterCount} onClick={() => { setFilters(initialFilters); setGrain("day"); }} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--fs-primary)] bg-[var(--fs-primary)] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--fs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-primary)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"><RefreshCw size={13} aria-hidden="true" />Clear all</button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2 xl:grid-cols-4">
                          <Field label="From">
                            <input
                              type="date"
                              className={control}
                              value={filters.date_from ?? ""}
                              onChange={(event) =>
                                filter("date_from", event.target.value || null)
                              }
                            />
                          </Field>
                          <Field label="To">
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
                            <Field label="Answers">
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
                            <Field label="Interval">
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
                          </div>
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
                            <MetricCard key={label} label={String(label)} value={format(Number(value))} icon={Database} />
                          ))}
                        </div>
                        <Panel>
                          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-[#e7edef] px-5 py-4">
                            {field?.type === "number" && <h3 className="m-0 mr-auto text-sm">{result.measure}: {format(result.value)}</h3>}
                            <div
                              className="flex gap-1"
                              role="group"
                              aria-label="Visualization type"
                            >
                              {charts.map((type) => (
                                <button
                                  key={type}
                                  aria-pressed={chart === type || (chart === "donut" && type === "pie")}
                                  onClick={() => setChart(type)}
                                  className={`min-h-9 rounded-md border px-4 py-1 text-xs capitalize ${chart === type || (chart === "donut" && type === "pie") ? "border-[var(--fs-primary)] bg-[var(--fs-primary)] text-white" : "border-[var(--fs-border)] bg-white text-[var(--fs-muted)] hover:bg-blue-50"}`}
                                >
                                  {type === "pie" ? "Doughnut" : type}
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
