import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, PageHeader, LoadingState } from "../../components/ui";
import { AdminPanel, AdminTableFooter, adminInputClass } from "../../components/superadmin/AdminUi";
import { apiClient } from "../../services/apiClient";
export function AuditLogPage() {
  const [q, setQ] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [page, setPage] = useState(1);
  const params = new URLSearchParams({ q, offset: String((page - 1) * 25), limit: "25" });
  if (start) params.set("start", `${start}T00:00:00Z`);
  if (end) params.set("end", `${end}T23:59:59.999999Z`);
  const events = useQuery({ queryKey: ["platform-events", params.toString()], queryFn: () => apiClient.platformEvents(params) });
  return <><PageHeader eyebrow="Security & governance" title="Audit log" description="Recorded organization administrative events. Authentication, billing, and complete platform security history are not covered." /><AdminPanel title="Recorded administrative activity"><div className="grid gap-4 py-4 md:grid-cols-3"><label>Search<input className={adminInputClass} value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></label><label>From (UTC)<input type="date" className={adminInputClass} value={start} max={end || undefined} onChange={e => { setStart(e.target.value); setPage(1); }} /></label><label>Through (UTC)<input type="date" className={adminInputClass} value={end} min={start || undefined} onChange={e => { setEnd(e.target.value); setPage(1); }} /></label></div>{events.isLoading && <LoadingState label="Loading recorded events" />}{events.error && <div role="alert">Unable to load audit events. <Button onClick={() => void events.refetch()}>Retry events</Button></div>}{events.data && <><div className="overflow-x-auto"><table className="min-w-[720px]"><thead><tr><th>Actor</th><th>Action</th><th>Organization</th><th>Target</th><th>Timestamp</th></tr></thead><tbody>{events.data.items.map(event => <tr key={event.id}><td>{event.actor}</td><td>{event.action}</td><td>{event.organization}</td><td className="break-all">{event.target}</td><td>{new Date(event.occurred_at).toLocaleString()}</td></tr>)}</tbody></table></div>{!events.data.items.length && <p className="py-8 text-center">No recorded events match these filters.</p>}<AdminTableFooter shown={events.data.items.length} total={events.data.total} page={page} pageSize={25} onPageChange={setPage} /></>}</AdminPanel></>;
}
