
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Cloud,
  Database,
  RefreshCw,
  Server,
  TriangleAlert,
  Wifi,
} from "lucide-react";
import { Button, LoadingSkeleton, PageHeader } from "../../components/ui";
import {
  AdminMetric,
  AdminPanel,
  AdminStatus,
} from "../../components/superadmin/AdminUi";
import { apiClient, ApiError } from "../../services/apiClient";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "The service could not be reached.";
}

export function SystemHealthPage() {

  const liveQuery = useQuery({
    queryKey: ["health", "live"],
    queryFn: apiClient.live,
    meta: { backgroundRefresh: true }, refetchInterval: 30_000,
    retry: false,
  });
  const readyQuery = useQuery({
    queryKey: ["health", "ready"],
    queryFn: apiClient.ready,
    meta: { backgroundRefresh: true }, refetchInterval: 30_000,
    retry: false,
  });
  const statusQuery = useQuery({
    queryKey: ["health", "status"],
    queryFn: apiClient.status,
    meta: { backgroundRefresh: true }, refetchInterval: 30_000,
    retry: false,
  });
  const refreshing =
    liveQuery.isFetching || readyQuery.isFetching || statusQuery.isFetching;
  const lastChecked = Math.max(liveQuery.dataUpdatedAt, readyQuery.dataUpdatedAt, statusQuery.dataUpdatedAt) ? new Date(Math.max(liveQuery.dataUpdatedAt, readyQuery.dataUpdatedAt, statusQuery.dataUpdatedAt)).toLocaleString() : "No successful checks";
  const apiHealthy = !liveQuery.error && liveQuery.data?.status === "ok";
  const databaseReady = !readyQuery.error && readyQuery.data?.database === "ready";
  const platformOperational =
    apiHealthy && databaseReady && !statusQuery.error && statusQuery.data?.status === "ok";

  const platformState = liveQuery.isPending || readyQuery.isPending || statusQuery.isPending ? "Unknown" : liveQuery.error && readyQuery.error ? "Unavailable" : platformOperational ? "Healthy" : "Degraded";

  async function refreshHealth() {
    await Promise.all([liveQuery.refetch(), readyQuery.refetch(), statusQuery.refetch()]);
  }

  const services = [
    {
      name: "FieldSight API",
      description: statusQuery.data
        ? `${statusQuery.data.service} · ${statusQuery.data.api_version}`
        : "Application API",
      detail: statusQuery.data?.environment ?? "Unavailable",
      status: liveQuery.isPending ? "Unknown" : liveQuery.error ? "Unavailable" : apiHealthy ? "Healthy" : "Degraded",
    },
    {
      name: "Primary database",
      description: "Persistence and tenant data",
      detail: readyQuery.data?.database ?? "Unavailable",
      status: readyQuery.isPending ? "Unknown" : readyQuery.error ? "Unavailable" : databaseReady ? "Healthy" : "Degraded",
    },
  ];
  const firstError = liveQuery.error ?? readyQuery.error ?? statusQuery.error;

  if (liveQuery.isLoading || readyQuery.isLoading || statusQuery.isLoading) return <div className="space-y-6"><PageHeader eyebrow="Platform operations" title="System health" /><LoadingSkeleton layout="table-page" metricCount={4} label="Checking system health..." /></div>;
  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="System health"
        description="Live availability checks reported by the FieldSight backend."
      >
        <Button
          variant="secondary"
          onClick={refreshHealth}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} size={15} />{" "}
          {refreshing ? "Checking…" : "Refresh status"}
        </Button>
      </PageHeader>

      {firstError && (
        <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
          {errorMessage(firstError)}
        </p>
      )}

      <section className="grid grid-cols-4 gap-[18px] max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
        <AdminMetric
          label="Platform status"
          value={platformState}
          detail={`Checked ${lastChecked}`}
          icon={Activity}
          tone={platformOperational ? "green" : "orange"}
        />
        <AdminMetric
          label="API service"
          value={liveQuery.isPending ? "Unknown" : apiHealthy ? "Online" : "Unavailable"}
          detail={statusQuery.data?.service ?? "No response"}
          icon={Wifi}
          tone={apiHealthy ? "green" : "orange"}
        />
        <AdminMetric
          label="Database"
          value={readyQuery.isPending ? "Unknown" : databaseReady ? "Ready" : "Unavailable"}
          detail="Readiness query"
          icon={Database}
          tone={databaseReady ? "green" : "orange"}
        />
        <AdminMetric
          label="API version"
          value={statusQuery.data?.api_version ?? "—"}
          detail={statusQuery.data?.environment ?? "Unknown environment"}
          icon={Server}
        />
      </section>

      <AdminPanel
        title="Backend services"
        description={`Live checks · updated ${lastChecked}`}
        className="mt-[18px]"
        action={
          <AdminStatus
            value={platformState}
          />
        }
      >
        <div className="divide-y divide-line">
          {services.map((service) => (
            <div
              className="grid grid-cols-[minmax(220px,1fr)_180px_110px] items-center gap-4 px-5 py-4 max-[760px]:grid-cols-[1fr_auto]"
              key={service.name}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-9 place-items-center rounded-[8px] ${service.status === "Healthy" ? "bg-[#e6f7f2] text-[#158e7d]" : "bg-[#fff1e4] text-[#d8792a]"}`}
                >
                  {service.status === "Healthy" ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <TriangleAlert size={17} />
                  )}
                </span>
                <div>
                  <strong className="block text-[14px] text-[#324158]">
                    {service.name}
                  </strong>
                  <small className="mt-0.5 block text-[12px] text-[#8793a2]">
                    {service.description}
                  </small>
                </div>
              </div>
              <div className="max-[760px]:hidden">
                <small className="block text-[11px] uppercase tracking-[.06em] text-[#8793a2]">
                  Current
                </small>
                <strong className="text-[12px] capitalize text-[#455467]">
                  {service.detail}
                </strong>
              </div>
              <AdminStatus value={service.status} />
            </div>
          ))}
        </div>
      </AdminPanel>

      <p className="mt-5 text-sm text-[var(--fs-muted)]">Worker heartbeats and synchronization jobs exist, but platform-wide monitoring is not connected here. Queue, scheduler and worker status: Unknown.</p>
      <AdminPanel
        title="Environment"
        description="Metadata reported by the API"
        className="mt-[18px]"
      >
        <div className="grid grid-cols-3 gap-5 p-5 max-[760px]:grid-cols-1">
          {[
            [
              Cloud,
              "Environment",
              statusQuery.data?.environment ?? "Unavailable",
            ],
            [Server, "Service", statusQuery.data?.service ?? "Unavailable"],
            [
              Database,
              "Database readiness",
              readyQuery.data?.database ?? "Unavailable",
            ],
          ].map(([Icon, label, value]) => {
            const RowIcon = Icon as typeof Cloud;
            return (
              <div className="flex items-center gap-3" key={label as string}>
                <span className="grid size-8 place-items-center rounded-[7px] bg-[#f5f8fc] text-[#657182]">
                  <RowIcon size={15} />
                </span>
                <div>
                  <small className="block text-[11px] uppercase tracking-[.05em] text-[#8793a2]">
                    {label as string}
                  </small>
                  <strong className="text-[12px] capitalize text-[#324158]">
                    {value as string}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </AdminPanel>
    </>
  );
}
