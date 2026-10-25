import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../services/apiClient";
import { Button } from "../components/ui";
import { Notice, Panel } from "./WorkspaceUI";

export function SyncControls({ projectId, connected }: { projectId: string; connected: boolean }) {
  const cache = useQueryClient();
  const settings = useQuery({ queryKey: ["sync-settings", projectId], queryFn: () => apiClient.syncSettings(projectId), refetchInterval: 5000 });
  const [interval, setInterval] = useState(3600);
  useEffect(() => { if (settings.data) setInterval(settings.data.interval_seconds ?? settings.data.interval_minutes * 60); }, [settings.data?.interval_minutes, settings.data?.interval_seconds]);
  const refresh = async () => {
    await Promise.all(["sync-settings", "sync-runs", "submissions", "workspace-tables", "indicators", "collected-results", "project-overview"].map(
      key => cache.invalidateQueries({ queryKey: [key] }),
    ));
  };
  const save = useMutation({ mutationFn: (mode: "manual" | "scheduled") => apiClient.updateSyncSettings(projectId, mode, interval), onSuccess: refresh });
  const sync = useMutation({ mutationFn: () => apiClient.queueSync(projectId), onSuccess: refresh });
  const last = settings.data?.last_successful_sync;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!settings.data?.pending) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [settings.data?.pending]);
  const nextAttempt = settings.data?.next_attempt_at;
  const retryScheduled = Boolean(settings.data?.pending && settings.data.attempts && nextAttempt && new Date(nextAttempt).getTime() > now);
  useEffect(() => { if (last) void refresh(); }, [last]);
  const running = settings.data?.pending && settings.data.execution_state === "running";
  return <Panel className="space-y-4 p-5">
    <h2 className="m-0 text-base font-semibold">Synchronization</h2>
    <p className="text-xs text-[#73868d]">Last successful sync: {last ? new Date(last).toLocaleString() : "Never"}</p>
    <p className="text-xs text-[#73868d]">Worker: {settings.data?.worker_available === true ? "Available" : settings.data?.worker_available === false ? "No live heartbeat" : "Health unavailable"}. Last heartbeat: {settings.data?.worker_heartbeat_at ? new Date(settings.data.worker_heartbeat_at).toLocaleString() : "Not recorded"}.</p>
    {settings.data?.worker_available === false && <Notice error>No worker heartbeat received in the last 20 seconds. Start or check the synchronization worker; queued work is retained.</Notice>}
    {settings.data?.execution_state === "unconfirmed" && settings.data.pending && <Notice error>The worker heartbeat stopped during this job. Its outcome is unconfirmed; queue recovery will retry safely.</Notice>}
    {running && <p role="status" className="text-xs">Running since {settings.data?.execution_started_at ? new Date(settings.data.execution_started_at).toLocaleString() : "the worker claimed this job"}.</p>}
    {settings.data?.latest_status && <p className="text-xs">Latest recorded attempt: {settings.data.latest_status}. Received {settings.data.received ?? 0}; created {settings.data.created ?? 0}; updated {settings.data.updated ?? 0}.</p>}
    {settings.data?.latest_error && <Notice error>{settings.data.latest_error}</Notice>}
    {settings.data && <div className="flex flex-wrap items-center gap-3 text-xs">
      <label className="flex items-center gap-2"><input type="checkbox" checked={settings.data.mode === "scheduled"} disabled={!connected || save.isPending}
        onChange={event => save.mutate(event.target.checked ? "scheduled" : "manual")} />Automatic synchronization</label>
      <label>Interval (seconds) <input aria-label="Sync interval in seconds" type="number" min={1.6} max={604800} step={0.1} value={interval}
        className="w-24 rounded border border-[#dce4e8] p-2" onChange={event => setInterval(Number(event.target.value))} /></label>
      <Button variant="secondary" disabled={save.isPending || !Number.isFinite(interval) || interval < 1.6 || interval > 604800} onClick={() => save.mutate(settings.data!.mode)}>Save interval</Button>
      <Button disabled={!connected || sync.isPending || settings.data.pending} onClick={() => sync.mutate()}>{settings.data.pending ? (running ? "Sync running…" : retryScheduled ? "Retry scheduled…" : "Sync pending…") : "Sync now"}</Button>
    </div>}
    {settings.isLoading && <p>Loading synchronization settings…</p>}
    {[settings.error, save.error, sync.error].filter(Boolean).map((error, index) => <Notice error key={index}>{error!.message}</Notice>)}
  </Panel>;
}
