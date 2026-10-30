import { MonthlyOrganizationActivity } from "../../components/superadmin/MonthlyOrganizationActivity";
import { useQuery } from "@tanstack/react-query";
import {
  FolderKanban,
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
  const overviewQuery = useQuery({ queryKey: ["platform-overview"], queryFn: apiClient.platformOverview });
  if (overviewQuery.isLoading)
    return <div className="space-y-6"><PageHeader eyebrow="Platform operations" title="Platform overview" /><LoadingSkeleton layout="dashboard" metricCount={4} label="Loading platform operations..." /></div>;
  if (!overviewQuery.data) return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><h1 className="text-xl font-semibold">Unable to load platform overview</h1><p>Platform totals could not be loaded.</p><Button variant="secondary" onClick={() => void overviewQuery.refetch()}>Retry platform overview</Button></section>;
  const totals = overviewQuery.data;
  const activeOrganizations = totals.active_organizations;
  const suspendedOrganizations = totals.total_organizations - activeOrganizations;
  const organizationStatus = [
    { name: "Active", value: activeOrganizations, color: "var(--fs-primary)" },
    { name: "Suspended", value: suspendedOrganizations, color: "var(--fs-danger)" },
  ];

  return (
    <div className="flex flex-col gap-5 text-[var(--fs-text)]">
      {(overviewQuery.isFetching) && <LoadingState variant="inline" label="Updating platform overview…" />}
      {(overviewQuery.error) && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Unable to update platform data. Showing the last loaded values. <button className="min-h-11 px-3 font-semibold underline" onClick={() => { void overviewQuery.refetch(); }}>Retry platform overview</button></div>}
      <PageHeader
        eyebrow="Platform operations"
        title="Platform overview"
      />




      <section aria-busy={overviewQuery.isFetching} className="grid grid-cols-4 gap-3 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1">
        <MetricCard
          label="Total Organizations"
          value={totals.total_organizations}
          context="Total registered organizations"
          icon={Building2}
        />
        <MetricCard label="Total Platform Users" value={totals.total_platform_users} context="Every stored account counted once, including Super Admin, inactive, and unassigned accounts" icon={Users} />
        <MetricCard
          label="Active Organizations"
          value={activeOrganizations}
          context="Organizations currently active"
          icon={UserCheck}
        />
        <MetricCard label="Total Projects" value={totals.total_projects} context="All stored projects across all organizations, statuses, and privacy levels" icon={FolderKanban} />
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
                  {totals.total_organizations ? Math.round((activeOrganizations / totals.total_organizations) * 100) : 0}%
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
                  <strong className="text-center tabular-nums">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>


    </div>
  );
}
