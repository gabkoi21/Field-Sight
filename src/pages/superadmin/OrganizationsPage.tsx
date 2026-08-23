import { useMemo, useState, type FormEvent } from "react";
import { Building2, ChevronDown, ExternalLink, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, PageHeader } from "../../components/ui";
import { AdminPanel, AdminStatus, AdminTableFooter, adminInputClass } from "../../components/superadmin/AdminUi";
import { organizations as seedOrganizations, type Organization, type OrganizationStatus } from "./data";

export function OrganizationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [organizations, setOrganizations] = useState(seedOrganizations);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | OrganizationStatus>("All");
  const [showCreate, setShowCreate] = useState(searchParams.get("create") === "1");
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(searchParams.get("create") === "1");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [plan, setPlan] = useState<Organization["plan"]>("Starter");

  const filteredOrganizations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return organizations.filter((organization) =>
      (status === "All" || organization.status === status) &&
      (!normalizedQuery || `${organization.name} ${organization.owner}`.toLowerCase().includes(normalizedQuery)),
    );
  }, [organizations, query, status]);

  function openCreate() {
    setDrawerClosing(false);
    setDrawerVisible(false);
    setShowCreate(true);
    window.requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeCreate() {
    setDrawerClosing(true);
    setDrawerVisible(false);
    setSearchParams({}, { replace: true });
    window.setTimeout(() => setShowCreate(false), 220);
  }

  function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const organizationName = name.trim();
    if (!organizationName || !owner.trim()) return;
    const initials = organizationName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    setOrganizations((current) => [{ id: Date.now(), name: organizationName, initials, plan, owner: owner.trim(), users: 1, projects: 0, submissions: "0", status: "Trial", activity: "Just now" }, ...current]);
    setName(""); setOwner(""); setPlan("Starter"); closeCreate();
  }

  return (
    <>
      <PageHeader eyebrow="Tenant administration" title="Organizations" description="Create and manage every organization using the FieldSight platform.">
        <Button onClick={openCreate}><Plus size={15} /> New organization</Button>
      </PageHeader>

      <AdminPanel title="Platform organizations" description="Plans, owners, usage, and tenant access">
        <div className="flex gap-2 border-b border-line p-4 max-[680px]:flex-col">
          <label className="flex min-h-[38px] flex-1 items-center gap-2 rounded-[7px] border border-[#dfe4e8] bg-white px-3 text-[#8793a2]">
            <Search size={15} /><input className="w-full border-0 bg-transparent text-xs text-[#324158] outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or owner..." />
          </label>
          <label className="relative flex min-h-[38px] min-w-[150px] items-center rounded-[7px] border border-[#dfe4e8] bg-white px-3">
            <select className="w-full appearance-none border-0 bg-transparent pr-5 text-xs text-[#455467] outline-none" value={status} onChange={(event) => setStatus(event.target.value as "All" | OrganizationStatus)}><option value="All">All statuses</option><option value="Active">Active</option><option value="Trial">Trial</option><option value="Suspended">Suspended</option></select><ChevronDown className="pointer-events-none absolute right-3 text-[#8793a2]" size={14} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px]">
            <thead><tr><th>Organization</th><th>Owner</th><th>Plan</th><th>Users</th><th>Projects</th><th>Submissions</th><th>Status</th><th>Last activity</th><th /></tr></thead>
            <tbody>
              {filteredOrganizations.map((organization) => (
                <tr key={organization.id} className="hover:bg-[#fbfcfe]">
                  <td><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-[7px] bg-[#e9f1ff] text-[10px] font-bold text-brand">{organization.initials}</span><strong>{organization.name}</strong></div></td>
                  <td>{organization.owner}</td><td>{organization.plan}</td><td>{organization.users}</td><td>{organization.projects}</td><td><strong>{organization.submissions}</strong></td><td><AdminStatus value={organization.status} /></td><td>{organization.activity}</td>
                  <td><div className="flex items-center gap-2"><button title="Open organization workspace" className="border-0 bg-transparent text-brand" onClick={() => navigate("/")}><ExternalLink size={15} /></button><button aria-label={`Actions for ${organization.name}`} className="border-0 bg-transparent text-[#8793a2]"><MoreHorizontal size={17} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrganizations.length === 0 && <p className="m-0 p-10 text-center text-xs text-[#8793a2]">No organizations match your filters.</p>}
        </div>
        <AdminTableFooter shown={filteredOrganizations.length} total={organizations.length} />
      </AdminPanel>

      {showCreate && (
        <div className={`fixed inset-0 z-50 bg-[rgba(16,42,67,.23)] transition-opacity ${drawerClosing ? "duration-[220ms] ease-in" : "duration-[220ms] ease-out"} ${drawerVisible ? "opacity-100" : "opacity-0"}`} onClick={closeCreate}>
          <form className={`absolute bottom-0 right-0 top-0 flex w-[min(470px,100%)] flex-col bg-white shadow-[-16px_0_35px_rgba(16,42,67,.18)] transition-[opacity,transform] max-[460px]:w-full ${drawerClosing ? "translate-x-[36px] opacity-0 duration-[220ms] ease-[cubic-bezier(.4,0,1,1)]" : `${drawerVisible ? "translate-x-0 opacity-100" : "translate-x-[36px] opacity-0"} duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)]`}`} onClick={(event) => event.stopPropagation()} onSubmit={createOrganization}>
            <header className="!flex !items-start !justify-between !border-b !border-[#e8edf4] !bg-white !px-[22px] !py-[20px]"><div><p className="!m-0 !mb-[6px] text-[11px] !leading-[1.4] font-bold tracking-[.08em] text-[#0b51b7] uppercase">PLATFORM TENANT</p><h2 className="!m-0 !mb-[6px] !mt-[4px] text-[21px] font-normal tracking-[-.3px] text-[#303e67]">Create organization</h2><p className="!m-0 text-[11px] text-[#8391a5]">Set up a new organization on the FieldSight platform.</p></div><button className="cursor-pointer border-0 bg-transparent p-0 text-[#8290a2]" type="button" onClick={closeCreate} aria-label="Close form"><X size={19} /></button></header>
            <div className="flex flex-1 flex-col gap-[15px] overflow-auto px-[22px] py-[21px]">
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Organization name<input autoFocus className={`${adminInputClass} placeholder:text-[#a0acba]`} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Community Health Initiative" required /></label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Organization owner<input className={`${adminInputClass} placeholder:text-[#a0acba]`} value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="e.g. Amara Johnson" required /></label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Initial plan<select className={adminInputClass} value={plan} onChange={(event) => setPlan(event.target.value as Organization["plan"])}><option>Starter</option><option>Professional</option><option>Enterprise</option></select></label>
              <label className="flex flex-row items-start gap-[9px] rounded-[6px] border border-[#e2e9f0] bg-[#f9fbfd] p-[11px] text-[11px] font-bold text-[#526177]"><input className="!m-0 !mt-[1px] !h-[15px] !w-[15px] accent-[#0b51b7]" type="checkbox" defaultChecked /><span className="flex flex-col gap-[3px]"><strong className="text-[11px] text-[#48586e]">Send owner invitation</strong><small className="text-[10px] font-normal leading-[1.4] text-[#8997a9]">Invite the organization owner to set up their workspace access.</small></span></label>
              <p className="!m-0 text-[10px] leading-[1.5] text-[#8997a9]">The organization starts in trial status. Billing and platform policies can be configured after creation.</p>
            </div>
            <footer className="flex justify-end gap-[8px] border-t border-[#e8edf4] bg-white px-[22px] py-[14px]"><button className="cursor-pointer rounded-[5px] border border-[#dce5ef] bg-white px-[11px] py-[9px] font-sans text-[11px] font-semibold leading-normal text-[#5b6a7e]" type="button" onClick={closeCreate}>Cancel</button><button className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] py-[9px] font-sans text-[11px] font-semibold leading-normal text-white" type="submit"><Plus size={15} />Create organization</button></footer>
          </form>
        </div>
      )}
    </>
  );
}
