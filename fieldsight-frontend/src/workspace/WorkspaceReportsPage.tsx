import { ProjectLink as Link } from "./projectRouting";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { Button, LoadingState } from "../components/ui";
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

export function WorkspaceReportsPage() {
  const { projectId, project } = useWorkspace();
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const invalid = Boolean(from && through && from > through);
  const indicators = useQuery({
    queryKey: ["indicators", projectId, from, through],
    queryFn: () => apiClient.indicators(projectId, from, through),
    enabled: Boolean(projectId && !invalid),
  });
  const tables = useQuery({
    queryKey: ["workspace-tables", projectId],
    queryFn: () => apiClient.tables(projectId),
    enabled: Boolean(projectId),
  });
  const reportLoading = indicators.isLoading || tables.isLoading;
  const reportUnavailable = Boolean((indicators.isError && !indicators.data) || (tables.isError && !tables.data));
  const pdf = useMutation({ mutationFn: () => apiClient.projectReportPdf(projectId, from, through), onSuccess: data => {
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    const link = document.createElement("a"); link.href = url; link.download = "fieldsight-project-report.pdf";
    link.click(); URL.revokeObjectURL(url);
  } });
  const number = (n: number | null) =>
    n === null
      ? "Not reported"
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  function exportCsv() {
    const lines: unknown[][] = [
      [
        "project",
        "indicator",
        "code",
        "unit",
        "actual",
        "target",
        "baseline",
        "result_source",
        "eligible_records",
        "missing",
        "invalid",
        "date_from",
        "date_to",
        "quality_excluded",
        "calculation_note",
      ],
    ];
    for (const item of indicators.data ?? [])
      lines.push([
        project?.name,
        item.name,
        item.code,
        item.unit,
        item.unit === "text" ? item.qualitative_value : item.current_value,
        item.target_value,
        item.baseline_value,
        item.result_source,
        item.eligible_records,
        item.missing_records,
        item.invalid_answers,
        from,
        through,
        item.quality_excluded_records,
        item.calculation_note,
      ]);
    const csv = lines
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fieldsight-project-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Page
      breadcrumb={`FieldSight / ${project?.name ?? "Project"}`}
      title="Project report"
      description="Generated from current saved data; this is not a stored historical snapshot."
      actions={
        <>
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!indicators.data || reportLoading || indicators.isFetching || reportUnavailable || invalid}
          >
            <Download size={14} />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => pdf.mutate()} disabled={invalid || pdf.isPending || !projectId || reportLoading || reportUnavailable}>
            <Download size={14} />{pdf.isPending ? "Generating PDF…" : "Download PDF"}
          </Button>
          <Button onClick={() => window.print()} disabled={invalid || reportLoading || indicators.isFetching || reportUnavailable}>
            <Printer size={14} />
            Print / save PDF
          </Button>
        </>
      }
    >
      <WorkspaceGate>
        {pdf.error && <Notice error>{pdf.error.message}</Notice>}
        <Panel className="flex flex-wrap items-end gap-4 p-5 print:hidden">
          <Field label="Submitted from (UTC)">
            <input
              type="date"
              className={fieldClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Submitted through (UTC)">
            <input
              type="date"
              className={fieldClass}
              value={through}
              onChange={(e) => setThrough(e.target.value)}
            />
          </Field>
          <p className="m-0 pb-2 text-xs text-[var(--fs-muted)]">
            Dates filter actuals. Targets are not prorated.
          </p>
        </Panel>
        {invalid && (
          <Notice error>Start date must be on or before end date.</Notice>
        )}
        {[indicators.error, tables.error].filter(Boolean).map((e, i) => (
          <Notice error key={i}>
            {e?.message}
          </Notice>
        ))}
        {indicators.isFetching && indicators.data && <LoadingState variant="inline" label="Updating report…" />}
        {(indicators.error || tables.error) && <Button variant="secondary" onClick={() => { void indicators.refetch(); void tables.refetch(); }}>Retry report data</Button>}
        {reportLoading && !invalid ? (
          <LoadingState variant="panel" label="Preparing project report…" />
        ) : (
          !invalid && !reportUnavailable && (
            <>
              <Panel className="p-6">
                <p className="text-[12px] uppercase tracking-widest text-[var(--fs-muted)]">
                  Monitoring & evaluation
                </p>
                <h2 className="text-xl font-semibold">{project?.name}</h2>
                <p className="text-xs">Current data report. Values may change after sync or review; no historical snapshot is stored. Results retrieved: {indicators.dataUpdatedAt ? new Date(indicators.dataUpdatedAt).toLocaleString() : "Not yet loaded"}.</p>
                <Link to={`/projects/${projectId}/indicators`} className="text-sm text-[#0b51b7] underline print:hidden">Inspect indicators and calculation sources</Link>
                <p className="text-sm leading-7 text-[var(--fs-muted)]">
                  {project?.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-8 text-xs text-[var(--fs-muted)]">
                  <span>
                    Window: {from || "All dates"} — {through || "Present"}
                  </span>
                  <span>Generated: {new Date().toLocaleString()}</span>
                  <span>
                    {indicators.data?.length ?? 0} indicators ·{" "}
                    {tables.data?.length ?? 0} source tables
                  </span>
                </div>
              </Panel>
              <Panel>
                <h2 className="m-0 border-b border-[#e4ebed] px-5 py-4 text-sm font-semibold">
                  Indicators against overall targets
                </h2>
                <div className="overflow-x-auto">
                  <table className="fs-data-table w-full min-w-[750px] text-left text-xs">
                    <thead className="bg-[#f8fafb] text-[12px] uppercase text-[var(--fs-muted)]">
                      <tr>
                        {[
                          "Indicator",
                          "Format",
                          "Actual",
                          "Target",
                          "Status",
                          "Source",
                        ].map((h) => (
                          <th key={h} className="px-5 py-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.data?.map((item) => (
                        <tr key={item.id} className="border-t border-[#edf0f2]">
                          <td className="px-5 py-4 font-medium"><Link to={`/projects/${projectId}/indicators?view=results`} className="text-[#0b51b7]">{item.name}</Link></td>
                          <td className="px-5">
                            {item.unit === "text" ? "Qualitative" : item.unit}
                          </td>
                          <td className="max-w-[300px] whitespace-pre-wrap px-5 leading-6">
                            {item.unit === "text"
                              ? (item.qualitative_value ?? "Not reported")
                              : number(item.current_value) +
                                (item.unit === "percentage" &&
                                item.current_value !== null
                                  ? "%"
                                  : "")}
                          </td>
                          <td className="px-5">
                            {item.unit === "text"
                              ? "—"
                              : number(item.target_value)}
                          </td>
                          <td className="px-5">
                            {item.target_achieved
                              ? "Achieved"
                              : item.status.replaceAll("_", " ")}
                          </td>
                          <td className="px-5">
                            {item.result_source === "manual"
                              ? `${item.manual_result_count} manual entries`
                              : item.result_source === "table"
                                ? `${item.eligible_records} ready records`
                                : "Not configured"}
                            <p>Missing {item.missing_records}; invalid {item.invalid_answers}; excluded {item.quality_excluded_records}.</p>
                            <p>{item.calculation_note}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!indicators.data?.length && (
                  <p className="p-5 text-sm text-[var(--fs-muted)]">
                    No indicators have been defined for this project.
                  </p>
                )}
              </Panel>
              <Panel className="p-6">
                <h2 className="mt-0 text-sm font-semibold">
                  Data sources & interpretation
                </h2>
                <ul className="space-y-2 pl-4 text-xs leading-6 text-[var(--fs-muted)]">
                  {tables.data?.map((table) => (
                    <li key={table.id}>
                      {table.title} · {table.source} · {table.records} stored
                      rows before date or quality filters
                    </li>
                  ))}
                </ul>
                <p className="mb-0 text-xs leading-6 text-[var(--fs-muted)]">
                  Linked calculations use ready records only; missing and
                  invalid answers are excluded from answer-based denominators.
                  Manual numeric entries are summed; percentages, rates
                  and ratios use their explicitly configured pooling or mean method. Qualitative indicators show
                  the latest dated narrative. Below-target results before their
                  deadline remain in progress. This report is generated from
                  current stored data; it is not a published or scheduled
                  report.
                </p>
              </Panel>
            </>
          )
        )}
      </WorkspaceGate>
    </Page>
  );
}
