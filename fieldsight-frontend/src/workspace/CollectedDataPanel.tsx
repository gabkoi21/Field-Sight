import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Database, Link2, Plus, Trash2 } from "lucide-react";
import { Button, LoadingSkeleton, LoadingState } from "../components/ui";
import { apiClient, type Indicator } from "../services/apiClient";
import { Dialog } from "../pages/organization/IndicatorForms";
import { Field, Notice, Panel, fieldClass } from "./WorkspaceUI";

export function CollectedDataPanel({
  indicator,
  onMap,
}: {
  indicator: Indicator;
  onMap: () => void;
}) {
  const cache = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [numerator, setNumerator] = useState("");
  const [denominator, setDenominator] = useState("");
  const [method, setMethod] = useState(indicator.manual_aggregation ?? "legacy");
  const [multiplier, setMultiplier] = useState(indicator.manual_rate_multiplier ?? 1);
  const policy = useQuery({ queryKey: ["indicator-policy"], queryFn: apiClient.indicatorPolicy, enabled: !indicator.mapping });
  const aggregation = useMutation({
    mutationFn: () => apiClient.updateIndicator(indicator.id, { manual_aggregation: method, manual_rate_multiplier: multiplier }),
    onSuccess: refresh,
  });
  const pooled = indicator.manual_aggregation === "pooled";
  const [narrative, setNarrative] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const results = useQuery({
    queryKey: ["collected-results", indicator.id],
    queryFn: () => apiClient.collectedResults(indicator.id),
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["indicator-evidence", indicator.id] }),
      cache.invalidateQueries({ queryKey: ["indicator-evidence", indicator.id] }),
      cache.invalidateQueries({ queryKey: ["dashboard-widget"] }),
      cache.invalidateQueries({ queryKey: ["dashboard"] }),
      cache.invalidateQueries({
        queryKey: ["collected-results", indicator.id],
      }),
      cache.invalidateQueries({
        queryKey: ["indicators", indicator.project_id],
      }),
    ]);
  }
  const add = useMutation({
    mutationFn: () =>
      apiClient.addCollectedResult(indicator.id, {
        result_date: date,
        value: indicator.unit === "text" || pooled ? null : Number(value),
        numerator: pooled ? Number(numerator) : null,
        denominator: pooled ? Number(denominator) : null,
        narrative: indicator.unit === "text" ? narrative : null,
        location: location || null,
        notes: notes || null,
      }),
    onSuccess: async () => {
      await refresh();
      setAdding(false);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient.deleteCollectedResult(indicator.id, id),
    onSuccess: refresh,
  });
  return (
    <div className="space-y-4">
      <Panel>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e4ebed] p-5">
          <div>
            <h2 className="m-0 text-base font-semibold">Collected data</h2>
            <p className="mb-0 mt-1 text-xs text-[var(--fs-muted)]">
              Enter a dated result or calculate results from a stored table.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={
                indicator.unit === "text" || Boolean(results.data?.length)
              }
              onClick={onMap}
            >
              <Link2 size={14} />
              Link data table
            </Button>
            <Button
              disabled={Boolean(indicator.mapping) || indicator.manual_aggregation === "legacy" && !indicator.legacy_definition}
              onClick={() => {
                setAdding(true);
                setValue("");
                setNumerator("");
                setDenominator("");
                setNarrative("");
                setNotes("");
                setLocation("");
                add.reset();
              }}
            >
              <Plus size={14} />
              Add manual result
            </Button>
          </div>
        </header>
        <div className="px-5 py-4 text-xs leading-6 text-[var(--fs-muted)]">
          {indicator.manual_aggregation === "legacy" && !indicator.legacy_definition && <p>Choose a calculation method below before adding results.</p>}
          {indicator.mapping ? (
            <>
              <strong>Linked table source</strong> · {indicator.source_form_id}
              <br />
              Actuals use ready responses from this table. Remove the source
              mapping before switching to manual entry.{" "}
              <button
                onClick={onMap}
                className="border-0 bg-transparent text-[var(--fs-primary)] underline"
              >
                Edit source mapping
              </button>
            </>
          ) : indicator.unit === "text" ? (
            "Qualitative indicators store dated narratives. The latest result is shown in the indicator summary."
          ) : (
            indicator.calculation_note || "Manual results are separate from linked table calculations. Choose a calculation method before entering pooled values."
          )}
        </div>
      </Panel>
      {!indicator.mapping && <Panel className="p-5">
        <details open={indicator.manual_aggregation === "legacy" && !indicator.legacy_definition}>
          <summary className="cursor-pointer text-sm font-semibold">Manual result settings</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Manual result aggregation">
              <select className={fieldClass} value={method} onChange={event => setMethod(event.target.value as typeof method)}>
                <option value="legacy" disabled>Choose a calculation method</option>
                {(policy.data?.manual[indicator.unit] ?? []).map(value => <option key={value} value={value}>{({sum: "Sum", unweighted_mean: "Unweighted mean", pooled: "Pooled fraction", latest: "Latest observation"} as Record<string, string>)[value]}</option>)}
              </select>
            </Field>
            {indicator.unit === "rate" && method === "pooled" && <Field label="Rate per population (e.g. 1000)"><input className={fieldClass} type="number" min={0.000001} max={1000000} step="any" value={multiplier} onChange={event => setMultiplier(Number(event.target.value))} /></Field>}
            <div><Button disabled={aggregation.isPending || method === "legacy" || policy.isPending || policy.isError || !Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 1000000} onClick={() => aggregation.mutate()}>Save manual settings</Button></div>
          </div>
        </details>
      </Panel>}
      {[results.error, add.error, remove.error, aggregation.error].filter(Boolean).map((e, i) => (
        <Notice error key={i}>
          {e?.message}
        </Notice>
      ))}
      {indicator.mapping && (
        <Panel className="flex items-center gap-3 p-5 text-xs text-[var(--fs-muted)]">
          <Database size={19} className="text-[var(--fs-primary)]" />
          <span>
            {indicator.eligible_records} ready records ·{" "}
            {indicator.missing_records} missing answers ·{" "}
            {indicator.invalid_answers} invalid answers
          </span>
          <Link className="ml-auto text-[var(--fs-primary)]" to={`/data-tables?project_id=${indicator.project_id}`}>
            View stored data →
          </Link>
        </Panel>
      )}
      {results.isFetching && results.data && <LoadingState variant="inline" label="Updating collected records…" />}
      {results.error && <Button variant="secondary" onClick={() => void results.refetch()}>Retry collected records</Button>}
      <Panel>
        {results.isLoading ? (
          <LoadingSkeleton label="Loading collected records…" />
        ) : results.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-[#f8fafb] text-[12px] uppercase tracking-wide text-[var(--fs-muted)]">
                <tr>
                  {["Date", "Result", "Location", "Notes", ""].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.data.map((row) => (
                  <tr key={row.id} className="border-t border-[#edf0f2]">
                    <td className="whitespace-nowrap px-5 py-4">
                      {row.result_date}
                    </td>
                    <td className="max-w-[380px] whitespace-pre-wrap px-5 py-4 leading-6">
                      {pooled && row.numerator != null && row.denominator ? `${row.numerator} / ${row.denominator} = ${row.value?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "—"}` : row.narrative ?? row.value?.toLocaleString() ?? "—"}
                      {indicator.unit === "percentage" ? "%" : ""}
                    </td>
                    <td className="px-5">{row.location ?? "Not reported"}</td>
                    <td className="max-w-[260px] px-5 leading-5">
                      {row.notes ?? "—"}
                    </td>
                    <td className="px-5">
                      <button
                        aria-label={`Delete result from ${row.result_date}`}
                        disabled={remove.isPending}
                        className="border-0 bg-transparent text-[#bb6370]"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this manually entered result?",
                            )
                          )
                            remove.mutate(row.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : results.error ? null : (
          <div className="p-10 text-center text-sm text-[var(--fs-muted)]">
            {indicator.mapping
              ? "This indicator uses linked table data. No manual entries are stored."
              : "No collected results yet. Add a manual result or link an imported table."}
          </div>
        )}
      </Panel>
      {adding && (
        <Dialog
          title="Add collected result"
          description={indicator.name}
          error={add.error?.message}
          onClose={() => setAdding(false)}
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Field label="Result date">
              <input
                type="date"
                required
                className={fieldClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            {pooled ? <>
              <Field label="Numerator"><input required type="number" min={0} max={1e15} step="any" className={fieldClass} value={numerator} onChange={event => setNumerator(event.target.value)} /></Field>
              <Field label="Denominator"><input required type="number" min={0.000001} max={1e15} step="any" className={fieldClass} value={denominator} onChange={event => setDenominator(event.target.value)} /></Field>
              <p className="text-xs">Results pool the underlying counts for each period and location. A zero numerator is valid; denominator must be greater than zero.</p>
            </> : indicator.unit === "text" ? (
              <Field label="Qualitative result">
                <textarea
                  required
                  maxLength={4000}
                  rows={4}
                  className={fieldClass}
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                />
              </Field>
            ) : (
              <Field
                label={
                  indicator.unit === "percentage"
                    ? "Result (%)"
                    : "Numeric result"
                }
              >
                <input
                  type="number"
                  step="any"
                  required
                  min={indicator.unit === "percentage" ? 0 : undefined}
                  max={indicator.unit === "percentage" ? 100 : undefined}
                  className={fieldClass}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
            )}
            <Field label="Location (optional)">
              <input
                maxLength={200}
                className={fieldClass}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
            <Field label="Evidence / notes (optional)">
              <textarea
                maxLength={2000}
                className={fieldClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={add.isPending}>
              Save result
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
