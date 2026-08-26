import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { NavLink, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  FileCheck2,
  Flag,
  Link2,
  MapPin,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import { Badge, Button, LoadingState } from "../../components/ui";
import { apiClient, ApiError } from "../../services/apiClient";
import { SubmissionActivityPanel } from "../../components/dashboard/SubmissionActivityPanel";

const tabs = ["Overview", "Submissions", "Data quality", "Analytics", "Enumerators", "Reports", "Settings"];
const tone = {
  blue: "bg-[#edf3fc] text-[#4d7fc6]",
  green: "bg-[#e8f6f4] text-[#0b51b7]",
  purple: "bg-[#f0edfa] text-[#7868b8]",
  orange: "bg-[#fff3e5] text-[#d88935]",
};
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(value + "T00:00:00"),
      )
    : "Not scheduled";
}

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
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
  if (userQuery.isLoading || projectQuery.isLoading) return <LoadingState />;
  if (projectQuery.error)
    return (
      <div className="rounded-xl border border-[#f7cfd4] bg-[#fff3f4] p-6 text-sm text-[#b42318]">
        {projectQuery.error instanceof ApiError ? projectQuery.error.message : "Unable to load project."}
      </div>
    );
  const project = projectQuery.data;
  if (!project) return <LoadingState />;
  const target = project.target_sample_size ? project.target_sample_size.toLocaleString() : null;
  const workflow = [
    ["Plan", "Project configured", true],
    ["Connect", project.kobo_form_name ? "Form connected" : "Connect a form", Boolean(project.kobo_form_name)],
    ["Collect", target ? "0 of " + target + " records" : "Set a collection target", false],
    ["Review", "Awaiting submissions", false],
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
          <Button>
            <RefreshCw size={15} /> Sync data
          </Button>
        </div>
      </div>
      <nav className="mb-1 flex gap-1 overflow-x-auto border-b border-[#e5eaf0]">
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
          value="0"
          note={target ? "of " + target + " target" : "No target configured"}
        />
        <Metric icon={FileCheck2} tone="green" label="Data quality" value="--" note="No records to review" />
        <Metric icon={Users} tone="purple" label="Field team" value="0" note="Enumerators assigned" />
        <Metric icon={Clock3} tone="orange" label="Last sync" value="--" note="Waiting for first sync" />
      </section>

      <div className="grid grid-cols-[minmax(0,1.85fr)_minmax(300px,.85fr)] gap-[14px] max-[1100px]:grid-cols-[1fr]">
        <SubmissionActivityPanel />
        <CalendarPanel />
      </div>

      <section className="grid grid-cols-[minmax(0,.72fr)_minmax(0,1.5fr)] gap-[14px] max-[1000px]:grid-cols-1">
        <TaskPerformance />
        <ProjectProgress project={project} />
      </section>

      <section className="grid grid-cols-[minmax(0,1.8fr)_minmax(320px,.8fr)] gap-[14px] max-[1050px]:grid-cols-1">
        <EnumeratorsTable enumerators={enumeratorsQuery.data ?? []} />
        <ProjectActivity projectName={project.name} hasForm={Boolean(project.kobo_form_name)} />
      </section>
      <section className="grid grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] gap-[14px] max-[1050px]:grid-cols-1">
        <article className="rounded-[6px] border border-[#e5e9ed] bg-white">
          <div className="flex justify-between px-6 py-5">
            <div>
              <h2 className="m-0 text-base font-bold text-[#1d2a38]">Recent activity</h2>
              <p className="mb-0 mt-1 text-xs text-[#7b899d]">Updates from this project</p>
            </div>
            <button className="text-xs font-bold text-brand">View all</button>
          </div>
          <div className="border-t border-[#edf0f4] px-6">
            <Activity
              icon={Link2}
              tone="blue"
              title={project.kobo_form_name ? "Kobo form is connected" : "Connect a Kobo form to begin"}
              time="Project setup"
            />
            <Activity
              icon={Target}
              tone="purple"
              title={target ? "Collection target set to " + target : "Add a collection target when you are ready"}
              time="Collection planning"
            />
            <Activity
              icon={MapPin}
              tone="green"
              title="Location and quality checks will appear here"
              time="After submissions arrive"
            />
          </div>
        </article>
        <article className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
          <div className="flex justify-between">
            <div>
              <h2 className="m-0 text-base font-bold text-[#1d2a38]">Attention needed</h2>
              <p className="mb-0 mt-1 text-xs text-[#7b899d]">Priority actions for this project</p>
            </div>
            <Flag size={18} className="text-[#d99a35]" />
          </div>
          <div className="mt-5 rounded-lg border border-dashed border-[#dce4ed] bg-[#fafbfd] px-4 py-5 text-center">
            <span className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-[#edf3fb] text-[#6d88ae]">
              <CheckCircle2 size={18} />
            </span>
            <strong className="block text-[13px] text-[#435873]">Nothing needs attention</strong>
            <p className="mb-0 mt-1 text-xs leading-5 text-[#7d8a9d]">
              Quality and field alerts will show here as data is collected.
            </p>
          </div>
        </article>
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
function Detail({
  icon: Icon,
  label,
  value,
  border,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-3 px-6 py-4 max-[560px]:px-4 " +
        (border ? "border-l border-[#edf0f4] max-[560px]:border-l-0 max-[560px]:border-t" : "")
      }
    >
      <span className="grid size-8 place-items-center rounded-lg bg-[#f0f4f9] text-[#6380a7]">
        <Icon size={16} />
      </span>
      <div>
        <span className="block text-[10px] font-bold uppercase tracking-[.07em] text-[#8b98aa]">{label}</span>
        <strong className="block text-[13px] text-[#425674]">{value}</strong>
      </div>
    </div>
  );
}
function Activity({
  icon: Icon,
  tone: color,
  title,
  time,
}: {
  icon: typeof Link2;
  tone: keyof typeof tone;
  title: string;
  time: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#edf0f4] py-4 last:border-b-0">
      <span className={"grid size-8 place-items-center rounded-lg " + tone[color]}>
        <Icon size={15} />
      </span>
      <div>
        <strong className="block text-[13px] text-[#415572]">{title}</strong>
        <span className="text-xs text-[#8995a7]">{time}</span>
      </div>
    </div>
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
function TaskPerformance() {
  const segments = [
    { name: "Completed", value: 25, color: "#0b51b7" },
    { name: "In progress", value: 35, color: "#6d81f5" },
    { name: "Pending", value: 40, color: "#e5e9ed" },
  ];
  return (
    <section className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Tasks performance</h2>
          <p className="mt-1 text-[11px] text-[#84909b]">Project setup and collection readiness</p>
        </div>
        <span className="rounded-[5px] border border-[#dce2e7] px-2 py-1 text-[10px] font-medium text-[#657382]">
          This project
        </span>
      </header>
      <div className="mt-2 grid grid-cols-[150px_1fr] items-center max-[520px]:grid-cols-[130px_1fr]">
        <div className="relative h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={segments} dataKey="value" innerRadius={50} outerRadius={67} paddingAngle={2} stroke="none">
                {segments.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid text-center pointer-events-none place-content-center">
            <strong className="text-[21px] text-[#1d2a38]">25%</strong>
            <span className="text-[10px] text-[#84909b]">complete</span>
          </div>
        </div>
        <div className="flex flex-col gap-[10px]">
          {segments.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-[11px] text-[#667481]">
              <span className="flex items-center gap-[6px]">
                <i className="size-[7px] rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <strong className="text-[#253342]">{item.value}%</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-[#edf0f2]">
        <div className="w-1/4 h-full rounded-full bg-brand" />
      </div>
      <p className="mb-0 mt-2 text-[10px] text-[#87939f]">1 of 4 workflow stages completed</p>
    </section>
  );
}

function ProjectProgress({
  project,
}: {
  project: { name: string; kobo_form_name?: string | null; start_date?: string | null; end_date?: string | null };
}) {
  const stages = ["Planning", "Design", "Collection", "Review"];
  const currentStage = project.kobo_form_name ? 1 : 0;
  return (
    <section className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
      <header className="flex items-center justify-between border-b border-[#edf0f2] pb-3">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Project progress</h2>
          <p className="mb-0 mt-1 text-[11px] text-[#84909b]">Collection readiness and delivery timeline</p>
        </div>
        <span className="size-3 rounded-full bg-[#20b889]" />
      </header>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
            <Building2 size={19} />
          </span>
          <div>
            <strong className="block text-[14px] text-[#253342]">{project.name}</strong>
            <span className="text-[11px] text-[#71809a]">
              {project.kobo_form_name ? "Kobo form connected" : "Set up your Kobo form"}
            </span>
          </div>
        </div>
        <div className="text-right text-[11px] leading-6 text-[#64758b]">
          <div>
            Start: <strong className="font-medium text-[#405572]">{date(project.start_date ?? null)}</strong>
          </div>
          <div>
            Deadline: <strong className="font-medium text-[#405572]">{date(project.end_date ?? null)}</strong>
          </div>
        </div>
      </div>
      <div className="relative grid grid-cols-4 mt-7">
        {stages.map((stage, index) => (
          <div key={stage} className="relative z-[1] text-center">
            <span
              className={
                (index <= currentStage
                  ? "border-brand bg-brand text-white"
                  : "border-[#dce4ed] bg-white text-[#93a1b2]") +
                " mx-auto grid size-7 place-items-center rounded-full border text-[11px] font-semibold"
              }
            >
              {index + 1}
            </span>
            <span className="mt-2 block text-[10px] font-semibold uppercase text-[#53657a]">{stage}</span>
            {index < stages.length - 1 && (
              <i
                className={
                  (index < currentStage ? "bg-brand" : "bg-[#dce4ed]") +
                  " absolute left-[calc(50%+14px)] top-[13px] h-px w-[calc(100%-28px)]"
                }
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-[11px] text-[#71809a]">
          <span>Project setup progress</span>
          <strong className="text-[#0b51b7]">{currentStage === 1 ? "40% complete" : "20% complete"}</strong>
        </div>
        <div className="h-[4px] overflow-hidden rounded-full bg-[#edf0f2]">
          <div className="h-full rounded-full bg-[#6d81f5]" style={{ width: currentStage === 1 ? "40%" : "20%" }} />
        </div>
      </div>
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f2] pt-3 text-[11px] text-[#71809a]">
        <span>{project.kobo_form_name ? "Ready to begin field collection" : "Connect a form to continue setup"}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-semibold text-[#0b51b7]"
        >
          Manage setup <ArrowUpRight size={13} />
        </button>
      </footer>
    </section>
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
function ProjectActivity({ projectName, hasForm }: { projectName: string; hasForm: boolean }) {
  const entries = [
    {
      label: hasForm ? "Kobo form connected" : "Project created",
      detail: projectName,
      time: "Project setup",
      color: "bg-[#e8f6f4] text-[#0b51b7]",
    },
    {
      label: "Collection plan updated",
      detail: "Targets and field readiness",
      time: "Planning",
      color: "bg-[#edf3fc] text-[#4d7fc6]",
    },
    {
      label: "Quality checks ready",
      detail: "Review queue will activate with submissions",
      time: "Data quality",
      color: "bg-[#f0edfa] text-[#7868b8]",
    },
  ];
  return (
    <section className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
      <header className="flex items-center justify-between border-b border-[#edf0f2] pb-3">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">Activity</h2>
          <p className="mb-0 mt-1 text-[11px] text-[#84909b]">Latest project updates</p>
        </div>
        <button
          type="button"
          className="rounded-[5px] border border-[#dce2e7] bg-white px-2 py-1 text-[10px] font-medium text-[#657382]"
        >
          All
        </button>
      </header>
      <div className="mt-1">
        {entries.map((entry, index) => (
          <div className="relative flex gap-3 py-3 last:pb-0" key={entry.label}>
            <span className={"relative z-[1] grid size-8 shrink-0 place-items-center rounded-full " + entry.color}>
              <Clock3 size={15} />
            </span>
            {index < entries.length - 1 && (
              <i className="absolute left-4 top-11 h-[22px] border-l border-dashed border-[#d6dee8]" />
            )}
            <div className="flex-1 min-w-0">
              <strong className="block text-[12px] text-[#354966]">{entry.label}</strong>
              <span className="block truncate text-[11px] text-[#71809a]">{entry.detail}</span>
            </div>
            <time className="shrink-0 text-[10px] text-[#8a96a7]">{entry.time}</time>
          </div>
        ))}
      </div>
    </section>
  );
}
