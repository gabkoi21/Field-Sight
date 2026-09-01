import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useParams } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  Clock3,
  Database,
  FileCheck2,
  RefreshCw,
  Users,
  MapPin,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge, Button, LoadingState } from "../../components/ui";
import { apiClient, ApiError, type ApiSubmission } from "../../services/apiClient";
import { SubmissionActivityPanel } from "../../components/dashboard/SubmissionActivityPanel";

const tone = {
  blue: "bg-[#edf3fc] text-[#4d7fc6]",
  green: "bg-[#e8f6f4] text-[#0b51b7]",
  purple: "bg-[#f0edfa] text-[#7868b8]",
  orange: "bg-[#fff3e5] text-[#d88935]",
};

function relativeTime(value: string | null | undefined) {
  if (!value) return "Never";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [syncMessage, setSyncMessage] = useState("");
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const projectQuery = useQuery({
    queryKey: ["project", organizationId, projectId],
    queryFn: () => apiClient.getProject(organizationId!, projectId!),
    enabled: Boolean(organizationId && projectId),
  });
  const overviewQuery = useQuery({
    queryKey: ["project-overview", projectId],
    queryFn: () => apiClient.analyticsOverview({ projectId: projectId!, period: "30d" }),
    enabled: Boolean(projectId),
  });
  const submissionsQuery = useQuery({
    queryKey: ["submissions", projectId],
    queryFn: apiClient.submissions,
    enabled: Boolean(projectId),
  });
  const syncMutation = useMutation({
    mutationFn: () => apiClient.syncProjectKoboForm(projectId!),
    onSuccess: async (result) => {
      setSyncMessage(
        `Sync complete: ${result.created} new and ${result.updated} updated submission${result.created + result.updated === 1 ? "" : "s"}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["project-overview", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["kobo-pending-sync"] });
    },
  });
  const projectSubmissions = useMemo(
    () => (submissionsQuery.data ?? []).filter((item) => item.project_id === projectId),
    [submissionsQuery.data, projectId],
  );

  if (userQuery.isLoading || projectQuery.isLoading || overviewQuery.isLoading) return <LoadingState />;
  if (projectQuery.error)
    return (
      <div className="rounded-xl border border-[#f7cfd4] bg-[#fff3f4] p-6 text-sm text-[#b42318]">
        {projectQuery.error instanceof ApiError ? projectQuery.error.message : "Unable to load project."}
      </div>
    );
  const project = projectQuery.data;
  if (!project) return <LoadingState />;
  const overview = overviewQuery.data;
  const totalSubmissions = projectSubmissions.length;
  const readyRecords = projectSubmissions.filter((item) => item.review_status === "ready").length;
  const activeEnumerators = new Set(projectSubmissions.map((item) => item.enumerator).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-[18px] pb-5">
      <div className="mb-2 flex items-end justify-between gap-[14px] max-[720px]:flex-col max-[720px]:items-start">
        <div>
          <NavLink
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-[#748299] no-underline hover:text-brand"
            to="/projects"
          >
            <ChevronRight size={14} className="rotate-180" /> All projects
          </NavLink>
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 place-items-center rounded-xl bg-[#e8f1ff] text-brand shadow-[inset_0_0_0_1px_#dce9fb]">
              <Building2 size={21} />
            </span>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-[2rem] font-bold leading-tight tracking-[-.05em] text-[#1d2a38]">
                  {project.name}
                </h1>
                <Badge value={project.status} />
              </div>
              <p className="m-0 text-[0.8125rem] text-[#77869b]">
                Project workspace <span className="mx-1 text-[#c6ced8]"> / </span>
                {project.kobo_form_name ? "Kobo form connected" : "No form connected"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!project.kobo_form_id || syncMutation.isPending}
            onClick={() => {
              setSyncMessage("");
              syncMutation.mutate();
            }}
          >
            <RefreshCw size={15} /> {syncMutation.isPending ? "Syncing…" : "Sync data"}
          </Button>
        </div>
      </div>
      {syncMessage && (
        <p className="m-0 rounded-[5px] border border-[#bfe4cf] bg-[#f0fbf5] px-3 py-2 text-xs text-[#18794e]">
          {syncMessage}
        </p>
      )}
      {syncMutation.error && (
        <p className="m-0 rounded-[5px] bg-[#fff0f2] px-3 py-2 text-xs text-[#b42318]">
          {syncMutation.error instanceof ApiError
            ? syncMutation.error.message
            : "Unable to sync Kobo data. Please try again."}
        </p>
      )}
      <nav className="mb-1 flex gap-1 overflow-x-auto border-b border-[#e5eaf0]">
        <span className="shrink-0 border-b-2 border-brand px-3.5 py-3 text-[13px] font-semibold text-brand">
          Overview
        </span>
        <NavLink
          to={`/analytics?project_id=${project.id}`}
          className="shrink-0 border-b-2 border-transparent px-3.5 py-3 text-[13px] font-semibold text-[#75849a] no-underline hover:text-[#344562]"
        >
          Analytics
        </NavLink>
      </nav>
      <section className="grid grid-cols-4 gap-[14px] max-[1120px]:grid-cols-2 max-[560px]:grid-cols-1">
        <Metric
          icon={Database}
          tone="blue"
          label="Submissions"
          value={totalSubmissions.toLocaleString()}
          note={
            project.target_sample_size
              ? "of " + project.target_sample_size.toLocaleString() + " target"
              : "No target configured"
          }
        />
        <Metric
          icon={FileCheck2}
          tone="green"
          label="Records ready"
          value={readyRecords.toLocaleString()}
          note={`${overview?.blocked_records ?? 0} records need attention`}
        />
        <Metric
          icon={Users}
          tone="purple"
          label="Active enumerators"
          value={String(activeEnumerators)}
          note="Contributing to this project"
        />
        <Metric
          icon={Clock3}
          tone="orange"
          label="Last sync"
          value={relativeTime(overview?.last_synced_at)}
          note={project.kobo_form_name ?? "No Kobo form assigned"}
        />
      </section>
      <div className="grid grid-cols-[minmax(0,1.85fr)_minmax(300px,.85fr)] gap-[14px] max-[1100px]:grid-cols-[1fr]">
        <SubmissionActivityPanel
          submissions={projectSubmissions}
          target={project.target_sample_size}
          startDate={project.start_date}
          endDate={project.end_date}
        />
        <TopLocationsPanel submissions={(submissionsQuery.data ?? []).filter((s) => s.project_id === projectId)} />
      </div>
      <section className="grid grid-cols-[minmax(0,1.8fr)_minmax(320px,.8fr)] gap-[14px] max-[1050px]:grid-cols-1">
        <ProjectLeaderboard submissions={projectSubmissions} />
        <ProjectExceptionAlerts submissions={projectSubmissions} projectName={project.name} />
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  tone: color,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  tone: keyof typeof tone;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card className="p-[17px]">
      <div className="flex justify-between">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[.07em] text-[#8491a5]">{label}</p>
          <strong className="mt-2 block text-[23px] leading-none text-[#2e4364]">{value}</strong>
        </div>
        <span className={"grid size-9 place-items-center rounded-lg " + tone[color]}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mb-0 mt-2.5 text-xs text-[#78869a]">{note}</p>
    </Card>
  );
}

function TopLocationsPanel({ submissions }: { submissions: ApiSubmission[] }) {
  const [view, setView] = useState<"counties" | "communities">("counties");
  const hasCountyData = submissions.some((item) => {
    const value = item.raw_answers["household/county"];
    return typeof value === "string" && Boolean(value.trim());
  });
  const hasCommunityData = submissions.some((item) => {
    const raw = item.raw_answers;
    const value = raw["household/community"] ?? raw["household/community_or_settlement"];
    return typeof value === "string" && Boolean(value.trim());
  });

  useEffect(() => {
    if (view === "counties" && !hasCountyData && hasCommunityData) setView("communities");
    if (view === "communities" && !hasCommunityData && hasCountyData) setView("counties");
  }, [view, hasCountyData, hasCommunityData]);

  const locationCounts = new Map<string, number>();
  for (const s of submissions) {
    const raw = s.raw_answers as Record<string, unknown>;
    const key =
      view === "counties"
        ? (raw["household/county"] as string | undefined)
        : ((raw["household/community"] as string | undefined) ??
          (raw["household/community_or_settlement"] as string | undefined));
    if (key && typeof key === "string" && key.trim()) {
      locationCounts.set(key.trim(), (locationCounts.get(key.trim()) ?? 0) + 1);
    }
  }
  const top3 = [...locationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const COLORS = ["#0b51b7", "#5c9af5", "#93bbfb"];

  return (
    <Card>
      <CardHeader
        title={
          <>
            <MapPin size={15} className="text-brand" /> Top 3 locations
          </>
        }
        subtitle={`Leading 3 ${view} by submission count`}
      >
        <div className="relative">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "counties" | "communities")}
            className="appearance-none rounded-lg border border-[#dce4ed] bg-white py-1.5 pl-3 pr-7 text-[12px] font-medium text-[#344562] focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="counties">Counties</option>
            <option value="communities">Communities</option>
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#748299]"
          />
        </div>
      </CardHeader>

      {top3.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#8491a3]">No location data yet. Sync Kobo data to populate.</p>
      ) : (
        <div className="p-5">
          <LocationDonutChart segments={top3} total={submissions.length} colors={COLORS} />
          <table className="mt-5 w-full text-left">
            <thead>
              <tr className="border-b border-[#edf0f4] text-[10px] font-semibold uppercase tracking-[.06em] text-[#8491a3]">
                <th className="pb-2">Location</th>
                <th className="pb-2 text-right">%</th>
                <th className="pb-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {top3.map(([name, count], i) => (
                <tr key={name} className="border-b border-[#f4f6f9] last:border-0">
                  <td className="py-2.5 text-[12px] text-[#2e4364]">
                    <span className="flex items-center gap-2">
                      <i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      {name}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-[12px] font-semibold text-[#2e4364]">
                    {submissions.length ? Math.round((count / submissions.length) * 100) : 0}%
                  </td>
                  <td className="py-2.5 text-right text-[12px] text-[#8491a3]">{count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LocationDonutChart({
  segments,
  total,
  colors,
}: {
  segments: [string, number][];
  total: number;
  colors: string[];
}) {
  let cum = 0;
  const stops = segments.map(([, count], i) => {
    const pct = total ? (count / total) * 100 : 0;
    const stop = `${colors[i]} ${cum}% ${cum + pct}%`;
    cum += pct;
    return stop;
  });
  if (cum < 100) stops.push(`#e8edf3 ${cum}% 100%`);

  return (
    <div className="flex justify-center py-2">
      <div
        className="relative size-[175px] rounded-full shadow-sm"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <span className="absolute inset-[28px] grid place-items-center rounded-full bg-white text-center shadow-inner">
          <div>
            <strong className="block text-[22px] font-bold leading-none text-[#1d2a38]">{total}</strong>
            <span className="mt-1 block text-[10px] font-medium uppercase tracking-[.06em] text-[#8491a3]">total</span>
          </div>
        </span>
      </div>
    </div>
  );
}

function ProjectLeaderboard({ submissions }: { submissions: ApiSubmission[] }) {
  const contributorsData = useMemo(() => {
    const map = new Map<string, { count: number; lastSubmission?: string }>();
    for (const item of submissions) {
      const name = item.enumerator?.trim() || "Unassigned";
      const existing = map.get(name) ?? { count: 0 };
      const lastSub =
        !existing.lastSubmission ||
        (item.submitted_at && new Date(item.submitted_at).getTime() > new Date(existing.lastSubmission).getTime())
          ? (item.submitted_at ?? existing.lastSubmission)
          : existing.lastSubmission;
      map.set(name, { count: existing.count + 1, lastSubmission: lastSub });
    }
    return [...map.entries()].map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count);
  }, [submissions]);

  const total = submissions.length;

  return (
    <Card className="flex h-full flex-col justify-between p-[17px]">
      <div>
        <CardHeader title="Enumerator leaderboard" subtitle="Contributions to this project">
          <span className="rounded-[5px] border border-[#dce4ed] bg-[#f8fafc] px-2 py-1 text-[10px] font-semibold text-[#536177]">
            Top 5
          </span>
        </CardHeader>

        <div className="mt-2.5 space-y-2">
          {contributorsData.slice(0, 5).map((item, index) => {
            const pct = total ? Math.round((item.count / total) * 100) : 0;
            const badgeStyles = [
              "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
              "bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]",
              "bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]",
            ];
            const badgeClass = badgeStyles[index] ?? "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]";

            return (
              <div
                key={item.name}
                className="flex flex-col gap-1 rounded-md border border-[#f0f3f7] bg-[#fbfcfd] p-2.5 transition-colors hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${badgeClass}`}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-xs font-semibold text-[#1e293b]" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5 text-xs">
                    <span className="text-[10px] font-medium text-[#64748b]">{pct}% share</span>
                    <strong className="text-[12px] font-bold text-[#0b51b7]">{item.count.toLocaleString()}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e2e8f0]">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {item.lastSubmission && (
                    <span className="shrink-0 text-[10px] text-[#94a3b8]">
                      Active {relativeTime(item.lastSubmission)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {!contributorsData.length && (
            <div className="py-6 text-center text-xs text-[#84909b]">
              No project contributions yet. Sync Kobo submissions to track team rankings.
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-[#f0f2f5] pt-2.5 text-right">
        <NavLink
          to="/field-enumerators"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          View field team <ArrowRight size={12} />
        </NavLink>
      </div>
    </Card>
  );
}

function ProjectExceptionAlerts({ submissions, projectName }: { submissions: ApiSubmission[]; projectName: string }) {
  const anomalies = useMemo(() => {
    return submissions
      .map((sub) => {
        const issues: string[] = [];
        if (sub.review_status === "invalid") issues.push("Invalid record");
        else if (sub.review_status === "needs_review") issues.push("Needs review");
        if (!sub.location || sub.location === "Not captured") issues.push("Missing location");
        if (!sub.enumerator) issues.push("Unassigned enumerator");
        return { sub, issues };
      })
      .filter((item) => item.issues.length > 0);
  }, [submissions]);

  return (
    <Card className="flex h-full flex-col justify-between p-[17px]">
      <div>
        <CardHeader title="Automated Exception Alerts" subtitle="Flagged data & rule anomalies">
          <span
            className={`rounded-[5px] border px-2 py-1 text-[10px] font-bold ${anomalies.length > 0 ? "border-[#f8cbad] bg-[#fff3e5] text-[#c05621]" : "border-[#b8e6d8] bg-[#e8f6f4] text-[#0b51b7]"}`}
          >
            {anomalies.length} {anomalies.length === 1 ? "exception" : "exceptions"}
          </span>
        </CardHeader>
        <div className="mt-2 max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
          {anomalies.map(({ sub, issues }) => (
            <div key={sub.id} className="rounded-md border border-[#fee4e2] bg-[#fff5f5] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <strong className="font-semibold text-[#991b1b]">{sub.external_id}</strong>
                <time className="text-[10px] text-[#7f1d1d]">{relativeTime(sub.submitted_at)}</time>
              </div>
              <p className="mb-1 mt-0.5 text-[11px] text-[#7f1d1d]">
                {sub.enumerator ?? "Unassigned"} {sub.location ? `• ${sub.location}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {issues.map((issue) => (
                  <span
                    key={issue}
                    className="rounded bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-medium text-[#991b1b]"
                  >
                    {issue}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!anomalies.length && (
            <div className="my-4 flex flex-col items-center justify-center py-6 text-center">
              <span className="grid size-10 place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]">
                <ShieldCheck size={20} />
              </span>
              <strong className="mt-2 block text-xs font-semibold text-[#1f2937]">No active exceptions</strong>
              <p className="m-0 mt-1 max-w-[240px] text-[11px] text-[#6b7280]">
                All submissions for {projectName} passed automated validation rules.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-[#f0f2f5] pt-2.5 text-right">
        <NavLink
          to="/submissions"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          Manage all submissions <ArrowRight size={12} />
        </NavLink>
      </div>
    </Card>
  );
}
