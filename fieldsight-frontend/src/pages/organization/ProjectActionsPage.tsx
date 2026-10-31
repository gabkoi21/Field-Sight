import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectLink as Link, useProjectSearchParams as useSearchParams } from "../../workspace/projectRouting";
import { useProjectRouteId } from "../../workspace/projectRouting";
import { useAuth } from "../../auth/AuthContext";
import { apiClient, type ActionDetail, type ActionInput, type ProjectAction, type WorkspaceMember } from "../../services/apiClient";
import { controlClass } from "../../components/ui/controlStyles";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";

const button = "min-h-11 rounded border border-[var(--fs-control-border)] px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-primary)] disabled:opacity-50";
const label = (value: string) => value.replaceAll("_", " ");
const transitions: Record<ProjectAction["status"], ProjectAction["status"][]> = { open: ["open", "in_progress"], in_progress: ["in_progress", "open", "resolved"], resolved: ["resolved", "in_progress", "closed"], closed: ["closed", "open"] };

export function ProjectActionsPage() {
  const projectId = useProjectRouteId() ?? "";
  const { user, loading } = useAuth();
  const organization = user?.memberships.find(member => member.role === "organization_admin")?.organization_id;
  const [params, setParams] = useSearchParams();
  const project = useQuery({ queryKey: ["project", organization, projectId], queryFn: () => apiClient.getProject(organization!, projectId), enabled: Boolean(organization && projectId && !loading) });
  const authorized = Boolean(organization && project.isSuccess);
  const filters = new URLSearchParams(params);
  filters.delete("action_id"); filters.delete("new"); filters.delete("submission_id");
  filters.set("limit", "20");
  const offset = Math.max(0, Number(filters.get("offset")) || 0);
  filters.set("offset", String(offset));
  const actions = useQuery({ queryKey: ["project-actions", organization, projectId, filters.toString()], queryFn: () => apiClient.projectActions(projectId, filters), enabled: authorized });
  const members = useQuery({ queryKey: ["action-members", organization], queryFn: () => apiClient.workspaceTeam(organization!), enabled: authorized });
  const team = useQuery({ queryKey: ["project-team", organization, projectId], queryFn: () => apiClient.projectTeam(projectId), enabled: authorized });
  const activeId = params.get("action_id");
  const creating = params.get("new") === "1";
  const archived = project.data?.status === "archived";
  function updateFilter(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); next.delete("offset"); setParams(next); }
  function open(id?: string) { const next = new URLSearchParams(params); next.delete("new"); next.delete("action_id"); next.delete("submission_id"); if (id) next.set("action_id", id); else next.set("new", "1"); setParams(next); }
  function close() { const next = new URLSearchParams(params); next.delete("new"); next.delete("action_id"); next.delete("submission_id"); setParams(next); }
  const eligible = [...new Map([...(members.data ?? []).filter(item => item.role === "organization_admin"), ...(team.data ?? [])].filter(item => item.is_active).map(item => [item.user_id, item])).values()];
  if (loading || project.isPending && organization) return <LoadingSkeleton layout="table-page" label="Loading project…" />;
  if (!organization || project.error) return <p role="alert">This project is unavailable or requires an organization administrator. <Link to="/projects">Back to projects</Link></p>;
  return <div className="space-y-5">
    <Link className="inline-flex min-h-11 items-center text-[var(--fs-primary)] underline" to={`/projects/${projectId}/overview`}>Back to project overview</Link>
    <PageHeader title="Actions & Follow-ups" description={`Project action register · ${project.data?.name ?? ""}`} />
    {archived && <p role="status">Archived project: action history is read-only.</p>}
    <button type="button" className={`${button} bg-[var(--fs-primary)] text-white`} disabled={archived} onClick={() => open()}>Create action</button>
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label>Search actions<input className={`${controlClass} w-full`} value={params.get("search") ?? ""} onChange={event => updateFilter("search", event.target.value)} /></label>
        <label>Status<select className={`${controlClass} w-full`} value={params.get("status") ?? ""} onChange={event => updateFilter("status", event.target.value)}><option value="">All statuses</option>{Object.keys(transitions).map(item => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        <label>Priority<select className={`${controlClass} w-full`} value={params.get("priority") ?? ""} onChange={event => updateFilter("priority", event.target.value)}><option value="">All priorities</option>{["low", "medium", "high"].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Assigned user<select className={`${controlClass} w-full`} value={params.get("assigned_user_id") ?? ""} onChange={event => updateFilter("assigned_user_id", event.target.value)}><option value="">All users</option>{(members.data ?? []).map(item => <option key={item.user_id} value={item.user_id}>{item.full_name ?? item.email}{!item.is_active ? " (inactive)" : ""}</option>)}</select></label>
        <label>Due from<input type="date" className={`${controlClass} w-full`} value={params.get("due_from") ?? ""} onChange={event => updateFilter("due_from", event.target.value)} /></label>
        <label>Due through<input type="date" className={`${controlClass} w-full`} value={params.get("due_to") ?? ""} onChange={event => updateFilter("due_to", event.target.value)} /></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={params.get("overdue") === "true"} onChange={event => updateFilter("overdue", event.target.checked ? "true" : "")} />Overdue only</label>
      </div>
      {(members.error || team.error) && <p role="alert">Team options unavailable. <button className={button} onClick={() => { void members.refetch(); void team.refetch(); }}>Retry team</button></p>}
    </Card>
    {actions.isPending && <LoadingSkeleton columns={5} label="Loading actions…" />}
    {actions.error && <p role="alert">Unable to load actions: {actions.error.message} <button className={button} onClick={() => void actions.refetch()}>Retry actions</button></p>}
    {actions.data && <>
      <p className="text-sm">Project totals: {actions.data.summary.unresolved} unresolved · {actions.data.summary.overdue} overdue · {actions.data.summary.high_priority} unresolved high priority</p>
      <div className="overflow-x-auto rounded border border-[var(--fs-border)] bg-white">
        <table className="fs-data-table w-full text-left text-sm"><caption className="sr-only">Project action register</caption><thead><tr>{["Action", "Status", "Priority", "Assigned", "Due date"].map(heading => <th className="p-3" key={heading}>{heading}</th>)}</tr></thead><tbody>{actions.data.items.map(item => <tr key={item.id} className="border-t border-[var(--fs-border)]"><td className="min-w-40 p-3"><button type="button" className="min-h-11 text-left font-semibold text-[var(--fs-primary)] underline [overflow-wrap:anywhere]" onClick={() => open(item.id)}>{item.title}</button></td><td className="p-3">{label(item.status)}</td><td className="p-3">{item.priority}</td><td className="p-3">{item.assigned_user_id ? members.data?.find(member => member.user_id === item.assigned_user_id)?.full_name ?? members.data?.find(member => member.user_id === item.assigned_user_id)?.email ?? "Assigned member" : "Unassigned"}</td><td className="p-3">{item.due_date ?? "Not set"}{item.overdue && <span className="block font-semibold text-[var(--fs-danger)]">Overdue</span>}</td></tr>)}</tbody></table>
        {!actions.data.items.length && <p className="p-5">No actions match these filters.</p>}
      </div>
      <nav aria-label="Action pagination" className="flex flex-wrap items-center gap-3"><button className={button} disabled={!offset || actions.isFetching} onClick={() => { const next = new URLSearchParams(params); next.set("offset", String(Math.max(0, offset-20))); setParams(next); }}>Previous actions</button><span>{actions.data.total} matching actions</span><button className={button} disabled={offset+20 >= actions.data.total || actions.isFetching} onClick={() => { const next = new URLSearchParams(params); next.set("offset", String(offset+20)); setParams(next); }}>Next actions</button></nav>
    </>}
    {authorized && (creating || activeId) && <ActionEditor key={`${projectId}:${activeId ?? "new"}`} projectId={projectId} id={activeId} initialSubmission={params.get("submission_id")} archived={Boolean(archived)} members={eligible} onClose={close} onSaved={id => open(id)} />}
  </div>;
}

function ActionEditor({ projectId, id, initialSubmission, archived, members, onClose, onSaved }: { projectId: string; id: string | null; initialSubmission: string | null; archived: boolean; members: WorkspaceMember[]; onClose: () => void; onSaved: (id: string) => void }) {
  const [historyOffset, setHistoryOffset] = useState(0);
  const detail = useQuery({ queryKey: ["action-detail", projectId, id, historyOffset], queryFn: () => apiClient.actionDetail(projectId, id!, historyOffset), enabled: Boolean(id) });
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; panel.current?.focus(); return () => previous?.focus(); }, []);
  return <section ref={panel} tabIndex={-1} aria-label={id ? "Action details" : "New action"} className="min-w-0 rounded-lg border border-[var(--fs-border)] bg-white p-5 focus-visible:outline focus-visible:outline-2">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{id ? "Action details" : "New action"}</h2><button className={button} onClick={onClose}>Close action</button></header>
    {id && detail.isPending && <LoadingSkeleton layout="details" rows={3} label="Loading action details…" />}
    {detail.error && <p role="alert">{detail.error.message} <button className={button} onClick={() => void detail.refetch()}>Reload action</button></p>}
    {(!id || detail.data) && <ActionForm key={detail.data ? `${id}:${detail.data.version}` : "new"} projectId={projectId} action={detail.data} initialSubmission={initialSubmission} archived={archived} members={members} onSaved={onSaved} reload={() => void detail.refetch()} />}
    {detail.data && <><h3 className="mt-6 font-semibold">Audit timeline ({detail.data.history_total})</h3><ol className="space-y-4">{detail.data.history.map(event => <li key={event.id} className="border-l-2 pl-3 [overflow-wrap:anywhere]"><p><time>{new Date(event.occurred_at).toISOString()}</time> · {label(event.event_type)} · Actor {event.actor_id}</p><p>{event.note}</p><details><summary className="min-h-11 cursor-pointer">Recorded changes</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ previous: event.previous_values, current: event.new_values }, null, 2)}</pre></details></li>)}</ol><div className="mt-3 flex gap-3"><button className={button} disabled={!historyOffset} onClick={() => setHistoryOffset(Math.max(0, historyOffset-50))}>Newer events</button><button className={button} disabled={historyOffset+50 >= detail.data.history_total} onClick={() => setHistoryOffset(historyOffset+50)}>Older events</button></div></>}
  </section>;
}

function ActionForm({ projectId, action, initialSubmission, archived, members, onSaved, reload }: { projectId: string; action?: ActionDetail; initialSubmission: string | null; archived: boolean; members: WorkspaceMember[]; onSaved: (id: string) => void; reload: () => void }) {
  const cache = useQueryClient();
  const [title, setTitle] = useState(action?.title ?? "");
  const [description, setDescription] = useState(action?.description ?? "");
  const [priority, setPriority] = useState<ProjectAction["priority"]>(action?.priority ?? "medium");
  const [status, setStatus] = useState<ProjectAction["status"]>(action?.status ?? "open");
  const [assigned, setAssigned] = useState(action?.assigned_user_id ?? "");
  const [due, setDue] = useState(action?.due_date ?? "");
  const [submission, setSubmission] = useState(action?.submission_id ?? initialSubmission ?? "");
  const [indicator, setIndicator] = useState(action?.indicator_id ?? "");
  const [summary, setSummary] = useState(action?.resolution_summary ?? "");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const evidence = useQuery({ queryKey: ["action-evidence", projectId, search], queryFn: () => apiClient.submissionPage(new URLSearchParams({ project_id: projectId, search, limit: "20" })), enabled: !archived });
  const indicators = useQuery({ queryKey: ["indicators", projectId, "action-options"], queryFn: () => apiClient.indicators(projectId), enabled: !archived });
  const save = useMutation({
    mutationFn: () => {
      const body: ActionInput = { title, description, priority, assigned_user_id: assigned || null, due_date: due || null, submission_id: submission || null, indicator_id: indicator || null };
      return action ? apiClient.updateAction(projectId, action.id, { ...body, expected_version: action.version, status, resolution_summary: summary, note }) : apiClient.createAction(projectId, body);
    },
    onSuccess: async result => { await Promise.all(["project-actions", "action-detail", "project-overview"].map(key => cache.invalidateQueries({ queryKey: [key] }))); setNote(""); onSaved(result.id); },
  });
  const transitionNeedsNote = Boolean(action && status !== action.status && (status === "closed" || ["resolved", "closed"].includes(action.status)));
  return <form className="mt-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
    <fieldset disabled={archived || save.isPending} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">Title (required)<input required maxLength={200} className={`${controlClass} w-full`} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="sm:col-span-2">Description<textarea maxLength={10000} className={`${controlClass} w-full`} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label>Priority<select className={`${controlClass} w-full`} value={priority} onChange={event => setPriority(event.target.value as ProjectAction["priority"])}>{["low", "medium", "high"].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Due date (UTC)<input type="date" className={`${controlClass} w-full`} value={due} onChange={event => setDue(event.target.value)} /></label>
      <label>Assign to<select className={`${controlClass} w-full`} value={assigned} onChange={event => setAssigned(event.target.value)}><option value="">Unassigned</option>{assigned && !members.some(item => item.user_id === assigned) && <option value={assigned}>Previously assigned member (check eligibility)</option>}{members.map(item => <option key={item.user_id} value={item.user_id}>{item.full_name ?? item.email}</option>)}</select></label>
      {action && <label>Action status<select className={`${controlClass} w-full`} value={status} onChange={event => setStatus(event.target.value as ProjectAction["status"])}>{transitions[action.status].map(item => <option key={item} value={item}>{label(item)}</option>)}</select></label>}
      <label>Search project evidence<input className={`${controlClass} w-full`} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Linked submission<select className={`${controlClass} w-full`} value={submission} onChange={event => setSubmission(event.target.value)}><option value="">No linked submission</option>{submission && !evidence.data?.items.some(item => item.id === submission) && <option value={submission}>Linked record {submission}</option>}{evidence.data?.items.map(item => <option key={item.id} value={item.id}>{item.external_id} · {label(item.review_status)}</option>)}</select></label>
      <label>Linked indicator<select className={`${controlClass} w-full`} value={indicator} onChange={event => setIndicator(event.target.value)}><option value="">No linked indicator</option>{indicator && !indicators.data?.some(item => item.id === indicator) && <option value={indicator}>Linked indicator {indicator}</option>}{indicators.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {(status === "resolved" || status === "closed") && <label className="sm:col-span-2">Resolution summary (required)<textarea required maxLength={10000} className={`${controlClass} w-full`} value={summary} onChange={event => setSummary(event.target.value)} /></label>}
      {action && <label className="sm:col-span-2">Findings / verification / reopening note {transitionNeedsNote && "(required)"}<textarea required={transitionNeedsNote} maxLength={5000} className={`${controlClass} w-full`} value={note} onChange={event => setNote(event.target.value)} /></label>}
      <p className="text-sm sm:col-span-2">Resolve after recording corrective action. Close after an administrator verifies the result and records a verification note. Reopening requires a reason.</p>
      <button type="submit" className={`${button} bg-[var(--fs-primary)] text-white sm:col-span-2`} disabled={!title.trim() || archived || save.isPending}>{save.isPending ? "Saving…" : action ? "Save action" : "Save new action"}</button>
    </fieldset>
    {submission && <Link className="inline-flex min-h-11 items-center underline" to={`/submissions?project_id=${projectId}&submission_id=${submission}`}>Inspect linked submission</Link>}
    {indicator && <Link className="ml-3 inline-flex min-h-11 items-center underline" to={`/projects/${projectId}/indicators?indicator_id=${indicator}`}>Inspect linked indicator</Link>}
    {(evidence.error || indicators.error) && <p role="alert">Evidence options unavailable. <button type="button" className={button} onClick={() => { void evidence.refetch(); void indicators.refetch(); }}>Retry evidence</button></p>}
    {save.error && <p role="alert">Unable to save: {save.error.message} <button type="button" className={button} onClick={() => { save.reset(); reload(); }}>Reload action</button></p>}
    {save.isSuccess && <p role="status">Action saved.</p>}
  </form>;
}
