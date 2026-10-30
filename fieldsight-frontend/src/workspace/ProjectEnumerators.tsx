import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Check, KeyRound, RefreshCw, ShieldMinus, Pencil, Trash2, UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type CollectorAssignmentInput, type KoboAccessState, type ManualKoboState, type ProjectCollector } from "../services/apiClient";
import { Button, LoadingState } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { Field, Notice, Panel, fieldClass } from "./WorkspaceUI";

const compactButton = "!min-h-8 !shrink-0 !whitespace-nowrap !gap-1.5 !rounded-md !px-2.5 !py-1 !text-xs !font-medium !shadow-none";
const blueButton = `${compactButton} !border-blue-200 !bg-blue-50 !text-blue-700 hover:!border-blue-300 hover:!bg-blue-100`;
const dangerButton = `${compactButton} !border-rose-200 !bg-white !text-rose-700 hover:!border-rose-300 hover:!bg-rose-50 focus-visible:!outline-rose-600`;
const grantedButton = `${compactButton} !border-emerald-200 !bg-emerald-50 !text-emerald-800 disabled:!opacity-100`;

const labels: Record<KoboAccessState, string> = {
  not_configured: "Not configured", pending: "Pending",
  verified_granted: "Granted — verified in Kobo", failed: "Failed — check or retry", revoked: "Direct collection permission revoked",
  reported_configured_unverified: "Reported configured — not verified",
};

export function ProjectEnumerators({ projectId }: { projectId: string }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ column: number; direction: "ascending" | "descending" } | null>(null);
  const [editing, setEditing] = useState<ProjectCollector | "new" | null>(null);
  const [removing, setRemoving] = useState<ProjectCollector | null>(null);
  const [mode, setMode] = useState("existing");
  const [identity, setIdentity] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [selected, setSelected] = useState(false);
  const [state, setState] = useState<ManualKoboState>("not_configured");
  const [accessConfirm, setAccessConfirm] = useState<{ item: ProjectCollector; form: ProjectCollector["forms"][number]; action: "grant" | "revoke" } | null>(null);
  const list = useQuery({ queryKey: ["project-enumerators", projectId], queryFn: () => apiClient.projectEnumerators(projectId), enabled: !!projectId });
  const eligible = useQuery({ queryKey: ["eligible-enumerators", projectId], queryFn: () => apiClient.eligibleEnumerators(projectId), enabled: !!projectId && editing === "new" });
  async function refresh() {
    await Promise.all([cache.invalidateQueries({ queryKey: ["project-enumerators"] }), cache.invalidateQueries({ queryKey: ["eligible-enumerators"] }), cache.invalidateQueries({ queryKey: ["project-team"] })]);
  }
  const save = useMutation({
    mutationFn: async () => {
      const person = eligible.data?.find(p => (p.collector_id ?? p.membership_id) === identity);
      const form = list.data?.connected_forms[0];
      const input: CollectorAssignmentInput = {
        ...(editing === "new" ? mode === "new" ? { full_name: name, email } : person?.collector_id ? { collector_id: person.collector_id } : { membership_id: person?.membership_id ?? undefined } : {}),
        kobo_username: username.trim(),
        forms: selected && form ? [{ connection_id: form.connection_id, form_id: form.form_id, state }] : [],
      };
      if (editing === "new") return apiClient.assignEnumerator(projectId, input);
      if (!editing) throw new Error("Select an assignment.");
      return apiClient.updateEnumeratorAssignment(projectId, editing.id, input);
    },
    onSuccess: async () => { setEditing(null); await refresh(); },
  });
  const remove = useMutation({ mutationFn: (id: string) => apiClient.removeEnumeratorAssignment(projectId, id), onSuccess: async () => { setRemoving(null); await refresh(); } });
  const access = useMutation({
    mutationFn: ({ assignment, form, action }: { assignment: string; form: string; action: "grant" | "verify" | "revoke" }) => apiClient.manageEnumeratorKoboAccess(projectId, assignment, form, action),
    onSuccess: async () => { setAccessConfirm(null); await refresh(); },
  });
  function open(item: ProjectCollector | "new") {
    save.reset(); setEditing(item); setMode("existing"); setIdentity(""); setName(""); setEmail("");
    setUsername(item === "new" ? "" : item.kobo_username ?? "");
    const form = item === "new" ? undefined : item.forms.find(f => f.is_selected && f.mapping_current);
    setSelected(!!form); setState(form && ["not_configured", "pending", "reported_configured_unverified"].includes(form.state) ? form.state as ManualKoboState : "not_configured");
  }
  function sortValue(item: ProjectCollector, column: number) {
    return [
      item.full_name || item.email,
      item.kobo_username || "",
      item.forms.filter(form => form.is_selected).map(form => list.data?.connected_forms.find(connected => connected.connection_id === form.connection_id && connected.form_id === form.form_id)?.name || form.form_id).join(", "),
      item.is_active ? "Active" : "Inactive",
      item.forms.map(form => labels[form.state]).join(", "),
      item.assigned_at,
    ][column];
  }
  const members = [...(list.data?.items ?? [])];
  if (sort) members.sort((a, b) => sortValue(a, sort.column).localeCompare(sortValue(b, sort.column), undefined, { numeric: true, sensitivity: "base" }) * (sort.direction === "ascending" ? 1 : -1));
  const pageCount = Math.max(1, Math.ceil(members.length / 10));
  const current = Math.min(page, pageCount);
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .filter(number => number === 1 || number === pageCount || Math.abs(number - current) <= 1);
  const paginationButton = "!min-h-8 !rounded !px-3 !py-1 !text-xs !font-normal !shadow-none";
  return <div className="space-y-4">
    {access.error && <Notice error>{access.error.message}</Notice>}
      <div className="flex justify-end">
        <Button className="!min-h-9 !gap-1.5 !px-3 !py-1.5 !text-xs" disabled={!list.data || !!list.error} onClick={() => open("new")}><UserPlus size={14} aria-hidden="true" />Add Enumerator</Button>
      </div>
    <Panel className="overflow-hidden !rounded-lg">
      {list.isLoading && <LoadingState label="Loading project enumerators…" />}
      {list.error && <Notice error>{list.error.message} <Button onClick={() => void list.refetch()}>Retry</Button></Notice>}
      {list.data && !list.error && <>
        {!members.length ? <p className="m-0 px-4 py-8 text-sm text-[var(--fs-muted)]">No enumerators found. Add an existing organization enumerator or register a collection-only contact.</p> : <div className="fs-table-scroll !rounded-none !border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--fs-primary)]" role="region" aria-label="Project enumerators table" tabIndex={0}>
          <table className="fs-data-table w-full min-w-[1440px] table-fixed text-left text-[13px]">
            <caption className="sr-only">Project enumerators, assigned forms and Kobo access</caption>
            <colgroup>{[15, 10, 17, 9, 28, 9, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
            <thead className="bg-[var(--fs-table-heading)] text-[13px] text-[var(--fs-text)]"><tr>
              {["Enumerator", "Kobo username", "Assigned forms", "Assignment status", "Kobo access", "Date assigned", "Actions"].map((heading, column) => <th key={heading} scope="col" aria-sort={column < 6 ? sort?.column === column ? sort.direction : "none" : undefined} className="border-r border-[var(--fs-table-border)] px-3 py-2 text-[13px] font-medium last:border-r-0">
                {column === 6 ? heading : <button type="button" aria-label={`Sort by ${heading}`} className="justify-between border-0 bg-transparent text-left text-[var(--fs-text)] hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--fs-primary)]" onClick={() => { setSort(previous => ({ column, direction: previous?.column === column && previous.direction === "ascending" ? "descending" : "ascending" })); setPage(1); }}>
                  <span>{heading}</span>{sort?.column === column ? sort.direction === "ascending" ? <ArrowUp size={12} aria-hidden="true" className="shrink-0 text-[var(--fs-primary)]" /> : <ArrowDown size={12} aria-hidden="true" className="shrink-0 text-[var(--fs-primary)]" /> : <ChevronsUpDown size={12} aria-hidden="true" className="shrink-0 text-slate-500" />}
                </button>}
              </th>)}
            </tr></thead>
            <tbody>{members.slice((current - 1) * 10, current * 10).map(item => <tr key={item.id} className="align-middle odd:bg-[var(--fs-table-stripe)] even:bg-[var(--fs-surface)] hover:bg-[var(--fs-canvas)]">
            <th scope="row" className="max-w-[240px] break-words px-3 py-2 font-normal"><strong className="block font-medium">{item.full_name || item.email}</strong><span className="mt-0.5 block text-xs text-[var(--fs-primary)]">{item.email}</span></th>
            <td className="max-w-[180px] break-words px-3 py-2">{item.kobo_username || "Not provided"}</td>
            <td className="max-w-[220px] break-words px-3 py-2">{item.forms.some(form => form.is_selected) ? item.forms.filter(form => form.is_selected).map(form => <div key={form.id} className="mb-2 last:mb-0" title={form.form_id}>{list.data?.connected_forms.find(connected => connected.connection_id === form.connection_id && connected.form_id === form.form_id)?.name || form.form_id}{!form.mapping_current && <span className="block text-xs text-[var(--fs-muted)]">Previous mapping</span>}</div>) : "No forms selected"}</td>
            <td className="px-3 py-2"><span className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-medium ${item.is_active ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-700"}`}>{item.is_active ? "Active" : "Inactive"}</span></td>
            <td className="max-w-[320px] px-3 py-2">{!item.forms.length ? "Not configured" : item.forms.map(form => <div key={form.id} className="mb-2 space-y-1 last:mb-0"><span className="block">{labels[form.state]}</span>
              {form.last_checked_at && <span className="block text-xs text-[var(--fs-muted)]">Last checked: {new Date(form.last_checked_at).toLocaleString()}</span>}
              {form.last_error && <p role="alert" className="m-0 text-xs text-red-700">{form.requested_action && `${form.requested_action}: `}{form.last_error}</p>}
              <div className="flex flex-row flex-nowrap items-center gap-1.5">
                {item.is_active && form.is_selected && form.mapping_current && <Button className={form.state === "verified_granted" ? grantedButton : blueButton} variant="secondary" disabled={form.state === "verified_granted" || access.isPending || !item.kobo_username} onClick={() => { access.reset(); setAccessConfirm({ item, form, action: "grant" }); }}>{form.state === "verified_granted" ? <Check size={14} aria-hidden="true" /> : <KeyRound size={14} aria-hidden="true" />}{form.state === "verified_granted" ? "Granted" : form.state === "failed" && form.requested_action === "grant" ? "Retry grant" : "Grant Kobo access"}</Button>}
                <Button className={blueButton} variant="secondary" disabled={access.isPending} onClick={() => access.mutate({ assignment: item.id, form: form.id, action: "verify" })}><RefreshCw size={14} aria-hidden="true" className={access.isPending && access.variables?.form === form.id && access.variables.action === "verify" ? "animate-spin motion-reduce:animate-none" : ""} />Check access</Button>
                <Button className={dangerButton} variant="secondary" disabled={access.isPending} onClick={() => { access.reset(); setAccessConfirm({ item, form, action: "revoke" }); }}><ShieldMinus size={14} aria-hidden="true" />{form.state === "failed" && form.requested_action === "revoke" ? "Retry revoke" : "Revoke collection"}</Button>
              </div>
            </div>)}</td>
            <td className="whitespace-nowrap px-3 py-2">{new Date(item.assigned_at).toLocaleDateString()}</td>
            <td className="px-3 py-2"><div className="flex flex-row flex-nowrap items-center gap-1.5">
              {item.is_active ? <><Button className={blueButton} variant="secondary" aria-label="Edit forms & Kobo access" onClick={() => open(item)}><Pencil size={14} aria-hidden="true" />Edit</Button><Button className={dangerButton} variant="secondary" onClick={() => { remove.reset(); setRemoving(item); }}><Trash2 size={14} aria-hidden="true" />Remove</Button></> : <Button className={blueButton} variant="secondary" onClick={() => { open("new"); setIdentity(item.collector_id ?? item.membership_id ?? ""); setUsername(item.kobo_username ?? ""); }}><UserPlus size={14} aria-hidden="true" />Reassign</Button>}
            </div></td>
          </tr>)}</tbody>
          </table>
        </div>}
        <nav aria-label="Enumerator pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--fs-table-border)] bg-[var(--fs-table-heading)] px-3 py-2 text-xs text-[var(--fs-muted)]">
          <span aria-live="polite">Showing {members.length ? (current - 1) * 10 + 1 : 0} to {Math.min(current * 10, members.length)} of {members.length} results</span>
          <div className="flex items-center gap-1">
            <Button className={paginationButton} variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
            {pageNumbers.map((number, index) => <span key={number} className="flex items-center gap-1">
              {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1" aria-hidden="true">…</span>}
              <Button className={paginationButton} variant={number === current ? "primary" : "secondary"} aria-label={`Page ${number}`} aria-current={number === current ? "page" : undefined} onClick={() => setPage(number)}>{number}</Button>
            </span>)}
            <Button className={paginationButton} variant="secondary" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>Next</Button>
          </div>
        </nav>
      </>}
    </Panel>
    {accessConfirm && <Dialog title={accessConfirm.action === "grant" ? "Grant Kobo collection access?" : "Revoke Kobo collection access?"} description={`${accessConfirm.form.permission_username || accessConfirm.item.kobo_username} · ${accessConfirm.form.form_id}`} error={access.error?.message} onClose={() => { if (!access.isPending) setAccessConfirm(null); }}><div className="space-y-4"><p>{accessConfirm.action === "grant" ? "Grant Add submissions using the project's Kobo connection. Kobo also includes View form. Existing unrelated permissions are preserved." : "Remove this account's direct Add submissions permission for this Kobo form. Its FieldSight assignment stays unchanged. Other Kobo permissions are preserved. This affects that Kobo account wherever this form is used."}</p><p className="text-sm text-[var(--fs-muted)]">Checks confirm direct Kobo API permissions at the displayed time; they do not test login, offline copies, or inherited account access.</p><div className="flex gap-3"><Button disabled={access.isPending} onClick={() => setAccessConfirm(null)}>Cancel</Button><Button disabled={access.isPending} onClick={() => access.mutate({ assignment: accessConfirm.item.id, form: accessConfirm.form.id, action: accessConfirm.action })}>{access.isPending ? "Updating Kobo…" : accessConfirm.action === "grant" ? "Confirm grant" : "Confirm revoke"}</Button></div></div></Dialog>}
    {editing && <Dialog title={editing === "new" ? "Add Enumerator" : "Update enumerator forms"} description="Save the assignment, then use Grant Kobo access on the selected form." error={save.error?.message} onClose={() => { if (!save.isPending) setEditing(null); }}>
      <form className="grid gap-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        {editing === "new" && <>
          <Field label="Enumerator type"><select className={fieldClass} value={mode} onChange={e => setMode(e.target.value)}><option value="existing">Existing organization enumerator</option><option value="new">New collection-only enumerator</option></select></Field>
          {mode === "existing" ? <>
            {eligible.isLoading && <LoadingState label="Loading eligible enumerators…" />}
            {eligible.error && <Notice error>{eligible.error.message}<Button type="button" onClick={() => void eligible.refetch()}>Retry</Button></Notice>}
            <Field label="Organization enumerator"><select required className={fieldClass} value={identity} onChange={e => { setIdentity(e.target.value); setUsername(eligible.data?.find(p => (p.collector_id ?? p.membership_id) === e.target.value)?.kobo_username ?? ""); setState("not_configured"); }}><option value="">Select an enumerator</option>{eligible.data?.map(p => <option key={p.collector_id ?? p.membership_id} value={p.collector_id ?? p.membership_id ?? ""}>{p.full_name || p.email} — {p.email}</option>)}</select></Field>
          </> : <><Field label="Full name"><input required minLength={2} maxLength={200} className={fieldClass} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Email"><input type="email" required className={fieldClass} value={email} onChange={e => setEmail(e.target.value)} /></Field></>}
        </>}
        <Field label="Kobo username"><input required pattern="[A-Za-z0-9_.@+\-]+" maxLength={100} className={fieldClass} value={username} onChange={e => { setUsername(e.target.value); setState("not_configured"); }} /></Field>
        <p className="text-sm">Use the actual Kobo account username; email is not assumed to be the username. Changing it resets prior manual reports across projects.</p>
        {list.data?.connected_forms.length ? list.data.connected_forms.map(f => <label key={f.form_id} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={selected} onChange={e => setSelected(e.target.checked)} />{f.name} ({f.form_id}) · {f.server_url}</label>) : <Notice>No Kobo form is connected. You can save the enumerator and configure forms later from the project Forms tab.</Notice>}
        {selected && <Field label="Manually recorded Kobo access"><select className={fieldClass} value={state} onChange={e => setState(e.target.value as ManualKoboState)}>{Object.entries(labels).filter(([value]) => ["not_configured", "pending", "reported_configured_unverified"].includes(value)).map(([value, text]) => <option key={value} value={value} disabled={value === "reported_configured_unverified" && !username.trim()}>{text}</option>)}</select></Field>}
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" disabled={save.isPending} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={save.isPending || (editing === "new" && mode === "existing" && (!identity || !!eligible.error))}>{save.isPending ? "Saving…" : "Confirm assignment"}</Button></div>
      </form>
    </Dialog>}
    {removing && <Dialog compact title="Remove enumerator?" description="Please confirm before removing this person from the project." error={remove.error?.message} onClose={() => { if (!remove.isPending) setRemoving(null); }}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-700"><Trash2 size={20} aria-hidden="true" /></span>
          <div className="min-w-0"><strong className="block break-words text-sm">{removing.full_name || removing.email}</strong><span className="block break-words text-xs text-[var(--fs-muted)]">{removing.email}</span></div>
        </div>
        <p className="text-sm text-[var(--fs-muted)]">Their project assignment will become inactive. You can reassign them later.</p>
        <Notice>Kobo access is not automatically revoked. Use Revoke collection on the assigned form here, or remove access in KoboToolbox separately. Manual access reports and audit history are retained.</Notice>
        <div className="flex justify-end gap-2 border-t border-[var(--fs-border)] pt-4">
          <Button variant="secondary" disabled={remove.isPending} onClick={() => setRemoving(null)}>Cancel</Button>
          <Button className="!border-rose-600 !bg-rose-600 !text-white hover:!border-rose-700 hover:!bg-rose-700 focus-visible:!outline-rose-600" disabled={remove.isPending} onClick={() => remove.mutate(removing.id)}><Trash2 size={15} aria-hidden="true" />{remove.isPending ? "Removing…" : "Confirm removal"}</Button>
        </div>
      </div>
    </Dialog>}
  </div>;
}


