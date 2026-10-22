import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
import { Button, LoadingState } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { apiClient } from "../services/apiClient";
import { useWorkspace } from "./WorkspaceContext";
import {
  Field,
  Notice,
  Page,
  Panel,
  WorkspaceGate,
  fieldClass,
} from "./WorkspaceUI";

export function DataTablesPage() {
  const { projectId, project, selectProject } = useWorkspace();
  const cache = useQueryClient();
  const [selection, setSelection] = useState<{
    project: string;
    id: string;
  } | null>(null);
  const form = selection?.project === projectId ? selection.id : "";
  const [offset, setOffset] = useState(0);
  const [importing, setImporting] = useState(false);
  const [source, setSource] = useState<"choose" | "csv">("choose");
  const [title, setTitle] = useState("");
  const [csvText, setCsv] = useState("");
  const [dateColumn, setDate] = useState("");
  const [locationColumn, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState("");
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
        cache.invalidateQueries({ queryKey: ["quality"] }),
      ]);
      setImporting(false);
      setSelection({ project: projectId, id: result.form_id });
      setOffset(0);
      setMessage(
        `Imported ${result.imported} rows. Review their quality before using them in indicator calculations.`,
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
    <Page
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
        <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="text-sm font-medium">{project?.name}</span>
          <Link className="text-xs text-[#168596]" to="/forms/connections">
            Manage Kobo connections →
          </Link>
        </Panel>
        {message && (
          <Notice>
            {message}{" "}
            <Link to="/quality" className="text-inherit underline">
              Open data quality
            </Link>
          </Notice>
        )}
        {(tables.error || rows.error) && (
          <Notice error>{tables.error?.message ?? rows.error?.message}</Notice>
        )}
        {tables.isLoading ? (
          <LoadingState />
        ) : form ? (
          <Panel>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e7eb] p-4">
              <div>
                <button
                  onClick={() => setSelection(null)}
                  className="mb-2 flex items-center gap-1 border-0 bg-transparent p-0 text-xs text-[#168596]"
                >
                  <ArrowLeft size={13} />
                  All tables
                </button>
                <h2 className="m-0 text-base font-medium">
                  {chosen?.title ?? form}
                </h2>
                <p className="mb-0 mt-1 text-xs text-[#87969d]">
                  Source: {chosen?.source} ·{" "}
                  {rows.data?.total ?? chosen?.records ?? 0} records
                </p>
              </div>
              <Link
                className="text-xs text-[#168596]"
                to={`/analytics?project_id=${projectId}`}
              >
                Analyze this workspace →
              </Link>
            </header>
            {rows.isLoading ? (
              <LoadingState />
            ) : (
              rows.data && (
                <>
                  <div className="max-h-[520px] overflow-auto">
                    <table className="w-full border-collapse whitespace-nowrap text-left text-xs">
                      <thead className="sticky top-0 bg-[#f8fafb] text-[10px] uppercase text-[#87969d]">
                        <tr>
                          <th className="px-4 py-3 font-medium">
                            Review status
                          </th>
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
                        {rows.data.rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-[#edf0f2] hover:bg-[#fafcfc]"
                          >
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2 py-1 text-[10px] ${row.review_status === "ready" ? "bg-[#ecf7f0] text-[#388567]" : "bg-[#fff7e8] text-[#a6803f]"}`}
                              >
                                {row.review_status.replaceAll("_", " ")}
                              </span>
                            </td>
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
                  <footer className="flex items-center justify-between border-t border-[#e1e7eb] px-5 py-3 text-xs text-[#87969d]">
                    <span>
                      {offset + 1}–{Math.min(offset + 50, rows.data.total)} of{" "}
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
                  <span className="grid size-10 place-items-center rounded-lg bg-[#edf6f7] text-[#168596]">
                    <Database size={19} />
                  </span>
                  <span className="rounded bg-[#f4f7f8] px-2 py-1 text-[10px] text-[#87969d]">
                    {table.source}
                  </span>
                </div>
                <h2 className="m-0 text-base font-medium">{table.title}</h2>
                <p className="mt-2 text-xs text-[#87969d]">
                  {table.records} stored records
                </p>
                <button
                  className="mt-4 self-start border-0 bg-transparent p-0 text-xs font-medium text-[#168596]"
                  onClick={() => {
                    selectProject(projectId);
                    setSelection({ project: projectId, id: table.id });
                    setOffset(0);
                  }}
                >
                  Open data table →
                </button>
              </Panel>
            ))}
          </div>
        ) : (
          <Panel className="p-12 text-center">
            <Database className="mx-auto text-[#8aadb5]" size={30} />
            <h2 className="text-lg">Bring your evidence into FieldSight</h2>
            <p className="text-sm text-[#87969d]">
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
          description={`Workspace: ${project?.name ?? "Select a workspace"}`}
          error={importer.error?.message || fileError}
          onClose={() => setImporting(false)}
        >
          {source === "choose" ? (
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <button
                className="rounded-lg border border-[#dce4e8] bg-white p-5 text-left hover:border-[#168596]"
                onClick={() => setSource("csv")}
              >
                <FileSpreadsheet className="mb-3 text-[#168596]" size={24} />
                <strong className="block text-sm">Local CSV file</strong>
                <span className="mt-2 block text-xs leading-5 text-[#87969d]">
                  Preview and import a table from your computer. Up to 2,000
                  rows.
                </span>
              </button>
              <Link
                to="/forms/connections"
                className="rounded-lg border border-[#dce4e8] p-5 text-inherit no-underline hover:border-[#168596]"
              >
                <Link2 className="mb-3 text-[#168596]" size={24} />
                <strong className="block text-sm">KoboToolbox</strong>
                <span className="mt-2 block text-xs leading-5 text-[#87969d]">
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
                  <p className="text-xs text-[#73868d]">
                    File preview · first lines
                  </p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-[#f5f8f9] p-3 text-[11px] leading-5">
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
              <p className="m-0 text-xs leading-5 text-[#87969d]">
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
  );
}
function cell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
