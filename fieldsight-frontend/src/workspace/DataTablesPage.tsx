import { formatDateValue } from "../utils/dateFormat";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectLink as Link, useProjectSearchParams as useSearchParams } from "./projectRouting";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Link2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button, LoadingSkeleton, LoadingState } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { apiClient } from "../services/apiClient";
import { useWorkspace } from "./WorkspaceContext";
import { TableExportDialog } from "./TableExportDialog";
import {
  Field,
  Notice,
  Page,
  Panel,
  WorkspaceGate,
  WorkspaceTabs,
  fieldClass,
} from "./WorkspaceUI";

export function DataTablesPage() {
  const [params, setParams] = useSearchParams();
  const { projectId, project, selectProject } = useWorkspace();
  const cache = useQueryClient();
  const form = params.get("table_project") === projectId ? params.get("table") ?? "" : "";
  const requestedOffset = Number(params.get("offset") ?? 0);
  const offset = form && Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 && requestedOffset <= 1_000_000_000
    ? Math.floor(requestedOffset / 50) * 50 : 0;
  function selectTable(id: string | null) {
    const next = new URLSearchParams(params);
    next.delete("offset");
    next.delete("import");
    if (id) {
      next.set("table", id);
      next.set("table_project", projectId);
    } else {
      next.delete("table");
      next.delete("table_project");
    }
    setParams(next);
  }
  function setOffset(value: number) {
    const next = new URLSearchParams(params);
    if (value) next.set("offset", String(value)); else next.delete("offset");
    setParams(next);
  }
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(params.get("import") === "csv");
  const [source, setSource] = useState<"choose" | "csv">(params.get("import") === "csv" ? "csv" : "choose");
  const [title, setTitle] = useState("");
  const [csvText, setCsv] = useState("");
  const [dateColumn, setDate] = useState("");
  const [locationColumn, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState("");
  function closeImport() {
    setImporting(false);
    if (params.has("import")) {
      const next = new URLSearchParams(params);
      next.delete("import");
      setParams(next, { replace: true });
    }
  }
  const tables = useQuery({
    queryKey: ["workspace-tables", projectId],
    queryFn: () => apiClient.tables(projectId),
    enabled: Boolean(projectId),
  });
  const rows = useQuery({
    queryKey: ["table-rows", projectId, form, offset],
    queryFn: () => apiClient.tableRows(projectId, form, offset),
    enabled: Boolean(projectId && form),
  });
  const importer = useMutation({
    mutationFn: () =>
      apiClient.importTable(projectId, {
        title,
        csv_text: csvText,
        date_column: dateColumn || null,
        location_column: locationColumn || null,
      }),
    onSuccess: async (result) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["workspace-tables"] }),
        cache.invalidateQueries({ queryKey: ["submissions"] }),
        cache.invalidateQueries({ queryKey: ["survey-fields"] }),
      ]);
      setImporting(false);
      selectTable(result.form_id);
      setMessage(
        `Imported ${result.imported} rows. Confirm their source mapping before using them in indicator calculations.`,
      );
    },
  });
  async function fileChanged(file?: File) {
    if (!file) return;
    setFileError("");
    if (file.size > 1000000) {
      setFileError("Choose a CSV file smaller than 1 MB.");
      return;
    }
    setTitle(file.name.replace(/\.csv$/i, ""));
    setCsv(await file.text());
  }
  const chosen = tables.data?.find((t) => t.id === form);
  return (
    <div className="space-y-5">
      {exporting && form && rows.data && <TableExportDialog key={`${projectId}/${form}`} project={projectId} form={form} title={chosen?.title ?? form} fields={rows.data.fields} onClose={() => setExporting(false)} />}
      <Link
        to={projectId ? `/projects/${projectId}` : "/projects"}
        className="inline-flex items-center gap-2 text-xs font-medium text-[var(--fs-primary)] no-underline hover:underline"
      >
        <ArrowLeft size={15} /> Back to project
      </Link>
    <Page
      breadcrumb={project?.name ?? "Select a project"}
      title="Data tables"
      description="Review your stored evidence and link it to your indicator plan."
      actions={
        <>
          <Button variant="secondary" onClick={() => tables.refetch()}>
            <RefreshCw size={14} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setImporting(true);
              setSource("choose");
              importer.reset();
              setFileError("");
              setCsv("");
              setTitle("");
              setDate("");
              setLocation("");
            }}
          >
            <Plus size={14} />
            Import table
          </Button>
        </>
      }
    >
      <WorkspaceGate>
        <WorkspaceTabs />
        {message && (
          <Notice>
            {message}{" "}
          </Notice>
        )}
        {(tables.error || rows.error) && (
          <Notice error>{tables.error?.message ?? rows.error?.message} <button className="min-h-11 px-3 font-semibold underline" onClick={() => { if (tables.error) void tables.refetch(); if (rows.error) void rows.refetch(); }}>Retry data tables</button></Notice>
        )}
        {((tables.isFetching && tables.data) || (rows.isFetching && rows.data)) && <LoadingState variant="inline" label="Updating table data…" />}
        {tables.isLoading ? (
          <LoadingSkeleton label="Loading data tables…" />
        ) : form ? (
          <Panel>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1e7eb] px-2 py-1">
              <div>
                <button
                  onClick={() => selectTable(null)}
                  className="mb-0.5 flex items-center gap-1 border-0 bg-transparent p-0 text-xs leading-4 text-[var(--fs-primary)]"
                >
                  <ArrowLeft size={13} />
                  All tables
                </button>
                <h2 className="m-0 text-sm font-medium leading-5">
                  {chosen?.title ?? form}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="secondary" className="!min-h-8 !gap-1.5 !px-2.5 !py-1 !text-xs" disabled={!rows.data} onClick={() => setExporting(true)}><FileSpreadsheet size={12} />Export data</Button>
              </div>
            </header>
            {rows.isLoading ? (
              <LoadingSkeleton label="Loading table records…" />
            ) : (
              rows.data && (
                <>
                  <div className="max-h-[520px] overflow-auto">
                    <table aria-busy={rows.isFetching} className="fs-data-table w-full border-collapse whitespace-nowrap text-left text-xs">
                      <thead className="sticky top-0 bg-[#f8fafb] text-[12px] uppercase text-[var(--fs-muted)]">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-medium" aria-label="Row number">Num #</th>
                          <th className="px-4 py-3 font-medium">
                            Review status
                          </th>
                          <th scope="col" className="px-4 py-3 font-medium" title="Kobo username recorded in submission metadata">
                            Submitted by
                          </th>
                          <th scope="col" className="px-4 py-3 font-medium" title="County assignment when this submission was made">Assigned counties</th>
                          {rows.data.fields.map((f) => (
                            <th
                              key={f.source_field}
                              className="px-4 py-3 font-medium"
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.data.rows.map((row, index) => (
                          <tr
                            key={row.id}
                            className="border-t border-[#edf0f2] hover:bg-[#fafcfc]"
                          >
                            <td className="px-4 py-3 tabular-nums text-[var(--fs-muted)]">{offset + index + 1}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2 py-1 text-[12px] ${row.review_status === "ready" ? "bg-[var(--fs-primary-soft)] text-[var(--fs-primary)]" : "bg-[#fff7e8] text-[#a6803f]"}`}
                              >
                                {row.review_status.replaceAll("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">{row.submitted_by?.trim() || "Unknown"}</td>
                            <td className="max-w-[350px] whitespace-normal px-4 py-3">{row.county_assignment_found ? row.assigned_counties?.join(", ") || "All counties" : "Not assigned"}</td>
                            {rows.data!.fields.map((f) => (
                              <td
                                key={f.source_field}
                                className="max-w-[350px] truncate px-4 py-3"
                                title={cell(row.answers[f.source_field])}
                              >
                                {cell(row.answers[f.source_field])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer className="flex items-center justify-between border-t border-[#e1e7eb] px-5 py-3 text-xs text-[var(--fs-muted)]">
                    <span>
                      {rows.data.total ? offset + 1 : 0}–{Math.min(offset + 50, rows.data.total)} of{" "}
                      {rows.data.total}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - 50))}
                      >
                        <ChevronLeft size={13} />
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={offset + 50 >= rows.data.total}
                        onClick={() => setOffset(offset + 50)}
                      >
                        Next
                        <ChevronRight size={13} />
                      </Button>
                    </div>
                  </footer>
                </>
              )
            )}
          </Panel>
        ) : tables.data?.length ? (
          <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            {tables.data.map((table) => (
              <Panel key={table.id} className="flex flex-col p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-lg bg-[var(--fs-primary-soft)] text-[var(--fs-primary)]">
                    <Database size={19} />
                  </span>
                  <span className="rounded bg-[#f4f7f8] px-2 py-1 text-[12px] text-[var(--fs-muted)]">
                    {table.source}
                  </span>
                </div>
                <h2 className="m-0 text-base font-medium">{table.title}</h2>
                <p className="mt-2 text-xs text-[var(--fs-muted)]">
                  {table.records} stored records
                </p>
                <button
                  className="mt-4 self-start border-0 bg-transparent p-0 text-xs font-medium text-[var(--fs-primary)]"
                  onClick={() => {
                    selectProject(projectId);
                    selectTable(table.id);
                  }}
                >
                  Open data table →
                </button>
              </Panel>
            ))}
          </div>
        ) : tables.error ? null : (
          <Panel className="p-12 text-center">
            <Database className="mx-auto text-[var(--fs-muted)]" size={30} />
            <h2 className="text-lg">Bring your evidence into FieldSight</h2>
            <p className="text-sm text-[var(--fs-muted)]">
              Import your first CSV table or connect a Kobo form.
            </p>
            <Button
              onClick={() => {
                setImporting(true);
                setSource("choose");
              }}
            >
              Import first table
            </Button>
          </Panel>
        )}
      </WorkspaceGate>
      {importing && (
        <Dialog
          title="Import a data table"
          description={`Project: ${project?.name ?? "Select a project"}`}
          error={importer.error?.message || fileError}
          onClose={closeImport}
        >
          {source === "choose" ? (
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <button
                className="rounded-lg border border-[#dce4e8] bg-white p-5 text-left hover:border-[var(--fs-primary)]"
                onClick={() => setSource("csv")}
              >
                <FileSpreadsheet className="mb-3 text-[var(--fs-primary)]" size={24} />
                <strong className="block text-sm">Local CSV file</strong>
                <span className="mt-2 block text-xs leading-5 text-[var(--fs-muted)]">
                  Preview and import a table from your computer. Up to 2,000
                  rows.
                </span>
              </button>
              <Link
                to="/forms/connections"
                className="rounded-lg border border-[#dce4e8] p-5 text-inherit no-underline hover:border-[var(--fs-primary)]"
              >
                <Link2 className="mb-3 text-[var(--fs-primary)]" size={24} />
                <strong className="block text-sm">KoboToolbox</strong>
                <span className="mt-2 block text-xs leading-5 text-[var(--fs-muted)]">
                  Verify a connection, assign a form and synchronize its
                  responses.
                </span>
              </Link>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                importer.mutate();
              }}
            >
              <Field label="CSV file">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void fileChanged(e.target.files?.[0])}
                  className={fieldClass}
                />
              </Field>
              <Field label="Table name">
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={fieldClass}
                />
              </Field>
              {csvText && (
                <div>
                  <p className="text-xs text-[var(--fs-muted)]">
                    File preview · first lines
                  </p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-[#f5f8f9] p-3 text-[12px] leading-5">
                    {csvText.split(/\r?\n/).slice(0, 6).join("\n")}
                  </pre>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date column (optional)">
                  <input
                    placeholder="Exact column heading"
                    value={dateColumn}
                    onChange={(e) => setDate(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Location column (optional)">
                  <input
                    placeholder="Exact column heading"
                    value={locationColumn}
                    onChange={(e) => setLocation(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </div>
              <p className="m-0 text-xs leading-5 text-[var(--fs-muted)]">
                Use unique headings and ISO dates such as 2026-10-22. Rows start
                in Needs review. A missing date remains unreported.
              </p>
              <Button
                type="submit"
                disabled={!projectId || !csvText || importer.isPending}
              >
                {importer.isPending ? "Importing…" : "Import table"}
              </Button>
            </form>
          )}
        </Dialog>
      )}
    </Page>
    </div>
  );
}
function cell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : formatDateValue(value);
}
