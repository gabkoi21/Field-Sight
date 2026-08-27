import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { BarChart3, Database, Download, FileCheck2, Filter, Hash, RefreshCw } from "lucide-react";
import { LoadingState } from "../../components/ui";
import { apiClient } from "../../services/apiClient";

const metadataFields = new Set(["_id", "_uuid", "_submission_time", "_submitted_by", "_attachments", "_geolocation", "_status", "_tags", "_notes", "_validation_status", "meta"]);
const technicalQuestionPattern = /(^|\/)(start|end|today|deviceid|subscriberid|simserial|phonenumber|username|formhub|version|instanceid)$/i;
const priorityQuestionPattern = /(consent|gender|sex|age|location|county|district|community|status|outcome|access|service|health|condition|symptom|facility|water|income|education|employment|satisfaction)/i;
function displayField(field: string) { return field.split("/").pop()?.replaceAll("_", " ") ?? field; }
function scalarValues(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(scalarValues);
  if (typeof value === "object") return [JSON.stringify(value)];
  return [String(value)];
}
function escapeCsv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export function ExploreAnalyzePage() {
  const [projectId, setProjectId] = useState("");
  const [reviewStatus, setReviewStatus] = useState("ready");
  const [field, setField] = useState("");
  const [chartOverride, setChartOverride] = useState("");
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const isOrganizationAdmin = userQuery.data?.memberships.some((membership) => membership.role === "organization_admin") ?? false;
  const projectsQuery = useQuery({ queryKey: ["organization-projects", organizationId], queryFn: () => apiClient.organizationProjects(organizationId!), enabled: Boolean(organizationId) });
  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: apiClient.submissions });
  const submissions = submissionsQuery.data ?? [];
  const records = useMemo(() => submissions.filter((item) => (!projectId || item.project_id === projectId) && (!reviewStatus || item.review_status === reviewStatus)), [submissions, projectId, reviewStatus]);
  const fieldProfiles = useMemo(() => {
    const keys = Array.from(new Set(records.flatMap((item) => Object.keys(item.raw_answers).filter((key) => !metadataFields.has(key) && !key.startsWith("_") && !technicalQuestionPattern.test(key)))));
    return keys.map((key) => {
      const answered = records.filter((item) => scalarValues(item.raw_answers[key]).length > 0).length;
      const unique = new Set(records.flatMap((item) => scalarValues(item.raw_answers[key]))).size;
      const coverage = records.length ? answered / records.length : 0;
      const recommended = priorityQuestionPattern.test(key) || (coverage >= 0.75 && unique > 1 && unique <= 20);
      const score = (priorityQuestionPattern.test(key) ? 100 : 0) + coverage * 20 + (unique > 1 ? 5 : 0);
      return { key, answered, unique, coverage, recommended, score };
    }).sort((a, b) => b.score - a.score || displayField(a.key).localeCompare(displayField(b.key)));
  }, [records]);
  const fields = fieldProfiles.map((profile) => profile.key);
  const recommendedFields = fieldProfiles.filter((profile) => profile.recommended);
  const otherFields = fieldProfiles.filter((profile) => !profile.recommended);
  const selectedField = field && fields.includes(field) ? field : fields[0] ?? "";
  const values = useMemo(() => records.flatMap((item) => scalarValues(item.raw_answers[selectedField])), [records, selectedField]);
  const rawValues = useMemo(() => records.map((item) => item.raw_answers[selectedField]).filter((value) => value !== null && value !== undefined && value !== ""), [records, selectedField]);
  const numericValues = values.map(Number).filter((value) => Number.isFinite(value));
  const isNumeric = values.length > 0 && numericValues.length / values.length >= 0.8;
  const isMultiple = rawValues.some(Array.isArray);
  const dateValues = values.map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()));
  const isDate = values.length > 0 && !isNumeric && dateValues.length / values.length >= 0.8 && values.some((value) => /^\d{4}-\d{2}-\d{2}/.test(value));
  const gpsValues = values.map((value) => {
    const parts = value.replace(",", " ").split(/\s+/).map(Number);
    return parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180 ? { latitude: parts[0], longitude: parts[1], value } : null;
  }).filter((value): value is { latitude: number; longitude: number; value: string } => Boolean(value));
  const isGps = (selectedField.toLowerCase().includes("gps") || selectedField.toLowerCase().includes("geopoint")) && gpsValues.length > 0;
  const average = numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : 0;
  const frequency = useMemo(() => {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12);
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
  const automaticChart = isGps ? "gps" : isDate ? "line" : isNumeric ? "histogram" : isMultiple || frequency.length > 6 ? "bar" : "donut";
  const chartType = chartOverride || automaticChart;
  const chartLabel = { gps: "GPS coordinate plot", line: "Time series", histogram: "Histogram", bar: "Horizontal bar", donut: "Donut chart" }[chartType] ?? "Chart";
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
  const readyCount = records.filter((item) => item.review_status === "ready").length;
  const completion = records.length ? Math.round((readyCount / records.length) * 100) : 0;

  function reset() { setProjectId(""); setReviewStatus("ready"); setField(""); setChartOverride(""); }
  function exportCsv() {
    if (!isOrganizationAdmin || !selectedField) return;
    const rows = [
      ["submission_id", "project", "submitted_at", "review_status", selectedField].map(escapeCsv).join(","),
      ...records.map((item) => [item.external_id, item.project_name, item.submitted_at, item.review_status, scalarValues(item.raw_answers[selectedField]).join(" | ")].map(escapeCsv).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectId ? records[0]?.project_name ?? "project" : "all-projects"}-${displayField(selectedField)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (userQuery.isLoading || projectsQuery.isLoading || submissionsQuery.isLoading) return <LoadingState />;
  return <div className="text-[#25324a]">
    <header className="mb-5 flex items-start justify-between gap-4 max-[650px]:flex-col"><div><p className="mb-1 mt-0 text-[10px] font-bold uppercase tracking-[.09em] text-brand">Analysis workspace</p><h1 className="m-0 text-[28px] font-bold tracking-[-.45px]">Explore &amp; analyze</h1><p className="mb-0 mt-1 text-[13px] text-[#75849a]">Discover fields from each project’s Kobo records and analyze quality-approved data.</p></div><button className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={exportCsv} disabled={!records.length || !selectedField || !isOrganizationAdmin} title={isOrganizationAdmin ? "Download the selected question data" : "Only organization administrators can download data"}><Download size={15} /> Download selected field</button></header>

    <section className="mb-4 flex items-end gap-3 rounded-lg border border-[#e5ebf2] bg-white p-4 max-[850px]:flex-wrap"><span className="mb-2 flex items-center gap-1 text-xs font-bold"><Filter size={15} /> Filters</span><label className="grid min-w-[210px] gap-1 text-[10px] font-bold text-[#8491a3]">Project<select className="rounded-md border border-[#dce5ef] bg-white px-3 py-2 text-xs" value={projectId} onChange={(event) => { setProjectId(event.target.value); setField(""); setChartOverride(""); }}><option value="">All projects</option>{(projectsQuery.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="grid min-w-[180px] gap-1 text-[10px] font-bold text-[#8491a3]">Record status<select className="rounded-md border border-[#dce5ef] bg-white px-3 py-2 text-xs" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}><option value="ready">Ready only</option><option value="">All records</option><option value="needs_review">Needs review</option><option value="invalid">Invalid</option></select></label><label className="grid min-w-[220px] flex-1 gap-1 text-[10px] font-bold text-[#8491a3]">Question / field<select className="rounded-md border border-[#dce5ef] bg-white px-3 py-2 text-xs" value={selectedField} onChange={(event) => { setField(event.target.value); setChartOverride(""); }} disabled={!fields.length}>{fields.length ? <><optgroup label="Recommended questions">{recommendedFields.map((item) => <option key={item.key} value={item.key}>{displayField(item.key)} · {Math.round(item.coverage * 100)}% answered</option>)}</optgroup>{otherFields.length > 0 && <optgroup label="Other questions">{otherFields.map((item) => <option key={item.key} value={item.key}>{displayField(item.key)} · {Math.round(item.coverage * 100)}% answered</option>)}</optgroup>}</> : <option>No fields available</option>}</select></label><button className="mb-1 inline-flex items-center gap-1 px-2 py-2 text-xs font-semibold text-brand" onClick={reset}><RefreshCw size={13} /> Reset</button></section>

    <section className="mb-4 grid grid-cols-4 gap-3 max-[950px]:grid-cols-2 max-[520px]:grid-cols-1">{[
      { label: "Records in view", value: records.length.toLocaleString(), note: projectId ? `${records[0]?.project_name ?? "Selected project"} only` : "Across all projects", icon: Database },
      { label: "Ready records", value: readyCount.toLocaleString(), note: `${completion}% of current view`, icon: FileCheck2 },
      { label: "Available fields", value: fields.length.toLocaleString(), note: `${recommendedFields.length} recommended questions`, icon: BarChart3 },
      { label: isNumeric ? "Average" : "Unique responses", value: isNumeric ? average.toLocaleString(undefined, { maximumFractionDigits: 2 }) : frequency.length.toLocaleString(), note: selectedField ? displayField(selectedField) : "Select a field", icon: Hash },
    ].map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-lg border border-[#e5ebf2] bg-white p-4"><div className="flex justify-between"><div><small className="text-[10px] font-bold uppercase text-[#738298]">{label}</small><strong className="mt-2 block text-[22px]">{value}</strong></div><span className="grid size-9 place-items-center rounded-lg bg-[#edf3fc] text-brand"><Icon size={17} /></span></div><p className="mb-0 mt-2 text-[10px] text-[#8996a8]">{note}</p></article>)}</section>

    <section className="mb-4 grid grid-cols-[minmax(0,1.35fr)_minmax(300px,.85fr)] gap-4 max-[950px]:grid-cols-1"><article className="rounded-lg border border-[#e4eaf2] bg-white"><header className="flex items-center justify-between gap-3 border-b border-[#e9eef4] p-4"><div><h2 className="m-0 text-sm">{selectedField ? displayField(selectedField) : "Field distribution"}</h2><p className="mb-0 mt-1 text-[10px] text-[#8b98aa]">Automatically selected: {chartLabel}</p></div><select className="rounded-md border border-[#dce5ef] bg-white px-2 py-1.5 text-[10px]" value={chartOverride} onChange={(event) => setChartOverride(event.target.value)}><option value="">Auto ({chartLabel})</option><option value="bar">Bar chart</option><option value="donut">Donut chart</option>{isNumeric && <option value="histogram">Histogram</option>}{isDate && <option value="line">Line chart</option>}{isGps && <option value="gps">GPS plot</option>}</select></header><div className="h-[320px] p-4">{!values.length ? <div className="grid h-full place-items-center text-xs text-[#8190a4]">No values are available for this field.</div> : chartType === "donut" ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={frequency} dataKey="count" nameKey="name" innerRadius={65} outerRadius={105} paddingAngle={2}>{frequency.map((item, index) => <Cell key={item.name} fill={["#0b51b7", "#6d81f5", "#08a88a", "#f0a34a", "#d85d67", "#9a7bd1"][index % 6]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : chartType === "line" ? <ResponsiveContainer width="100%" height="100%"><LineChart data={dateFrequency}><CartesianGrid vertical={false} stroke="#edf1f5" /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#0b51b7" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer> : chartType === "gps" ? <ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid stroke="#edf1f5" /><XAxis type="number" dataKey="longitude" name="Longitude" domain={["dataMin", "dataMax"]} tick={{ fontSize: 9 }} /><YAxis type="number" dataKey="latitude" name="Latitude" domain={["dataMin", "dataMax"]} tick={{ fontSize: 9 }} /><ZAxis range={[70, 70]} /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={gpsValues} fill="#0b51b7" /></ScatterChart></ResponsiveContainer> : chartType === "histogram" ? <ResponsiveContainer width="100%" height="100%"><BarChart data={histogram} margin={{ bottom: 35 }}><CartesianGrid vertical={false} stroke="#edf1f5" /><XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="count" fill="#0b51b7" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><BarChart data={frequency} layout="vertical" margin={{ left: 35, right: 12 }}><CartesianGrid horizontal={false} stroke="#edf1f5" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="count" fill="#0b51b7" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer>}</div></article><article className="rounded-lg border border-[#e4eaf2] bg-white"><header className="border-b border-[#e9eef4] p-4"><h2 className="m-0 text-sm">Field summary</h2><p className="mb-0 mt-1 text-[10px] text-[#8b98aa]">Detected as {isGps ? "GPS" : isDate ? "date" : isNumeric ? "numeric" : isMultiple ? "multiple response" : "categorical"}</p></header><dl className="grid grid-cols-2 gap-4 p-5 text-xs"><div><dt className="text-[#8b98aa]">Answered</dt><dd className="m-0 mt-1 text-xl font-bold">{values.length}</dd></div><div><dt className="text-[#8b98aa]">Missing</dt><dd className="m-0 mt-1 text-xl font-bold">{Math.max(0, records.length - rawValues.length)}</dd></div>{isNumeric && <><div><dt className="text-[#8b98aa]">Minimum</dt><dd className="m-0 mt-1 font-bold">{Math.min(...numericValues)}</dd></div><div><dt className="text-[#8b98aa]">Maximum</dt><dd className="m-0 mt-1 font-bold">{Math.max(...numericValues)}</dd></div></>}</dl><div className="mx-5 mb-5 rounded-md bg-[#f4f7fb] p-3 text-[10px] leading-4 text-[#66768d]">FieldSight selected <strong>{chartLabel}</strong> based on the values in this field. Use the chart menu to override it.</div></article></section>

    <section className="rounded-lg border border-[#e4eaf2] bg-white"><header className="border-b border-[#e9eef4] p-4"><h2 className="m-0 text-sm">Submission trend</h2><p className="mb-0 mt-1 text-[10px] text-[#8b98aa]">Records received by submission date</p></header><div className="h-[250px] p-4">{trend.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid vertical={false} stroke="#edf1f5" /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="received" fill="#0b51b7" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-xs text-[#8190a4]">No dated records in the current view.</div>}</div></section>
  </div>;
}




