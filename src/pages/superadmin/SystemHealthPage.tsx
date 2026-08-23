import { useState } from "react";
import { Activity, CheckCircle2, Cloud, Database, RefreshCw, Server, TriangleAlert, Wifi } from "lucide-react";
import { Button, PageHeader } from "../../components/ui";
import { AdminMetric, AdminPanel, AdminStatus } from "../../components/superadmin/AdminUi";
import { systemServices } from "./data";

export function SystemHealthPage() {
  const [lastChecked, setLastChecked] = useState("Just now");

  function refreshHealth() {
    setLastChecked("Checking...");
    window.setTimeout(() => setLastChecked("Just now"), 600);
  }

  return (
    <>
      <PageHeader eyebrow="Platform operations" title="System health" description="Observe production services, workload, storage, and recent platform incidents.">
        <Button variant="secondary" onClick={refreshHealth}><RefreshCw size={15} /> Refresh status</Button>
      </PageHeader>

      <section className="grid grid-cols-4 gap-[18px] max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
        <AdminMetric label="Platform uptime" value="99.98%" detail="Last 30 days" icon={Activity} tone="green" />
        <AdminMetric label="API response" value="184 ms" detail="P95 production latency" icon={Wifi} />
        <AdminMetric label="Queued jobs" value="48" detail="12 currently processing" icon={Server} tone="violet" />
        <AdminMetric label="Storage used" value="34%" detail="2.8 TB of 8.2 TB" icon={Database} tone="orange" />
      </section>

      <AdminPanel title="Production services" description={`Live checks · updated ${lastChecked}`} className="mt-[18px]" action={<AdminStatus value="Operational" />}>
        <div className="divide-y divide-line">
          {systemServices.map((service, index) => (
            <div className="grid grid-cols-[minmax(220px,1fr)_130px_130px_110px] items-center gap-4 px-5 py-4 max-[760px]:grid-cols-[1fr_auto]" key={service.name}>
              <div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-[8px] ${service.status === "Healthy" ? "bg-[#e6f7f2] text-[#158e7d]" : "bg-[#fff1e4] text-[#d8792a]"}`}>{service.status === "Healthy" ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}</span><div><strong className="block text-[12px] text-[#324158]">{service.name}</strong><small className="mt-0.5 block text-[10px] text-[#8793a2]">{service.description}</small></div></div>
              <div className="max-[760px]:hidden"><small className="block text-[9px] uppercase tracking-[.06em] text-[#8793a2]">Uptime</small><strong className="text-[11px] text-[#455467]">{service.uptime}</strong></div>
              <div className="max-[760px]:hidden"><small className="block text-[9px] uppercase tracking-[.06em] text-[#8793a2]">Current</small><strong className="text-[11px] text-[#455467]">{service.latency}</strong></div>
              <AdminStatus value={service.status} />
            </div>
          ))}
        </div>
      </AdminPanel>

      <section className="mt-[18px] grid grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] gap-[18px] max-[1000px]:grid-cols-1">
        <AdminPanel title="Recent incidents" description="Operational events from the last 30 days">
          <div className="px-5 py-1">
            {[
              ["Email delivery delay", "Resolved after provider failover", "Aug 19 · 18 minutes", "Resolved"],
              ["Kobo sync queue congestion", "Workers automatically scaled from 4 to 8", "Aug 12 · 9 minutes", "Resolved"],
              ["Database maintenance", "Planned security patch completed", "Aug 4 · 22 minutes", "Maintenance"],
            ].map(([title, detail, time, status]) => <div className="flex items-center gap-3 border-b border-line py-[15px] last:border-b-0" key={title}><span className="grid size-8 place-items-center rounded-full bg-[#e9f1ff] text-brand"><Activity size={15} /></span><div className="min-w-0 flex-1"><strong className="block text-[11px] text-[#324158]">{title}</strong><small className="block truncate text-[10px] text-[#8793a2]">{detail} · {time}</small></div><AdminStatus value={status} /></div>)}
          </div>
        </AdminPanel>

        <AdminPanel title="Environment" description="Production infrastructure">
          <div className="p-5">
            {[
              [Cloud, "Hosting region", "West Africa · Primary"],
              [Server, "Application version", "FieldSight 2.8.4"],
              [Database, "Database cluster", "PostgreSQL 16 · HA"],
              [RefreshCw, "Last deployment", "Aug 21, 2026 · 14:24 UTC"],
            ].map(([Icon, label, value]) => { const RowIcon = Icon as typeof Cloud; return <div className="mb-4 flex items-center gap-3 last:mb-0" key={label as string}><span className="grid size-8 place-items-center rounded-[7px] bg-[#f5f8fc] text-[#657182]"><RowIcon size={15} /></span><div><small className="block text-[9px] uppercase tracking-[.05em] text-[#8793a2]">{label as string}</small><strong className="text-[11px] text-[#324158]">{value as string}</strong></div></div>; })}
          </div>
        </AdminPanel>
      </section>
    </>
  );
}
