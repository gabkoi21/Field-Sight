import { useState } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { DeleteConfirmation } from "../components/ui/DeleteConfirmation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, LoadingState } from "../components/ui";
import { apiClient, type Indicator, type ReportInput, type ReportPreview, type SavedReport } from "../services/apiClient";
import { formatDateTime } from "../utils/dateFormat";
import { useWorkspace } from "./WorkspaceContext";
import { Field, Notice, Page, Panel, WorkspaceGate, fieldClass } from "./WorkspaceUI";
import { reportPeriod, type PeriodKind } from "./reportPeriods";

const label = (key: string) => key.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
const numeric = (value: number | null | undefined) => value == null ? "Not reported" : value.toLocaleString(undefined, {maximumFractionDigits: 2});
const inputOf = (r: ReportInput): ReportInput => ({title: r.title, description: r.description, template_key: r.template_key,
  reporting_period_start: r.reporting_period_start, reporting_period_end: r.reporting_period_end, sections: r.sections, indicator_ids: r.indicator_ids});

export function ReportDocument({preview}: {preview: ReportPreview}) {
  const {data} = preview;
  const statuses = data.indicators.reduce<Record<string, number>>((counts, item) => {
    counts[item.schedule_status] = (counts[item.schedule_status] ?? 0) + 1; return counts;
  }, {});
  return <article aria-label="Report preview" className="space-y-6 bg-white p-5 text-[#24434c] sm:p-10">
    <header className="border-b pb-6">
      <p className="text-xs uppercase tracking-widest">{data.organization.name} / Monitoring & evaluation</p>
      <h2 className="text-2xl font-semibold">{data.report.title}</h2><p>{data.project.name}</p>
      <p>{data.report.reporting_period_start} — {data.report.reporting_period_end} (UTC)</p>
      <p className="text-xs">{data.published_at ? `Published: ${formatDateTime(data.published_at)}` : "Draft preview • live calculated data"}</p>
    </header>
    <section><h3 className="font-semibold">Project overview</h3><p className="whitespace-pre-wrap">{data.project.description}</p><p className="whitespace-pre-wrap">{data.report.description}</p></section>
    {Object.entries(data.report.sections).map(([key, value]) => <section key={key}><h3 className="font-semibold">{label(key)} <span className="text-xs font-normal">• User-authored</span></h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{value || "No narrative provided."}</p></section>)}
    <section><h3 className="font-semibold">Indicator performance • Calculated data</h3>
      <p className="text-sm">{Object.entries(statuses).map(([key, count]) => `${label(key)}: ${count}`).join(" · ") || "No indicators selected."}</p>
      <p className="text-xs">Submission review counts: {Object.entries(data.review_counts).map(([key, count]) => `${label(key)}: ${count}`).join(" · ") || "No submissions in this period."}</p>
      {data.indicators.map(item => <IndicatorReport key={item.id} item={item} />)}
    </section>
    {data.framework.length > 0 && <section><h3 className="font-semibold">Results framework</h3>{data.framework.map((node, index) => <p key={index} className="text-sm">{label(node.node_type)}: {node.title}</p>)}</section>}
    <section><h3 className="font-semibold">Data sources and methodology</h3><p className="text-xs leading-6">{data.methodology}</p></section>
  </article>;
}

function IndicatorReport({item}: {item: Indicator}) {
  const series = [{name: item.code, Actual: item.current_value, "Overall target": item.target_value}];
  return <section className="mt-6 border-t pt-4">
    <h4 className="font-semibold">{item.code} — {item.name}</h4>
    <p className="text-xs">{label(item.unit)} · {item.direction === "decrease" ? "Lower values are better" : "Higher values are better"} · {label(item.schedule_status)}</p>
    <dl className="my-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
      <div><dt>Actual</dt><dd>{item.unit === "text" ? item.qualitative_value || "Not reported" : numeric(item.current_value)}</dd></div>
      <div><dt>Overall target</dt><dd>{numeric(item.target_value)}</dd></div>
      <div><dt>Overall progress</dt><dd>{item.progress_percent == null ? "Not applicable" : `${numeric(item.progress_percent)}%`}</dd></div>
      <div><dt>Baseline</dt><dd>{numeric(item.baseline_value)}</dd></div>
    </dl>
    {item.unit !== "text" && <div aria-label={`${item.name} actual versus overall target, ${item.unit}`} role="img" className="h-52 w-full print:hidden">
      <ResponsiveContainer width="100%" height="100%"><BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Actual" fill="#146b72" /><Bar dataKey="Overall target" fill="#a4b6c3" /></BarChart></ResponsiveContainer>
    </div>}
    {item.history.length > 0 && <>
      <h5 className="text-sm font-semibold">Reporting period trend • {label(item.reporting_frequency)}</h5>
      {item.unit !== "text" && <div aria-label={`${item.name} reporting period trend`} role="img" className="h-52 w-full print:hidden"><ResponsiveContainer width="100%" height="100%"><LineChart data={item.history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Legend /><Line name="Actual" dataKey="value" stroke="#146b72" connectNulls={false} /><Line name="Period target" dataKey="target_value" stroke="#64748b" connectNulls={false} /></LineChart></ResponsiveContainer></div>}
      <div className="overflow-x-auto"><table className="fs-data-table w-full text-left text-xs"><thead><tr><th>UTC period</th><th>Actual</th><th>Period target</th><th>Achieved</th></tr></thead><tbody>{item.history.map(point => <tr key={point.period}><td>{point.period}</td><td>{numeric(point.value)}</td><td>{numeric(point.target_value)}</td><td>{point.target_achieved == null ? "Not applicable" : point.target_achieved ? "Yes" : "No"}</td></tr>)}</tbody></table></div>
    </>}
    <p className="text-xs leading-6">Source: {item.result_source}. Eligible: {item.eligible_records}. Excluded by review: {item.quality_excluded_records}. {item.calculation_note}</p>
  </section>;
}

export function SavedReportsWorkspace() {
  const {projectId, project, projects, selectProject} = useWorkspace();
  const cache = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const [record, setRecord] = useState<SavedReport | null>(null);
  const [form, setForm] = useState<ReportInput | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<PeriodKind>("monthly");
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [part, setPart] = useState(new Date().getUTCMonth() + 1);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const templates = useQuery({queryKey: ["report-templates"], queryFn: apiClient.reportTemplates, enabled: Boolean(projectId)});
  const reports = useQuery({queryKey: ["saved-reports", projectId, offset], queryFn: () => apiClient.savedReports(projectId, offset), enabled: Boolean(projectId)});
  const indicators = useQuery({queryKey: ["report-indicator-selection", projectId], queryFn: () => apiClient.indicators(projectId), enabled: editing && record?.status !== "published" && Boolean(projectId)});
  const readonly = record?.status === "published";
  const periodInvalid = kind !== "custom" && (!Number.isInteger(year) || year < 1 || year > 9999);
  const invalid = periodInvalid || !form?.title.trim() || !form.reporting_period_start || !form.reporting_period_end || form.reporting_period_start > form.reporting_period_end;
  const selectedTemplate = templates.data?.find(t => t.key === form?.template_key);
  async function run(action: () => Promise<void>) {
    setPending(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Report action failed. Please try again."); }
    finally { setPending(false); }
  }
  function change(changes: Partial<ReportInput>) { setForm(current => current ? {...current, ...changes} : current); setPreview(null); }
  function newReport() {
    const template = templates.data?.[0]; if (!template) return;
    const now = new Date(); const currentPart = now.getUTCMonth() + 1;
    const dates = reportPeriod("monthly", now.getUTCFullYear(), currentPart);
    setKind("monthly"); setYear(now.getUTCFullYear()); setPart(currentPart);
    setRecord(null); setPreview(null); setStep(1); setError(""); setNotice(""); setEditing(true);
    setForm({title: `${project?.name ?? "Project"} — ${template.name}`, description: "", template_key: template.key,
      reporting_period_start: dates[0], reporting_period_end: dates[1], sections: Object.fromEntries(template.sections.map(k => [k, ""])), indicator_ids: []});
  }
  function period(nextKind: PeriodKind, nextYear: number, nextPart: number) {
    setKind(nextKind); setYear(nextYear); setPart(nextPart);
    if (nextKind !== "custom") {
      try { const [start, end] = reportPeriod(nextKind, nextYear, nextPart); change({reporting_period_start: start, reporting_period_end: end}); setError(""); }
      catch (e) { setError((e as Error).message); }
    }
  }
  async function save() {
    if (!form || invalid) throw new Error("Enter a title and a valid reporting period.");
    const saved = record ? await apiClient.updateReport(record.id, {...inputOf(form), expected_revision: record.revision_number}) : await apiClient.createReport(projectId, inputOf(form));
    setRecord(saved); setForm(inputOf(saved)); setPreview(null);
    await cache.invalidateQueries({queryKey: ["saved-reports", projectId]});
    return saved;
  }
  async function open(id: string) {
    const report = await apiClient.savedReport(id);
    setRecord(report); setForm(inputOf(report)); setEditing(true); setKind("custom"); setPreview(null); setStep(report.status === "published" ? 4 : 1);
    if (report.status === "published") setPreview(await apiClient.reportPreview(id));
  }
  async function download() {
    if (!record) return;
    const bytes = await apiClient.savedReportPdf(record.id, readonly ? undefined : preview?.content_hash);
    const url = URL.createObjectURL(new Blob([bytes], {type: "application/pdf"}));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `fieldsight-${record.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "report"}-${record.reporting_period_start}-${record.reporting_period_end}.pdf`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <Page className="sm:[&>header]:flex-row sm:[&>header]:!items-center" title="Reporting" breadcrumb={`FieldSight / ${project?.name ?? "Project"}`} description=""
    actions={<Button disabled={pending || templates.isLoading || !templates.data || !projectId} onClick={newReport}>Create report</Button>}>
    <WorkspaceGate>
      {(error || reports.error || templates.error) && <Notice error>{error || reports.error?.message || templates.error?.message}<Button variant="secondary" disabled={pending} onClick={() => {void reports.refetch(); void templates.refetch();}}>Retry loading reports</Button></Notice>}
      {notice && <Notice>{notice}</Notice>}
      {!editing ? <Panel className="p-5">
        <div className="mb-4 flex flex-col gap-3 border-b border-[var(--fs-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="m-0 text-base font-semibold leading-6 text-[var(--fs-text)]">Saved reports</h2>
            <p className="mb-0 mt-0.5 text-[12px] leading-5 text-[var(--fs-muted)]">Drafts and published reports for this project.</p>
          </div>
          <label className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
            <span className="shrink-0 text-xs font-medium text-[var(--fs-muted)]">Project</span>
            <select aria-label="Project" className={`${fieldClass} !min-h-9 !rounded-md !py-1.5 !text-xs sm:w-64`} value={projectId} onChange={e => {setOffset(0); selectProject(e.target.value);}}>{projects?.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
          </label>
        </div>
        {reports.isLoading ? <LoadingState label="Loading saved reports…" /> : reports.data?.items.length === 0 ? <p>No saved reports yet. Create a report to start documenting this project's results.</p> : <div className="overflow-x-auto"><table className="fs-data-table w-full min-w-[960px] table-fixed text-left text-sm [&_td]:align-middle [&_th]:align-middle"><colgroup><col className="w-[36%]" /><col className="w-[21%]" /><col className="w-[10%]" /><col className="w-[19%]" /><col className="w-[14%]" /></colgroup><thead className="[&_th]:!bg-[var(--fs-primary-soft)] [&_th]:!py-2.5 [&_th]:!text-[11px] [&_th]:!font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:!text-[var(--fs-muted)]"><tr><th>Report</th><th>Period (UTC)</th><th>Status</th><th>Created / published</th><th className="text-right">Actions</th></tr></thead><tbody>{reports.data?.items.map(r => <tr key={r.id}>
          <td><button className="block w-full break-words text-left text-sm font-medium leading-6 text-[var(--fs-primary)] hover:underline" disabled={pending} onClick={() => void run(() => open(r.id))}>{r.title}</button></td><td className="whitespace-nowrap text-xs tabular-nums">{r.reporting_period_start} — {r.reporting_period_end}</td><td><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${r.status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{label(r.status)}</span></td><td className="text-xs leading-6 tabular-nums">{formatDateTime(r.created_at)}{r.published_at && <><br />{formatDateTime(r.published_at)}</>}</td>
          <td><div className="flex items-center justify-end gap-2">
            {r.status === "draft" && <button type="button" aria-label={`Edit report: ${r.title}`} title="Edit report" disabled={pending}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void run(() => open(r.id))}><Pencil size={17} aria-hidden="true" /></button>}
            <button type="button" aria-label={`Duplicate report: ${r.title}`} title="Duplicate report" disabled={pending}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void run(async () => {const copy = await apiClient.duplicateReport(r.id); await open(copy.id); await cache.invalidateQueries({queryKey: ["saved-reports", projectId]});})}>
              <Copy size={17} aria-hidden="true" />
            </button>
            {r.status === "draft" && <button type="button" aria-label={`Delete draft report: ${r.title}`} title="Delete draft report" disabled={pending}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-colors hover:border-red-400 hover:bg-red-100 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setDeleting(r)}><Trash2 size={17} aria-hidden="true" /></button>}
          </div></td>
        </tr>)}</tbody></table></div>}
        <nav aria-label="Report pagination" className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--fs-border)] pt-4">
          <Button variant="secondary" className="!min-h-8 !rounded-md !px-2.5 !py-1 !text-xs !shadow-none" disabled={offset === 0 || pending} onClick={() => setOffset(offset - 25)}>Previous</Button>
          <span className="text-[11px] text-[var(--fs-muted)]">{reports.data?.total ?? 0} reports</span>
          <Button variant="secondary" className="!min-h-8 !rounded-md !px-2.5 !py-1 !text-xs !shadow-none" disabled={!reports.data || offset + 25 >= reports.data.total || pending} onClick={() => setOffset(offset + 25)}>Next</Button>
        </nav>
      </Panel> : form && <>
        <div className="flex flex-wrap items-center gap-3 print:hidden"><Button variant="secondary" disabled={pending} onClick={() => {setEditing(false); setError(""); setNotice("");}}>Back to saved reports</Button>{readonly && <span className="text-sm">Published • read-only</span>}</div>
        {!readonly && <nav aria-label="Report steps" className="flex flex-wrap gap-2 print:hidden">{["Report information", "Reporting period", "Report content", "Preview", "Save or publish"].map((name, i) => <Button key={name} variant={step === i + 1 ? "primary" : "secondary"} disabled={pending || (i >= 3 && !preview)} onClick={() => setStep(i + 1)} aria-current={step === i + 1 ? "step" : undefined}>{i + 1}. {name}</Button>)}</nav>}
        {readonly && !preview && <Button disabled={pending} onClick={() => void run(async () => {if (record) setPreview(await apiClient.reportPreview(record.id));})}>Retry published report</Button>}
        {!readonly && step < 4 && <Panel className="p-5"><fieldset disabled={pending} className="space-y-5">
          {step === 1 && <><h2 className="text-lg font-semibold">Report information</h2><p className="text-sm">Project: {project?.name}</p>
            <Field label="Report title"><input className={fieldClass} value={form.title} maxLength={200} required onChange={e => change({title: e.target.value})} /></Field>
            <Field label="Report template"><select aria-label="Report template" className={fieldClass} value={form.template_key} onChange={e => {const t = templates.data?.find(t => t.key === e.target.value); if (t) change({template_key: t.key, sections: Object.fromEntries(t.sections.map(k => [k, form.sections[k] ?? ""]))});}}>{templates.data?.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}</select></Field>
            <p className="text-xs">Sections: {selectedTemplate?.sections.map(label).join(" · ")}. Project details, reporting period, and calculated indicator performance are included automatically.</p>
            <Field label="Report description (optional)"><textarea className={fieldClass} value={form.description} maxLength={2000} onChange={e => change({description: e.target.value})} /></Field>
          </>}
          {step === 2 && <><h2 className="text-lg font-semibold">Reporting period</h2><div className="flex flex-wrap items-end gap-4">
            <Field label="Period type"><select aria-label="Period type" className={fieldClass} value={kind} onChange={e => period(e.target.value as PeriodKind, year, 1)}>{["monthly", "quarterly", "semiannual", "annual", "custom"].map(k => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
            {kind !== "custom" && <Field label="Year"><input type="number" min={1} max={9999} className={fieldClass} value={year} onChange={e => period(kind, Number(e.target.value), part)} /></Field>}
            {kind !== "custom" && kind !== "annual" && <Field label={kind === "monthly" ? "Month" : kind === "quarterly" ? "Quarter" : "Half year"}><select aria-label={kind === "monthly" ? "Month" : kind === "quarterly" ? "Quarter" : "Half year"} className={fieldClass} value={part} onChange={e => period(kind, year, Number(e.target.value))}>{Array.from({length: kind === "monthly" ? 12 : kind === "quarterly" ? 4 : 2}, (_, i) => <option key={i} value={i + 1}>{kind === "monthly" ? new Date(Date.UTC(2026, i, 1)).toLocaleString("en", {month: "long", timeZone: "UTC"}) : `${kind === "quarterly" ? "Q" : "H"}${i + 1}`}</option>)}</select></Field>}
            {kind === "custom" && <><Field label="Start date (UTC)"><input type="date" className={fieldClass} value={form.reporting_period_start} onChange={e => change({reporting_period_start: e.target.value})} /></Field><Field label="End date (UTC)"><input type="date" className={fieldClass} value={form.reporting_period_end} onChange={e => change({reporting_period_end: e.target.value})} /></Field></>}
          </div><p className="text-sm">Effective period: {form.reporting_period_start} — {form.reporting_period_end} (UTC)</p>
          {form.reporting_period_start > form.reporting_period_end && <Notice error>Start date must be on or before end date.</Notice>}
          <p className="text-xs">Overall targets are not prorated. Period-specific targets appear alongside their exact UTC period. Custom ranges have no proportional targets.</p></>}
          {step === 3 && <><h2 className="text-lg font-semibold">Report content</h2><fieldset><legend className="font-semibold">Included indicators</legend>
            {indicators.isLoading && <LoadingState label="Loading indicators…" />}{indicators.error && <Notice error>{indicators.error.message}<Button onClick={() => void indicators.refetch()}>Retry indicators</Button></Notice>}
            {indicators.data?.length === 0 && <p>No indicators configured. You can still save a narrative report.</p>}
            <div className="mb-3 flex gap-2"><Button variant="secondary" onClick={() => change({indicator_ids: indicators.data?.map(i => i.id) ?? []})}>Select all</Button><Button variant="secondary" onClick={() => change({indicator_ids: []})}>Clear selection</Button></div>
            {indicators.data?.map(i => <label className="flex items-center gap-3 py-2 text-sm" key={i.id}><input type="checkbox" checked={form.indicator_ids.includes(i.id)} onChange={e => change({indicator_ids: e.target.checked ? [...form.indicator_ids, i.id] : form.indicator_ids.filter(id => id !== i.id)})} />{i.code} — {i.name}</label>)}
          </fieldset><p className="text-xs">Narratives are optional user-authored plain text. They do not change source data.</p>
          {Object.entries(form.sections).map(([key, value]) => <Field label={label(key)} key={key}><textarea rows={key === "executive_summary" ? 6 : 4} maxLength={30000} className={fieldClass} value={value} onChange={e => change({sections: {...form.sections, [key]: e.target.value}})} /></Field>)}
          </>}
          <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={pending || step === 1} onClick={() => setStep(step - 1)}>Previous step</Button>{step < 3 ? <Button disabled={pending || invalid} onClick={() => setStep(step + 1)}>Continue</Button> : <Button disabled={pending || invalid} onClick={() => void run(async () => {const saved = await save(); setPreview(await apiClient.reportPreview(saved.id)); setStep(4);})}>{pending ? "Preparing preview…" : "Save and preview"}</Button>}</div>
        </fieldset></Panel>}
        {(readonly || step >= 4) && preview && <Panel><ReportDocument preview={preview} /></Panel>}
        {!readonly && step === 4 && <Button disabled={pending || !preview} onClick={() => setStep(5)}>Continue to publication</Button>}
        {!readonly && step === 5 && <Notice>Publishing preserves this preview and PDF permanently. For corrections, duplicate the published report and publish a replacement.</Notice>}
        <div className="flex flex-wrap gap-3 print:hidden">
          {!readonly && <Button disabled={pending || invalid} variant="secondary" onClick={() => void run(async () => {await save(); setStep(Math.min(step, 3)); setNotice("Draft saved.");})}>{pending ? "Working…" : "Save draft"}</Button>}
          {!readonly && step === 5 && <Button disabled={pending || !preview || !record} onClick={() => void run(async () => {if (!record || !preview) return; const published = await apiClient.publishReport(record.id, record.revision_number, preview.content_hash); setRecord(published); setForm(inputOf(published)); setPreview(await apiClient.reportPreview(record.id)); await cache.invalidateQueries({queryKey: ["saved-reports", projectId]}); setNotice("Report published. Historical PDF preserved.");})}>Publish report</Button>}
          {record && preview && <Button variant="secondary" disabled={pending} onClick={() => void run(download)}>Download saved PDF</Button>}
          {preview && <Button variant="secondary" disabled={pending} onClick={() => window.print()}>Print preview</Button>}
          {!readonly && record && <Button variant="secondary" disabled={pending} onClick={() => setDeleting(record)}><Trash2 size={16} aria-hidden="true" />Delete draft</Button>}
        </div>
      </>}
    </WorkspaceGate>
    {deleting && <DeleteConfirmation title="Delete draft report" name={deleting.title}
      description="Permanently delete this saved draft report and its narrative content."
      phrase="delete report" actionLabel="Delete report"
      warning="This action cannot be undone. Project indicators and source submissions are retained."
      onClose={() => setDeleting(null)} onConfirm={async () => {
        setPending(true);
        try {
          await apiClient.deleteReport(deleting.id, deleting.revision_number);
          if (record?.id === deleting.id) setEditing(false);
          if (reports.data?.items.length === 1 && offset > 0) setOffset(offset - 25);
          await cache.invalidateQueries({queryKey: ["saved-reports", projectId]});
          setNotice("Draft report deleted.");
        } finally { setPending(false); }
      }} />}
  </Page>;
}
