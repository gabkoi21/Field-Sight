import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button, LoadingState, PageHeader, Ring } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, ApiError, type ApiQualityIssue } from "../../services/apiClient";

const severityStyles = {
  Blocking: "bg-[#fff0f2] text-[#b42318]",
  High: "bg-[#fff5e8] text-[#b96b0c]",
  Medium: "bg-[#edf4ff] text-[#3979c8]",
  Low: "bg-[#f1f4f7] text-[#718094]",
} as const;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Unknown time";
}

export function QualityCenterPage() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState("");
  const [severity, setSeverity] = useState("");
  const [selected, setSelected] = useState<ApiQualityIssue | null>(null);
  const [message, setMessage] = useState("");
  const organizationId = user?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(organizationId),
  });
  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: apiClient.submissions, enabled: !authLoading });
  const issuesQuery = useQuery({
    queryKey: ["quality-issues", projectId],
    queryFn: () => apiClient.qualityIssues(projectId || undefined),
    enabled: !authLoading,
  });
  const runMutation = useMutation({
    mutationFn: () => apiClient.runQualityValidation(projectId || undefined),
    onSuccess: async (result) => {
      setMessage(`Checked ${result.checked} records: ${result.ready} ready, ${result.needs_review} need review, and ${result.invalid} invalid.`);
      await queryClient.invalidateQueries({ queryKey: ["quality-issues"] });
      await queryClient.invalidateQueries({ queryKey: ["submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["organization-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["project-overview"] });
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ submissionId, status }: { submissionId: string; status: "ready" | "invalid" }) =>
      apiClient.updateSubmissionReviewStatus(submissionId, status),
    onSuccess: async (_, variables) => {
      setMessage(variables.status === "ready" ? "Submission marked ready for analysis." : "Submission marked invalid and blocked from analysis.");
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["quality-issues"] });
      await queryClient.invalidateQueries({ queryKey: ["organization-overview"] });
    },
  });

  const submissions = submissionsQuery.data ?? [];
  const scopedSubmissions = projectId ? submissions.filter((item) => item.project_id === projectId) : submissions;
  const issues = issuesQuery.data ?? [];
  const visibleIssues = severity ? issues.filter((issue) => issue.severity === severity) : issues;
  const invalidCount = scopedSubmissions.filter((item) => item.review_status === "invalid").length;
  const reviewCount = scopedSubmissions.filter((item) => item.review_status === "needs_review").length;
  const readyCount = scopedSubmissions.filter((item) => item.review_status === "ready").length;
  const issueSubmissions = useMemo(() => new Set(issues.map((issue) => issue.submission_id)).size, [issues]);
  const error = issuesQuery.error ?? runMutation.error ?? reviewMutation.error;

  if (authLoading || projectsQuery.isLoading || submissionsQuery.isLoading) return <LoadingState />;

  return (
    <div className="text-[#243047]">
      <PageHeader eyebrow="Data quality" title="Quality center" description="Validate real Kobo records before they enter analysis and reporting.">
        <Button onClick={() => { setMessage(""); runMutation.mutate(); }} disabled={runMutation.isPending}>
          {runMutation.isPending ? <Ring className="size-4" /> : <ShieldCheck size={16} />}
          {runMutation.isPending ? "Validating…" : "Run validation"}
        </Button>
      </PageHeader>

      {message && <p className="rounded-md border border-[#bfe4cf] bg-[#f0fbf5] p-3 text-xs text-[#18794e]">{message}</p>}
      {error && <p className="rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{error instanceof ApiError ? error.message : "Unable to complete the quality request."}</p>}

      <section className="mb-5 grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1">
        {[
          { label: "Records checked", value: scopedSubmissions.length, icon: RefreshCw, tone: "bg-[#edf3fc] text-brand" },
          { label: "Ready", value: readyCount, icon: CheckCircle2, tone: "bg-[#eaf8f2] text-[#188b69]" },
          { label: "Need review", value: reviewCount, icon: AlertTriangle, tone: "bg-[#fff7e9] text-[#d9911c]" },
          { label: "Invalid", value: invalidCount, icon: CircleAlert, tone: "bg-[#fff0f2] text-[#b42318]" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="flex items-center gap-3 rounded-lg border border-[#e5eaf0] bg-white p-4">
            <span className={`grid size-10 place-items-center rounded-lg ${tone}`}><Icon size={19} /></span>
            <div><small className="text-[10px] font-bold uppercase tracking-wide text-[#8794a9]">{label}</small><strong className="block text-[23px]">{value}</strong></div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#e2e9f1] bg-white">
        <div className="flex items-end gap-3 border-b border-[#e8edf4] p-4 max-[700px]:flex-wrap">
          <label className="grid gap-1 text-[10px] font-bold text-[#66768d]">Project
            <select className="min-w-[220px] rounded-md border border-[#dfe6ee] bg-white px-3 py-2 text-xs" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelected(null); }}>
              <option value="">All projects</option>
              {(projectsQuery.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[10px] font-bold text-[#66768d]">Severity
            <select className="min-w-[160px] rounded-md border border-[#dfe6ee] bg-white px-3 py-2 text-xs" value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="">All severities</option><option>Blocking</option><option>High</option><option>Medium</option><option>Low</option>
            </select>
          </label>
          <p className="ml-auto mb-1 text-xs text-[#7d8a9c]">{visibleIssues.length} issues across {issueSubmissions} records</p>
        </div>
        {issuesQuery.isLoading ? <div className="p-10 text-center text-sm text-[#7d8a9c]">Loading quality issues…</div> : visibleIssues.length ? (
          <div className="overflow-x-auto"><table className="min-w-[850px] w-full">
            <thead><tr>{["Severity", "Issue", "Submission", "Project", "Submitted", "Action"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
            <tbody>{visibleIssues.map((issue) => <tr key={issue.id}>
              <td><span className={`rounded px-2 py-1 text-[10px] font-bold ${severityStyles[issue.severity]}`}>{issue.severity}</span></td>
              <td><strong>{issue.rule}</strong><small>{issue.field ? `Field: ${issue.field}` : issue.detail}</small></td>
              <td><strong>{issue.external_id}</strong><small>{issue.enumerator ?? "Unknown collector"}</small></td>
              <td>{issue.project_name}</td><td>{formatDate(issue.submitted_at)}</td>
              <td><button className="text-xs font-semibold text-brand" onClick={() => setSelected(issue)}>Review</button></td>
            </tr>)}</tbody>
          </table></div>
        ) : <div className="p-12 text-center"><CheckCircle2 className="mx-auto text-[#188b69]" size={30} /><strong className="mt-3 block">No quality issues found</strong><p className="text-xs text-[#7d8a9c]">Run validation after importing new Kobo records.</p></div>}
      </section>

      {selected && <div className="fixed inset-0 z-50 bg-[#102a4340]" onClick={() => setSelected(null)}>
        <aside className="absolute bottom-0 right-0 top-0 flex w-[min(460px,100%)] flex-col bg-white shadow-[-14px_0_35px_#102a4324]" onClick={(event) => event.stopPropagation()}>
          <header className="flex items-start justify-between border-b border-[#e8edf4] p-5"><div><span className={`rounded px-2 py-1 text-[10px] font-bold ${severityStyles[selected.severity]}`}>{selected.severity}</span><h2 className="mb-0 mt-3 text-xl">{selected.rule}</h2></div><button onClick={() => setSelected(null)}><X size={18} /></button></header>
          <div className="flex-1 overflow-auto p-5"><p className="text-sm leading-6 text-[#56657a]">{selected.detail}</p><dl className="mt-5 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-[#8b98ab]">Submission</dt><dd className="m-0 mt-1 font-semibold">{selected.external_id}</dd></div><div><dt className="text-[#8b98ab]">Project</dt><dd className="m-0 mt-1 font-semibold">{selected.project_name}</dd></div><div><dt className="text-[#8b98ab]">Collector</dt><dd className="m-0 mt-1 font-semibold">{selected.enumerator ?? "Unknown"}</dd></div><div><dt className="text-[#8b98ab]">Field</dt><dd className="m-0 mt-1 font-semibold">{selected.field ?? "Record level"}</dd></div></dl></div>
          <footer className="flex justify-end gap-2 border-t border-[#e8edf4] p-4"><button className="rounded-md border border-[#e2b8be] bg-white px-4 py-2 text-xs font-semibold text-[#b42318]" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "invalid" })}>Mark invalid</button><Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "ready" })}>Mark ready</Button></footer>
        </aside>
      </div>}
    </div>
  );
}


