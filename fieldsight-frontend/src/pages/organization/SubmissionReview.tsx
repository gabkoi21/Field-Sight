import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { SubmissionEvidence } from "./SubmissionEvidence";
import { controlClass } from "../../components/ui/controlStyles";

export function SubmissionReview({ id, onClose }: { id: string; onClose: () => void }) {
  const cache = useQueryClient();
  const panel = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("ready");
  const [note, setNote] = useState("");
  const detail = useQuery({ queryKey: ["submission-detail", id, offset], queryFn: () => apiClient.submissionDetail(id, offset) });
  useEffect(() => { const previous = document.activeElement as HTMLElement; panel.current?.focus(); return () => previous?.focus(); }, []);
  const decision = useMutation({
    mutationFn: () => apiClient.reviewSubmission(id, { status, note, evidence_fingerprint: detail.data!.evidence_fingerprint!, expected_review_token: detail.data!.review_token }),
    onSuccess: async () => { setNote(""); await Promise.all(["submission-detail", "submissions", "project-overview", "indicators", "dashboard-widget"].map(key => cache.invalidateQueries({ queryKey: [key] }))); },
  });
  const record = detail.data;
  return <section ref={panel} tabIndex={-1} aria-label="Submission review" className="mt-6 min-w-0 rounded-lg border border-[var(--fs-border)] bg-white p-5 focus-visible:outline focus-visible:outline-2">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Review submission {record?.external_id}</h2><button type="button" className="min-h-11 px-3 underline" onClick={onClose}>Close review</button></header>
    {detail.isPending && <p role="status">Loading submission…</p>}
    {detail.error && <p role="alert">{detail.error.message} <button className="min-h-11 underline" onClick={() => void detail.refetch()}>Reload evidence</button></p>}
    {record && <>
      <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Source</dt><dd>{record.form_name ?? "Form not named"} · {record.external_id}</dd></div><div><dt>Review status</dt><dd>{record.review_status.replaceAll("_", " ")}</dd></div><div><dt>Received (UTC)</dt><dd>{record.submitted_at ? new Date(record.submitted_at).toISOString() : "Not recorded"}</dd></div><div><dt>Collector</dt><dd>{record.enumerator ?? "Not recorded"}</dd></div></dl>
      {record.review_required && <p>Changed evidence requires a new decision.</p>}
      {record.findings.map(finding => <p key={finding.id}>{finding.field && `${finding.field}: `}{finding.detail}</p>)}
      <SubmissionEvidence answers={record.raw_answers} loading={false} error={false} />
      <form className="mt-5 grid gap-3" onSubmit={event => { event.preventDefault(); decision.mutate(); }}>
        <label>Decision<select className={controlClass} value={status} onChange={event => setStatus(event.target.value)}><option value="ready">Ready</option><option value="needs_review">Needs review</option><option value="invalid">Invalid</option></select></label>
        <label>Reason / notes {status !== "ready" && "(required)"}<textarea className={`${controlClass} w-full`} maxLength={2000} required={status !== "ready"} value={note} onChange={event => setNote(event.target.value)} /></label>
        <p className="text-sm text-[var(--fs-muted)]">Only eligible Ready evidence contributes to results. This decision is not donor report approval.</p>
        <button className="min-h-11 rounded bg-[var(--fs-primary)] px-4 text-white disabled:opacity-50" disabled={decision.isPending || detail.isFetching || detail.isError || !record.evidence_fingerprint}>Record decision</button>
        {decision.error && <p role="alert">{decision.error.message} <button type="button" className="min-h-11 underline" onClick={() => { decision.reset(); void detail.refetch(); }}>Reload evidence</button></p>}
        {decision.isSuccess && <p role="status">Review decision saved.</p>}
      </form>
      <h3 className="mt-5 font-semibold">Review history ({record.history_total})</h3>
      <ol className="space-y-3">{record.history.map(event => <li key={event.id} className="break-words border-l-2 pl-3"><time>{new Date(event.occurred_at).toISOString()}</time><p>{event.previous_status ?? "New"} → {event.status ?? "Unchanged"} · {event.actor_id ?? "System"} ({event.source})</p><p>{event.note}</p><details><summary>Evidence version</summary><code className="break-all">{event.evidence_fingerprint ?? "Legacy version not recorded"}</code></details></li>)}</ol>
      {!record.history_total && <p>No review events recorded.</p>}
      <div className="flex gap-3"><button type="button" className="min-h-11 underline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Newer history</button><button type="button" className="min-h-11 underline" disabled={offset + 50 >= record.history_total} onClick={() => setOffset(offset + 50)}>Older history</button></div>
    </>}
  </section>;
}
