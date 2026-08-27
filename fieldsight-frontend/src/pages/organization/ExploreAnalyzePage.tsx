import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  Filter,
  Hash,
  Lightbulb,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { LoadingState } from "../../components/ui";
import { apiClient } from "../../services/apiClient";

const metadataFields = new Set(["_id", "_uuid", "_submission_time", "_submitted_by", "_attachments", "_geolocation", "_status", "_tags", "_notes", "_validation_status", "meta"]);
const technicalQuestionPattern = /(^|\/)(start|end|today|device[_\s]?id|subscriber[_\s]?id|simserial|phone[_\s]?number|username|formhub|version|instance[_\s]?id|instance[_\s]?name|root[_\s]?uuid|uuid|id|notes|consent|name|device)$/i;
const priorityQuestionPattern = /(consent|gender|sex|age|location|county|district|community|status|outcome|access|service|health|condition|symptom|facility|water|income|education|employment|satisfaction)/i;
const palette = ["#0b51b7", "#6d81f5", "#16a6a1", "#e6a23c", "#d75c68", "#8b72c8"];

function displayField(field: string) {
  const name = field.split("/").pop()?.replaceAll("_", " ") ?? field;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
function scalarValues(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(scalarValues);
  if (typeof value === "object") return [JSON.stringify(value)];
  return [String(value)];
}
function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function compactNumber(value: number) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function ExploreAnalyzePage() {
  const [searchParams] = useSearchParams();
  const [projectIdState, setProjectId] = useState(() => searchParams.get("project_id") ?? "");
  const [reviewStatus, setReviewStatus] = useState("ready");
  const [field, setField] = useState("");
  const [compareField, setCompareField] = useState("");
  const [chartOverride, setChartOverride] = useState("");

  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const isOrganizationAdmin = userQuery.data?.memberships.some((membership) => membership.role === "organization_admin") ?? false;
  const projectsQuery = useQuery({ queryKey: ["organization-projects", organizationId], queryFn: () => apiClient.organizationProjects(organizationId!), enabled: Boolean(organizationId) });

  const projectId = projectIdState || (projectsQuery.data?.[0]?.id ?? "");

  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: apiClient.submissions });
  const mappingsQuery = useQuery({ queryKey: ["field-mappings", projectId], queryFn: () => apiClient.fieldMappings(projectId), enabled: Boolean(projectId) });

  const submissions = submissionsQuery.data ?? [];
  const records = useMemo(() => submissions.filter((item) => (!projectId || item.project_id === projectId) && (!reviewStatus || item.review_status === reviewStatus)), [submissions, projectId, reviewStatus]);
  const mappingNames = new Map((mappingsQuery.data?.mappings ?? []).map((mapping) => [mapping.source_field, mapping.display_name]));
  const fieldLabel = (key: string) => mappingNames.get(key) ?? displayField(key);

  const fieldProfiles = useMemo(() => {
    const keys = Array.from(new Set(records.flatMap((item) => Object.keys(item.raw_answers).filter((key) => !metadataFields.has(key) && !key.startsWith("_") && !technicalQuestionPattern.test(key)))));
    return keys.map((key) => {
      const answered = records.filter((item) => scalarValues(item.raw_answers[key]).length > 0).length;
      const unique = new Set(records.flatMap((item) => scalarValues(item.raw_answers[key]))).size;
      const coverage = records.length ? answered / records.length : 0;
      const recommended = priorityQuestionPattern.test(key) || (coverage >= 0.75 && unique > 1 && unique <= 20);
      return { key, answered, unique, coverage, recommended, score: (priorityQuestionPattern.test(key) ? 100 : 0) + coverage * 20 + (unique > 1 ? 5 : 0) };
    }).sort((a, b) => displayField(a.key).localeCompare(displayField(b.key)));
  }, [records]);

  const fields = fieldProfiles.map((item) => item.key);
  const selectedField = field && fields.includes(field) ? field : fields[0] ?? "";
  const values = useMemo(() => records.flatMap((item) => scalarValues(item.raw_answers[selectedField])), [records, selectedField]);
  const rawValues = useMemo(() => records.map((item) => item.raw_answers[selectedField]).filter((value) => value !== null && value !== undefined && value !== ""), [records, selectedField]);
  const numericValues = values.map(Number).filter(Number.isFinite);
  const isNumeric = values.length > 0 && numericValues.length / values.length >= 0.8;
  const isMultiple = rawValues.some(Array.isArray);
  const dateValues = values.map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()));
  const isDate = values.length > 0 && !isNumeric && dateValues.length / values.length >= 0.8 && values.some((value) => /^\d{4}-\d{2}-\d{2}/.test(value));
  const average = numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : 0;
  const sortedNumbers = [...numericValues].sort((a, b) => a - b);
  const median = sortedNumbers.length ? (sortedNumbers[Math.floor((sortedNumbers.length - 1) / 2)] + sortedNumbers[Math.ceil((sortedNumbers.length - 1) / 2)]) / 2 : 0;

  const frequency = useMemo(() => {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return Array.from(counts, ([name, count]) => ({ name, count, percent: values.length ? Math.round(count / values.length * 100) : 0 })).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [values]);
  const histogram = useMemo(() => {
    if (!numericValues.length) return [];
    const min = Math.min(...numericValues), max = Math.max(...numericValues);
    if (min === max) return [{ name: String(min), count: numericValues.length }];
    const size = (max - min) / Math.min(8, Math.max(3, Math.ceil(Math.sqrt(numericValues.length))));
    const bins = Array.from({ length: Math.ceil((max - min) / size) }, (_, index) => ({ name: `${(min + index * size).toFixed(1)}–${(min + (index + 1) * size).toFixed(1)}`, count: 0 }));
    numericValues.forEach((value) => { bins[Math.min(bins.length - 1, Math.floor((value - min) / size))].count += 1; });
    return bins;
  }, [numericValues]);
  const dateFrequency = useMemo(() => {
    const counts = new Map<string, number>();
    dateValues.forEach((value) => { const key = value.toISOString().slice(0, 10); counts.set(key, (counts.get(key) ?? 0) + 1); });
    return Array.from(counts, ([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  }, [values]);
  const trend = useMemo(() => {
    const counts = new Map<string, { received: number; ready: number }>();
    records.forEach((item) => {
      if (!item.submitted_at) return;
      const day = new Date(item.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const current = counts.get(day) ?? { received: 0, ready: 0 };
      current.received += 1;
      if (item.review_status === "ready") current.ready += 1;
      counts.set(day, current);
    });
    return Array.from(counts, ([day, counts]) => ({ day, ...counts })).slice(-14);
  }, [records]);

  const automaticChart = isDate ? "line" : isNumeric ? "histogram" : isMultiple || frequency.length > 6 ? "bar" : "donut";
  const chartType = chartOverride || automaticChart;
  const chartLabel = { line: "Time series", histogram: "Distribution", bar: "Response ranking", donut: "Share of responses" }[chartType] ?? "Chart";
  const readyCount = records.filter((item) => item.review_status === "ready").length;
  const answerRate = records.length ? Math.round(rawValues.length / records.length * 100) : 0;
  const topResponse = frequency[0];
  const insight = !records.length ? "Choose a project with synchronized records to begin analysis." : isNumeric ? `${fieldLabel(selectedField)} averages ${average.toLocaleString(undefined, { maximumFractionDigits: 1 })}, with a median of ${median.toLocaleString(undefined, { maximumFractionDigits: 1 })}.` : topResponse ? `${topResponse.name} is the leading response for ${fieldLabel(selectedField)}, representing ${topResponse.percent}% of answered records.` : `No usable answers are available for ${fieldLabel(selectedField)}.`;

  const availableCompareFields = useMemo(() => fields.filter((item) => item !== selectedField), [fields, selectedField]);
  const resolvedCompareField = compareField && availableCompareFields.includes(compareField) ? compareField : availableCompareFields[0] ?? "";

  const comparisonKeys = useMemo(() => {
    if (!resolvedCompareField) return [];
    const counts = new Map<string, number>();
    records.flatMap((item) => scalarValues(item.raw_answers[resolvedCompareField])).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key]) => key);
  }, [records, resolvedCompareField]);
  const crossTab = useMemo(() => frequency.slice(0, 8).map((primary) => {
    const row: Record<string, string | number> = { name: primary.name };
    comparisonKeys.forEach((comparison) => {
      row[comparison] = records.filter((item) => scalarValues(item.raw_answers[selectedField]).includes(primary.name) && scalarValues(item.raw_answers[resolvedCompareField]).includes(comparison)).length;
    });
    return row;
  }), [records, selectedField, resolvedCompareField, comparisonKeys, frequency]);

  function reset() { setProjectId(""); setReviewStatus("ready"); setField(""); setCompareField(""); setChartOverride(""); }
  function exportCsv() {
    if (!isOrganizationAdmin || !selectedField) return;
    const rows = [["submission_id", "project", "submitted_at", "review_status", selectedField].map(escapeCsv).join(","), ...records.map((item) => [item.external_id, item.project_name, item.submitted_at, item.review_status, scalarValues(item.raw_answers[selectedField]).join(" | ")].map(escapeCsv).join(","))];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectId ? records[0]?.project_name ?? "project" : "all-projects"}-${fieldLabel(selectedField)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (userQuery.isLoading || projectsQuery.isLoading || submissionsQuery.isLoading) return <LoadingState />;
  return <div className="text-[#25324a]">
    <header className="mb-5 flex items-start justify-between gap-4 max-[700px]:flex-col">
      <div><p className="mb-1 mt-0 text-[10px] font-bold uppercase tracking-[.12em] text-brand">Project intelligence</p><h1 className="m-0 text-[30px] font-bold tracking-[-.7px]">Analysis</h1><p className="mb-0 mt-1 max-w-[650px] text-[13px] text-[#75849a]">Turn synchronized field records into evidence, comparisons, and practical project signals.</p></div>
      <button className="inline-flex items-center gap-2 rounded-lg border border-[#cdd9ea] bg-white px-4 py-2.5 text-xs font-semibold text-brand shadow-sm disabled:opacity-50" onClick={exportCsv} disabled={!records.length || !selectedField || !isOrganizationAdmin}><Download size={15} /> Export analysis</button>
    </header>

    <section className="mb-4 grid grid-cols-4 gap-3 max-[950px]:grid-cols-2 max-[520px]:grid-cols-1">
      <Metric label="Records analyzed" value={compactNumber(records.length)} note={projectId ? records[0]?.project_name ?? "Selected project" : "Across all projects"} icon={Database} />
      <Metric label="Analysis-ready" value={`${records.length ? Math.round(readyCount / records.length * 100) : 0}%`} note={`${readyCount.toLocaleString()} ready records`} icon={CheckCircle2} />
      <Metric label="Answer coverage" value={`${answerRate}%`} note={`${rawValues.length.toLocaleString()} answered`} icon={BarChart3} />
      <Metric label={isNumeric ? "Average value" : "Distinct responses"} value={isNumeric ? compactNumber(average) : compactNumber(frequency.length)} note={selectedField ? fieldLabel(selectedField) : "Select a question"} icon={Hash} />
    </section>
    <Card className="mb-4 flex items-end gap-3 p-4 max-[900px]:flex-wrap">
      <span className="mb-2 flex items-center gap-1.5 text-xs font-bold"><SlidersHorizontal size={15} /> Analysis controls</span>
      <Select label="Project" textSize="text-sm" value={projectId} onChange={(value) => { setProjectId(value); setField(""); setCompareField(""); setChartOverride(""); }}>{(projectsQuery.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select>
      <Select label="Primary question" value={selectedField} onChange={(value) => { setField(value); setCompareField(""); setChartOverride(""); }} grow><option value="">No fields</option>{fieldProfiles.map((item) => <option key={item.key} value={item.key}>{fieldLabel(item.key)}</option>)}</Select>
      <button className="mb-1 inline-flex items-center gap-1 border-0 bg-transparent px-2 py-2 text-xs font-semibold text-brand" onClick={reset}><RefreshCw size={13} /> Reset</button>
    </Card>

    <section className="mb-4 grid grid-cols-[minmax(0,1.55fr)_minmax(290px,.65fr)] gap-4 max-[980px]:grid-cols-1">
      <Card>
        <CardHeader title={selectedField ? fieldLabel(selectedField) : "Question analysis"} subtitle={chartLabel}><select className="rounded-md border border-[#dce5ef] bg-white px-2 py-1.5 text-[10px]" value={chartOverride} onChange={(event) => setChartOverride(event.target.value)}><option value="">Recommended</option><option value="bar">Bar</option><option value="donut">Donut</option>{isNumeric && <option value="histogram">Distribution</option>}{isDate && <option value="line">Time series</option>}</select></CardHeader>
        <div className="h-[360px] p-5">{!values.length ? <EmptyChart /> : chartType === "donut" ? <ResponsiveContainer><PieChart><Pie data={frequency} dataKey="count" nameKey="name" innerRadius={78} outerRadius={122} paddingAngle={3}>{frequency.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : chartType === "line" ? <ResponsiveContainer><AreaChart data={dateFrequency}><defs><linearGradient id="fieldArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0b51b7" stopOpacity={0.28} /><stop offset="95%" stopColor="#0b51b7" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf1f5" /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="count" stroke="#0b51b7" strokeWidth={2.5} fill="url(#fieldArea)" /></AreaChart></ResponsiveContainer> : <ResponsiveContainer><BarChart data={chartType === "histogram" ? histogram : frequency} layout={chartType === "histogram" ? "horizontal" : "vertical"} margin={{ left: chartType === "histogram" ? 0 : 45, bottom: chartType === "histogram" ? 28 : 0 }}><CartesianGrid vertical={chartType === "histogram"} horizontal={chartType !== "histogram"} stroke="#edf1f5" />{chartType === "histogram" ? <><XAxis dataKey="name" angle={-20} textAnchor="end" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /></> : <><XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9 }} /></>}<Tooltip /><Bar dataKey="count" fill="#0b51b7" radius={chartType === "histogram" ? [5, 5, 0, 0] : [0, 5, 5, 0]} /></BarChart></ResponsiveContainer>}</div>
      </Card>
      <Card><CardHeader title="Response ranking" subtitle="Highest shares in this question" /><div className="space-y-4 p-5">{frequency.slice(0, 6).map((item, index) => <div key={item.name}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate"><i className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />{item.name}</span><strong>{item.percent}%</strong></div><div className="h-1.5 rounded-full bg-[#edf1f6]"><i className="block h-full rounded-full" style={{ width: `${item.percent}%`, backgroundColor: palette[index % palette.length] }} /></div></div>)}{!frequency.length && <p className="text-xs text-[#8190a4]">No response ranking is available.</p>}</div><div className="mx-5 mb-5 rounded-lg bg-[#f5f8fc] p-3 text-[11px] leading-5 text-[#64748b]"><strong className="text-[#26364d]">Interpretation</strong><br />{insight}</div></Card>
    </section>

    <section className="mb-4 grid grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)] gap-4 max-[980px]:grid-cols-1">
      <Card><CardHeader title="Collection momentum" subtitle="Submission and ready-record trend" /><div className="h-[280px] p-5">{trend.length ? <ResponsiveContainer><AreaChart data={trend}><defs><linearGradient id="receivedArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0b51b7" stopOpacity={0.24} /><stop offset="95%" stopColor="#0b51b7" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf1f5" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="received" stroke="#0b51b7" strokeWidth={2.5} fill="url(#receivedArea)" /><Area type="monotone" dataKey="ready" stroke="#6d81f5" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer> : <EmptyChart />}</div></Card>
      <Card><CardHeader title="Field health" subtitle="Reliability of the selected evidence" /><div className="p-5"><HealthRow label="Answer coverage" value={answerRate} /><HealthRow label="Analysis-ready records" value={records.length ? Math.round(readyCount / records.length * 100) : 0} /><HealthRow label="Field diversity" value={Math.min(100, frequency.length * 10)} /><dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-[#f6f8fb] p-4 text-xs"><div><dt className="text-[#8190a4]">Answered</dt><dd className="m-0 mt-1 text-lg font-bold">{rawValues.length}</dd></div><div><dt className="text-[#8190a4]">Missing</dt><dd className="m-0 mt-1 text-lg font-bold">{Math.max(0, records.length - rawValues.length)}</dd></div>{isNumeric && <><div><dt className="text-[#8190a4]">Minimum</dt><dd className="m-0 mt-1 font-bold">{Math.min(...numericValues)}</dd></div><div><dt className="text-[#8190a4]">Maximum</dt><dd className="m-0 mt-1 font-bold">{Math.max(...numericValues)}</dd></div></>}</dl></div></Card>
    </section>

    <Card><CardHeader title="Compare two questions" subtitle="Reveal differences between beneficiary groups, locations, or outcomes"><select className="rounded-md border border-[#dce5ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#34445c]" value={resolvedCompareField} onChange={(event) => setCompareField(event.target.value)}>{availableCompareFields.map((item) => <option key={item} value={item}>{fieldLabel(item)}</option>)}</select></CardHeader><div className="h-[310px] p-5">{resolvedCompareField && crossTab.length && comparisonKeys.length ? <ResponsiveContainer><BarChart data={crossTab}><CartesianGrid vertical={false} stroke="#edf1f5" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />{comparisonKeys.map((key, index) => <Bar key={key} dataKey={key} fill={palette[index % palette.length]} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-xs text-[#8190a4]"><div><Filter className="mx-auto mb-2" size={20} /><p className="m-0">Choose a comparison field to build a cross-tab chart.</p></div></div>}</div></Card>
  </div>;
}

function Select({ label, value, onChange, children, grow = false, textSize = "text-base" }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; grow?: boolean; textSize?: string }) {
  return <label className={`grid min-w-[170px] gap-1 text-xs font-bold text-[#8491a3] ${grow ? "flex-1" : ""}`}>{label}<select className={`rounded-md border border-[#dce5ef] bg-white px-3 py-2 ${textSize} font-bold text-[#34445c]`} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}
function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Database }) {
  return <Card className="p-4"><div className="flex justify-between"><div><small className="text-[10px] font-bold uppercase tracking-[.07em] text-[#77869a]">{label}</small><strong className="mt-2 block text-[24px] tracking-[-.5px]">{value}</strong></div><span className="grid size-10 place-items-center rounded-md bg-[#eaf2ff] text-brand"><Icon size={18} /></span></div><p className="mb-0 mt-2 flex items-center gap-1 text-[10px] text-[#8996a8]"><ArrowUpRight size={11} />{note}</p></Card>;
}
function CardHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return <header className="flex items-center justify-between gap-3 border-b border-[#e9eef4] px-5 py-4"><div><h2 className="m-0 text-sm font-semibold text-[#24334a]">{title}</h2><p className="mb-0 mt-1 text-[10px] text-[#8b98aa]">{subtitle}</p></div>{children}</header>;
}
function HealthRow({ label, value }: { label: string; value: number }) {
  return <div className="mb-4"><div className="mb-1.5 flex justify-between text-xs"><span className="text-[#64748b]">{label}</span><strong>{value}%</strong></div><div className="h-2 rounded-full bg-[#e8edf3]"><i className="block h-full rounded-full bg-brand" style={{ width: `${value}%` }} /></div></div>;
}
function EmptyChart() {
  return <div className="grid h-full place-items-center text-xs text-[#8190a4]">No data is available for this view.</div>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`overflow-hidden border border-[#e1e7ef] bg-white shadow-[0_4px_14px_rgba(23,40,70,.04)] ${className}`}>{children}</article>;
}