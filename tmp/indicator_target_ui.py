from pathlib import Path
p=Path('fieldsight-backend/app/routes/indicators.py');s=p.read_text().replace('from typing import Annotated, Literal, cast','from typing import Annotated, Any, Literal, cast').replace('        filters = [\n            Submission.', '        filters: list[Any] = [\n            Submission.',1);p.write_text(s)
p=Path('fieldsight-frontend/src/pages/organization/IndicatorWorkspacePage.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('kind: "definition" | "mapping"; input: IndicatorInput | IndicatorMappingInput;', 'kind: "definition" | "mapping" | "targets"; input: IndicatorInput | IndicatorMappingInput | Array<{period: string; target_value: number}>;')
s=s.replace('  const [error, setError]', '''  async function reviewTargets(input: Array<{period: string; target_value: number}>) {
    try {
      const preview = await apiClient.indicatorTargetsPreview(periodTargets!.id, input);
      setReason(""); setConfirmed(false); setReview({kind: "targets", input, preview});
    } catch (cause) { setError((cause as Error).message); }
  }
  const [error, setError]''',1)
s=s.replace('mutationFn: (input: Array<{ period: string; target_value: number }>) =>\n      apiClient.saveIndicatorPeriodTargets(periodTargets!.id, input),','mutationFn: (input: {rows: Array<{ period: string; target_value: number }>; controls: {confirm_change: boolean; change_reason: string; expected_version: number}}) =>\n      apiClient.saveIndicatorPeriodTargets(periodTargets!.id, input.rows, input.controls),')
s=s.replace('else map.mutate({ ...review.input as IndicatorMappingInput, ...controls });','else if (review.kind === "mapping") map.mutate({ ...review.input as IndicatorMappingInput, ...controls });\n          else targets.mutate({ rows: review.input as Array<{period: string; target_value: number}>, controls });')
s=s.replace('onSave={(input) => targets.mutate(input)}','onSave={reviewTargets}').replace('{periodTargets && (','{periodTargets && !review && (')
s=s.replace('(sourceFilter === "mapped" && item.mapping_health === "healthy")','(sourceFilter === "mapped" && item.result_source === "table")').replace('(sourceFilter === "unmapped" && item.mapping_health !== "healthy")','(sourceFilter === "unmapped" && item.result_source !== "table")')
s=s.replace('      : item.mapping_health !== "healthy"\n        ? item.mapping_health === "unmapped"\n          ? "Not mapped"\n          : "Check source"', '      : item.result_source === "unconfigured"\n        ? "Not configured"\n        : item.result_source === "table" && item.mapping_health !== "healthy"\n          ? "Broken mapping"')
p.write_text(s,encoding='utf-8')
p=Path('fieldsight-frontend/src/workspace/CollectedDataPanel.tsx');s=p.read_text(encoding='utf-8').replace('disabled={Boolean(indicator.mapping)}','disabled={Boolean(indicator.mapping) || indicator.manual_aggregation === "legacy" && !indicator.legacy_definition}',1)
s=s.replace('        <div className="px-5 py-4 text-xs leading-6 text-[#73868d]">','        <div className="px-5 py-4 text-xs leading-6 text-[#73868d]">\n          {indicator.manual_aggregation === "legacy" && !indicator.legacy_definition && <p>Select an explicit aggregation method in indicator settings before adding results.</p>}',1)
p.write_text(s,encoding='utf-8')
p=Path('fieldsight-backend/tests/test_indicator_results.py');s=p.read_text();s=s.replace('api.put(\n        f"/indicators/{item[\'id\']}/period-targets",','api.put(\n        f"/indicators/{item[\'id\']}/period-targets?confirm_change=true&change_reason=Reviewed%20targets&expected_version=0",',1)
s=s.replace('api.put(f"/indicators/{item[\'id\']}/period-targets", headers=headers, json=[])','api.put(f"/indicators/{item[\'id\']}/period-targets?confirm_change=true&change_reason=Reviewed%20targets&expected_version=1", headers=headers, json=[])')
p.write_text(s)
