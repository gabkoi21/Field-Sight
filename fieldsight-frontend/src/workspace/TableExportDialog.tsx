import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { apiClient, type SurveyField, type TableDownload, type TableExportOptions } from "../services/apiClient";
import { Field, Notice, fieldClass } from "./WorkspaceUI";
import { liberiaCounties as counties } from "../utils/liberiaCounties";

export function saveTableDownload({ blob, filename }: TableDownload) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


export function TableExportDialog({ project, form, fields, onClose }: {
  project: string; form: string; title: string; fields: SurveyField[]; onClose: () => void;
}) {
  const [format, setFormat] = useState<TableExportOptions["format"]>("xlsx");
  const [county, setCounty] = useState("");
  const [period, setPeriod] = useState<"all" | "weekly" | "fortnightly" | "monthly">("all");
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState("");
  const exporter = useMutation({
    mutationFn: () => apiClient.exportTable(project, form, {
      format, period, anchor: anchor || new Date().toISOString().slice(0, 10), end: null,
      week_start: 0, timezone: "Africa/Monrovia", date_field: null,
      content: "records", compare: false, group_by: "county", columns: null,
      review_status: "all", search: "", metric_field: null, metric: "sum",
      county: county || null,
      county_field: fields.find(field => /\bcounty\b/i.test(field.label) || /(?:^|[/_])county$/i.test(field.source_field))?.source_field ?? null,
    }),
    onSuccess: result => { saveTableDownload(result); setNotice("Your data has been downloaded."); },
  });
  return <Dialog title="Export data" compact error={exporter.error?.message} onClose={exporter.isPending ? () => undefined : onClose}>
    <div className="space-y-4">
      <Field label="File format">
        <select className={fieldClass} value={format} onChange={e => { setFormat(e.target.value as TableExportOptions["format"]); setNotice(""); }}>
          <option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option>
          <option value="json">JSON (.json)</option><option value="pdf">PDF (.pdf)</option>
        </select>
      </Field>
      <Field label="Reporting period">
        <select className={fieldClass} value={period} onChange={e => { setPeriod(e.target.value as typeof period); setNotice(""); }}>
          <option value="all">All dates</option>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Every two weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      {period !== "all" && <Field label={period === "monthly" ? "Month" : period === "weekly" ? "Date within week" : "Two-week start date"}>
        <input className={fieldClass} type={period === "monthly" ? "month" : "date"}
          min={period === "monthly" ? "1900-01" : "1900-01-01"}
          max={period === "monthly" ? "9997-12" : "9997-12-31"}
          value={period === "monthly" ? anchor.slice(0, 7) : anchor}
          onChange={e => { setAnchor(e.target.value ? e.target.value + (period === "monthly" ? "-01" : "") : ""); setNotice(""); }} />
      </Field>}
      <Field label="Breakdown by county">
        <select className={fieldClass} value={county} onChange={e => { setCounty(e.target.value); setNotice(""); }}>
          <option value="">All counties</option>
          {counties.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </Field>
      {notice && <div role="status"><Notice>{notice}</Notice></div>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={exporter.isPending}>Cancel</Button>
        <Button disabled={exporter.isPending || (period !== "all" && !anchor)} onClick={() => exporter.mutate()}>
          <Download size={15} />{exporter.isPending ? "Exporting…" : "Download"}
        </Button>
      </div>
    </div>
  </Dialog>;
}
