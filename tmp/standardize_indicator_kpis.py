from pathlib import Path
p=Path('fieldsight-frontend/src/pages/organization/IndicatorWorkspacePage.tsx')
s=p.read_text(encoding='utf-8-sig').replace('LoadingState, PageHeader }','LoadingState, MetricCard, PageHeader }')
a=s.index('                        <Panel key={label}>',s.index('["Indicators", items.length]')); b=s.index('                      ))}',a)
s=s[:a]+'''                        <MetricCard key={label} label={String(label)} value={value} icon={label === "Indicators" ? BarChart3 : label === "With source mappings" ? Link2 : Target} />
'''+s[b:]
a=s.index('            <Panel key={label}>',s.index('{ label: "Starting value"')); b=s.index('          ))}',a)
s=s[:a]+'''            <MetricCard key={label} label={label} value={value} icon={Icon} valueClassName={label === "Target deadline" ? "!text-xl" : ""} />
'''+s[b:]
a=s.index('          <Panel key={label}>',s.index('["Total score", indicator.numerator]')); b=s.index('        ))}',a)
s=s[:a]+'''          <MetricCard key={label} label={String(label)} value={typeof value === "number" ? amount(value) : "Not reported"} icon={BarChart3} />
'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('fieldsight-frontend/src/workspace/DashboardsPage.tsx')
s=p.read_text(encoding='utf-8-sig').replace('  Trash2,','  Target,\n  Trash2,',1).replace('LoadingSkeleton, LoadingState }','LoadingSkeleton, LoadingState, MetricCard }')
a=s.index('        <p className="mb-1 text-sm font-medium text-[var(--fs-text)]">{item.name}</p>')
s=s[:a]+s[a:].replace('        <p className="mb-1 text-sm font-medium text-[var(--fs-text)]">{item.name}</p>\n','',1)
a=s.index('        <strong className="block text-3xl'); b=s.index('        {item.unit !== "text"',a)
s=s[:a]+'''        <MetricCard label={item.name} icon={Target} value={
          item.unit === "text"
            ? (item.qualitative_value ?? "Not reported")
            : value(item.current_value) + (item.current_value != null && item.unit === "percentage" ? "%" : "")
        } />
'''+s[b:]
p.write_text(s,encoding='utf-8')
