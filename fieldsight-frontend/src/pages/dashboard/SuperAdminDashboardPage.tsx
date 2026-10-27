import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Plus,
  Server,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminStatus } from "../../components/superadmin/AdminUi";
import { Button, EmptyState, LoadingSkeleton, LoadingState, MetricCard, PageHeader, Panel } from "../../components/ui";
import { apiClient } from "../../services/apiClient";

const palette = ["#0b51b7", "#6d81f5", "#a7b4c8"];

export function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const organizationsQuery = useQuery({ queryKey: ["platform-organizations"], queryFn: apiClient.organizations });
  const usersQuery = useQuery({ queryKey: ["platform-users"], queryFn: apiClient.users });
  const statusQuery = useQuery({ queryKey: ["health", "status"], queryFn: apiClient.status, meta: { backgroundRefresh: true }, refetchInterval: 30_000 });
  if (organizationsQuery.isLoading || usersQuery.isLoading)
    return <div className="space-y-6"><PageHeader eyebrow="Platform operations" title="Platform overview" description="Tenant access, account coverage, and service health." /><LoadingSkeleton layout="dashboard" metricCount={4} label="Loading platform operations…" /></div>;

  if ((organizationsQuery.error && !organizationsQuery.data) || (usersQuery.error && !usersQuery.data)) return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><h1 className="text-xl font-semibold">Unable to load platform overview</h1><p>Organization or account data could not be loaded.</p><Button variant="secondary" onClick={() => { void organizationsQuery.refetch(); void usersQuery.refetch(); }}>Retry platform overview</Button></section>;
  const organizations = organizationsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const tenantUsers = users.filter((user) => user.platform_role !== "super_admin");
  const activeOrganizations = organizations.filter((item) => item.is_active).length;
  const suspendedOrganizations = organizations.length - activeOrganizations;
  const activeUsers = tenantUsers.filter((item) => item.is_active).length;
  const inactiveUsers = tenantUsers.length - activeUsers;
  const organizationAdmins = tenantUsers.filter((item) =>
    item.memberships.some((membership) => membership.role === "organization_admin"),
  ).length;
  const enumerators = tenantUsers.filter((item) =>
    item.memberships.some((membership) => membership.role === "enumerator"),
  ).length;
  const organizationStatus = [
    { name: "Active", value: activeOrganizations, color: "#0b51b7" },
    { name: "Suspended", value: suspendedOrganizations, color: "#d85d67" },
  ];
  const accountRoles = [
    { name: "Organization admins", value: organizationAdmins },
    { name: "Enumerators", value: enumerators },
    { name: "Unassigned", value: Math.max(0, tenantUsers.length - organizationAdmins - enumerators) },
  ];
  const platformHealthy = statusQuery.data?.status === "ok";
  const attentionItems = [
    ...(suspendedOrganizations
      ? [
          {
            title: `${suspendedOrganizations} organization${suspendedOrganizations === 1 ? "" : "s"} suspended`,
            detail: "Review tenant status and restore access when appropriate.",
            path: "/superadmin/organizations",
          },
        ]
      : []),
    ...(inactiveUsers
      ? [
          {
            title: `${inactiveUsers} inactive user account${inactiveUsers === 1 ? "" : "s"}`,
            detail: "Confirm whether these accounts should remain disabled.",
            path: "/superadmin/users",
          },
        ]
      : []),
    ...(!platformHealthy
      ? [
          {
            title: "Platform health requires attention",
            detail: "The status API is not reporting a healthy service.",
            path: "/superadmin/system",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5 text-[#24334a]">
      {(organizationsQuery.isFetching || usersQuery.isFetching || statusQuery.isFetching) && <LoadingState variant="inline" label="Updating platform overview…" />}
      {(organizationsQuery.error || usersQuery.error) && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Unable to update platform data. Showing the last loaded values. <button className="min-h-11 px-3 font-semibold underline" onClick={() => { void organizationsQuery.refetch(); void usersQuery.refetch(); }}>Retry platform overview</button></div>}
      <header className="flex items-end justify-between gap-4 max-[700px]:flex-col max-[700px]:items-start">
        <div>
          <p className="mb-1 mt-0 text-[12px] font-bold uppercase tracking-[.12em] text-brand">Platform operations</p>
          <h1 className="m-0 text-[2rem] font-bold tracking-[-.05em]">Platform overview</h1>
          <p className="mb-0 mt-1.5 text-[0.875rem] text-[#718096]">
            Tenant access, account coverage, and service health from live FieldSight records.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
          onClick={() => navigate("/superadmin/organizations?create=1")}
        >
          <Plus size={15} /> Create organization
        </button>
      </header>

      <section
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${platformHealthy ? "border-[#cfe0f6] bg-[#f5f9ff]" : "border-[#f0c9ce] bg-[#fff6f7]"}`}
      >
        <span
          className={`grid size-9 place-items-center rounded-lg ${platformHealthy ? "bg-[#e4efff] text-brand" : "bg-[#ffe9ec] text-[#c94f5d]"}`}
        >
          {platformHealthy ? <ShieldCheck size={18} /> : <CircleAlert size={18} />}
        </span>
        <div className="flex-1">
          <strong className="block text-xs">
            {platformHealthy ? "All monitored services are operational" : "Service status is unavailable"}
          </strong>
          <p className="mb-0 mt-1 text-[12px] text-[#718096]">
            {statusQuery.data
              ? `${statusQuery.data.service} ${statusQuery.data.api_version} · ${statusQuery.data.environment}`
              : "Waiting for the platform status endpoint."}
          </p>
        </div>
        <button
          className="border-0 bg-transparent text-xs font-semibold text-brand"
          onClick={() => navigate("/superadmin/system")}
        >
          System health <ArrowRight className="inline" size={13} />
        </button>
      </section>

      <section aria-busy={organizationsQuery.isFetching || usersQuery.isFetching} className="grid grid-cols-4 gap-3 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1">
        <MetricCard
          label="Organizations"
          value={organizations.length}
          context={`${activeOrganizations} active`}
          icon={Building2}
        />
        <MetricCard label="Tenant accounts" value={tenantUsers.length} context={`${activeUsers} active`} icon={Users} />
        <MetricCard
          label="Organization admins"
          value={organizationAdmins}
          context="Administrative accounts"
          icon={UserCheck}
        />
        <MetricCard label="Enumerators" value={enumerators} context="Field collection accounts" icon={Activity} />
      </section>

      <section className="grid grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] gap-4 max-[1000px]:grid-cols-1">
        <Panel title="Account structure" subtitle="How tenant access is distributed across platform roles">
          <div className="h-[260px] pt-4">
            <ResponsiveContainer>
              <BarChart data={accountRoles} layout="vertical" margin={{ left: 30, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="#edf1f5" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0b51b7" radius={[0, 5, 5, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Organization availability" subtitle="Tenant access currently available on the platform">
          <div className="grid grid-cols-[160px_1fr] items-center py-3 max-[500px]:grid-cols-1">
            <div className="relative h-[160px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={organizationStatus}
                    dataKey="value"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {organizationStatus.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <strong className="text-2xl">
                  {organizations.length ? Math.round((activeOrganizations / organizations.length) * 100) : 0}%
                </strong>
                <small className="text-[#7b899c]">available</small>
              </div>
            </div>
            <div className="space-y-3">
              {organizationStatus.map((item) => (
                <div key={item.name} className="flex justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <i className="size-2 rounded-full" style={{ background: item.color }} />
                    {item.name}
                  </span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-[minmax(0,1.35fr)_minmax(310px,.65fr)] gap-4 max-[1000px]:grid-cols-1">
        <Panel
          title="Organizations"
          subtitle="Recently created tenants and their current availability"
          action={
            <button className="text-xs font-semibold text-brand" onClick={() => navigate("/superadmin/organizations")}>
              View all <ArrowRight className="inline" size={13} />
            </button>
          }
        >
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[650px]">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Owner</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {organizations.slice(0, 6).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.slug}</small>
                    </td>
                    <td>{item.owner_email ?? "Not provided"}</td>
                    <td>{item.country ?? "Not set"}</td>
                    <td>
                      <AdminStatus value={item.is_active ? "Active" : "Suspended"} />
                    </td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!organizations.length && <EmptyState>No organizations have been created.</EmptyState>}
          </div>
        </Panel>
        <Panel title="Needs attention" subtitle="Operational exceptions based on current platform data">
          <div className="mt-3 space-y-2">
            {attentionItems.map((item) => (
              <button
                key={item.title}
                onClick={() => navigate(item.path)}
                className="flex w-full items-start gap-3 rounded-lg border border-[#e5eaf1] bg-white p-3 text-left hover:border-[#b9cdea]"
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#fff1e8] text-[#ca712e]">
                  <CircleAlert size={14} />
                </span>
                <span className="flex-1">
                  <strong className="block text-xs">{item.title}</strong>
                  <small className="mt-1 block text-[12px] leading-4 text-[#7b899c]">{item.detail}</small>
                </span>
                <ArrowRight className="mt-1 text-[#9aa7b8]" size={14} />
              </button>
            ))}
            {!attentionItems.length && (
              <div className="rounded-lg bg-[#f4f8fd] p-4 text-center">
                <CheckCircle2 className="mx-auto text-brand" size={20} />
                <strong className="mt-2 block text-xs">No platform exceptions</strong>
                <p className="mb-0 mt-1 text-[12px] text-[#7b899c]">
                  Organizations, users, and monitored services are available.
                </p>
              </div>
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
