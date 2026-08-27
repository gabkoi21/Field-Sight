import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  BarChart3,
  ListChecks,
  Timer,
  Database,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  Users,
} from "lucide-react";
import { Badge, Button, LoadingState } from "../../components/ui";
import { apiClient, ApiError, type ApiAnalyticsOverview } from "../../services/apiClient";
import { SubmissionActivityPanel } from "../../components/dashboard/SubmissionActivityPanel";

const tabs = ["Overview", "Submissions", "Data quality", "Analytics", "Enumerators", "Reports", "Settings"];
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
  const syncMutation = useMutation({
    mutationFn: () => apiClient.syncProjectKoboForm(projectId!),
    onSuccess: async (result) => {
      setSyncMessage(`Sync complete: ${result.created} new and ${result.updated} updated submission${result.created + result.updated === 1 ? "" : "s"}.`);
      await queryClient.invalidateQueries({ queryKey: ["submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["project-overview", projectId] });
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
  const qualityRate = totalSubmissions ? Math.round((readyRecords / totalSubmissions) * 100) : 0;
  const activeEnumerators = (enumeratorsQuery.data ?? []).filter((item) => item.is_active).length;
  const target = project.target_sample_size ? project.target_sample_size.toLocaleString() : null;
  const workflow = [
    ["Plan", "Project configured", true],
    ["Connect", project.kobo_form_name ? "Form connected" : "Connect a form", Boolean(project.kobo_form_name)],
    ["Collect", target ? `${totalSubmissions.toLocaleString()} of ${target} records` : `${totalSubmissions.toLocaleString()} records collected`, totalSubmissions > 0],
    ["Review", overview?.blocked_records ? `${overview.blocked_records} records need attention` : "No records need attention", totalSubmissions > 0 && !overview?.blocked_records],
  ] as const;
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
      {syncMessage && <p className="m-0 rounded-[5px] border border-[#bfe4cf] bg-[#f0fbf5] px-3 py-2 text-xs text-[#18794e]">{syncMessage}</p>}
      {syncMutation.error && <p className="m-0 rounded-[5px] bg-[#fff0f2] px-3 py-2 text-xs text-[#b42318]">{syncMutation.error instanceof ApiError ? syncMutation.error.message : "Unable to sync Kobo data. Please try again."}</p>}      <nav className="mb-1 flex gap-1 overflow-x-auto border-b border-[#e5eaf0]">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={
              "shrink-0 border-x-0 border-t-0 bg-transparent px-3.5 py-3 text-[13px] font-semibold " +
              (i === 0
                ? "border-b-2 border-brand text-brand"
                : "border-b-2 border-transparent text-[#75849a] hover:text-[#344562]")
            }
          >
            {tab}
          </button>
        ))}
      </nav>
      <section className="grid grid-cols-4 gap-[14px] max-[1120px]:grid-cols-2 max-[560px]:grid-cols-1">
        <Metric
          icon={Database}
          tone="blue"
          label="Submissions"
          value={totalSubmissions.toLocaleString()}
          note={target ? "of " + target + " target" : "No target configured"}
        />
        <Metric icon={FileCheck2} tone="green" label="Data quality" value={`${qualityRate}%`} note={`${overview?.blocked_records ?? 0} records need attention`} />
        <Metric icon={Users} tone="purple" label="Field team" value={String(activeEnumerators)} note={`${(enumeratorsQuery.data ?? []).length} organization enumerators`} />
        <Metric icon={Clock3} tone="orange" label="Last sync" value={relativeTime(overview?.last_synced_at)} note={project.kobo_form_name ?? "No Kobo form assigned"} />
      </section>

      <div className="grid grid-cols-[minmax(0,1.85fr)_minmax(300px,.85fr)] gap-[14px] max-[1100px]:grid-cols-[1fr]">
        <SubmissionActivityPanel data={overview?.trend} subtitle="Imported and ready records for this project" />
        <CalendarPanel />
      </div>

      <WorkspaceInsights overview={overview} target={project.target_sample_size} />

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
function CalendarPanel() {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = new Date();
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  function moveMonth(direction: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
    setSelectedDay(1);
  }

  return (
    <section className="h-full rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
      <header className="flex items-center justify-between border-b border-[#edf0f2] pb-3">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Calendar</h2>
          <p className="mb-0 mt-1 text-[11px] text-[#84909b]">Project schedule</p>
        </div>
        <span className="rounded-[5px] bg-[#edf3fc] px-2 py-1 text-[10px] font-semibold text-[#0b51b7]">
          {isCurrentMonth ? "This month" : "Schedule"}
        </span>
      </header>
      <div className="mt-3 border border-[#edf0f2] px-3 py-[13px]">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => moveMonth(-1)}
            className="grid size-7 place-items-center border-0 bg-transparent text-[#93a1b2] hover:text-[#0b51b7]"
          >
            <ChevronLeft size={17} />
          </button>
          <strong className="text-[12px] text-[#253342]">{monthLabel}</strong>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => moveMonth(1)}
            className="grid size-7 place-items-center border-0 bg-transparent text-[#93a1b2] hover:text-[#0b51b7]"
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[10px]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day} className="py-1 font-medium text-[#0b51b7]">
              {day}
            </span>
          ))}
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span key={`blank-${index}`} className="size-7" />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`mx-auto grid size-7 place-items-center rounded-[4px] text-[11px] transition-colors ${selectedDay === day ? "bg-[#edf3fc] font-semibold text-[#0b51b7]" : isCurrentMonth && day === today.getDate() ? "font-semibold text-[#0b51b7] ring-1 ring-[#b9d0ef]" : "text-[#384a65] hover:bg-[#f1f5fa]"}`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
function WorkspaceInsights({ overview, target }: { overview?: ApiAnalyticsOverview; target: number | null }) {
  const total = overview?.total_submissions ?? 0;
  const ready = overview?.ready_records ?? 0;
  const review = overview?.needs_review ?? 0;
  const invalid = overview?.invalid_records ?? 0;
  const collectionProgress = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const qualityRate = total ? Math.round((ready / total) * 100) : 0;
  const segments = [
    { label: "Ready", value: ready, color: "#0abf82" },
    { label: "Needs review", value: review, color: "#f0a34a" },
    { label: "Invalid", value: invalid, color: "#d85d67" },
  ];
  const readyDegrees = total ? (ready / total) * 360 : 0;
  const reviewDegrees = total ? (review / total) * 360 : 0;
  return (
    <section className="grid grid-cols-3 gap-[14px] max-[1100px]:grid-cols-1">
      <article className="overflow-hidden rounded-[9px] border border-[#dfe4e9] bg-white">
        <InsightHeader icon={ListChecks} title="Review status" />
        <div className="grid grid-cols-[140px_1fr] items-center gap-4 px-5 py-7 max-[480px]:grid-cols-1">
          <div className="relative mx-auto size-[130px] rounded-full" style={{ background: total ? `conic-gradient(#0abf82 0 ${readyDegrees}deg, #f0a34a ${readyDegrees}deg ${readyDegrees + reviewDegrees}deg, #d85d67 ${readyDegrees + reviewDegrees}deg 360deg)` : "#e8edf2" }}>
            <span className="absolute inset-[19px] grid place-items-center rounded-full bg-white text-center"><strong className="text-[23px]">{total}</strong></span>
          </div>
          <div className="space-y-3">
            {segments.map((item) => <div key={item.label} className="flex justify-between gap-3 text-[12px] text-[#637187]"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span><strong className="text-[#172033]">{item.value}</strong></div>)}
          </div>
        </div>
      </article>
      <article className="overflow-hidden rounded-[9px] border border-[#dfe4e9] bg-white">
        <InsightHeader icon={Timer} title="Collection status" />
        <div className="space-y-5 px-5 py-6">
          <div><span className="text-[12px] text-[#6b778c]">Last synchronized</span><strong className="mt-1 block text-[22px] text-[#111827]">{relativeTime(overview?.last_synced_at)}</strong></div>
          <div><span className="text-[12px] text-[#6b778c]">Kobo source health</span><strong className="mt-1 block text-[18px] text-[#111827]">{overview?.collection_health.healthy_sources ?? 0} healthy · {overview?.collection_health.delayed_sources ?? 0} delayed</strong></div>
          <p className="m-0 text-[12px] text-[#77869a]">{total.toLocaleString()} records imported in the last 30 days</p>
        </div>
      </article>
      <article className="overflow-hidden rounded-[9px] border border-[#dfe4e9] bg-white">
        <InsightHeader icon={BarChart3} title="Project progress" />
        <div className="space-y-7 px-5 py-6">
          <ProgressMetric label="Collection target" value={target ? `${collectionProgress}%` : "Not set"} color="bg-[#2e6be6]" filled={Math.round(collectionProgress / 2.5)} />
          <ProgressMetric label="Data quality" value={`${qualityRate}%`} color="bg-[#08bf7a]" filled={Math.round(qualityRate / 2.5)} />
        </div>
      </article>
    </section>
  );
}

function InsightHeader({ icon: Icon, title }: { icon: typeof ListChecks; title: string }) {
  return (
    <header className="flex items-center justify-between border-b border-[#e5e8ec] px-4 py-2">
      <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg border border-[#cfd6de] text-[#1f2937] shadow-[inset_0_0_0_2px_#f7f8fa]"><Icon size={20} /></span><h2 className="text-[16px] font-bold text-[#121b2a]">{title}</h2></div>
      <button type="button" className="rounded-lg border border-[#d3d8de] px-4 py-2 text-[13px] font-medium text-[#111827]">View details</button>
    </header>
  );
}

function ProgressMetric({ label, value, color, filled }: { label: string; value: string; color: string; filled: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[14px]"><span className="text-[#59677d]">{label}</span><strong className="text-[16px] text-[#111827]">{value}</strong></div>
      <div className="flex gap-[3px]">{Array.from({ length: 40 }, (_, index) => <i key={index} className={`h-7 flex-1 rounded-[2px] ${index < filled ? color : "bg-[#e2e4e7]"}`} />)}</div>
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
                    <td className="px-4 py-3">{item.employee_id ?? "�"}</td>
                    <td className="px-4 py-3">{item.phone_number ?? "�"}</td>
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
function ProjectActivity({ overview, projectName, hasForm }: { overview?: ApiAnalyticsOverview; projectName: string; hasForm: boolean }) {
  const entries = overview?.activity ?? [];
  return (
    <section className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
      <header className="flex items-center justify-between border-b border-[#edf0f2] pb-3">
        <div><h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Activity</h2><p className="mb-0 mt-1 text-[11px] text-[#84909b]">Latest project submissions</p></div>
        <span className="rounded-[5px] border border-[#dce2e7] bg-white px-2 py-1 text-[10px] font-medium text-[#657382]">{entries.length} recent</span>
      </header>
      <div className="mt-1">
        {entries.map((entry, index) => (
          <div className="relative flex gap-3 py-3 last:pb-0" key={entry.id}>
            <span className="relative z-[1] grid size-8 shrink-0 place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]"><Clock3 size={15} /></span>
            {index < entries.length - 1 && <i className="absolute left-4 top-11 h-[22px] border-l border-dashed border-[#d6dee8]" />}
            <div className="min-w-0 flex-1"><strong className="block text-[12px] text-[#354966]">{entry.name}</strong><span className="block text-[11px] text-[#71809a]">{entry.detail}{entry.location ? ` in ${entry.location}` : ""}</span></div>
            <time className="shrink-0 text-[10px] text-[#8a96a7]">{relativeTime(entry.occurred_at)}</time>
          </div>
        ))}
        {!entries.length && <p className="m-0 py-8 text-center text-[11px] text-[#84909b]">{hasForm ? `No submissions imported for ${projectName} yet.` : "Connect a Kobo form to begin collection."}</p>}
      </div>
    </section>
  );
}