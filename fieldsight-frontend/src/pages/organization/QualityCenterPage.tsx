import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, MapPin, MessageSquare, RefreshCw, Send, ShieldCheck, UserRound } from "lucide-react";
import { Button, LoadingState, Ring } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, ApiError, type ApiQualityIssue, type ApiSubmission } from "../../services/apiClient";

const severityStyles = {
  Blocking: "border-[#f2c0c7] bg-[#fff0f2] text-[#b42318]",
  High: "border-[#f1d4a9] bg-[#fff5e8] text-[#b96b0c]",
  Medium: "border-[#cfe0fb] bg-[#edf4ff] text-[#3979c8]",
  Low: "border-[#dfe5eb] bg-[#f1f4f7] text-[#718094]",
} as const;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function QualityCenterPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState(() => searchParams.get("project_id") ?? "");
  const [severity, setSeverity] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [assignee, setAssignee] = useState("Unassigned");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const organizationId = user?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({ queryKey: ["organization-projects", organizationId], queryFn: () => apiClient.organizationProjects(organizationId!), enabled: Boolean(organizationId) });
  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: apiClient.submissions, enabled: !authLoading });
  const issuesQuery = useQuery({ queryKey: ["quality-issues", projectId], queryFn: () => apiClient.qualityIssues(projectId || undefined), enabled: !authLoading });
  const runMutation = useMutation({
    mutationFn: () => apiClient.runQualityValidation(projectId || undefined),
    onSuccess: async (result) => {
      setMessage(`Checked ${result.checked} records: ${result.ready} ready, ${result.needs_review} need review, and ${result.invalid} invalid.`);
      await Promise.all(["quality-issues", "submissions", "organization-overview", "project-overview"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ submissionId, status }: { submissionId: string; status: "ready" | "needs_review" | "invalid" }) => apiClient.updateSubmissionReviewStatus(submissionId, status),
    onSuccess: async (_, variables) => {
      setMessage(variables.status === "ready" ? "Submission marked ready for analysis." : variables.status === "invalid" ? "Submission marked invalid and blocked from analysis." : "Correction request recorded; this submission remains in review.");
      await Promise.all(["submissions", "quality-issues", "organization-overview"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
  });
  const submissions = submissionsQuery.data ?? [];
  const issues = issuesQuery.data ?? [];
  const visibleIssues = severity ? issues.filter((issue) => issue.severity === severity) : issues;
  const selected = useMemo(() => visibleIssues.find((issue) => issue.id === selectedId) ?? visibleIssues[0] ?? null, [selectedId, visibleIssues]);
  const submission = useMemo<ApiSubmission | null>(() => submissions.find((item) => item.id === selected?.submission_id) ?? null, [selected, submissions]);
  const scopedSubmissions = projectId ? submissions.filter((item) => item.project_id === projectId) : submissions;
  const reviewCount = scopedSubmissions.filter((item) => item.review_status === "needs_review").length;
  const invalidCount = scopedSubmissions.filter((item) => item.review_status === "invalid").length;
  const readyCount = scopedSubmissions.filter((item) => item.review_status === "ready").length;
  const issueSubmissions = useMemo(() => new Set(issues.map((issue) => issue.submission_id)).size, [issues]);
  const selectedIndex = selected ? visibleIssues.findIndex((issue) => issue.id === selected.id) : -1;
  const error = issuesQuery.error ?? runMutation.error ?? reviewMutation.error;
  useEffect(() => { setAssignee("Unassigned"); setNote(""); setNotes([]); }, [selected?.id]);
  const chooseIssue = (offset: number) => {
    if (!visibleIssues.length || selectedIndex < 0) return;
    setSelectedId(visibleIssues[(selectedIndex + offset + visibleIssues.length) % visibleIssues.length].id);
  };
  const addNote = () => { if (note.trim()) { setNotes((current) => [...current, note.trim()]); setNote(""); } };
  if (authLoading || projectsQuery.isLoading || submissionsQuery.isLoading) return <LoadingState />;

  return <div className="text-[#243047]">
    <div className="mb-5 flex justify-end">
      <Button onClick={() => { setMessage(""); runMutation.mutate(); }} disabled={runMutation.isPending}>{runMutation.isPending ? <Ring className="size-4" /> : <ShieldCheck size={16} />}{runMutation.isPending ? "Validating..." : "Run validation"}</Button>
    </div>
    {message && <p className="mb-4 rounded-md border border-[#bfe4cf] bg-[#f0fbf5] p-3 text-xs text-[#18794e]">{message}</p>}
    {error && <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{error instanceof ApiError ? error.message : "Unable to complete the quality request."}</p>}
    <section className="mb-5 grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1">
      {[{ label: "Records checked", value: scopedSubmissions.length, icon: RefreshCw, tone: "bg-[#edf3fc] text-brand" }, { label: "Ready", value: readyCount, icon: CheckCircle2, tone: "bg-[#eaf8f2] text-[#188b69]" }, { label: "Need review", value: reviewCount, icon: AlertTriangle, tone: "bg-[#fff7e9] text-[#d9911c]" }, { label: "Invalid", value: invalidCount, icon: CircleAlert, tone: "bg-[#fff0f2] text-[#b42318]" }].map(({ label, value, icon: Icon, tone }) => <article key={label} className="flex items-center gap-3 rounded-lg border border-[#e5eaf0] bg-white p-4"><span className={`grid size-10 place-items-center rounded-lg ${tone}`}><Icon size={19} /></span><div><small className="text-[12px] font-bold uppercase tracking-wide text-[#8794a9]">{label}</small><strong className="block text-[23px]">{value}</strong></div></article>)}
    </section>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-[12px] font-bold text-[#66768d]">Project<select className="min-w-[220px] rounded-md border border-[#dfe6ee] bg-white px-3 py-2 text-xs" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedId(null); }}><option value="">All projects</option>{(projectsQuery.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label className="grid gap-1 text-[12px] font-bold text-[#66768d]">Severity<select className="min-w-[160px] rounded-md border border-[#dfe6ee] bg-white px-3 py-2 text-xs" value={severity} onChange={(event) => { setSeverity(event.target.value); setSelectedId(null); }}><option value="">All severities</option><option>Blocking</option><option>High</option><option>Medium</option><option>Low</option></select></label>
      <p className="mb-2 ml-auto text-xs text-[#7d8a9c]">{visibleIssues.length} issues across {issueSubmissions} records</p>
    </div>
    {issuesQuery.isLoading ? <div className="rounded-lg border border-[#e2e9f1] bg-white p-10 text-center text-sm text-[#7d8a9c]">Loading quality issues...</div> : selected ? <section className="grid min-h-[610px] grid-cols-[minmax(230px,0.8fr)_minmax(320px,1.35fr)_minmax(250px,0.8fr)] overflow-hidden rounded-lg border border-[#e2e9f1] bg-white max-[1100px]:grid-cols-[minmax(220px,0.8fr)_minmax(360px,1.2fr)] max-[800px]:grid-cols-1">
      <aside className="border-r border-[#e8edf4] bg-[#fbfcfe] max-[800px]:border-b max-[800px]:border-r-0"><div className="border-b border-[#e8edf4] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Review queue</h2><span className="rounded-full bg-[#fff0e7] px-2 py-0.5 text-[12px] font-bold text-[#b96b0c]">{visibleIssues.length}</span></div><p className="mt-1 text-xs text-[#7d8a9c]">Select an issue to inspect it.</p></div><div className="max-h-[520px] overflow-auto max-[800px]:max-h-[240px]">{visibleIssues.map((issue) => <button key={issue.id} type="button" onClick={() => setSelectedId(issue.id)} className={`block w-full border-b border-[#edf1f5] p-4 text-left transition-colors ${selected.id === issue.id ? "border-l-2 border-l-brand bg-[#edf4ff]" : "border-l-2 border-l-transparent hover:bg-[#f4f7fb]"}`}><div className="flex items-center justify-between gap-2"><span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${severityStyles[issue.severity]}`}>{issue.severity}</span><span className="text-[12px] text-[#8794a9]">{formatDate(issue.submitted_at)}</span></div><strong className="mt-2 block text-xs text-[#33435c]">{issue.external_id}</strong><span className="mt-1 block text-xs text-[#64748b]">{issue.rule}</span><span className="mt-1 block truncate text-[12px] text-[#8794a9]">{issue.enumerator ?? "Unknown collector"}</span></button>)}</div></aside>
      <main className="border-r border-[#e8edf4] p-5 max-[1100px]:border-r-0 max-[800px]:border-b"><div className="flex items-start justify-between gap-4"><div><p className="text-[12px] font-bold uppercase tracking-wide text-brand">Flagged submission</p><h2 className="mt-1 text-xl font-bold">{selected.external_id}</h2><p className="mt-1 text-xs text-[#718096]">{selected.project_name} · Submitted {formatDate(selected.submitted_at)}</p></div><span className={`rounded border px-2 py-1 text-[12px] font-bold ${severityStyles[selected.severity]}`}>{selected.severity}</span></div><section className="mt-5 rounded-md border border-[#f0d7a9] bg-[#fffaf1] p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-[#c87c16]" size={18} /><div><p className="text-[12px] font-bold uppercase tracking-wide text-[#a86510]">Flagged field</p><h3 className="mt-1 text-sm font-bold text-[#593c14]">{selected.field ?? "Record-level validation"}</h3><p className="mt-2 text-xs leading-5 text-[#6f5732]">{selected.detail}</p></div></div></section><section className="mt-6"><div className="flex items-center gap-2"><ClipboardCheck size={16} className="text-brand" /><h3 className="text-sm font-bold">Submission context</h3></div><p className="mt-1 text-xs text-[#7d8a9c]">Review surrounding answers before making a decision.</p><dl className="mt-3 grid grid-cols-2 gap-x-5 border-y border-[#e8edf4] py-1 max-[480px]:grid-cols-1">{Object.entries(submission?.raw_answers ?? {}).slice(0, 10).map(([key, value]) => <div key={key} className={`py-3 ${key === selected.field ? "rounded bg-[#fff7e9] px-2" : ""}`}><dt className="text-[12px] font-semibold text-[#8794a9]">{key}</dt><dd className="mt-1 break-words text-xs font-medium text-[#3f4e65]">{displayValue(value)}</dd></div>)}{!Object.keys(submission?.raw_answers ?? {}).length && <div className="col-span-2 py-5 text-xs text-[#8794a9]">Submission answers are not available for this record yet.</div>}</dl></section><section className="mt-5 grid grid-cols-2 gap-3 text-xs max-[480px]:grid-cols-1"><div className="flex gap-2"><UserRound size={15} className="shrink-0 text-[#7c8ba0]" /><div><p className="text-[12px] text-[#8794a9]">Enumerator</p><strong>{selected.enumerator ?? "Unknown collector"}</strong></div></div><div className="flex gap-2"><MapPin size={15} className="shrink-0 text-[#7c8ba0]" /><div><p className="text-[12px] text-[#8794a9]">Location</p><strong>{selected.location ?? "Not recorded"}</strong></div></div></section></main>
      <aside className="p-5 max-[1100px]:col-span-2 max-[800px]:col-span-1"><div className="flex items-center justify-between"><div><p className="text-[12px] font-bold uppercase tracking-wide text-brand">Review decision</p><h2 className="mt-1 text-sm font-bold">What happens next?</h2></div><div className="flex gap-1"><button type="button" title="Previous issue" aria-label="Previous issue" onClick={() => chooseIssue(-1)} className="grid size-8 place-items-center rounded-md border border-[#dfe6ee] text-[#52637b] hover:bg-[#f4f7fb]"><ChevronLeft size={16} /></button><button type="button" title="Next issue" aria-label="Next issue" onClick={() => chooseIssue(1)} className="grid size-8 place-items-center rounded-md border border-[#dfe6ee] text-[#52637b] hover:bg-[#f4f7fb]"><ChevronRight size={16} /></button></div></div><label className="mt-5 grid gap-1 text-[12px] font-bold text-[#66768d]">Assign reviewer<select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="rounded-md border border-[#dfe6ee] bg-white px-3 py-2 text-xs font-normal text-[#3f4e65]"><option>Unassigned</option><option>Me</option><option>Data quality team</option></select></label><div className="mt-5 grid gap-2"><Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "ready" })}><CheckCircle2 size={16} />Mark ready</Button><Button variant="secondary" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "needs_review" })}><Send size={16} />Request correction</Button><button type="button" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "invalid" })} className="min-h-[36px] rounded-lg border border-[#e2b8be] bg-white px-3 py-2 text-xs font-semibold text-[#b42318] hover:bg-[#fff5f6] disabled:opacity-50">Mark invalid</button></div><section className="mt-6 border-t border-[#e8edf4] pt-5"><div className="flex items-center gap-2"><MessageSquare size={16} className="text-brand" /><h3 className="text-sm font-bold">Review activity</h3></div><p className="mt-1 text-xs text-[#7d8a9c]">{assignee === "Unassigned" ? "No reviewer assigned yet." : `Assigned to ${assignee}.`}</p><div className="mt-4 grid gap-2"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a review note" rows={3} className="resize-none rounded-md border border-[#dfe6ee] p-2 text-xs outline-none focus:border-brand" /><button type="button" onClick={addNote} disabled={!note.trim()} className="justify-self-end text-xs font-semibold text-brand disabled:opacity-40">Add note</button></div>{notes.length > 0 && <div className="mt-3 grid gap-2">{notes.map((item, index) => <p key={`${item}-${index}`} className="rounded-md bg-[#f4f7fb] p-2 text-xs text-[#52637b]">{item}</p>)}</div>}</section></aside>
    </section> : <div className="rounded-lg border border-[#e2e9f1] bg-white p-12 text-center"><CheckCircle2 className="mx-auto text-[#188b69]" size={30} /><strong className="mt-3 block">No quality issues found</strong><p className="text-xs text-[#7d8a9c]">Run validation after importing new Kobo records.</p></div>}
  </div>;
}
