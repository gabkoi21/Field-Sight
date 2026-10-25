from pathlib import Path
p=Path('fieldsight-frontend/src/pages/organization/IndicatorWorkspacePage.tsx');s=p.read_text(encoding="utf-8").replace('  calculations,','  Dialog,\n  calculations,',1)
s=s.replace('  const [error, setError]', '''  const [review, setReview] = useState<{ kind: "definition" | "mapping"; input: IndicatorInput | IndicatorMappingInput; preview: Awaited<ReturnType<typeof apiClient.indicatorPreview>> } | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  async function reviewDefinition(input: IndicatorInput) {
    if (editing === "new") { definition.mutate(input); return; }
    try {
      const preview = await apiClient.indicatorPreview((editing as Indicator).id, input);
      setReason(""); setConfirmed(false); setReview({kind: "definition", input, preview});
    } catch (cause) { setError((cause as Error).message); }
  }
  async function reviewMapping(input: IndicatorMappingInput) {
    try {
      const preview = await apiClient.indicatorMappingPreview(mapping!.id, input);
      setReason(""); setConfirmed(false); setReview({kind: "mapping", input, preview});
    } catch (cause) { setError((cause as Error).message); }
  }
  const [error, setError]''',1)
s=s.replace('      cache.invalidateQueries({ queryKey: ["indicator-period-targets"] }),','      cache.invalidateQueries({ queryKey: ["indicator-period-targets"] }),\n      cache.invalidateQueries({ queryKey: ["indicator-evidence"] }),\n      cache.invalidateQueries({ queryKey: ["indicator-versions"] }),\n      cache.invalidateQueries({ queryKey: ["dashboard"] }),\n      cache.invalidateQueries({ queryKey: ["dashboard-widget"] }),')
s=s.replace('onSave={(input) => definition.mutate(input)}','onSave={reviewDefinition}').replace('onSave={(input) => map.mutate(input)}','onSave={reviewMapping}')
s=s.replace('["details", "summary", "sources"]','["details", "summary", "sources", "evidence"]',1)
s=s.replace(': "Indicator details"}', ': id === "evidence" ? "Evidence & versions" : "Indicator details"}',1)
s=s.replace('{detailsTab === "details" ? (','{detailsTab === "evidence" ? <IndicatorEvidence indicator={selected} from={dateFrom} to={dateTo} /> : detailsTab === "details" ? (',1)
# Insert review dialog beside existing conditional definition form
pos=s.index('      {editing &&') if '      {editing &&' in s else -1
if pos < 0: print('no edit render')
else:
 s=s[:pos]+'''      {review && <Dialog title="Review definition change" onClose={() => setReview(null)} error={error}>
        <p className="text-xs">{review.preview.notice}</p>
        <p className="text-xs">Affected periods: {review.preview.affected_periods.join(", ") || "No dated results"}</p>
        <p>Actual: {amount(review.preview.before.current_value, review.preview.before.unit)} → {amount(review.preview.after.current_value, review.preview.after.unit)}</p>
        <p className="text-xs">Included: {review.preview.after.mapped_records}; missing: {review.preview.after.missing_records}; invalid: {review.preview.after.invalid_answers}; quality excluded: {review.preview.after.quality_excluded_records}; numerator / denominator: {review.preview.after.numerator ?? "—"} / {review.preview.after.denominator}</p>
        <label className="grid gap-2 text-xs">Reason / explanation for target exceptions<textarea className={inputClass} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label className="my-4 flex gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Apply the new definition to current calculations for all reporting periods. Retain the previous definition in history.</label>
        <Button disabled={!confirmed || reason.trim().length < 3 || definition.isPending || map.isPending} onClick={() => {
          const controls = { change_reason: reason.trim(), confirm_change: true, expected_version: review.preview.expected_version };
          if (review.kind === "definition") definition.mutate({ ...review.input as IndicatorInput, ...controls } as IndicatorInput);
          else map.mutate({ ...review.input as IndicatorMappingInput, ...controls });
          setReview(null);
        }}>Confirm change</Button>
      </Dialog>}
''' + s[pos:]
s += '''

function IndicatorEvidence({ indicator, from, to }: { indicator: Indicator; from: string; to: string }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [indicator.id, from, to]);
  const evidence = useQuery({queryKey: ["indicator-evidence", indicator.id, offset, from, to], queryFn: () => apiClient.indicatorEvidence(indicator.id, offset, from, to)});
  const versions = useQuery({queryKey: ["indicator-versions", indicator.id], queryFn: () => apiClient.indicatorVersions(indicator.id)});
  return <section className="grid gap-3 rounded-lg border bg-white p-5 text-xs">
    <p>Definition v{indicator.definition_version ?? 0} · {indicator.legacy_definition ? "Legacy definition; original approval unknown" : indicator.setup_complete ? "Calculation configured" : "Draft — setup incomplete"}</p>
    {indicator.definition_warnings?.map(warning => <p key={warning} role="status">{warning}</p>)}
    <p>Definition → result source → calculation → baseline/targets → preview. Date filters affect actuals; targets are unchanged. Period results are independent aggregates.</p>
    <p>{evidence.data?.source === "table" ? indicator.mapping_health === "healthy" ? "Linked table" : "Broken mapping" : evidence.data?.source === "manual" ? "Manual results" : "Not configured"} · {evidence.data?.method}</p>
    <p>{evidence.data?.notice}</p>
    {(evidence.error || versions.error) && <p role="alert">{evidence.error?.message || versions.error?.message}</p>}
    {evidence.data?.items.map(item => <article className="rounded border p-3" key={String(item.id)}>
      {Object.entries(item).map(([key, value]) => <div className="break-words" key={key}><strong>{key.replaceAll("_", " ")}: </strong>{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</div>)}
    </article>)}
    <div className="flex gap-3"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><span>{offset + 1}–{Math.min(offset + 25, evidence.data?.total ?? 0)} of {evidence.data?.total ?? 0}</span><Button variant="secondary" disabled={offset + 25 >= (evidence.data?.total ?? 0)} onClick={() => setOffset(offset + 25)}>Next</Button></div>
    <h3>Observed definition changes</h3>
    {versions.data?.map(version => <p key={version.version}>v{version.version} · {version.occurred_at} · {version.reason} · {version.effective_scope}</p>)}
    {!versions.data?.length && <p>No recorded changes. Legacy history has not been fabricated.</p>}
  </section>;
}
'''
p.write_text(s, encoding="utf-8")

