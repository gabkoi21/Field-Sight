import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  MoreVertical,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { Button, LoadingSkeleton, LoadingState, PageHeader, Ring } from "../../components/ui";
import {
  AdminMetric,
  AdminPanel,
  AdminStatus,
  AdminTableFooter,
} from "../../components/superadmin/AdminUi";
import {
  apiClient,
  ApiError,
  type ApiUserDirectoryItem,
} from "../../services/apiClient";

type DisplayRole = "Super Admin" | "Organization Admin" | "Enumerator";
type RoleFilter = "All" | DisplayRole;

const roleLabels: Record<string, DisplayRole> = {
  super_admin: "Super Admin",
  organization_admin: "Organization Admin",
  enumerator: "Enumerator",
};

function userRoles(user: ApiUserDirectoryItem): DisplayRole[] {
  if (user.platform_role === "super_admin") return ["Super Admin"];
  return [
    ...new Set(
      user.memberships
        .filter((membership) => membership.is_active)
        .map((membership) => roleLabels[membership.role]),
    ),
  ];
}

function displayName(user: ApiUserDirectoryItem) {
  return user.username?.trim() || user.email.split("@")[0];
}

function initials(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function UsersPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("All");
  const usersQuery = useQuery({
    queryKey: ["platform-users"],
    queryFn: apiClient.users,
  });
  const users = (usersQuery.data ?? []).filter(
    (user) => user.platform_role !== "super_admin",
  );
  const rows = useMemo(
    () =>
      users.map((user) => {
        const roles = userRoles(user);
        const organizations = user.memberships
          .filter((membership) => membership.is_active)
          .map((membership) => membership.organization_name);
        const name = displayName(user);
        return {
          ...user,
          name,
          initials: initials(name),
          roles,
          roleText: roles.join(", ") || "No active role",
          organizationText:
            organizations.join(", ") ||
            (user.platform_role === "super_admin"
              ? "FieldSight platform"
              : "—"),
          status: user.is_active ? "Active" : "Suspended",
          created: new Date(user.created_at).toLocaleDateString(),
        };
      }),
    [users],
  );
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter(
      (user) =>
        (role === "All" || user.roles.includes(role)) &&
        (!normalizedQuery ||
          `${user.name} ${user.email} ${user.organizationText} ${user.roleText}`
            .toLowerCase()
            .includes(normalizedQuery)),
    );
  }, [query, role, rows]);
  const activeUsers = users.filter((user) => user.is_active).length;
  const organizationAdmins = users.filter((user) =>
    user.memberships.some(
      (membership) =>
        membership.is_active && membership.role === "organization_admin",
    ),
  ).length;
  const enumerators = users.filter((user) =>
    user.memberships.some(
      (membership) => membership.is_active && membership.role === "enumerator",
    ),
  ).length;
  const loadError =
    usersQuery.error instanceof ApiError
      ? usersQuery.error.message
      : usersQuery.error
        ? "Unable to load users from the API."
        : "";



  if (usersQuery.isLoading) return <div className="space-y-6"><PageHeader eyebrow="Platform administration" title="Users & roles" description="Loading users from FieldSight…" /><LoadingSkeleton layout="table-page" metricCount={4} label="Loading users…" /></div>;
  if (usersQuery.error && !(usersQuery.data !== undefined)) return <div className="space-y-6"><PageHeader eyebrow="Platform administration" title="Users & roles" description="Manage platform users." /><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">Unable to load users. <Button variant="secondary" onClick={() => void usersQuery.refetch()}>Retry users</Button></div></div>;
  return (
    <>
      <PageHeader
        eyebrow="Platform access"
        title="Users & roles"
        description="View platform accounts, organization membership, and assigned roles."
      />
      {usersQuery.isFetching && <LoadingState variant="inline" label="Updating users…" />}
      {loadError && (
        <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
          {loadError} <button className="min-h-11 px-3 font-semibold underline" onClick={() => void usersQuery.refetch()}>Retry users</button>
        </p>
      )}

      <section className="mb-[18px] grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
        <AdminMetric
          label="All users"
          value={String(users.length)}
          detail="Registered platform accounts"
          icon={Users}
        />
        <AdminMetric
          label="Active accounts"
          value={String(activeUsers)}
          detail={`${users.length ? Math.round((activeUsers / users.length) * 100) : 0}% of all users`}
          icon={UserCheck}
          tone="green"
        />
        <AdminMetric
          label="Organization admins"
          value={String(organizationAdmins)}
          detail="Active organization memberships"
          icon={ShieldCheck}
          tone="violet"
        />
        <AdminMetric
          label="Enumerators"
          value={String(enumerators)}
          detail="Active field accounts"
          icon={UserX}
          tone="orange"
        />
      </section>

      <AdminPanel
        title="Platform directory"
        description="Users, organization membership, and assigned roles"
      >
        <div className="flex gap-2 border-b border-[#e9eef4] p-[14px] max-[680px]:flex-col">
          <label className="flex min-h-[38px] flex-1 items-center gap-2 rounded-[5px] border border-[#dce5ef] bg-white px-[9px] text-[#8492a4]">
            <Search size={15} />
            <input
              className="w-full border-0 bg-transparent py-[8px] font-sans text-[14px] text-[#4e5e74] outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users, email, organization, or role…"
            />
          </label>
          <label className="relative flex min-h-[38px] min-w-[185px] items-center rounded-[5px] border border-[#dce5ef] bg-white px-[9px]">
            <select
              className="w-full appearance-none border-0 bg-transparent py-[8px] pr-5 font-sans text-[12px] text-[#69798e] outline-none"
              value={role}
              onChange={(event) => setRole(event.target.value as RoleFilter)}
            >
              <option value="All">All roles</option>
              <option>Organization Admin</option>
              <option>Enumerator</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 text-[#8793a2]"
              size={14}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table aria-busy={usersQuery.isFetching} className="min-w-[960px] [&_th]:!px-[13px] [&_th]:!py-[10px] [&_td]:!px-[13px] [&_td]:!py-[11px]">
            <thead>
              <tr>
                <th>User</th>
                <th>Organization</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <span className="inline-flex items-center gap-2 text-xs text-[#758092]">
                      <Ring className="size-4 text-brand" aria-hidden="true" />
                      Loading users…
                    </span>
                  </td>
                </tr>
              )}
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#fbfcfe]">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 place-items-center rounded-[7px] bg-[#f0edff] text-[12px] font-bold text-[#6d5bd0]">
                        {user.initials}
                      </span>
                      <div>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{user.organizationText}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="text-[#8793a2]" size={13} />
                      {user.roleText}
                    </span>
                  </td>
                  <td>
                    <AdminStatus value={user.status} />
                  </td>
                  <td>{user.created}</td>
                  <td>
                    <button
                      type="button"
                      title="User actions"
                      aria-label={`Actions for ${user.name}`}
                      className="grid size-7 place-items-center rounded-[6px] border-0 bg-[#f7f9fc] text-[#8190a4] hover:bg-[#eef3fa] hover:text-[#43546b]"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!usersQuery.isLoading && filteredUsers.length === 0 && (
            <p className="m-0 p-10 text-center text-xs text-[#8793a2]">
              No users match your filters.
            </p>
          )}
        </div>
        <AdminTableFooter shown={filteredUsers.length} total={users.length} />
      </AdminPanel>
    </>
  );
}
