import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, MapPin, MessageSquare, RefreshCw, Send, ShieldCheck, UserRound } from "lucide-react";
import { controlClass } from "../../components/ui/controlStyles";
import { Button, LoadingSkeleton, LoadingState, PageHeader, Ring } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, ApiError, type ApiQualityIssue } from "../../services/apiClient";

import { SubmissionEvidence } from "./SubmissionEvidence";

const severityStyles = {
  Blocking: "border-[#f2c0c7] bg-[#fff0f2] text-[#b42318]",
  High: "border-[#f1d4a9] bg-[#fff5e8] text-[#b96b0c]",
  Medium: "border-[#cfe0fb] bg-[#edf4ff] text-[#3979c8]",
  Low: "border-[#dfe5eb] bg-[#f1f4f7] text-[#718094]",
} as const;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
}

export function QualityCenterPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const projectId = searchParams.get("project_id") ?? "";
  const setProjectId = (id: string) => { const params = new URLSearchParams(searchParams); if (id) params.set("project_id", id); else params.delete("project_id"); setSearchParams(params); };
  const [severity, setSeverity] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [offset, setOffset] = useState(0);
  const [includeReviewed, setIncludeReviewed] = useState(false);
  const [note, setNote] = useState("");

  const organizationId = user?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({ queryKey: ["organization-projects", organizationId], queryFn: () => apiClient.organizationProjects(organizationId!), enabled: Boolean(organizationId) });
  const params = new URLSearchParams({ offset: String(offset), limit: "20", include_reviewed: String(includeReviewed) });
  if (projectId) params.set("project_id", projectId);
  if (severity) params.set("severity", severity);
  const issuesQuery = useQuery({ queryKey: ["quality-issues", params.toString()], queryFn: () => apiClient.qualityQueue(params), enabled: !authLoading });
  const runMutation = useMutation({
    mutationFn: () => apiClient.runQualityValidation(projectId || undefined),
    onSuccess: async (result) => {
      setMessage(`Checked ${result.checked} records: ${result.ready} ready, ${result.needs_review} need review, and ${result.invalid} invalid.`);
      await Promise.all(["quality-issues", "submissions", "organization-overview", "project-overview", "indicators", "dashboard-results", "workspace-dashboard-results", "submission-review", "dashboard-widget"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ submissionId, status }: { submissionId: string; status: "ready" | "needs_review" | "invalid" }) => apiClient.updateSubmissionReviewStatus(submissionId, status, note.trim() || null, detail.data?.submission.evidence_fingerprint),
    onSuccess: async (_, variables) => {
      if (selected?.submission_id === variables.submissionId) setNote("");
      setMessage(variables.status === "ready" ? "Submission marked ready for analysis." : variables.status === "invalid" ? "Submission marked invalid and blocked from analysis." : "Submission marked as needing review. Contact the collector separately for corrections.");
      await Promise.all(["submissions", "quality-issues", "organization-overview", "indicators", "dashboard-results", "workspace-dashboard-results", "submission-review", "dashboard-widget"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
  });
  const issues = issuesQuery.data?.items ?? [];
  const visibleIssues = issues;
  const selected = useMemo(() => visibleIssues.find((issue) => issue.id === selectedId) ?? visibleIssues[0] ?? null, [selectedId, visibleIssues]);
  const detail = useQuery({ queryKey: ["submission-review", selected?.submission_id], queryFn: () => apiClient.submissionReview(selected!.submission_id), enabled: Boolean(selected) });
  const assignment = useMutation({ mutationFn: (id: string | null) => apiClient.assignReviewer(selected!.submission_id, id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["submission-review"] }) });
  const saveNote = useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => apiClient.addReviewNote(id, text), onSuccess: async (_, variables) => { if (selected?.submission_id === variables.id) { setNote(""); setMessage("Review note saved."); } await queryClient.invalidateQueries({ queryKey: ["submission-review"] }); } });
  const submission = detail.data?.submission;
  const notes = detail.data?.events ?? [];
  const counts = issuesQuery.data?.counts ?? {};
  const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const reviewCount = counts.needs_review ?? 0;
  const invalidCount = counts.invalid ?? 0;
  const readyCount = counts.ready ?? 0;
  const issueSubmissions = new Set(issues.map(issue => issue.submission_id)).size;
  const selectedIndex = selected ? visibleIssues.findIndex((issue) => issue.id === selected.id) : -1;
  const error = issuesQuery.error ?? projectsQuery.error ?? detail.error ?? assignment.error ?? saveNote.error ?? runMutation.error ?? reviewMutation.error;
  useEffect(() => { setNote(""); }, [selected?.id]);
  useEffect(() => { setOffset(0); setSelectedId(null); }, [projectId, severity, includeReviewed]);
  const chooseIssue = (offset: number) => {
    if (!visibleIssues.length || selectedIndex < 0) return;
    setSelectedId(visibleIssues[(selectedIndex + offset + visibleIssues.length) % visibleIssues.length].id);
  };
  const addNote = () => { if (note.trim() && selected) saveNote.mutate({ id: selected.submission_id, text: note.trim() }); };
  if (authLoading || projectsQuery.isLoading) return <LoadingState variant="page" label="Preparing data quality…" />;

  return <div className="text-[#243047]">
    <div className="mb-6"><PageHeader eyebrow="FieldSight / Data operations" title="Data Quality" description="Review saved findings and resolve collection issues. Indicator mappings include ready records by default; needs-review and invalid records are excluded.">
      <Button onClick={() => { setMessage(""); runMutation.mutate(); }} disabled={runMutation.isPending}>{runMutation.isPending ? <Ring className="size-4" /> : <ShieldCheck size={16} />}{runMutation.isPending ? "Validating..." : "Run validation"}</Button>
    </PageHeader></div>
    {issuesQuery.isFetching && issuesQuery.data && <LoadingState variant="inline" label="Updating quality issues…" />}
    {message && <p className="mb-4 rounded-md border border-[#bfe4cf] bg-[#f0fbf5] p-3 text-xs text-[#18794e]">{message}</p>}
    {error && <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{error instanceof ApiError ? error.message : "Unable to complete the quality request."} <button className="min-h-11 px-3 font-semibold underline" onClick={() => { if (issuesQuery.error) void issuesQuery.refetch(); if (projectsQuery.error) void projectsQuery.refetch(); if (detail.error) void detail.refetch(); }}>Retry loading quality data</button></p>}
    <section className="mb-5 grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1">
      {[{ label: "Records checked", value: totalRecords, icon: RefreshCw, tone: "bg-[#edf3fc] text-brand" }, { label: "Ready", value: readyCount, icon: CheckCircle2, tone: "bg-[#eaf8f2] text-[#188b69]" }, { label: "Need review", value: reviewCount, icon: AlertTriangle, tone: "bg-[#fff7e9] text-[#d9911c]" }, { label: "Invalid", value: invalidCount, icon: CircleAlert, tone: "bg-[#fff0f2] text-[#b42318]" }].map(({ label, value, icon: Icon, tone }) => <article key={label} className="flex items-center gap-3 rounded-lg border border-[#e5eaf0] bg-white p-4"><span className={`grid size-10 place-items-center rounded-lg ${tone}`}><Icon size={19} /></span><div><small className="text-[12px] font-bold uppercase tracking-wide text-[var(--fs-muted)]">{label}</small><strong className="block text-[23px]">{value}</strong></div></article>)}
    </section>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-[12px] font-bold text-[#66768d]">Project filter<select className={controlClass} value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedId(null); }}><option value="">All projects</option>{(projectsQuery.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label className="grid gap-1 text-[12px] font-bold text-[#66768d]">Severity<select className={controlClass} value={severity} onChange={(event) => { setSeverity(event.target.value); setSelectedId(null); }}><option value="">All severities</option><option>Blocking</option><option>High</option><option>Medium</option><option>Low</option></select></label>
      <p className="mb-2 ml-auto text-xs text-[var(--fs-muted)]">{issuesQuery.data?.total ?? 0} saved issues · {issueSubmissions} records on this page</p>
    </div>
    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
      <label><input type="checkbox" checked={includeReviewed} onChange={event => setIncludeReviewed(event.target.checked)} /> Include reviewed findings</label>
      <span>{issuesQuery.data?.snapshot_note}</span>
      <button disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous page</button>
      <button disabled={offset + 20 >= (issuesQuery.data?.total ?? 0)} onClick={() => setOffset(value => value + 20)}>Next page</button>
    </div>
    {issuesQuery.isLoading ? <LoadingSkeleton label="Loading quality issues…" /> : selected ? <section aria-busy={issuesQuery.isFetching} className="grid min-h-[610px] grid-cols-[minmax(230px,0.8fr)_minmax(320px,1.35fr)_minmax(250px,0.8fr)] overflow-hidden rounded-lg border border-[#e2e9f1] bg-white max-[1100px]:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)] max-[800px]:grid-cols-1">
      <aside className="border-r border-[#e8edf4] bg-[#fbfcfe] max-[800px]:border-b max-[800px]:border-r-0"><div className="border-b border-[#e8edf4] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Review queue</h2><span className="rounded-full bg-[#fff0e7] px-2 py-0.5 text-[12px] font-bold text-[#b96b0c]">{visibleIssues.length}</span></div><p className="mt-1 text-xs text-[var(--fs-muted)]">Select an issue to inspect it.</p></div><div className="max-h-[520px] overflow-auto max-[800px]:max-h-[240px]">{visibleIssues.map((issue) => <button key={issue.id} type="button" onClick={() => setSelectedId(issue.id)} className={`block w-full border-b border-[#edf1f5] p-4 text-left transition-colors ${selected.id === issue.id ? "border-l-2 border-l-brand bg-[#edf4ff]" : "border-l-2 border-l-transparent hover:bg-[#f4f7fb]"}`}><div className="flex items-center justify-between gap-2"><span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${severityStyles[issue.severity]}`}>{issue.severity}</span><span className="text-[12px] text-[var(--fs-muted)]">{formatDate(issue.submitted_at)}</span></div><strong className="mt-2 block text-xs text-[#33435c]">{issue.external_id}</strong><span className="mt-1 block text-xs text-[#64748b]">{issue.rule}</span><span className="mt-1 block truncate text-[12px] text-[var(--fs-muted)]">{issue.enumerator ?? "Unknown collector"}</span></button>)}</div></aside>
      <main className="min-w-0 border-r border-[#e8edf4] p-5 max-[1100px]:border-r-0 max-[800px]:border-b"><div className="flex items-start justify-between gap-4"><div><p className="text-[12px] font-bold uppercase tracking-wide text-brand">Flagged submission</p><h2 className="mt-1 text-xl font-bold">{selected.external_id}</h2><p className="mt-1 text-xs text-[#718096]">{selected.project_name} · Submitted {formatDate(selected.submitted_at)}</p></div><span className={`rounded border px-2 py-1 text-[12px] font-bold ${severityStyles[selected.severity]}`}>{selected.severity}</span></div><section className="mt-5 rounded-md border border-[#f0d7a9] bg-[#fffaf1] p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-[#c87c16]" size={18} /><div><p className="text-[12px] font-bold uppercase tracking-wide text-[#a86510]">Flagged field</p><h3 className="mt-1 text-sm font-bold text-[#593c14]">{selected.field ?? "Record-level validation"}</h3><p className="mt-2 text-xs leading-5 text-[#6f5732]">{selected.detail}</p></div></div></section><section className="mt-6"><div className="flex items-center gap-2"><ClipboardCheck size={16} className="text-brand" /><h3 className="text-sm font-bold">Submission context</h3></div><p className="mt-1 text-xs text-[var(--fs-muted)]">Review surrounding answers before making a decision.</p><SubmissionEvidence answers={submission?.raw_answers} field={selected.field} fields={detail.data?.fields} loading={detail.isPending} error={detail.isError} /></section><section className="mt-5 grid grid-cols-2 gap-3 text-xs max-[480px]:grid-cols-1"><div className="flex gap-2"><UserRound size={15} className="shrink-0 text-[#7c8ba0]" /><div><p className="text-[12px] text-[var(--fs-muted)]">Enumerator</p><strong>{selected.enumerator ?? "Unknown collector"}</strong></div></div><div className="flex gap-2"><MapPin size={15} className="shrink-0 text-[#7c8ba0]" /><div><p className="text-[12px] text-[var(--fs-muted)]">Location</p><strong>{selected.location ?? "Not recorded"}</strong></div></div></section></main>
      <aside className="p-5 max-[1100px]:col-span-2 max-[800px]:col-span-1"><div className="flex items-center justify-between"><div><p className="text-[12px] font-bold uppercase tracking-wide text-brand">Review decision</p><h2 className="mt-1 text-sm font-bold">What happens next?</h2></div><div className="flex gap-1"><button type="button" title="Previous issue" aria-label="Previous issue" onClick={() => chooseIssue(-1)} className="grid size-11 place-items-center rounded-lg border border-[#dfe6ee] text-[#52637b] hover:bg-[#f4f7fb]"><ChevronLeft size={16} /></button><button type="button" title="Next issue" aria-label="Next issue" onClick={() => chooseIssue(1)} className="grid size-11 place-items-center rounded-lg border border-[#dfe6ee] text-[#52637b] hover:bg-[#f4f7fb]"><ChevronRight size={16} /></button></div></div><label className="mt-5 grid gap-1 text-[12px] font-bold text-[#66768d]">Reviewer<select aria-label="Assigned reviewer" disabled={assignment.isPending || detail.isPending} value={detail.data?.reviewer_id ?? ""} onChange={(event) => assignment.mutate(event.target.value || null)} className="rounded-md border border-[#dfe6ee] bg-white px-3 py-2 text-xs font-normal text-[#3f4e65]"><option value="">Unassigned</option>{detail.data?.reviewers.map(reviewer => <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>)}</select></label><div className="mt-5 grid gap-2"><Button disabled={reviewMutation.isPending || detail.isPending || detail.isError || !submission} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "ready" })}><CheckCircle2 size={16} />Mark ready</Button><Button variant="secondary" disabled={reviewMutation.isPending || detail.isPending || detail.isError || !submission} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "needs_review" })}><Send size={16} />Mark needs review</Button><button type="button" disabled={reviewMutation.isPending || detail.isPending || detail.isError || !submission} onClick={() => reviewMutation.mutate({ submissionId: selected.submission_id, status: "invalid" })} className="min-h-11 rounded-lg border border-[#e2b8be] bg-white px-3 py-2 text-xs font-semibold text-[#b42318] hover:bg-[#fff5f6] disabled:opacity-50">Mark invalid</button></div><section className="mt-6 border-t border-[#e8edf4] pt-5"><div className="flex items-center gap-2"><MessageSquare size={16} className="text-brand" /><h3 className="text-sm font-bold">Saved review history</h3></div><p className="mt-1 text-xs text-[var(--fs-muted)]">{detail.isPending ? "Loading review history…" : "Assignments, notes and decisions are stored with their author and time."}</p><div className="mt-4 grid gap-2"><textarea disabled={saveNote.isPending || reviewMutation.isPending} aria-label="Review note" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a review note" rows={3} className="resize-none rounded-md border border-[#dfe6ee] p-2 text-xs outline-none focus:border-brand" /><button type="button" onClick={addNote} disabled={!note.trim() || saveNote.isPending} className="justify-self-end text-xs font-semibold text-brand disabled:opacity-40">Add note</button></div>{notes.length > 0 && <div className="mt-3 grid gap-2">{notes.map((item) => <p key={item.id} className="rounded-md bg-[#f4f7fb] p-2 text-xs text-[#52637b]"><strong>{item.actor}</strong> · {formatDate(item.occurred_at)}<br />{item.action}{item.status ? `: ${item.previous_status ?? ""} → ${item.status}` : ""}{item.reviewer_id ? ` · Reviewer ${detail.data?.reviewers.find(reviewer => reviewer.id === item.reviewer_id)?.name ?? item.reviewer_id}` : ""}{item.note && <span className="block whitespace-pre-wrap">{item.note}</span>}</p>)}</div>}</section></aside>
    </section> : issuesQuery.error ? null : <div className="rounded-lg border border-[#e2e9f1] bg-white p-12 text-center"><CheckCircle2 className="mx-auto text-[#188b69]" size={30} /><strong className="mt-3 block">No saved findings in this view</strong><p className="text-xs text-[var(--fs-muted)]">Run validation after importing new Kobo records. Include reviewed findings to revisit saved decisions.</p></div>}
  </div>;
}
