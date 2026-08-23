import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, MoreHorizontal, Plus, Search, ShieldCheck, UserCheck, Users, UserX, X } from "lucide-react";
import { Button, PageHeader } from "../../components/ui";
import {
  AdminMetric,
  AdminPanel,
  AdminStatus,
  AdminTableFooter,
  adminInputClass,
} from "../../components/superadmin/AdminUi";
import { platformUsers as seedUsers, organizations, type PlatformUser } from "./data";

type RoleFilter = "All" | PlatformUser["role"];

export function UsersPage() {
  const [users, setUsers] = useState(seedUsers);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("All");
  const [showInvite, setShowInvite] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState(organizations[0].name);
  const [inviteRole, setInviteRole] = useState<PlatformUser["role"]>("Organization Admin");

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter(
      (user) =>
        (role === "All" || user.role === role) &&
        (!normalizedQuery || `${user.name} ${user.email} ${user.organization}`.toLowerCase().includes(normalizedQuery)),
    );
  }, [query, role, users]);

  function openInvite() {
    setDrawerClosing(false);
    setDrawerVisible(false);
    setShowInvite(true);
    window.requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeInvite() {
    setDrawerClosing(true);
    setDrawerVisible(false);
    window.setTimeout(() => setShowInvite(false), 220);
  }
  function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invitedEmail = email.trim();
    if (!invitedEmail) return;
    const username = invitedEmail.split("@")[0].replace(/[._-]/g, " ");
    const name = username.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
    setUsers((current) => [
      {
        id: Date.now(),
        name,
        initials,
        email: invitedEmail,
        organization,
        role: inviteRole,
        status: "Invited",
        lastActive: "Never",
      },
      ...current,
    ]);
    setEmail("");
    closeInvite();
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform access"
        title="Users & roles"
        description="Manage platform administrators and organization-level account access."
      >
        <Button onClick={openInvite}>
          <Plus size={15} /> Invite user
        </Button>
      </PageHeader>

      <section className="mb-[18px] grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
        <AdminMetric label="All users" value="1,286" detail="Across 24 organizations" icon={Users} />
        <AdminMetric label="Active this month" value="1,104" detail="85.8% engagement" icon={UserCheck} tone="green" />
        <AdminMetric label="Pending invites" value="18" detail="6 expire this week" icon={UserX} tone="orange" />
        <AdminMetric
          label="Privileged roles"
          value="31"
          detail="2 platform super admins"
          icon={ShieldCheck}
          tone="violet"
        />
      </section>

      <AdminPanel title="Platform directory" description="Users, organization membership, and assigned roles">
        <div className="flex gap-2 border-b border-[#e9eef4] p-[14px] max-[680px]:flex-col">
          <label className="flex min-h-[38px] flex-1 items-center gap-2 rounded-[5px] border border-[#dce5ef] bg-white px-[9px] text-[#8492a4]">
            <Search size={15} />
            <input
              className="w-full border-0 bg-transparent py-[8px] font-sans text-[12px] text-[#4e5e74] outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users, email, or organization..."
            />
          </label>
          <label className="relative flex min-h-[38px] min-w-[185px] items-center rounded-[5px] border border-[#dce5ef] bg-white px-[9px]">
            <select
              className="w-full appearance-none border-0 bg-transparent py-[8px] pr-5 font-sans text-[11px] text-[#69798e] outline-none"
              value={role}
              onChange={(event) => setRole(event.target.value as RoleFilter)}
            >
              <option value="All">All roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Organization Admin">Organization Admin</option>
              <option value="Data Manager">Data Manager</option>
              <option value="Analyst">Analyst</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 text-[#8793a2]" size={14} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] [&_th]:!px-[13px] [&_th]:!py-[10px] [&_td]:!px-[13px] [&_td]:!py-[11px]">
            <thead>
              <tr>
                <th>User</th>
                <th>Organization</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#fbfcfe]">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 place-items-center rounded-[7px] bg-[#f0edff] text-[10px] font-bold text-[#6d5bd0]">
                        {user.initials}
                      </span>
                      <div>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{user.organization}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="text-[#8793a2]" size={13} />
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <AdminStatus value={user.status} />
                  </td>
                  <td>{user.lastActive}</td>
                  <td>
                    <button aria-label={`Actions for ${user.name}`} className="border-0 bg-transparent text-[#8793a2]">
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <p className="m-0 p-10 text-center text-xs text-[#8793a2]">No users match your filters.</p>
          )}
        </div>
        <AdminTableFooter shown={filteredUsers.length} total={users.length} />
      </AdminPanel>

      <section className="mt-[18px] grid grid-cols-4 gap-[14px] max-[1000px]:grid-cols-2 max-[620px]:grid-cols-1">
        {[
          ["Super Admin", "Full platform control across every tenant."],
          ["Organization Admin", "Manages one tenant, its members, and settings."],
          ["Data Manager", "Controls projects, forms, quality, and exports."],
          ["Analyst", "Views trusted data, analytics, and reports."],
        ].map(([name, detail]) => (
          <article className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]" key={name}>
            <ShieldCheck className="text-[#4d7fc6]" size={18} />
            <strong className="mt-[13px] block text-[13px] text-[#253342]">{name}</strong>
            <p className="mb-0 mt-1 text-[11px] leading-5 text-[#84909b]">{detail}</p>
          </article>
        ))}
      </section>

      {showInvite && (
        <div
          className={`fixed inset-0 z-50 bg-[rgba(16,42,67,.23)] transition-opacity ${drawerClosing ? "duration-[220ms] ease-in" : "duration-[220ms] ease-out"} ${drawerVisible ? "opacity-100" : "opacity-0"}`}
          onClick={closeInvite}
        >
          <form
            className={`absolute bottom-0 right-0 top-0 flex w-[min(470px,100%)] flex-col bg-white shadow-[-16px_0_35px_rgba(16,42,67,.18)] transition-[opacity,transform] max-[460px]:w-full ${drawerClosing ? "translate-x-[36px] opacity-0 duration-[220ms] ease-[cubic-bezier(.4,0,1,1)]" : `${drawerVisible ? "translate-x-0 opacity-100" : "translate-x-[36px] opacity-0"} duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)]`}`}
            onClick={(event) => event.stopPropagation()}
            onSubmit={inviteUser}
          >
            <header className="!flex !items-start !justify-between !border-b !border-[#e8edf4] !bg-white !px-[22px] !py-[20px]">
              <div>
                <p className="!m-0 !mb-[6px] text-[11px] !leading-[1.4] font-bold tracking-[.08em] text-[#0b51b7] uppercase">
                  PLATFORM ACCESS
                </p>
                <h2 className="!m-0 !mb-[6px] !mt-[4px] text-[21px] font-normal tracking-[-.3px] text-[#303e67]">
                  Invite user
                </h2>
                <p className="!m-0 text-[11px] text-[#8391a5]">Give a user access to an organization workspace.</p>
              </div>
              <button
                className="cursor-pointer border-0 bg-transparent p-0 text-[#8290a2]"
                type="button"
                onClick={closeInvite}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </header>
            <div className="flex flex-1 flex-col gap-[15px] overflow-auto px-[22px] py-[21px]">
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Email address
                <input
                  autoFocus
                  type="email"
                  className={`${adminInputClass} placeholder:text-[#a0acba]`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@organization.org"
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Organization
                <select
                  className={adminInputClass}
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                >
                  {organizations.map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Role
                <select
                  className={adminInputClass}
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as PlatformUser["role"])}
                >
                  <option>Organization Admin</option>
                  <option>Data Manager</option>
                  <option>Analyst</option>
                </select>
              </label>
              <label className="flex flex-row items-start gap-[9px] rounded-[6px] border border-[#e2e9f0] bg-[#f9fbfd] p-[11px] text-[11px] font-bold text-[#526177]">
                <input className="!m-0 !mt-[1px] !h-[15px] !w-[15px] accent-[#0b51b7]" type="checkbox" defaultChecked />
                <span className="flex flex-col gap-[3px]">
                  <strong className="text-[11px] text-[#48586e]">Send invitation email</strong>
                  <small className="text-[10px] font-normal leading-[1.4] text-[#8997a9]">
                    The invitation grants access only to the selected organization and role.
                  </small>
                </span>
              </label>
            </div>
            <footer className="flex justify-end gap-[8px] border-t border-[#e8edf4] bg-white px-[22px] py-[14px]">
              <button
                className="cursor-pointer rounded-[5px] border border-[#dce5ef] bg-white px-[11px] py-[9px] font-sans text-[11px] font-semibold text-[#5b6a7e]"
                type="button"
                onClick={closeInvite}
              >
                Cancel
              </button>
              <button
                className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] py-[9px] font-sans text-[11px] font-semibold text-white"
                type="submit"
              >
                <Plus size={15} />
                Send invitation
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
