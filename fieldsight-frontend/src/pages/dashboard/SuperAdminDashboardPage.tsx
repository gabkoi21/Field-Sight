import { MonthlyOrganizationActivity } from "../../components/superadmin/MonthlyOrganizationActivity";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import { Button, LoadingSkeleton, LoadingState, MetricCard, PageHeader, Panel } from "../../components/ui";
import { apiClient } from "../../services/apiClient";

export function SuperAdminDashboardPage() {
  const organizationsQuery = useQuery({ queryKey: ["platform-organizations"], queryFn: apiClient.organizations });
  const usersQuery = useQuery({ queryKey: ["platform-users"], queryFn: apiClient.users });
  if (organizationsQuery.isLoading || usersQuery.isLoading)
    return <div className="space-y-6"><PageHeader eyebrow="Platform operations" title="Platform overview" description="Tenant access, account coverage, and service health." /><LoadingSkeleton layout="dashboard" metricCount={4} label="Loading platform operations…" /></div>;

  if ((organizationsQuery.error && !organizationsQuery.data) || (usersQuery.error && !usersQuery.data)) return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><h1 className="text-xl font-semibold">Unable to load platform overview</h1><p>Organization or account data could not be loaded.</p><Button variant="secondary" onClick={() => { void organizationsQuery.refetch(); void usersQuery.refetch(); }}>Retry platform overview</Button></section>;
  const organizations = organizationsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const activeOrganizations = organizations.filter((item) => item.is_active).length;
  const suspendedOrganizations = organizations.length - activeOrganizations;
  const organizationStatus = [
    { name: "Active", value: activeOrganizations, color: "#0b51b7" },
    { name: "Suspended", value: suspendedOrganizations, color: "#d85d67" },
  ];

  return (
    <div className="flex flex-col gap-5 text-[#24334a]">
      {(organizationsQuery.isFetching || usersQuery.isFetching) && <LoadingState variant="inline" label="Updating platform overview…" />}
      {(organizationsQuery.error || usersQuery.error) && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Unable to update platform data. Showing the last loaded values. <button className="min-h-11 px-3 font-semibold underline" onClick={() => { void organizationsQuery.refetch(); void usersQuery.refetch(); }}>Retry platform overview</button></div>}
      <PageHeader
        eyebrow="Platform operations"
        title="Platform overview"
        description="Tenant access, account coverage, and service health from live FieldSight records."
      />



      <section aria-busy={organizationsQuery.isFetching || usersQuery.isFetching} className="grid grid-cols-4 gap-3 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1">
        <MetricCard
          label="Total Organizations"
          value={organizations.length}
          context="Total registered organizations"
          icon={Building2}
        />
        <MetricCard label="Total Platform Users" value={users.length} context="All registered users across the platform" icon={Users} />
        <MetricCard
          label="Active Organizations"
          value={activeOrganizations}
          context="Organizations currently active"
          icon={UserCheck}
        />
        <MetricCard label="Suspended Organizations" value={suspendedOrganizations} context="Tenant access paused" icon={Activity} />
      </section>


      <section className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-4 max-[1000px]:grid-cols-1">
        <MonthlyOrganizationActivity />
        <Panel className="h-full" title="Organization availability" subtitle="Tenant access currently available on the platform">
          <div className="flex flex-col items-center gap-6 py-5">
            <div className="relative h-[260px] w-full max-w-[300px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={organizationStatus}
                    dataKey="value"
                    cx="50%" cy="50%"
                    innerRadius={88}
                    outerRadius={116}
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
                <strong className="text-4xl font-semibold tabular-nums">
                  {organizations.length ? Math.round((activeOrganizations / organizations.length) * 100) : 0}%
                </strong>
                <small className="mt-2 text-sm text-[var(--fs-muted)]">available</small>
              </div>
            </div>
            <div className="w-full space-y-4 px-2 pb-2">
              {organizationStatus.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <i className="size-2 rounded-full" style={{ background: item.color }} />
                    {item.name}
                  </span>
                  <strong className="min-w-10 rounded-lg bg-[var(--fs-canvas)] px-3 py-2 text-center tabular-nums">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>


    </div>
  );
}
