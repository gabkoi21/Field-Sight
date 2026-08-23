import { useMemo, useState } from "react";
import { ChevronDown, Download, FileClock, Search, ShieldCheck } from "lucide-react";
import { Button, PageHeader } from "../../components/ui";
import { AdminMetric, AdminPanel, AdminStatus, AdminTableFooter } from "../../components/superadmin/AdminUi";
import { auditEvents, type AuditEvent } from "./data";

type CategoryFilter = "All" | AuditEvent["category"];

export function AuditLogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return auditEvents.filter((event) =>
      (category === "All" || event.category === category) &&
      (!normalizedQuery || `${event.actor} ${event.action} ${event.target} ${event.ip}`.toLowerCase().includes(normalizedQuery)),
    );
  }, [category, query]);

  return (
    <>
      <PageHeader eyebrow="Security & governance" title="Audit log" description="Review privileged actions, access events, and changes across every organization.">
        <Button variant="secondary"><Download size={15} /> Export log</Button>
      </PageHeader>

      <section className="mb-[18px] grid grid-cols-3 gap-[18px] max-[800px]:grid-cols-1">
        <AdminMetric label="Events today" value="184" detail="18 privileged actions" icon={FileClock} />
        <AdminMetric label="Blocked events" value="3" detail="All automatically contained" icon={ShieldCheck} tone="red" />
        <AdminMetric label="Retention" value="365 days" detail="Immutable audit storage" icon={Download} tone="violet" />
      </section>

      <AdminPanel title="Platform events" description="Security and administrative activity">
        <div className="flex gap-2 border-b border-line p-4 max-[680px]:flex-col">
          <label className="flex min-h-[38px] flex-1 items-center gap-2 rounded-[7px] border border-[#dfe4e8] px-3 text-[#8793a2]"><Search size={15} /><input className="w-full border-0 bg-transparent text-xs text-[#324158] outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action, target, or IP..." /></label>
          <label className="relative flex min-h-[38px] min-w-[165px] items-center rounded-[7px] border border-[#dfe4e8] px-3"><select className="w-full appearance-none border-0 bg-transparent pr-5 text-xs text-[#455467] outline-none" value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}><option value="All">All categories</option><option value="Access">Access</option><option value="Organization">Organization</option><option value="Billing">Billing</option><option value="Security">Security</option></select><ChevronDown className="pointer-events-none absolute right-3 text-[#8793a2]" size={14} /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1020px]"><thead><tr><th>Actor</th><th>Action</th><th>Target</th><th>Category</th><th>IP address</th><th>Time</th><th>Status</th></tr></thead><tbody>{filteredEvents.map((event) => <tr key={event.id}><td><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-[7px] bg-[#f0edff] text-[9px] font-bold text-[#6d5bd0]">{event.initials}</span><strong>{event.actor}</strong></div></td><td>{event.action}</td><td>{event.target}</td><td><span className="inline-flex items-center gap-1.5"><ShieldCheck className="text-[#8793a2]" size={13} />{event.category}</span></td><td className="font-mono text-[11px]">{event.ip}</td><td>{event.time}</td><td><AdminStatus value={event.status} /></td></tr>)}</tbody></table>
          {filteredEvents.length === 0 && <p className="m-0 p-10 text-center text-xs text-[#8793a2]">No audit events match your filters.</p>}
        </div>
        <AdminTableFooter shown={filteredEvents.length} total={auditEvents.length} />
      </AdminPanel>
    </>
  );
}
