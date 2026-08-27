import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useParams } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  ChevronDown,
  Clock3,
  BarChart3,
  ListChecks,
  Timer,
  Database,
  ExternalLink,
  FileCheck2,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import { Badge, Button, LoadingState } from "../../components/ui";
import { apiClient, ApiError, type ApiAnalyticsOverview, type ApiSubmission } from "../../services/apiClient";
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
  const enumeratorsQuery = useQuery({
    queryKey: ["organization-enumerators"],
    queryFn: apiClient.enumerators,
    enabled: Boolean(organizationId),
  });
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
  const totalSubmissions = overview?.total_submissions ?? 0;
  const readyRecords = overview?.ready_records ?? 0;
  const activeEnumerators = (enumeratorsQuery.data ?? []).filter((item) => item.is_active).length;
  const target = project.target_sample_size ? project.target_sample_size.toLocaleString() : null;
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
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="m-0 text-[27px] font-bold leading-tight tracking-[-.45px] text-[#1d2a38]">
                  {project.name}
                </h1>
                <Badge value={project.status} />
              </div>
              <p className="m-0 text-xs text-[#77869b]">
                Project workspace <span className="mx-1 text-[#c6ced8]"> / </span>
                {project.kobo_form_name ? "Kobo form connected" : "No form connected"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.kobo_form_name && (
            <Button variant="secondary">
              <ExternalLink size={15} /> Open in Kobo
            </Button>
          )}
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
        <span className="shrink-0 border-b-2 border-brand px-3.5 py-3 text-[13px] font-semibold text-brand">Overview</span>
        <NavLink to={`/analytics?project_id=${project.id}`} className="shrink-0 border-b-2 border-transparent px-3.5 py-3 text-[13px] font-semibold text-[#75849a] no-underline hover:text-[#344562]">Analytics</NavLink>
      </nav>
      <section className="grid grid-cols-4 gap-[14px] max-[1120px]:grid-cols-2 max-[560px]:grid-cols-1">
        <Metric
          icon={Database}
          tone="blue"
          label="Submissions"
          value={totalSubmissions.toLocaleString()}
          note={target ? "of " + target + " target" : "No target configured"}
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
          note="Available in this organization"
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
        <SubmissionActivityPanel data={overview?.trend} totalSubmissions={totalSubmissions} />
        <TopLocationsPanel submissions={(submissionsQuery.data ?? []).filter((s) => s.project_id === projectId)} />
      </div>

      <section className="grid grid-cols-[minmax(0,1.8fr)_minmax(320px,.8fr)] gap-[14px] max-[1050px]:grid-cols-1">
        <EnumeratorsTable enumerators={enumeratorsQuery.data ?? []} />
        <ProjectActivity overview={overview} projectName={project.name} hasForm={Boolean(project.kobo_form_name)} />
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
  icon: typeof Database;
  tone: keyof typeof tone;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
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
    </article>
  );
}
function TopLocationsPanel({ submissions }: { submissions: ApiSubmission[] }) {
  const [view, setView] = useState<"counties" | "communities">("counties");
  const locationCounts = new Map<string, number>();
  for (const s of submissions) {
    const raw = s.raw_answers as Record<string, unknown>;
    const key =
      view === "counties"
        ? (raw["household/county"] as string | undefined)
        : ((raw["household/community"] as string | undefined) ?? (raw["household/community_or_settlement"] as string | undefined));
    if (key && typeof key === "string" && key.trim()) {
      locationCounts.set(key.trim(), (locationCounts.get(key.trim()) ?? 0) + 1);
    }
  }
  const top3 = [...locationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const COLORS = ["#0b51b7", "#5c9af5", "#93bbfb"];

  return (
    <section className="overflow-hidden rounded-xl border border-[#e1e7ef] bg-white shadow-[0_5px_18px_rgba(25,43,75,.04)]">
      <header className="border-b border-[#edf0f4] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-brand" />
              <h2 className="m-0 text-sm font-semibold">Top locations</h2>
            </div>
            <p className="mb-0 mt-1 text-[10px] text-[#8491a3]">Leading {view} by submission count</p>
          </div>
          <div className="relative">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as "counties" | "communities")}
              className="appearance-none rounded-lg border border-[#dce4ed] bg-white py-1.5 pl-3 pr-7 text-[12px] font-medium text-[#344562] focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="counties">Counties</option>
              <option value="communities">Communities</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#748299]" />
          </div>
        </div>
      </header>

      {top3.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#8491a3]">No location data yet. Sync Kobo data to populate.</p>
      ) : (
        <div className="p-5">
          {/* Donut chart */}
          <LocationDonutChart segments={top3} total={submissions.length} colors={COLORS} />
          {/* Table */}
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
    </section>
  );
}

function LocationDonutChart({ segments, total, colors }: { segments: [string, number][]; total: number; colors: string[] }) {
  let cum = 0;
  const stops = segments.map(([, count], i) => {
    const pct = total ? (count / total) * 100 : 0;
    const stop = `${colors[i]} ${cum}% ${cum + pct}%`;
    cum += pct;
    return stop;
  });
  if (cum < 100) stops.push(`#e8edf3 ${cum}% 100%`);
  return (
    <div className="flex justify-center">
      <div className="relative size-[120px] rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
        <span className="absolute inset-[20px] grid place-items-center rounded-full bg-white text-center">
          <strong className="block text-[18px] leading-none text-[#1d2a38]">{total}</strong>
          <span className="mt-0.5 block text-[9px] text-[#8491a3]">total</span>
        </span>
      </div>
    </div>
  );
}

function EnumeratorsTable({
  enumerators,
}: {
  enumerators: Array<{
    membership_id: string;
    full_name: string | null;
    username: string | null;
    email: string;
    employee_id: string | null;
    phone_number: string | null;
    is_active: boolean;
    created_at: string;
  }>;
}) {
  return (
    <section className="overflow-hidden rounded-[6px] border border-[#e5e9ed] bg-white">
      <header className="flex items-center justify-between border-b border-[#edf0f2] px-[17px] py-[13px]">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Enumerators</h2>
          <p className="mb-0 mt-1 text-[11px] text-[#84909b]">Field team assigned to your organization</p>
        </div>
        <NavLink to="/field-operations" className="text-[11px] font-semibold text-[#0b51b7] no-underline">
          View all
        </NavLink>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-[#f7f9fc] text-[10px] font-semibold uppercase tracking-[.04em] text-[#748299]">
            <tr>
              <th className="px-4 py-3">Enumerator</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Employee ID</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {enumerators.length ? (
              enumerators.slice(0, 6).map((item) => {
                const name = item.full_name ?? item.username ?? "Unnamed enumerator";
                const initials = name
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <tr key={item.membership_id} className="border-t border-[#edf0f2] text-[12px] text-[#405572]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-[#edf3fc] text-[10px] font-bold text-[#4d7fc6]">
                          {initials}
                        </span>
                        <strong className="text-[#253342]">{name}</strong>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3">{item.email}</td>
                    <td className="px-4 py-3">{item.employee_id ?? "—"}</td>
                    <td className="px-4 py-3">{item.phone_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "rounded-[4px] px-2 py-1 text-[10px] font-semibold " +
                          (item.is_active ? "bg-[#e2f6ed] text-[#1e9b72]" : "bg-[#fff0f2] text-[#b42318]")
                        }
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{new Date(item.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#84909b]">
                  No enumerators have been added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ProjectActivity({
  overview,
  projectName,
  hasForm,
}: {
  overview?: ApiAnalyticsOverview;
  projectName: string;
  hasForm: boolean;
}) {
  const entries = overview?.activity ?? [];
  return (
    <section className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
      <header className="flex items-center justify-between border-b border-[#edf0f2] pb-3">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Activity</h2>
          <p className="mb-0 mt-1 text-[11px] text-[#84909b]">Latest project submissions</p>
        </div>
        <span className="rounded-[5px] border border-[#dce2e7] bg-white px-2 py-1 text-[10px] font-medium text-[#657382]">
          {entries.length} recent
        </span>
      </header>
      <div className="mt-1">
        {entries.map((entry, index) => (
          <div className="relative flex gap-3 py-3 last:pb-0" key={entry.id}>
            <span className="relative z-[1] grid size-8 shrink-0 place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]">
              <Clock3 size={15} />
            </span>
            {index < entries.length - 1 && (
              <i className="absolute left-4 top-11 h-[22px] border-l border-dashed border-[#d6dee8]" />
            )}
            <div className="flex-1 min-w-0">
              <strong className="block text-[12px] text-[#354966]">{entry.name}</strong>
              <span className="block text-[11px] text-[#71809a]">
                {entry.detail}
                {entry.location ? ` in ${entry.location}` : ""}
              </span>
            </div>
            <time className="shrink-0 text-[10px] text-[#8a96a7]">{relativeTime(entry.occurred_at)}</time>
          </div>
        ))}
        {!entries.length && (
          <p className="m-0 py-8 text-center text-[11px] text-[#84909b]">
            {hasForm ? `No submissions imported for ${projectName} yet.` : "Connect a Kobo form to begin collection."}
          </p>
        )}
      </div>
    </section>
  );
}
