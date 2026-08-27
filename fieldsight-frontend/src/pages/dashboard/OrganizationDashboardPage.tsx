import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  FileCheck2,
  FolderCheck,
  MapPinned,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  UsersRound,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import { SubmissionActivityPanel } from "../../components/dashboard/SubmissionActivityPanel";
import { apiClient } from "../../services/apiClient";

const statIconToneStyles = {
  blue: "bg-[#edf3fc] text-[#4d7fc6]",
  teal: "bg-[#e8f6f4] text-[#0b51b7]",
  violet: "bg-[#f0edfa] text-[#7868b8]",
  amber: "bg-[#fff3e5] text-[#d88935]",
} as const;

const changeToneStyles = {
  up: "text-[#0b51b7]",
  down: "text-[#c95660]",
} as const;

const avatarToneStyles = {
  teal: "bg-[#e4f4f1] text-[#0b51b7]",
  amber: "bg-[#fff0df] text-[#c57a2c]",
  blue: "bg-[#e9f0fa] text-[#4d7fc6]",
  violet: "bg-[#eeeafa] text-[#7564b2]",
} as const;

const alertToneStyles = {
  red: "bg-[#fcebee] text-[#ca5560]",
  amber: "bg-[#fff2e3] text-[#d48431]",
  blue: "bg-[#eaf1fb] text-[#4d7fc6]",
} as const;

const selectStyles =
  "inline-flex h-[36px] items-center gap-[6px] rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[#546271] max-[600px]:min-w-0 max-[600px]:w-full";
const selectInputStyles =
  "max-w-[170px] appearance-none border-0 bg-transparent font-sans text-[12px] font-medium leading-[normal] text-[#425162] outline-none max-[600px]:min-w-0 max-[600px]:flex-1 max-[600px]:max-w-none";
const periodButtonStyles =
  "inline-flex items-center gap-[6px] rounded-[5px] border-0 bg-transparent px-px py-1 font-sans text-[12px] font-medium leading-[normal] text-[#546271]";
const textButtonStyles =
  "inline-flex items-center gap-[6px] rounded-[5px] border-0 bg-transparent font-sans text-[11px] font-semibold leading-[normal] text-[#0b51b7]";

const periodLabels: Record<string, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };

function relativeTime(value: string | null | undefined) {
  if (!value) return "never";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "KS";
}
function StatCard({
  label,
  value,
  change,
  direction,
  icon: Icon,
  tone,
  note,
  onClick,
}: {
  label: string;
  value: string;
  change?: string;
  direction: "up" | "down";
  icon: typeof Database;
  tone: keyof typeof statIconToneStyles;
  note: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="relative grid w-full cursor-pointer grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309] focus-visible:[outline:3px_solid_#0b51b730] focus-visible:outline-offset-2"
      onClick={onClick}
    >
      <div className={`row-[1/3] grid size-[40px] place-items-center rounded-full ${statIconToneStyles[tone]}`}>
        <Icon size={19} />
      </div>
      <div>
        <span className="block text-[11px] font-medium text-[#6f7d8a]">{label}</span>
        <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">{value}</strong>
      </div>
      {change && (
        <div
          className={`flex items-center self-start gap-[2px] text-[11px] font-semibold ${changeToneStyles[direction]}`}
        >
          {direction === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {change}
        </div>
      )}
      <small className="col-[2/4] mt-[6px] text-[10px] text-[#88939d]">{note}</small>
    </button>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] ${className}`}>
      <header className="flex !h-auto items-start justify-between !border-0 !bg-transparent !p-0">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">{title}</h2>
          {subtitle && <p className="mt-1 text-[11px] text-[#84909b]">{subtitle}</p>}
        </div>
        {action ?? (
          <button
            className="inline-flex items-center gap-[6px] rounded-[5px] border-0 bg-transparent p-[2px] font-sans text-[12px] font-medium leading-[normal] text-[#87929d]"
            aria-label={`More options for ${title}`}
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function CalendarPanel() {
  const [month, setMonth] = useState(() => new Date(2026, 7, 1));
  const [selectedDay, setSelectedDay] = useState(26);
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function moveMonth(direction: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
    setSelectedDay(1);
  }

  return (
    <Panel title="Calendar">
      <div className="mt-3 border border-[#edf0f5] bg-white p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            className="grid size-7 place-items-center border-0 bg-transparent text-[#9aa7b8] hover:text-[#0b51b7]"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft size={19} />
          </button>
          <strong className="text-[12px] text-[#303e67]">{monthLabel}</strong>
          <button
            type="button"
            className="grid size-7 place-items-center border-0 bg-transparent text-[#9aa7b8] hover:text-[#0b51b7]"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[10px]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day} className="py-1 font-medium text-[#0b51b7]">
              {day}
            </span>
          ))}
          {calendarCells.map((day, index) =>
            day ? (
              <button
                key={`${monthLabel}-${day}`}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`mx-auto grid size-7 place-items-center rounded-[3px] text-[11px] transition-colors ${selectedDay === day ? "bg-[#edf3fc] font-semibold text-[#0b51b7]" : "text-[#384a65] hover:bg-[#f1f5fa]"}`}
              >
                {day}
              </button>
            ) : (
              <span key={`blank-${index}`} className="size-7" aria-hidden="true" />
            ),
          )}
        </div>
      </div>
    </Panel>
  );
}
export function OrganizationDashboardPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const [period, setPeriod] = useState("7d");
  const [location, setLocation] = useState("");
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(organizationId),
  });
  const overviewQuery = useQuery({
    queryKey: ["organization-overview", projectId, location, period],
    queryFn: () => apiClient.analyticsOverview({
      projectId: projectId || undefined,
      location: location || undefined,
      period,
    }),
  });
  const overview = overviewQuery.data;
  const enumeratorsQuery = useQuery({ queryKey: ["organization-enumerators"], queryFn: apiClient.enumerators });
  const activeEnumeratorCount = (enumeratorsQuery.data ?? []).filter((enumerator) => enumerator.is_active).length;
  const enumeratorTotal = (enumeratorsQuery.data ?? []).length;
  if (overviewQuery.isLoading)
    return (
      <div className="rounded-[10px] bg-white p-[60px] text-center text-[#758092]">Loading organization dashboard…</div>
    );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="mb-[2px] flex items-end justify-between max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[14px]">
        <div>
          <p className="!mb-[5px] !mt-0 !text-[10px] !font-bold !tracking-[.09em] !text-[#0b51b7]">
            ORGANIZATION OVERVIEW
          </p>
          <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px] !text-[#1d2a38]">
            Collection dashboard
          </h1>
          <p className="mb-0 mt-[6px] text-[13px] text-[#73808d]">
            {projectId ? projectsQuery.data?.find((item) => item.id === projectId)?.name ?? "Selected project" : "All projects"} · {location || "All locations"} · {periodLabels[period]}
          </p>
        </div>
        <div className="flex gap-[7px] max-[900px]:items-center max-[700px]:w-full max-[700px]:flex-wrap max-[600px]:grid max-[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[600px]:gap-[6px] ">
          <label className={selectStyles}>
            <FolderCheck size={15} />
            <select
              className={selectInputStyles}
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              aria-label="Filter dashboard by project"
            >
              <option value="">All projects</option>
              {(projectsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none" size={14} />
          </label>
          <label className={selectStyles}>
            <MapPinned size={15} />
            <select
              className={selectInputStyles}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              aria-label="Filter dashboard by location"
            >
              <option value="">All locations</option>
              {(overview?.available_locations ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <ChevronDown className="pointer-events-none" size={14} />
          </label>
          <label className={selectStyles}>
            <CalendarDays size={15} />
            <select
              className={selectInputStyles}
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label="Filter dashboard by period"
            >
              <option value="7d">Last 7 days</option>
              <option value="today">Today</option>
              <option value="30d">Last 30 days</option>
            </select>
            <ChevronDown className="pointer-events-none" size={14} />
          </label>
          <button
            className="inline-flex h-[36px] items-center gap-[6px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] font-sans text-[12px] font-semibold leading-[normal] text-white max-[600px]:w-full max-[600px]:justify-center"
            onClick={() => navigate("/sync")}
          >
            <RefreshCw size={15} />
            Sync all
          </button>
        </div>
      </div>

      <section
        className="flex items-center gap-[11px] px-[2px] text-[11px] text-[#71808e] max-[900px]:flex-wrap max-[900px]:gap-[7px] [&_strong]:text-[#465667] [&_svg]:text-[#0b51b7]"
        aria-label="Data trust summary"
      >
        <span className="flex items-center gap-[5px] max-[600px]:w-full">
          <CheckCircle2 size={14} /> Data refreshed <strong>{relativeTime(overview?.last_synced_at)}</strong>
        </span>
        <i className="size-[3px] rounded-full bg-[#c4cbd2] max-[900px]:hidden" />
        <span className="flex items-center gap-[5px] max-[600px]:w-full">
          <FileCheck2 size={14} /> <strong>{(overview?.ready_this_week ?? 0).toLocaleString()} records</strong> became export-ready this week
        </span>
        <i className="size-[3px] rounded-full bg-[#c4cbd2] max-[900px]:hidden" />
        <span className="flex items-center gap-[5px] max-[600px]:w-full">
          <ShieldAlert size={14} /> <strong>{(overview?.blocked_records ?? 0).toLocaleString()} records</strong> blocked from export
        </span>
      </section>

      <div className="grid grid-cols-[repeat(4,1fr)] gap-[14px] max-[1100px]:grid-cols-[repeat(2,1fr)] max-[700px]:grid-cols-[1fr]">
        <StatCard
          label="Total submissions"
          value={(overview?.total_submissions ?? 0).toLocaleString()}
          change={overview?.submission_change_percent == null ? undefined : `${Math.abs(overview.submission_change_percent)}%`}
          direction={(overview?.submission_change_percent ?? 0) >= 0 ? "up" : "down"}
          icon={Database}
          tone="blue"
          note="Imported Kobo records"
        />
        <StatCard
          label="Active projects"
          value={String(overview?.active_projects ?? 0)}
          direction="up"
          icon={FolderCheck}
          tone="teal"
          note="Projects currently active"
        />
        <StatCard
          label="Active enumerators"
          value={String(activeEnumeratorCount)}
          direction="up"
          icon={UsersRound}
          tone="violet"
          note={`of ${enumeratorTotal} organization enumerators`}
        />
        <StatCard
          label="Needs review"
          value={(overview?.needs_review ?? 0).toLocaleString()}
          direction="down"
          icon={ShieldAlert}
          tone="amber"
          note="Records requiring review"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1.85fr)_minmax(300px,.85fr)] gap-[14px] max-[1100px]:grid-cols-[1fr]">
        <SubmissionActivityPanel data={overview?.trend} subtitle="Imported and ready Kobo records over time" />
        <CalendarPanel />
      </div>

      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)] gap-[14px] max-[1100px]:grid-cols-[1fr]">
        <Panel
          title="Project progress"
          subtitle="Actual submissions against planned sample"
          action={
            <button className={textButtonStyles} onClick={() => navigate("/projects")}>
              All projects <ExternalLink size={13} />
            </button>
          }
        >
          <div className="mt-[16px] h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.projects ?? []} layout="vertical" margin={{ top: 0, right: 18, left: 28, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#edf0f2" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#87929d" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={105}
                  tick={{ fontSize: 11, fill: "#526171" }}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e5e8ec",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="target" fill="#e8edf1" radius={[0, 3, 3, 0]} barSize={12} />
                <Bar dataKey="actual" fill="#0b51b7" radius={[0, 3, 3, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Collection health"
          subtitle="Live operational signals"
          action={
            <span className="flex items-center gap-[5px] text-[10px] font-semibold text-[#0b51b7]">
              <i className="size-[6px] rounded-full bg-[#0b51b7] shadow-[0_0_0_3px_#0b51b722]" /> Live
            </span>
          }
        >
          <div className="mt-[10px] flex flex-col">
            <div className="flex items-center gap-[10px] border-b border-[#edf0f2] py-[11px]">
              <span className="grid size-[34px] place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]"><CheckCircle2 size={17} /></span>
              <p className="m-0">
                <strong className="block text-[12px]">{overview?.collection_health.healthy_sources ?? 0} healthy source{overview?.collection_health.healthy_sources === 1 ? "" : "s"}</strong>
                <small className="mt-[2px] block text-[10px] text-[#84909b]">{overview?.collection_health.connected_sources ?? 0} Kobo project source{overview?.collection_health.connected_sources === 1 ? "" : "s"} connected</small>
              </p>
            </div>
            <div className="flex items-center gap-[10px] border-b border-[#edf0f2] py-[11px]">
              <span className="grid size-[34px] place-items-center rounded-full bg-[#fff3e5] text-[#d88935]"><Clock3 size={17} /></span>
              <p className="m-0">
                <strong className="block text-[12px]">{overview?.collection_health.delayed_sources ?? 0} delayed source{overview?.collection_health.delayed_sources === 1 ? "" : "s"}</strong>
                <small className="mt-[2px] block text-[10px] text-[#84909b]">Last successful sync {relativeTime(overview?.last_synced_at)}</small>
              </p>
            </div>
            <div className="flex items-center gap-[10px] border-0 py-[11px]">
              <span className="grid size-[34px] place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]"><FileCheck2 size={17} /></span>
              <p className="m-0">
                <strong className="block text-[12px]">{(overview?.ready_records ?? 0).toLocaleString()} export-ready</strong>
                <small className="mt-[2px] block text-[10px] text-[#84909b]">Ready in the current dashboard view</small>
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-[14px] max-[700px]:grid-cols-[1fr]">
        <Panel title="Recent field activity" subtitle="Latest imported Kobo submissions">
          <div className="mt-[9px]">
            {(overview?.activity ?? []).map((item) => (
              <div className="flex gap-[10px] border-b border-[#edf0f2] py-[10px] last:border-0" key={item.id}>
                <span className={`grid size-[30px] flex-[0_0_30px] place-items-center rounded-full text-[9px] font-bold ${avatarToneStyles.teal}`}>
                  {initials(item.name)}
                </span>
                <p className="m-0 text-[11px] leading-[1.45] text-[#667481]">
                  <strong className="text-[#253342]">{item.name}</strong> {item.detail}
                  {item.location && <span> in {item.location}</span>}
                  <small className="mt-[2px] block text-[9px] text-[#9aa3ac]">{relativeTime(item.occurred_at)}</small>
                </p>
              </div>
            ))}
            {!overview?.activity.length && <p className="m-0 py-8 text-center text-[11px] text-[#84909b]">No submission activity for this view.</p>}
          </div>
        </Panel>

        <Panel
          title="Requires attention"
          subtitle="Exceptions derived from the current dashboard view"
          action={<button className={textButtonStyles} onClick={() => navigate("/quality")}>View all <ExternalLink size={13} /></button>}
        >
          <div className="mt-[9px]">
            {(overview?.alerts ?? []).map((item) => {
              const Icon = item.kind === "sync" ? Wifi : ShieldAlert;
              const toneClass = item.kind === "invalid" ? alertToneStyles.red : item.kind === "sync" ? alertToneStyles.amber : alertToneStyles.blue;
              return (
                <div className="flex items-center gap-[10px] border-b border-[#edf0f2] py-[11px] last:border-0" key={`${item.kind}-${item.title}`}>
                  <span className={`grid size-[32px] flex-[0_0_32px] place-items-center rounded-[5px] ${toneClass}`}><Icon size={17} /></span>
                  <p className="m-0 flex-1">
                    <strong className="block text-[11px] text-[#253342]">{item.title}</strong>
                    <small className="mt-[2px] block text-[10px] text-[#84909b]">{item.text}</small>
                  </p>
                  <button className="border-0 bg-transparent font-sans text-[10px] font-semibold text-[#0b51b7]" onClick={() => navigate(item.path)}>View</button>
                </div>
              );
            })}
            {!overview?.alerts.length && <p className="m-0 py-8 text-center text-[11px] text-[#84909b]">No records or sources currently require attention.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
