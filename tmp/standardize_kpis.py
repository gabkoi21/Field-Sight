from pathlib import Path

def edit(path, fn):
    p=Path(path); p.write_text(fn(p.read_text(encoding="utf-8-sig")),encoding="utf-8")
def cut(s,a,b,new):
    x=s.index(a); y=s.index(b,x); return s[:x]+new+s[y:]

def admin(s):
    s=s.replace('import { Card } from "../ui/Card";', 'import { Card } from "../ui/Card";\nimport { MetricCard } from "../ui/MetricCard";')
    a=s.index('export function AdminMetric('); b=s.index('export function AdminPanel(',a)
    return s[:a]+'''export function AdminMetric({ label, value, detail, icon, tone: _tone }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: MetricTone }) {
  return <MetricCard label={label} value={value} context={detail} icon={icon} />;
}

'''+s[b:]
edit('fieldsight-frontend/src/components/superadmin/AdminUi.tsx',admin)

def overview(s):
    s=s.replace('Button, LoadingSkeleton, LoadingState }', 'Button, LoadingSkeleton, LoadingState, MetricCard }')
    a=s.index('  return (',s.index('function OverviewMetric(')); b=s.index('\nfunction LoadError(',a)
    return s[:a]+'''  return <MetricCard label={label} value={value} title={note} icon={Icon} to={to} valueClassName={typeof value === "string" ? "!text-xl" : ""} />;
}

'''+s[b:]
edit('fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.tsx',overview)

def team(s):
    s=s.replace('Button, PageHeader }','Button, MetricCard, PageHeader }')
    a=s.index('        <Card className="grid grid-cols-[auto_1fr]'); b=s.index('      </section>}',a)
    return s[:a]+'''        <MetricCard label="Total enumerators" value={projectEnumerators.length} context="Assigned field collection accounts" icon={Users} />
        <MetricCard label="Active" value={activeCount} context="Can access assigned field work" icon={UserCheck} />
        <MetricCard label="Inactive" value={projectEnumerators.length - activeCount} context="Access has been disabled" icon={UserX} />
'''+s[b:]
edit('fieldsight-frontend/src/pages/organization/FieldOperationsPage.tsx',team)

def submissions(s):
    s=s.replace('LoadingSkeleton, LoadingState }','LoadingSkeleton, LoadingState, MetricCard }')
    a=s.index('        <article className='); b=s.index('      </section>}',a)
    return s[:a]+'''        <MetricCard label="All submissions" value={Object.values(counts).reduce((sum, n) => sum + n, 0)} context={projectId ? `For ${selectedProjectName}` : "Across active organization projects"} icon={Database} />
'''+s[b:]
edit('fieldsight-frontend/src/pages/organization/SubmissionsPage.tsx',submissions)

def explorer(s):
    s=s.replace('LoadingState, PageHeader }','LoadingState, MetricCard, PageHeader }')
    a=s.index('                            <Panel key={label}>',s.index('["Eligible records", result.eligible_records]'))
    b=s.index('                          ))}',a)
    return s[:a]+'''                            <MetricCard key={label} label={String(label)} value={format(Number(value))} icon={Database} />
'''+s[b:]
edit('fieldsight-frontend/src/pages/organization/SurveyQuestionExplorer.tsx',explorer)

def old_analysis(s):
    s='import { MetricCard } from "../../components/ui/MetricCard";\n'+s
    a=s.index('  return (',s.index('function Metric({')); b=s.index('function CardHeader(',a)
    return s[:a]+'''  return <MetricCard label={label} value={value} context={note} icon={Icon} />;
}
'''+s[b:]
edit('fieldsight-frontend/src/pages/organization/ExploreAnalyzePage.tsx',old_analysis)
