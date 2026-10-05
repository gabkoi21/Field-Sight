import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Link2, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../auth/AuthContext";
import { Button, Card, CardHeader, LoadingState } from "../../components/ui";
import {
  apiClient,
  ApiError,
  type Indicator,
  type IndicatorCreateInput,
  type IndicatorField,
  type IndicatorInput,
  type IndicatorMappingInput,
  type IndicatorStatus,
  type IndicatorUnit,
} from "../../services/apiClient";

const emptyIndicator: IndicatorInput = {
  name: "", code: "", description: null, unit: "number", direction: "increase",
  baseline_value: null, target_value: null, target_date: null, reporting_frequency: "monthly",
};

const units: Record<IndicatorUnit, string> = {
  number: "Number", percentage: "Percentage", rate: "Rate", ratio: "Ratio",
  currency: "Currency", days: "Days", text: "Text",
};

function automaticMapping(unit: IndicatorUnit, sourceField: string): IndicatorMappingInput {
  if (unit === "percentage") return { source_field: sourceField, calculation: "percentage_matching", match_value: "Yes" };
  if (unit === "text") return { source_field: sourceField, calculation: "count_records", match_value: null };
  return { source_field: sourceField, calculation: "average", match_value: null };
}

function value(valueToFormat: number | null, unit: IndicatorUnit) {
  if (valueToFormat === null) return "Not set";
  return unit === "percentage" ? String(valueToFormat) + "%" : valueToFormat.toLocaleString();
}

export function ProjectIndicatorsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = user?.memberships[0]?.organization_id;
  const [editing, setEditing] = useState<Indicator | "new" | null>(null);
  const [choosingQuestion, setChoosingQuestion] = useState<Indicator | null>(null);
  const [monitoringIndicator, setMonitoringIndicator] = useState<Indicator | null>(null);
  const [error, setError] = useState("");
  const projectQuery = useQuery({
    queryKey: ["project", organizationId, projectId],
    queryFn: () => apiClient.getProject(organizationId!, projectId!),
    enabled: Boolean(!authLoading && organizationId && projectId),
  });
  const indicatorsQuery = useQuery({
    queryKey: ["indicators", projectId],
    queryFn: () => apiClient.indicators(projectId!),
    enabled: Boolean(!authLoading && projectId),
  });
  const fieldsQuery = useQuery({
    queryKey: ["indicator-fields", projectId],
    queryFn: () => apiClient.indicatorFields(projectId!),
    enabled: Boolean((editing === "new" || choosingQuestion) && projectId),
  });
  const saveMutation = useMutation({
    mutationFn: (input: IndicatorCreateInput) => {
      if (editing === "new") return apiClient.createIndicator(projectId!, input);
      if (editing) {
        const { mapping: _, ...changes } = input;
        return apiClient.updateIndicator(editing.id, changes);
      }
      throw new Error("No indicator selected.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["indicators", projectId] });
      setEditing(null);
      setError("");
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : "Unable to save the indicator."),
  });
  const questionMutation = useMutation({
    mutationFn: (input: IndicatorMappingInput) => apiClient.saveIndicatorMapping(choosingQuestion!.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["indicators", projectId] });
      setChoosingQuestion(null);
      setError("");
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : "Unable to save the Kobo question."),
  });
  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteIndicator,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["indicators", projectId] }),
  });
  const connectedCount = useMemo(
    () => (indicatorsQuery.data ?? []).filter((indicator) => indicator.mapping).length,
    [indicatorsQuery.data],
  );

  if (authLoading || projectQuery.isLoading || indicatorsQuery.isLoading) return <LoadingState />;
  if (projectQuery.error || indicatorsQuery.error) {
    const cause = projectQuery.error ?? indicatorsQuery.error;
    return <p className="rounded-md bg-[#fff0f2] p-4 text-sm text-[#b42318]">{cause instanceof ApiError ? cause.message : "Unable to load indicators."}</p>;
  }
  const project = projectQuery.data;
  if (!project) return <LoadingState />;
  const indicators = indicatorsQuery.data ?? [];

  return <div className="flex flex-col gap-[18px] pb-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Link to={"/projects/" + project.id} className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-[#748299] no-underline hover:text-brand"><ArrowLeft size={14} /> {project.name}</Link>
        <h1 className="m-0 text-[1.75rem] font-bold leading-tight text-[#1d2a38]">Indicator register</h1>
        <p className="mb-0 mt-1 text-sm text-[#718096]">Define the measures used to monitor this project’s results.</p>
      </div>
      <Button onClick={() => { setError(""); setEditing("new"); }}><Plus size={16} /> Add indicator</Button>
    </div>
    <nav className="flex gap-1 overflow-x-auto border-b border-[#e5eaf0]">
      <NavLink to={"/projects/" + project.id} className="shrink-0 border-b-2 border-transparent px-3.5 py-3 text-[13px] font-semibold text-[#75849a] no-underline hover:text-[#344562]">Overview</NavLink>
      <span className="shrink-0 border-b-2 border-brand px-3.5 py-3 text-[13px] font-semibold text-brand">Indicators</span>
      <NavLink to={"/analytics?project_id=" + project.id} className="shrink-0 border-b-2 border-transparent px-3.5 py-3 text-[13px] font-semibold text-[#75849a] no-underline hover:text-[#344562]">Analytics</NavLink>
    </nav>
    <section className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
      <Summary label="Active indicators" value={String(indicators.filter((indicator) => indicator.is_active).length)} />
      <Summary label="With a target" value={String(indicators.filter((indicator) => indicator.target_value !== null).length)} />
      <Summary label="Kobo question selected" value={String(connectedCount)} />
    </section>
    <Card>
      <CardHeader title="Project indicators" subtitle="Baseline, target, and current performance"><span className="text-xs font-semibold text-[#66768d]">{indicators.length} total</span></CardHeader>
      {indicators.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead className="bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[.06em] text-[#718096]"><tr><th className="px-5 py-3">Indicator</th><th className="px-4 py-3">Baseline</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Current result</th><th className="px-4 py-3">Kobo question</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
        <tbody>{indicators.map((indicator) => <tr key={indicator.id} className="border-t border-[#edf0f4] text-[#344562]">
          <td className="px-5 py-4"><strong className="block text-[13px] text-[#1d2a38]">{indicator.name}</strong><span className="mt-1 block font-mono text-[10px] text-[#718096]">{indicator.code}</span></td>
          <td className="px-4 py-4">{value(indicator.baseline_value, indicator.unit)}</td>
          <td className="px-4 py-4">{value(indicator.target_value, indicator.unit)}</td>
          <td className="px-4 py-4"><strong className="text-[13px] text-[#24334a]">{value(indicator.current_value, indicator.unit)}</strong></td>
          <td className="px-4 py-4"><button type="button" onClick={() => { setError(""); setChoosingQuestion(indicator); }} className={"inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold " + (indicator.mapping ? "bg-[#e8f6f4] text-[#08725a]" : "bg-[#fff7e6] text-[#9a6700]")}><Link2 size={12} />{indicator.mapping ? "Selected" : "Choose question"}</button></td>
          <td className="px-4 py-4"><Status status={indicator.status} /></td>
          <td className="px-5 py-4"><div className="flex justify-end gap-1"><IconButton label="View indicator monitoring" onClick={() => setMonitoringIndicator(indicator)}><BarChart3 size={15} /></IconButton><IconButton label="Edit indicator" onClick={() => { setError(""); setEditing(indicator); }}><Pencil size={15} /></IconButton><IconButton label="Delete indicator" destructive onClick={() => { if (window.confirm("Delete " + indicator.name + "?")) deleteMutation.mutate(indicator.id); }}><Trash2 size={15} /></IconButton></div></td>
        </tr>)}</tbody>
      </table></div> : <div className="grid place-items-center px-5 py-14 text-center"><span className="grid size-11 place-items-center rounded-full bg-[#edf3fc] text-brand"><Target size={20} /></span><strong className="mt-3 text-sm text-[#24334a]">No indicators yet</strong><p className="m-0 mt-1 max-w-sm text-xs leading-5 text-[#718096]">Add the measures this project is accountable for and select its Kobo question in the same form.</p><Button className="mt-4" onClick={() => setEditing("new")}><Plus size={15} /> Add first indicator</Button></div>}
    </Card>
    {editing && <IndicatorForm indicator={editing === "new" ? null : editing} fields={fieldsQuery.data ?? []} loading={fieldsQuery.isLoading} error={error} saving={saveMutation.isPending} onClose={() => setEditing(null)} onSubmit={(input) => saveMutation.mutate(input)} />}
    {choosingQuestion && <QuestionForm indicator={choosingQuestion} fields={fieldsQuery.data ?? []} loading={fieldsQuery.isLoading} error={error} saving={questionMutation.isPending} onClose={() => setChoosingQuestion(null)} onSubmit={(input) => questionMutation.mutate(input)} />}
    {monitoringIndicator && <MonitoringModal indicator={monitoringIndicator} onClose={() => setMonitoringIndicator(null)} />}
  </div>;
}

function Summary({ label, value: summaryValue }: { label: string; value: string }) {
  return <Card className="p-4"><p className="m-0 text-[11px] font-bold uppercase tracking-[.06em] text-[#8491a5]">{label}</p><strong className="mt-2 block text-2xl text-[#24334a]">{summaryValue}</strong></Card>;
}

function Status({ status }: { status: IndicatorStatus }) {
  const classes: Record<IndicatorStatus, string> = { not_started: "bg-[#edf3fc] text-[#3864a5]", on_track: "bg-[#e8f6f4] text-[#08725a]", needs_attention: "bg-[#fff0e8] text-[#b54708]" };
  const labels: Record<IndicatorStatus, string> = { not_started: "Not started", on_track: "On track", needs_attention: "Needs attention" };
  return <span className={"rounded px-2 py-1 text-[10px] font-semibold " + classes[status]}>{labels[status]}</span>;
}

function IconButton({ children, label, onClick, destructive = false }: { children: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={"grid size-8 place-items-center rounded-md border border-[#dfe6ee] bg-white " + (destructive ? "text-[#b42318] hover:bg-[#fff0f2]" : "text-[#536177] hover:text-brand")}>{children}</button>;
}

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-[#475569]"><span>{label}</span><div className="[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[#dfe6ee] [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[#dfe6ee] [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-[#dfe6ee] [&_textarea]:px-3 [&_textarea]:py-2">{children}</div></label>;
}

function IndicatorForm({ indicator, fields, loading, error, saving, onClose, onSubmit }: { indicator: Indicator | null; fields: IndicatorField[]; loading: boolean; error: string; saving: boolean; onClose: () => void; onSubmit: (input: IndicatorCreateInput) => void }) {
  const [form, setForm] = useState<IndicatorInput>(indicator ? { name: indicator.name, code: indicator.code, description: indicator.description, unit: indicator.unit, direction: indicator.direction, baseline_value: indicator.baseline_value, target_value: indicator.target_value, target_date: indicator.target_date, reporting_frequency: indicator.reporting_frequency } : emptyIndicator);
  const [sourceField, setSourceField] = useState("");
  const update = <K extends keyof IndicatorInput>(key: K, fieldValue: IndicatorInput[K]) => setForm((current) => ({ ...current, [key]: fieldValue }));
  const submit = () => onSubmit({ ...form, mapping: sourceField ? automaticMapping(form.unit, sourceField) : null });
  return <Modal title={indicator ? "Edit indicator" : "Add indicator"} subtitle="Set the measure and performance expectation." error={error} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); submit(); }} className="grid gap-4"><InputField label="Indicator name"><input required value={form.name} onChange={(event) => update("name", event.target.value)} /></InputField><InputField label="Code"><input required value={form.code} onChange={(event) => update("code", event.target.value.toUpperCase())} /></InputField><InputField label="Description"><textarea rows={3} value={form.description ?? ""} onChange={(event) => update("description", event.target.value || null)} /></InputField>{!indicator && <InputField label="Kobo question"><select value={sourceField} onChange={(event) => setSourceField(event.target.value)} disabled={loading || !fields.length}><option value="">{loading ? "Loading Kobo questions..." : fields.length ? "Choose a question (optional)" : "No Kobo questions available"}</option>{fields.map((field) => <option key={field.source_field} value={field.source_field}>{field.label}</option>)}</select></InputField>}<div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1"><InputField label="Unit"><select value={form.unit} onChange={(event) => update("unit", event.target.value as IndicatorUnit)}>{(Object.keys(units) as IndicatorUnit[]).map((unit) => <option key={unit} value={unit}>{units[unit]}</option>)}</select></InputField><InputField label="Direction"><select value={form.direction} onChange={(event) => update("direction", event.target.value as IndicatorInput["direction"])}><option value="increase">Increase is better</option><option value="decrease">Decrease is better</option></select></InputField></div><div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1"><InputField label="Baseline"><input type="number" value={form.baseline_value ?? ""} onChange={(event) => update("baseline_value", event.target.value ? Number(event.target.value) : null)} /></InputField><InputField label="Target"><input type="number" value={form.target_value ?? ""} onChange={(event) => update("target_value", event.target.value ? Number(event.target.value) : null)} /></InputField></div><div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1"><InputField label="Target date"><input type="date" value={form.target_date ?? ""} onChange={(event) => update("target_date", event.target.value || null)} /></InputField><InputField label="Reporting frequency"><select value={form.reporting_frequency} onChange={(event) => update("reporting_frequency", event.target.value as IndicatorInput["reporting_frequency"])}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semi_annual">Semi-annual</option><option value="annual">Annual</option></select></InputField></div><ModalActions saving={saving} label={indicator ? "Save changes" : "Create indicator"} onClose={onClose} /></form></Modal>;
}

function QuestionForm({ indicator, fields, loading, error, saving, onClose, onSubmit }: { indicator: Indicator; fields: IndicatorField[]; loading: boolean; error: string; saving: boolean; onClose: () => void; onSubmit: (input: IndicatorMappingInput) => void }) {
  const [sourceField, setSourceField] = useState(indicator.mapping?.source_field ?? "");
  return <Modal title="Choose Kobo question" subtitle="FieldSight will set the calculation automatically." error={error} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSubmit(automaticMapping(indicator.unit, sourceField)); }} className="grid gap-4"><InputField label="Kobo question"><select required value={sourceField} onChange={(event) => setSourceField(event.target.value)} disabled={loading || !fields.length}><option value="">{loading ? "Loading Kobo questions..." : fields.length ? "Choose a question" : "No Kobo questions available"}</option>{fields.map((field) => <option key={field.source_field} value={field.source_field}>{field.label}</option>)}</select></InputField><ModalActions saving={saving} label="Save question" onClose={onClose} disabled={!sourceField} /></form></Modal>;
}

function Modal({ title, subtitle, error, onClose, children, wide = true }: { title: string; subtitle: string; error: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#172033]/35 p-4"><section className={(wide ? "max-w-[860px]" : "max-w-[620px]") + " max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-xl"}><header className="flex items-start justify-between gap-3 border-b border-[#e5eaf0] pb-4"><div><h2 className="m-0 text-lg font-bold text-[#1d2a38]">{title}</h2><p className="mb-0 mt-1 text-xs text-[#718096]">{subtitle}</p></div><IconButton label="Close" onClick={onClose}><X size={17} /></IconButton></header>{error && <p className="mt-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{error}</p>}<div className="mt-5">{children}</div></section></div>;
}

function ModalActions({ saving, label, onClose, disabled = false }: { saving: boolean; label: string; onClose: () => void; disabled?: boolean }) {
  return <div className="mt-2 flex justify-end gap-2 border-t border-[#e5eaf0] pt-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || disabled}>{saving ? "Saving..." : label}</Button></div>;
}

function MonitoringModal({ indicator, onClose }: { indicator: Indicator; onClose: () => void }) {
  const chartData = indicator.history.filter((point) => point.value !== null).map((point) => ({ ...point, label: new Date(point.period + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  return <Modal title={indicator.name} subtitle="Results over time and by location." error="" onClose={onClose}><div className="grid gap-5"><section><div className="grid grid-cols-3 gap-3 max-[520px]:grid-cols-1"><MonitoringMetric label="Current result" value={value(indicator.current_value, indicator.unit)} /><MonitoringMetric label="Target" value={value(indicator.target_value, indicator.unit)} /><MonitoringMetric label="Valid records" value={String(indicator.eligible_records)} /></div></section><section><h3 className="m-0 text-sm font-bold text-[#24334a]">Trend over time</h3>{chartData.length ? <div className="mt-3 h-[220px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}><CartesianGrid stroke="#e9edf2" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} /><Tooltip formatter={(chartValue) => value(typeof chartValue === "number" ? chartValue : null, indicator.unit)} /><Line type="monotone" dataKey="value" stroke="#0b51b7" strokeWidth={2.5} dot={{ r: 3, fill: "#ffffff", stroke: "#0b51b7", strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div> : <p className="mb-0 mt-3 rounded-md bg-[#f8fafc] p-3 text-xs text-[#718096]">No dated Kobo submissions are available yet.</p>}</section><section><h3 className="m-0 text-sm font-bold text-[#24334a]">Results by location</h3>{indicator.location_breakdown.length ? <div className="mt-3 overflow-hidden rounded-md border border-[#e5eaf0]"><table className="w-full border-collapse text-left text-xs"><thead className="bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[.06em] text-[#718096]"><tr><th className="px-3 py-2">Location</th><th className="px-3 py-2">Result</th><th className="px-3 py-2 text-right">Valid records</th></tr></thead><tbody>{indicator.location_breakdown.map((item) => <tr key={item.location} className="border-t border-[#edf0f4]"><td className="px-3 py-2.5 text-[#344562]">{item.location}</td><td className="px-3 py-2.5 font-semibold text-[#24334a]">{value(item.value, indicator.unit)}</td><td className="px-3 py-2.5 text-right text-[#66768d]">{item.eligible_records}</td></tr>)}</tbody></table></div> : <p className="mb-0 mt-3 rounded-md bg-[#f8fafc] p-3 text-xs text-[#718096]">No location information is available yet.</p>}</section><div className="flex justify-end border-t border-[#e5eaf0] pt-4"><Button variant="secondary" onClick={onClose}>Close</Button></div></div></Modal>;
}

function MonitoringMetric({ label, value: metricValue }: { label: string; value: string }) {
  return <div className="rounded-md border border-[#e5eaf0] bg-[#fbfcfd] p-3"><span className="block text-[10px] font-bold uppercase tracking-[.06em] text-[#718096]">{label}</span><strong className="mt-1 block text-lg text-[#24334a]">{metricValue}</strong></div>;
}
