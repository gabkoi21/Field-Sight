import { formatDate, formatDateTime } from "../utils/dateFormat";
import { DeleteConfirmation } from "../components/ui/DeleteConfirmation";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Check, KeyRound, ShieldMinus, RefreshCw, Pencil, Trash2, UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type CollectorAssignmentInput, type KoboAccessState, type ProjectCollector, type ProjectEnumerators as EnumeratorList } from "../services/apiClient";
import { Button, LoadingState } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { Field, Notice, Panel, fieldClass } from "./WorkspaceUI";
import { liberiaCounties } from "../utils/liberiaCounties";

const compactButton = "!min-h-8 !shrink-0 !whitespace-nowrap !gap-1.5 !rounded-md !px-2.5 !py-1 !text-xs !font-medium !shadow-none";
const blueButton = `${compactButton} !border-blue-200 !bg-blue-50 !text-blue-700 hover:!border-blue-300 hover:!bg-blue-100`;
const dangerButton = `${compactButton} !border-rose-200 !bg-white !text-rose-700 hover:!border-rose-300 hover:!bg-rose-50 focus-visible:!outline-rose-600`;
const revokeButton = `${compactButton} !border-rose-200 !bg-rose-50 !text-rose-700 hover:!border-rose-300 hover:!bg-rose-100 focus-visible:!outline-rose-600`;
const grantedButton = `${compactButton} !border-emerald-200 !bg-emerald-50 !text-emerald-800 disabled:!opacity-100`;

const labels: Record<KoboAccessState, string> = {
  not_configured: "Not configured", pending: "Pending",
  verified_granted: "Granted — verified in Kobo", failed: "Failed — check or retry", revoked: "Direct form access revoked",
  reported_configured_unverified: "Reported configured — not verified",
};

function teamStatus(item: ProjectCollector) {
  if (!item.is_active) return "Removed";
  return item.forms.some(form => form.is_selected && form.mapping_current && (form.state === "verified_granted" && form.grant_confirmed)) ? "Active" : "Inactive";
}

export function ProjectEnumerators({ projectId }: { projectId: string }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [showRemoved, setShowRemoved] = useState(false);
  const [sort, setSort] = useState<{ column: number; direction: "ascending" | "descending" } | null>(null);
  const [editing, setEditing] = useState<ProjectCollector | "new" | null>(null);
  const [removing, setRemoving] = useState<ProjectCollector | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [counties, setCounties] = useState<string[] | null>(null);
  const [countyDropdownOpen, setCountyDropdownOpen] = useState(false);
  const [countySearch, setCountySearch] = useState("");
  const list = useQuery({ queryKey: ["project-enumerators", projectId], queryFn: () => apiClient.projectEnumerators(projectId), enabled: !!projectId });
  async function refresh() {
    await Promise.all([cache.invalidateQueries({ queryKey: ["project-enumerators"] }), cache.invalidateQueries({ queryKey: ["eligible-enumerators"] }), cache.invalidateQueries({ queryKey: ["project-team"] })]);
  }
  const save = useMutation({
    mutationFn: async () => {
      const input: CollectorAssignmentInput = {
        ...(editing === "new" && fullName.trim() ? { full_name: fullName.trim() } : {}),
        ...(editing === "new" && email.trim() ? { email: email.trim() } : {}),
        ...(editing && editing !== "new" && fullName.trim() !== (editing.full_name ?? "") ? { full_name: fullName.trim() || null } : {}),
        kobo_username: username.trim(),
        counties,
      };
      if (editing === "new") return apiClient.assignEnumerator(projectId, input);
      if (!editing) throw new Error("Select an assignment.");
      return apiClient.updateEnumeratorAssignment(projectId, editing.id, input);
    },
    onSuccess: async () => { setEditing(null); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.removeEnumeratorAssignment(projectId, id),
    onSuccess: async (_, id) => {
      const key = ["project-enumerators", projectId];
      await cache.cancelQueries({ queryKey: key, exact: true });
      cache.setQueryData<EnumeratorList>(key, previous => previous ? {
        ...previous,
        items: previous.items.map(item => item.id === id ? { ...item, is_active: false } : item),
      } : previous);
      setRemoving(null);
      await refresh();
    },
  });
  const [accessConfirm, setAccessConfirm] = useState<{ item: ProjectCollector; form: ProjectCollector["forms"][number]; action: "grant" | "revoke" } | null>(null);
  const access = useMutation({
    mutationFn: ({ assignment, form, action }: { assignment: string; form: string; action: "grant" | "verify" | "revoke" }) => apiClient.manageEnumeratorKoboAccess(projectId, assignment, form, action),
    onSuccess: async () => { setAccessConfirm(null); await refresh(); },
    onError: async () => { await refresh(); },
  });
  function open(item: ProjectCollector | "new") {
    save.reset(); setEditing(item);
    setUsername(item === "new" ? "" : item.kobo_username ?? "");
    setFullName(item === "new" ? "" : item.full_name ?? "");
    setEmail("");
    setCounties(item === "new" ? null : item.counties ?? null);
    setCountyDropdownOpen(false); setCountySearch("");
  }
  function sortValue(item: ProjectCollector, column: number) {
    return [
      item.full_name || item.email || item.kobo_username || "",
      item.kobo_username || "",
      item.forms.filter(form => form.is_selected).map(form => list.data?.connected_forms.find(connected => connected.connection_id === form.connection_id && connected.form_id === form.form_id)?.name || form.form_id).join(", "),
      teamStatus(item),
      item.forms.map(form => labels[form.state]).join(", "),
      item.assigned_at,
      item.counties?.join(", ") ?? "All counties",
    ][column];
  }
  const members = (list.data?.items ?? []).filter(item => showRemoved || item.is_active);
  if (sort) members.sort((a, b) => sortValue(a, sort.column).localeCompare(sortValue(b, sort.column), undefined, { numeric: true, sensitivity: "base" }) * (sort.direction === "ascending" ? 1 : -1));
  const pageCount = Math.max(1, Math.ceil(members.length / 10));
  const current = Math.min(page, pageCount);
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .filter(number => number === 1 || number === pageCount || Math.abs(number - current) <= 1);
  const paginationButton = "!min-h-8 !rounded !px-3 !py-1 !text-xs !font-normal !shadow-none";
  const refreshing = !list.isLoading && (list.isFetching || save.isPending || remove.isPending);
  return <div className="space-y-4">
    {access.error && <Notice error>{access.error.message}</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-9 items-center gap-2 text-sm text-[var(--fs-muted)]"><input type="checkbox" checked={showRemoved} onChange={e => { setShowRemoved(e.target.checked); setPage(1); }} />Show removed enumerators</label>
        <Button className="!min-h-9 !gap-1.5 !px-3 !py-1.5 !text-xs" disabled={!list.data || !!list.error} onClick={() => open("new")}><UserPlus size={14} aria-hidden="true" />Add Enumerator</Button>
      </div>
    <Panel className="overflow-hidden !rounded-lg">
      {refreshing && <div role="status" aria-live="polite" className="flex items-center gap-2 border-b border-[var(--fs-table-border)] px-4 py-3 text-sm text-[var(--fs-muted)]"><RefreshCw size={16} aria-hidden="true" className="motion-safe:animate-spin" />Refreshing enumerators…</div>}
      {list.isLoading && <LoadingState label="Loading project enumerators…" />}
      {list.error && <Notice error>{list.error.message} <Button onClick={() => void list.refetch()}>Retry</Button></Notice>}
      {list.data && !list.error && <>
        {!members.length ? <p className="m-0 px-4 py-8 text-sm text-[var(--fs-muted)]">No enumerators found. Add an existing organization enumerator or register a collection-only contact.</p> : <div className="fs-table-scroll !rounded-none !border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--fs-primary)]" role="region" aria-label="Project enumerators table" tabIndex={0}>
          <table aria-busy={refreshing} className="fs-data-table w-full min-w-[1440px] table-fixed text-left text-[13px]">
            <caption className="sr-only">Project enumerators, assigned forms and Kobo access</caption>
            <colgroup>{[14, 9, 15, 7, 21, 9, 11, 14].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
            <thead className="bg-[var(--fs-table-heading)] text-[13px] text-[var(--fs-text)]"><tr>
              {["Enumerator", "Kobo username", "Assigned forms", "Status", "Kobo access", "Date assigned", "Counties", "Actions"].map((heading, column) => <th key={heading} scope="col" aria-sort={column < 7 ? sort?.column === column ? sort.direction : "none" : undefined} className="border-r border-[var(--fs-table-border)] px-3 py-2 text-[13px] font-medium last:border-r-0">
                {column === 7 ? heading : <button type="button" aria-label={`Sort by ${heading}`} className="justify-between border-0 bg-transparent text-left text-[var(--fs-text)] hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--fs-primary)]" onClick={() => { setSort(previous => ({ column, direction: previous?.column === column && previous.direction === "ascending" ? "descending" : "ascending" })); setPage(1); }}>
                  <span>{heading}</span>{sort?.column === column ? sort.direction === "ascending" ? <ArrowUp size={12} aria-hidden="true" className="shrink-0 text-[var(--fs-primary)]" /> : <ArrowDown size={12} aria-hidden="true" className="shrink-0 text-[var(--fs-primary)]" /> : <ChevronsUpDown size={12} aria-hidden="true" className="shrink-0 text-slate-500" />}
                </button>}
              </th>)}
            </tr></thead>
            <tbody>{members.slice((current - 1) * 10, current * 10).map(item => <tr key={item.id} className="align-middle odd:bg-[var(--fs-table-stripe)] even:bg-[var(--fs-surface)] hover:bg-[var(--fs-canvas)]">
            <th scope="row" className="max-w-[240px] break-words px-3 py-2 font-normal"><strong className="block font-medium">{item.full_name || item.kobo_username || item.email || "Enumerator"}</strong>{item.email && <span className="mt-0.5 block text-xs text-[var(--fs-primary)]">{item.email}</span>}</th>
            <td className="max-w-[180px] break-words px-3 py-2">{item.kobo_username || "Not provided"}</td>
            <td className="max-w-[220px] break-words px-3 py-2">{item.forms.some(form => form.is_selected) ? item.forms.filter(form => form.is_selected).map(form => <div key={form.id} className="mb-2 last:mb-0" title={form.form_id}>{list.data?.connected_forms.find(connected => connected.connection_id === form.connection_id && connected.form_id === form.form_id)?.name || form.form_id}{!form.mapping_current && <span className="block text-xs text-[var(--fs-muted)]">Previous mapping</span>}</div>) : "No forms selected"}</td>
            <td className="px-3 py-2"><span className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-medium ${teamStatus(item) === "Active" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-700"}`}>{teamStatus(item)}</span></td>
            <td className="max-w-[320px] px-3 py-2">{!item.forms.length ? "Not configured" : item.forms.map(form => <div key={form.id} className="mb-2 space-y-1 last:mb-0">{form.grant_confirmed && form.state !== "not_configured" && <span className="block">{labels[form.state]}</span>}
              {form.grant_confirmed && form.last_checked_at && <span className="block text-xs text-[var(--fs-muted)]">Last checked: {formatDateTime(form.last_checked_at)}</span>}
              {form.last_error && <p role="alert" className="m-0 text-xs text-red-700">{form.requested_action && `${form.requested_action}: `}{form.last_error}</p>}
              <div className="flex min-w-0 flex-wrap items-center gap-2 pt-1">
                {item.is_active && form.is_selected && form.mapping_current && <Button className={(form.state === "verified_granted" && form.grant_confirmed) ? grantedButton : blueButton} variant="secondary" disabled={(form.state === "verified_granted" && form.grant_confirmed) || access.isPending || !item.kobo_username} onClick={() => { access.reset(); setAccessConfirm({ item, form, action: "grant" }); }}>{(form.state === "verified_granted" && form.grant_confirmed) ? <Check size={14} aria-hidden="true" /> : <KeyRound size={14} aria-hidden="true" />}{(form.state === "verified_granted" && form.grant_confirmed) ? "Granted" : form.state === "failed" && form.requested_action === "grant" ? "Retry grant" : "Grant Kobo access"}</Button>}
                {(form.grant_confirmed && (form.state === "verified_granted" || (form.requested_action === "revoke" && form.state !== "revoked"))) && <>
                  <Button className={revokeButton} variant="secondary" disabled={access.isPending} onClick={() => { access.reset(); setAccessConfirm({ item, form, action: "revoke" }); }}><ShieldMinus size={14} aria-hidden="true" />{form.state === "failed" && form.requested_action === "revoke" ? "Retry revoke" : "Revoke access"}</Button>
                </>}
              </div>
            </div>)}</td>
            <td className="whitespace-nowrap px-3 py-2">{formatDate(item.assigned_at)}</td>
            <td className="break-words px-3 py-2">{item.counties?.join(", ") ?? "All counties"}</td>
            <td className="px-3 py-3 !pr-4"><div className="flex min-w-0 flex-wrap items-center gap-2">
              {item.is_active ? <><Button className={blueButton} variant="secondary" aria-label="Edit forms & Kobo access" onClick={() => open(item)}><Pencil size={14} aria-hidden="true" />Edit</Button><Button className={dangerButton} variant="secondary" onClick={() => { remove.reset(); setRemoving(item); }}><Trash2 size={14} aria-hidden="true" />Remove</Button></> : <Button className={blueButton} variant="secondary" onClick={() => { open("new"); setUsername(item.kobo_username ?? ""); }}><UserPlus size={14} aria-hidden="true" />Reassign</Button>}
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
    {accessConfirm && <Dialog title={accessConfirm.action === "grant" ? "Grant Kobo collection access?" : "Revoke Kobo form access?"} description={`${accessConfirm.form.permission_username || accessConfirm.item.kobo_username} · ${accessConfirm.form.form_id}`} error={access.error?.message} onClose={() => { if (!access.isPending) setAccessConfirm(null); }}><div className="space-y-4"><p>{accessConfirm.action === "grant" ? "Grant Add submissions using the project's Kobo connection. Kobo also includes View form. Existing unrelated permissions are preserved." : "Remove this account's direct permissions to view this form and submit data in Kobo. Its FieldSight assignment and submission history stay saved. This affects that Kobo account wherever this form is used."}</p><p className="text-sm text-[var(--fs-muted)]">Checks confirm direct Kobo API permissions at the displayed time; they do not test login, offline copies, or inherited account access.</p><div className="flex gap-3"><Button disabled={access.isPending} onClick={() => setAccessConfirm(null)}>Cancel</Button><Button disabled={access.isPending} onClick={() => access.mutate({ assignment: accessConfirm.item.id, form: accessConfirm.form.id, action: accessConfirm.action })}>{access.isPending ? "Updating Kobo…" : accessConfirm.action === "grant" ? "Confirm grant" : "Confirm revoke"}</Button></div></div></Dialog>}
    {editing && <Dialog title={editing === "new" ? "Add Enumerator" : "Update enumerator forms"} description="Save the assignment, then grant Kobo access using the button in the table." error={save.error?.message} onClose={() => { if (!save.isPending) setEditing(null); }}>
      <form className="grid gap-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-[var(--fs-muted)]"><span>Kobo username <span aria-hidden="true" className="text-red-600">*</span></span><input aria-label="Kobo username" required pattern="[A-Za-z0-9_.@+\-]+" maxLength={100} className={fieldClass} value={username} onChange={e => { setUsername(e.target.value); }} /></label>
        <Field label="Full name"><input minLength={2} maxLength={200} autoComplete="name" className={fieldClass} placeholder="Enter the person’s full name" value={fullName} onChange={e => setFullName(e.target.value)} /></Field>
        {editing === "new" && <Field label="Email"><input type="email" maxLength={254} autoComplete="email" className={fieldClass} placeholder="Enter email (optional)" value={email} onChange={e => setEmail(e.target.value)} /></Field>}
        <div className="relative grid gap-1.5" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setCountyDropdownOpen(false); }} onKeyDown={e => { if (e.key === "Escape" && countyDropdownOpen) { e.preventDefault(); e.stopPropagation(); setCountyDropdownOpen(false); e.currentTarget.querySelector("button")?.focus(); } }}>
          <label htmlFor="assigned-counties" className="text-sm font-medium text-[var(--fs-muted)]">Assigned counties</label>
          <div className="relative">
            <input id="assigned-counties" className={`${fieldClass} pr-10`} autoComplete="off" role="combobox" aria-expanded={countyDropdownOpen} aria-controls="county-options" aria-haspopup="dialog" value={countyDropdownOpen ? countySearch : counties === null ? "All counties" : counties.join(", ")} placeholder={counties?.length ? counties.join(", ") : "Search counties…"} onFocus={() => { setCountySearch(""); setCountyDropdownOpen(true); }} onChange={e => setCountySearch(e.target.value)} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setCountyDropdownOpen(true); } }} />
            <button type="button" aria-label={countyDropdownOpen ? "Close county options" : "Open county options"} aria-expanded={countyDropdownOpen} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-[var(--fs-muted)] focus-visible:outline focus-visible:outline-2" onClick={() => { setCountySearch(""); setCountyDropdownOpen(!countyDropdownOpen); }}><ChevronsUpDown size={16} aria-hidden="true" /></button>
          </div>
          {countyDropdownOpen && <div id="county-options" role="dialog" aria-label="County options" className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] p-2 shadow-lg">
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={counties === null} onChange={e => setCounties(e.target.checked ? null : [])} />All counties
          </label>
          <div className="grid">
            {liberiaCounties.filter(county => county.toLowerCase().includes(countySearch.trim().toLowerCase())).map(county => <label key={county} className="flex min-h-11 items-center gap-2 rounded px-2 text-sm hover:bg-[var(--fs-table-heading)]">
              <input type="checkbox" checked={counties === null || counties.includes(county)} onChange={e => {
                const selectedCounties = counties ?? [...liberiaCounties];
                const next = e.target.checked ? [...selectedCounties, county] : selectedCounties.filter(name => name !== county);
                setCounties(next.length === liberiaCounties.length ? null : next);
              }} />{county}
            </label>)}
          </div>
          {!liberiaCounties.some(county => county.toLowerCase().includes(countySearch.trim().toLowerCase())) && <p className="px-2 py-3 text-sm text-[var(--fs-muted)]">No counties found.</p>}
          </div>}
          {counties?.length === 0 && <p role="alert" className="text-xs text-red-700">Select at least one county or All counties.</p>}
        </div>
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" disabled={save.isPending} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={save.isPending || counties?.length === 0 || !username.trim()}>{save.isPending ? "Saving…" : "Confirm assignment"}</Button></div>
      </form>
    </Dialog>}
    {removing && <DeleteConfirmation title="Remove enumerator" name={removing.full_name || removing.email || removing.kobo_username || "Enumerator"} description="Deactivate assignment; Kobo access and history remain." phrase="remove enumerator" actionLabel="Remove enumerator" warning="This deactivates the project assignment. Kobo collection access is retained." onConfirm={() => remove.mutateAsync(removing.id)} onClose={() => setRemoving(null)} />}
  </div>;
}


