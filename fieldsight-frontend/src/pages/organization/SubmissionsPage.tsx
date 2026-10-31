import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  MapPin,
  Search,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useProjectSearchParams as useSearchParams } from "../../workspace/projectRouting";
import { PageHeader } from "../../components/ui/PageHeader";
import { controlClass } from "../../components/ui/controlStyles";
import { LoadingSkeleton, LoadingState, MetricCard } from "../../components/ui";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, type ApiSubmission } from "../../services/apiClient";
import { SubmissionReview } from "./SubmissionReview";
import { formatLocation } from "../../utils/location";
import { useProjectQueryId, useSelectProjectFilter } from "../../workspace/projectRouting";

type ExportPeriod = "daily" | "weekly" | "biweekly" | "monthly";
type Row = {
  id: string;
  internalId: string;
  review: string;
  concern: boolean;
  projectId: string;
  enumerator: string;
  location: string;
  submitted: string;
  submittedAt: string | null;
  project: string;
  form: string;
  sync: "Synced" | "Pending";
  device: string;
};

function toRow(submission: ApiSubmission): Row {
  return {
    id: submission.external_id,
    internalId: submission.id,
    review: submission.review_status ?? "Not recorded",
    concern: Boolean(submission.review_required || submission.validation_status === "invalid"),
    projectId: submission.project_id,
    enumerator: submission.enumerator ?? "Unassigned",
    location: formatLocation(submission.location),
    submitted: submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "Not recorded",
    submittedAt: submission.submitted_at,
    project: submission.project_name,
    form: submission.form_name ?? "Kobo form",
    sync: "Synced",
    device: "Kobo Collect",
  };
}
const selectClass = controlClass + " w-auto max-w-full";

export function SubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const organizationId = user?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(!authLoading && organizationId),
  });
  const query = searchParams.get("search") ?? "";
  const setQuery = (value: string) => { const params = new URLSearchParams(searchParams); if (value) params.set("search", value); else params.delete("search"); setSearchParams(params, { replace: true }); };
  const queryProjectId = useProjectQueryId();
  const projectId = queryProjectId ?? "";
  const setProjectId = useSelectProjectFilter();
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("daily");
  const [selected, setSelected] = useState<string | null>(null);
  const reviewStatus = searchParams.get("review_status") ?? "";
  const scope = JSON.stringify([organizationId, projectId, query, reviewStatus]);
  const [pagination, setPagination] = useState({ scope, page: 1 });
  const currentPage = pagination.scope === scope ? pagination.page : 1;
  const setCurrentPage = (value: number | ((page: number) => number)) => setPagination(previous => ({ scope, page: typeof value === "function" ? value(previous.scope === scope ? previous.page : 1) : value }));
  useEffect(() => { setSelected(searchParams.get("submission_id")); setPagination(previous => previous.scope === scope ? previous : { scope, page: 1 }); }, [scope, searchParams.get("submission_id")]);
  const pageSize = 10;
  const params = new URLSearchParams({ offset: String((currentPage - 1) * pageSize), limit: String(pageSize), search: query });
  if (projectId) params.set("project_id", projectId);
  if (reviewStatus) params.set("review_status", reviewStatus);
  const scopeResolved = queryProjectId !== "";
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["submissions", "page", params.toString()], queryFn: () => apiClient.submissionPage(params), enabled: !authLoading && scopeResolved });
  const rows: Row[] = (data?.items ?? []).map(toRow);
  const total = data?.total ?? 0;
  const counts = data?.counts ?? {};

  const projects = useMemo(
    () => [...(projectsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [projectsQuery.data],
  );
  const selectedProjectName = projects.find((item) => item.id === projectId)?.name ?? "All projects";
  const visible = rows;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const outOfRange = Boolean(data && currentPage > totalPages);
  useEffect(() => {
    if (outOfRange) { setCurrentPage(totalPages); setSelected(null); }
  }, [outOfRange, totalPages, scope]);
  const activePage = currentPage;
  const paginatedRows = rows;
  const pageNumbers: Array<number | string> = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (activePage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", activePage - 1, activePage, activePage + 1, "...", totalPages];
  }, [totalPages, activePage]);
  const firstVisibleRow = visible.length ? (activePage - 1) * pageSize + 1 : 0;
  const lastVisibleRow = Math.min(activePage * pageSize, total);

  const csvExport = useMutation({
    mutationFn: () => {
      const exportParams = new URLSearchParams(params);
      exportParams.delete("offset"); exportParams.delete("limit");
      const periodDays: Record<ExportPeriod, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
      const now = new Date();
      const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - periodDays[exportPeriod] + 1));
      exportParams.set("date_from", cutoff.toISOString());
      exportParams.set("date_to", now.toISOString());
      return apiClient.exportSubmissionsCsv(exportParams);
    },
    onSuccess: csv => {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `fieldsight-${exportPeriod}-submissions.csv`;
      link.click(); URL.revokeObjectURL(url);
    },
  });
  const exportCsv = () => csvExport.mutate();


  return (
    <div className="text-[#25324a]">
      {error && <p role="alert">Unable to load submissions: {error.message} <button className="min-h-11 px-3 font-semibold underline" onClick={() => void refetch()}>Retry submissions</button></p>}
      {csvExport.error && <p role="alert">Unable to export: {csvExport.error.message}</p>}
      <p className="text-xs">Exports include every matching submission across all pages, filtered by the selected project, search and UTC period.</p>
      <div className="mb-6"><PageHeader eyebrow="FieldSight / Data collection" title="Submissions" description="Browse every completed form sent from your field teams and connected sources." /></div>

      {(isLoading || authLoading) ? <div className="mb-5"><LoadingSkeleton layout="metrics" metricCount={3} announce={false} label="Loading submission counts…" /></div> : data && <section className="mb-[18px] grid grid-cols-1 gap-[14px]">
        <MetricCard label="All submissions" value={Object.values(counts).reduce((sum, n) => sum + n, 0)} context={projectId ? `For ${selectedProjectName}` : "Across active organization projects"} icon={Database} />
      </section>}

      <div className="mt-[16px] grid grid-cols-[minmax(280px,1fr)_minmax(210px,260px)_minmax(130px,160px)_minmax(130px,auto)] items-center gap-[10px] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <label className="flex min-w-0 w-full items-center gap-2 rounded-lg border border-[var(--fs-control-border)] bg-white px-3 text-[var(--fs-muted)] focus-within:ring-2 focus-within:ring-brand">
          <Search size={16} />
          <input
            className="min-h-11 w-full min-w-0 rounded-lg border-0 bg-transparent py-2 text-base sm:text-sm text-[var(--fs-text)] focus:outline-none"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            aria-label="Search submissions"
            placeholder="Search ID, enumerator collector, location, or form"
          />
        </label>
        <select
          aria-label="Submissions project filter"
          className={`${selectClass} w-full`}
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <label className="text-sm">Review status
          <select aria-label="Review status filter" className={`${selectClass} w-full`} value={reviewStatus} onChange={event => { const next = new URLSearchParams(searchParams); if (event.target.value) next.set("review_status", event.target.value); else next.delete("review_status"); setSearchParams(next); }}>
            <option value="">All review statuses</option><option value="ready">Ready</option><option value="needs_review">Needs review</option><option value="invalid">Invalid</option>
          </select>
        </label>
        <select
          className={`${selectClass} w-full`}
          value={exportPeriod}
          onChange={(event) => setExportPeriod(event.target.value as ExportPeriod)}
          aria-label="CSV export period"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!total || csvExport.isPending}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[#dce5ef] bg-white px-[16px] py-[9px] font-sans text-[14px] font-semibold leading-normal text-[#155da6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} />
          {csvExport.isPending ? "Exporting…" : "Export all filtered data"}
        </button>
      </div>

      {isFetching && data && <div className="my-3"><LoadingState variant="inline" label="Updating submissions…" /></div>}
      {(isLoading || authLoading || outOfRange) ? <div className="mt-4"><LoadingSkeleton label="Loading submissions…" columns={6} /></div> : <Card className="mt-[16px] rounded-none">
        <div className="overflow-x-auto">
          <table aria-busy={isFetching} className="fs-data-table w-full min-w-[900px] border-separate border-spacing-0 overflow-hidden text-left">
            <thead>
              <tr>
                {["Submission", "Project & form", "Enumerator Collector", "Location", "Received", "Review"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86] whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={`${row.projectId}:${row.id}`} className="border-b border-[#edf1f5] bg-white transition-colors hover:bg-[#f7faff]">
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[14px] leading-[1.45] text-[#536177]">
                    <button type="button" className="min-h-11 block text-left text-[14px] font-semibold leading-normal text-[#0b51b7] focus-visible:outline focus-visible:outline-2" onClick={() => setSelected(row.internalId)}>
                      {row.id}
                      <small className="mt-[2px] block text-[12px] font-normal text-[#8a99ad]">
                        {row.form}
                      </small>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[14px] leading-[1.45] text-[#374151]">
                    <strong className="block text-[14px] font-semibold text-[#1f2937]">{row.project}</strong>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[14px] leading-[1.45] text-[#374151]">
                    <div className="flex items-center gap-[9px]">
                      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#dfeeff] text-[12px] font-bold text-[#1d4ed8]">
                        {row.enumerator
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <span className="text-[14px] font-medium text-[#374151]">{row.enumerator}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[14px] leading-[1.45] text-[#6b7280]">
                    <span className="flex items-center gap-[5px]">
                      <MapPin size={14} className="text-[#9ca3af]" />
                      {row.location}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[14px] leading-[1.45] text-[#374151] tabular-nums">
                    {row.submitted}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[14px] leading-[1.45]">
                    <span>{row.review.replaceAll("_", " ")}</span>
                    {row.concern && <small className="block text-amber-800">Evidence needs attention</small>}
                  </td>
                </tr>
              ))}
              {!error && visible.length === 0 && (
                <tr>
                  <td
                    className="whitespace-nowrap border-t border-[#edf1f5] px-4 py-3 text-[12px] leading-[1.45] text-[#536177]"
                    colSpan={6}
                  >
                    <div className="p-[38px] text-center text-[14px] text-[#8190a4]">
                      No submissions match these filters.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f2] bg-white px-[14px] py-[11px] text-[12px] text-[#84909b]">
          <span className="text-[12px] text-[#64748b]">
            Showing{" "}
            <strong className="font-semibold text-[#1e293b]">
              {firstVisibleRow}–{lastVisibleRow}
            </strong>{" "}
            of <strong className="font-semibold text-[#1e293b]">{total.toLocaleString()}</strong> submissions
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#dce5ef] bg-[#f8fafc] px-3 text-[12px] font-medium text-[#8793a2] transition-colors hover:border-[#b8cde8] hover:bg-white hover:text-[#0b51b7] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={activePage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
              <span className="max-[520px]:hidden">Previous</span>
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((page, idx) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="inline-flex h-8 min-w-8 items-center justify-center text-[12px] font-medium text-[#94a3b8]"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[12px] font-semibold transition-colors ${
                      page === activePage
                        ? "border-[#0b51b7] bg-[#0b51b7] text-white"
                        : "border-[#dce5ef] bg-white text-[#64748b] hover:border-[#b8cde8] hover:bg-[#f8fafc] hover:text-[#0b51b7]"
                    }`}
                    onClick={() => setCurrentPage(page as number)}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#dce5ef] bg-[#f8fafc] px-3 text-[12px] font-medium text-[#8793a2] transition-colors hover:border-[#b8cde8] hover:bg-white hover:text-[#0b51b7] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={activePage === totalPages}
              aria-label="Next page"
            >
              <span className="max-[520px]:hidden">Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </footer>
      </Card>}

      {selected && <SubmissionReview key={selected} id={selected} onClose={() => setSelected(null)} />}

    </div>
  );
}
