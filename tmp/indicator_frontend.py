from pathlib import Path
p=Path('fieldsight-backend/alembic/versions/0028_indicator_reliability.py');s=p.read_text().replace('    op.add_column("indicators", sa.Column("definition_version", sa.Integer(), nullable=False, server_default="0"))\n    op.add_column("indicators", sa.Column("reliability_policy", sa.Integer(), nullable=False, server_default="0"))','''    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("indicators")}
    for name in ("definition_version", "reliability_policy"):
        if name not in columns:
            op.add_column("indicators", sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
    if "indicator_definition_versions" in inspector.get_table_names():
        return''');p.write_text(s)
p=Path('fieldsight-frontend/src/services/apiClient.ts');s=p.read_text().replace('"legacy" | "unweighted_mean" | "pooled"','"legacy" | "unweighted_mean" | "pooled" | "sum" | "latest"')
s=s.replace('export interface Indicator {','export interface Indicator {\n  definition_version?: number;\n  legacy_definition?: boolean;\n  setup_complete?: boolean;\n  definition_warnings?: string[];')
s=s.replace('  is_active?: boolean;\n};','  is_active?: boolean;\n  change_reason?: string;\n  confirm_change?: boolean;\n  expected_version?: number;\n};',1)
s=s.replace('  createIndicator: (projectId:', '''  indicatorPolicy: () => request<{ linked: Record<IndicatorUnit, string[]>; manual: Record<IndicatorUnit, string[]> }>("/indicator-calculation-policy"),
  indicatorPreview: (id: string, input: IndicatorUpdateInput) => request<{ expected_version: number; affected_periods: string[]; before: Indicator; after: Indicator; notice: string }>(`/indicators/${id}/definition-preview`, { method: "POST", body: JSON.stringify(input) }),
  indicatorEvidence: (id: string, offset = 0, from = "", to = "") => request<{ source: string; method: string; definition_version: number; total: number; items: Array<Record<string, unknown>>; notice: string }>(`/indicators/${id}/evidence?offset=${offset}&limit=25${from ? `&date_from=${from}` : ""}${to ? `&date_to=${to}` : ""}`),
  indicatorVersions: (id: string) => request<Array<{ version: number; reason: string; occurred_at: string; effective_scope: string }>>(`/indicators/${id}/versions`),
  createIndicator: (projectId:''')
p.write_text(s)
p=Path('fieldsight-frontend/src/pages/organization/IndicatorForms.tsx');s=p.read_text()
s=s.replace('  const [form, setForm] = useState<IndicatorInput>(', '  const policy = useQuery({ queryKey: ["indicator-policy"], queryFn: apiClient.indicatorPolicy });\n  const [form, setForm] = useState<IndicatorInput>(',1)
s=s.replace('{["percentage", "rate", "ratio"].includes(form.unit) && <>','{<>',1)
s=s.replace('<option value="legacy">Keep legacy unweighted mean</option>\n                    <option value="unweighted_mean">Explicit unweighted mean (equal weight per entry)</option>\n                    <option value="pooled">Pool numerators and denominators</option>', '''<option value="legacy">{indicator ? "Legacy method (selection unknown)" : "Choose a method before entering results"}</option>
                    {(policy.data?.manual[form.unit] ?? []).map(method => <option key={method} value={method}>{({sum: "Sum", unweighted_mean: "Unweighted mean", pooled: "Pooled fraction", latest: "Latest observation"} as Record<string, string>)[method]}</option>)}''')
s=s.replace('Pooling sums numerators and denominators before division. Legacy entries without denominators cannot be converted; retain them and create a separate pooled indicator. Unweighted means give every entry equal weight.','Sum: 2 + 3 = 5. Mean: (20 + 80) / 2 = 50; each entry has equal weight regardless of population. Pooled: (9 + 1) / (10 + 90) = 10%; populations must be comparable. Latest: newest result date, then creation time, then record ID. Periods are independent aggregates.')
s=s.replace('  const field = fields.data?.find', '  const policy = useQuery({ queryKey: ["indicator-policy"], queryFn: apiClient.indicatorPolicy });\n  const field = fields.data?.find',1)
s=s.replace('field?.supported && operation !== "" && (!matching || match.trim()),','field?.supported && operation !== "" && policy.data?.linked[indicator.unit]?.includes(operation) && (!matching || match.trim()),')
s=s.replace('(value === "sum" || value === "average") &&\n                  field?.type !== "number"','!policy.data?.linked[indicator.unit]?.includes(value) || ((value === "sum" || value === "average") &&\n                  field?.type !== "number")')
s=s.replace('{label}\n              </option>','{label}{!policy.data?.linked[indicator.unit]?.includes(value) ? ` — cannot produce ${indicator.unit} units` : ((value === "sum" || value === "average") && field?.type !== "number") ? " — requires a numeric question" : ""}\n              </option>',1)
p.write_text(s)
