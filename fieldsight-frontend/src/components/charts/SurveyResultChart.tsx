import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult, SavedAnalysis } from "../../services/apiClient";

const colors = ["#0b51b7", "#60a5fa", "#7756a8", "#a86612", "#ba4055", "#334155", "#526477"];
const number = (value: number | null) => value == null ? "Not reported" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
export const conciseLabel = (label: string) => label.length > 28 ? label.slice(0, 27) + "..." : label;
export function surveyChartTypes(field: AnalysisResult["field"] | undefined, groupBy: string | null): SavedAnalysis["chart"][] {
  if (field?.type === "text") return ["table"];
  return ["bar", ...(field?.type === "date" && !groupBy ? ["line" as const] : []), ...(!groupBy && (field?.type === "select_one") ? ["pie" as const] : []), "table"];
}
export function defaultSurveyChart(field: AnalysisResult["field"] | undefined, groupBy: string | null): SavedAnalysis["chart"] {
  if (field?.type === "select_one" && !groupBy) return "pie";
  if (field?.type === "date" && !groupBy) return "line";
  return field?.type === "text" ? "table" : "bar";
}
export function effectiveSurveyChart(result: AnalysisResult, requested: SavedAnalysis["chart"]): SavedAnalysis["chart"] {
  const types = surveyChartTypes(result.field, result.group_by);
  if (result.field.type === "text") return "table";
  if (requested === "donut") return types.includes("pie") && result.measure === "count" ? "donut" : "bar";
  return types.includes(requested) && (requested !== "pie" || result.measure === "count") ? requested : "bar";
}
export function surveyCategoryColor(result: AnalysisResult, name: string, index: number): string {
  const choice = result.field.choices.find(item => item.label === name);
  const code = (choice?.value ?? name).trim().toLowerCase();
  if (code === "yes" || name.trim().toLowerCase() === "yes") return "#245493";
  if (code === "no" || name.trim().toLowerCase() === "no") return "#38843f";
  return colors[index % colors.length];
}
export function surveyChartData(result: AnalysisResult) {
  return result.series.map(point => ({ ...point, label: point.group == null ? point.name : `${point.name} / Group: ${point.group}` }));
}
function ResponseText({ text }: { text: string | null }) {
  if (!text || text.length <= 60) return <>{text}</>;
  return <details className="min-w-0"><summary className="min-h-11 cursor-pointer py-2 text-[var(--fs-primary)]">{text.slice(0, 52).trimEnd()}...<span className="sr-only"> Expand full response</span></summary><p className="m-0 whitespace-pre-wrap pb-2 pt-1 font-normal">{text}</p></details>;
}
export function SurveyResultsTable({ result }: { result: AnalysisResult }) {
  return <div className="min-w-0 overflow-x-auto"><table className="w-full table-fixed border-collapse text-left text-xs">
    <caption className="sr-only">Survey chart values for {result.field.label}. Percentages use {result.denominator} usable answered submissions.</caption>
    <thead className="bg-slate-50 text-[var(--fs-muted)]"><tr><th scope="col" className="w-2/5 px-3 py-3">Response / period</th>{result.group_by && <th scope="col" className="px-3 py-3">Group</th>}<th scope="col" className="px-2 py-3">Value</th><th scope="col" className="px-2 py-3">Records</th><th scope="col" className="px-2 py-3">% answered</th></tr></thead>
    <tbody>{result.series.map((point, index) => <tr key={index} className="border-t border-slate-100"><th scope="row" aria-label={point.name} className="break-words px-3 py-3 font-medium [overflow-wrap:anywhere]"><ResponseText text={point.name} /></th>{result.group_by && <td className="break-words px-3 py-3 [overflow-wrap:anywhere]"><ResponseText text={point.group} /></td>}<td className="px-2 py-3 tabular-nums">{number(point.value)}</td><td className="px-2 py-3 tabular-nums">{number(point.count)}</td><td className="px-2 py-3 tabular-nums">{point.percent == null ? "Not reported" : number(point.percent) + "%"}</td></tr>)}</tbody>
  </table></div>;
}
export function SurveyResultChart({ result, chart: requested }: { result: AnalysisResult; chart: SavedAnalysis["chart"] }) {
  const chart = effectiveSurveyChart(result, requested);
  const data = surveyChartData(result);
  const slices = data.map((point, index) => ({...point, color: surveyCategoryColor(result, point.name, index)})).filter(point => point.count > 0);
  if (chart === "table") return <SurveyResultsTable result={result} />;
  if (!result.answered_records || !data.length) return <p role="status" className="p-6 text-center text-sm text-[var(--fs-muted)]">No usable answers match this question and filters. Missing answers are not zero responses.</p>;
  if (data.length > 60) return <p role="status" className="p-6 text-sm text-[var(--fs-muted)]">This result has {data.length} categories. Use the table or narrow your filters to chart up to 60 categories.</p>;
  const tooltip = <Tooltip content={({ active, payload }) => {
    const point = payload?.[0]?.payload as typeof data[number] | undefined;
    if (!active || !point) return null;
    return <div className="max-w-[min(280px,75vw)] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"><p className="m-0 break-words font-semibold [overflow-wrap:anywhere]">{point.label}</p><p className="mb-0 mt-2">{number(point.count)} records / {point.percent == null ? "Percentage unavailable" : number(point.percent) + "% answered"}</p>{result.measure !== "count" && <p>{result.measure}: {number(point.value)}</p>}</div>;
  }} />;
  if (chart === "pie" || chart === "donut") return <div className="flex h-full min-h-0 min-w-0 flex-col">
    <div className="min-h-[180px] min-w-0 flex-1" role="img" aria-label={`Response ${chart} chart for ${result.field.label}. Exact values are in the accompanying table.`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={slices} dataKey="count" nameKey="label" innerRadius="42%" outerRadius="80%" isAnimationActive={false}>{slices.map((point, index) => <Cell key={index} fill={point.color} stroke="white" />)}</Pie>{tooltip}</PieChart></ResponsiveContainer></div>
    <ul aria-label="Response legend" className="m-0 flex min-w-0 shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-2 px-2 pb-2 pt-3 text-xs">{data.map((point, index) => <li key={index} className="flex min-w-0 items-start gap-2"><span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full" style={{background: surveyCategoryColor(result, point.name, index)}} /><span className="min-w-0 break-words [overflow-wrap:anywhere]" title={point.label}>{conciseLabel(point.label)}</span></li>)}</ul>
  </div>;
  return <div className="h-full min-w-0" role="img" aria-label={`Response ${chart} chart for ${result.field.label}. Exact values are in the accompanying table.`}><ResponsiveContainer width="100%" height="100%">{chart === "line" ? <LineChart data={data} margin={{left: 0, right: 12, bottom: 24}}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tickFormatter={conciseLabel} tick={{fontSize: 11}} /><YAxis tick={{fontSize: 11}} />{tooltip}<Line dataKey="value" name={result.measure} stroke={colors[0]} strokeWidth={2} isAnimationActive={false} connectNulls={false} /></LineChart> : <BarChart data={data} margin={{left: 0, right: 12, bottom: 32}}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tickFormatter={conciseLabel} tick={{fontSize: 11}} minTickGap={20} height={55} /><YAxis tick={{fontSize: 11}} allowDecimals={result.measure !== "count"} />{tooltip}<Bar dataKey="value" name={result.measure} fill={colors[0]} maxBarSize={72} radius={[3,3,0,0]} isAnimationActive={false} /></BarChart>}</ResponsiveContainer></div>;
}
