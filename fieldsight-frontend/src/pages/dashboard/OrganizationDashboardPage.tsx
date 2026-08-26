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

const submissionTrend = [
  { day: "Aug 13", submissions: 246, approved: 218 },
  { day: "Aug 14", submissions: 310, approved: 279 },
  { day: "Aug 15", submissions: 284, approved: 260 },
  { day: "Aug 16", submissions: 372, approved: 331 },
  { day: "Aug 17", submissions: 341, approved: 308 },
  { day: "Aug 18", submissions: 448, approved: 402 },
  { day: "Today", submissions: 516, approved: 461 },
];

const projectPerformance = [
  { name: "Community Health", actual: 1842, target: 2560 },
  { name: "Maternal Health", actual: 3104, target: 3700 },
  { name: "Youth Employment", actual: 2716, target: 4400 },
  { name: "Water Access", actual: 986, target: 2050 },
];

const qualityData = [
  { name: "Approved", value: 82, color: "#0b51b7" },
  { name: "On hold", value: 11, color: "#f0a34a" },
  { name: "Rejected", value: 4, color: "#d85d67" },
  { name: "Unreviewed", value: 3, color: "#dce3e8" },
];

const activity = [
  {
    initials: "MK",
    name: "Mary Kamara",
    detail: "submitted 18 records in Paynesville",
    time: "6 min ago",
    tone: "teal",
  },
  {
    initials: "JT",
    name: "James Thompson",
    detail: "had 4 interviews placed on hold",
    time: "24 min ago",
    tone: "amber",
  },
  {
    initials: "SD",
    name: "Sarah Dolo",
    detail: "completed the Congo Town assignment",
    time: "51 min ago",
    tone: "blue",
  },
  {
    initials: "DN",
    name: "David Nyan",
    detail: "synced 12 offline submissions",
    time: "1 hr ago",
    tone: "violet",
  },
] as const;

const alerts = [
  {
    icon: ShieldAlert,
    title: "24 high-severity issues",
    text: "Duration and GPS checks need review",
    action: "Review queue",
    tone: "red",
  },
  {
    icon: Wifi,
    title: "1 source needs attention",
    text: "Water Point Census sync is delayed",
    action: "View sync",
    tone: "amber",
  },
  {
    icon: MapPinned,
    title: "3 locations below target",
    text: "Less than 60% of planned interviews",
    action: "View coverage",
    tone: "blue",
  },
] as const;

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
  change: string;
  direction: "up" | "down";
  icon: typeof Database;
  tone: keyof typeof statIconToneStyles;
  note: string;
  onClick: () => void;
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
      <div
        className={`flex items-center self-start gap-[2px] text-[11px] font-semibold ${changeToneStyles[direction]}`}
      >
        {direction === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {change}
      </div>
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

export function OrganizationDashboardPage() {
  const navigate = useNavigate();
  const [project, setProject] = useState("All projects");
  const [period, setPeriod] = useState("Last 7 days");
  const [location, setLocation] = useState("All locations");
  const { isLoading } = useQuery({
    queryKey: ["organization-overview"],
    queryFn: async () => new Promise((resolve) => setTimeout(() => resolve(true), 180)),
  });
  if (isLoading)
    return (
      <div className="rounded-[10px] bg-white p-[60px] text-center text-[#758092]">Loading organization dashboard…</div>
    );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="mb-[2px] flex items-end justify-between max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[14px]">
        <div>
          <p className="!mb-[5px] !mt-0 !text-[10px] !font-bold !tracking-[.09em] !text-[#0b51b7]">
            COMMUNITY HEALTH INITIATIVE
          </p>
          <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px] !text-[#1d2a38]">
            Collection dashboard
          </h1>
          <p className="mb-0 mt-[6px] text-[13px] text-[#73808d]">
            {project} · {location} · {period}
          </p>
        </div>
        <div className="flex gap-[7px] max-[900px]:items-center max-[700px]:w-full max-[700px]:flex-wrap max-[600px]:grid max-[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[600px]:gap-[6px] ">
          <label className={selectStyles}>
            <FolderCheck size={15} />
            <select
              className={selectInputStyles}
              value={project}
              onChange={(event) => setProject(event.target.value)}
              aria-label="Filter dashboard by project"
            >
              <option>All projects</option>
              <option>Community Health Assessment</option>
              <option>Maternal Health Survey</option>
              <option>Youth Employment Study</option>
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
              <option>All locations</option>
              <option>Montserrado</option>
              <option>Bong County</option>
              <option>Paynesville</option>
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
              <option>Last 7 days</option>
              <option>Today</option>
              <option>Last 30 days</option>
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
          <CheckCircle2 size={14} />
          Data refreshed <strong>8 min ago</strong>
        </span>
        <i className="size-[3px] rounded-full bg-[#c4cbd2] max-[900px]:hidden" />
        <span className="flex items-center gap-[5px] max-[600px]:w-full">
          <FileCheck2 size={14} />
          <strong>1,192 records</strong> became export-ready this week
        </span>
        <i className="size-[3px] rounded-full bg-[#c4cbd2] max-[900px]:hidden" />
        <span className="flex items-center gap-[5px] max-[600px]:w-full">
          <ShieldAlert size={14} />
          <strong>149 records</strong> blocked from export
        </span>
      </section>

      <div className="grid grid-cols-[repeat(4,1fr)] gap-[14px] max-[1100px]:grid-cols-[repeat(2,1fr)] max-[700px]:grid-cols-[1fr]">
        <StatCard
          label="Total submissions"
          value="10,284"
          change="12.4%"
          direction="up"
          icon={Database}
          tone="blue"
          note="1,306 received this week"
        />
        <StatCard
          label="Active projects"
          value="4"
          change="1"
          direction="up"
          icon={FolderCheck}
          tone="teal"
          note="7 projects in the portfolio"
        />
        <StatCard
          label="Active enumerators"
          value="28"
          change="3"
          direction="up"
          icon={UsersRound}
          tone="violet"
          note="of 33 assigned today"
        />
        <StatCard
          label="Needs review"
          value="421"
          change="31"
          direction="down"
          icon={ShieldAlert}
          tone="amber"
          note="149 blocking export"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1.85fr)_minmax(300px,.85fr)] gap-[14px] max-[1100px]:grid-cols-[1fr]">
        <Panel
          title="Submission activity"
          subtitle="Incoming and approved records across active projects"
          action={
            <button className={textButtonStyles} onClick={() => navigate("/submissions")}>
              View submissions <ExternalLink size={13} />
            </button>
          }
        >
          <div className="flex h-[24px] justify-end gap-[14px] pt-[5px] text-[10px] text-[#788591]">
            <span className="flex items-center gap-[5px]">
              <i className="size-[7px] rounded-full bg-[#0b51b7]" />
              Submitted
            </span>
            <span className="flex items-center gap-[5px]">
              <i className="size-[7px] rounded-full bg-[#6d81f5]" />
              Approved
            </span>
          </div>
          <div className="h-[235px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={submissionTrend} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="submittedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#0b51b7" stopOpacity=".22" />
                    <stop offset="1" stopColor="#0b51b7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#7d8996", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9aa4ae", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e5e8ec",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="submissions"
                  stroke="#0b51b7"
                  strokeWidth={2.4}
                  fill="url(#submittedFill)"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  stroke="#6d81f5"
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray="4 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Review status"
          subtitle="Current submission decisions"
          action={
            <button className={periodButtonStyles}>
              This week
              <ChevronDown size={13} />
            </button>
          }
        >
          <div className="mt-3 grid grid-cols-[160px_1fr] items-center max-[700px]:grid-cols-[140px_1fr]">
            <div className="relative size-[155px] max-[700px]:size-[135px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={qualityData}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={74}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {qualityData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid text-center pointer-events-none place-content-center">
                <strong className="block text-[21px]">87.2%</strong>
                <span className="text-[10px] text-[#84909b]">approved</span>
              </div>
            </div>
            <div className="flex flex-col gap-[9px]">
              {qualityData.map((item) => (
                <div className="flex justify-between text-[11px] text-[#667481]" key={item.name}>
                  <span className="flex items-center gap-[6px]">
                    <i className="size-[7px] rounded-full" style={{ background: item.color }} />
                    {item.name}
                  </span>
                  <strong className="text-[#253342]">{item.value}%</strong>
                </div>
              ))}
            </div>
          </div>
          <button
            className="mt-[8px] flex w-full items-center gap-[7px] rounded-[5px] border border-[#f0dcc3] bg-[#fff8ed] px-[10px] py-[9px] font-sans text-[11px] font-semibold leading-[normal] text-[#9b642f]"
            onClick={() => navigate("/quality")}
          >
            <ShieldAlert size={15} />
            Open quality review queue <span className="ml-auto rounded-[10px] bg-[#f6e5cf] px-[7px] py-[2px]">421</span>
          </button>
        </Panel>
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
              <BarChart data={projectPerformance} layout="vertical" margin={{ top: 0, right: 18, left: 28, bottom: 0 }}>
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
              <i className="size-[6px] rounded-full bg-[#0b51b7] shadow-[0_0_0_3px_#0b51b722]" />
              Live
            </span>
          }
        >
          <div className="mt-[10px] flex flex-col">
            <div className="flex items-center gap-[10px] border-b border-[#edf0f2] py-[11px]">
              <span className="grid size-[34px] place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]">
                <CheckCircle2 size={17} />
              </span>
              <p className="m-0">
                <strong className="block text-[12px]">3 sources healthy</strong>
                <small className="mt-[2px] block text-[10px] text-[#84909b]">Last checked 8 minutes ago</small>
              </p>
            </div>
            <div className="flex items-center gap-[10px] border-b border-[#edf0f2] py-[11px]">
              <span className="grid size-[34px] place-items-center rounded-full bg-[#fff3e5] text-[#d88935]">
                <Clock3 size={17} />
              </span>
              <p className="m-0">
                <strong className="block text-[12px]">1 delayed source</strong>
                <small className="mt-[2px] block text-[10px] text-[#84909b]">Water Point Census · 18 hours</small>
              </p>
            </div>
            <div className="flex items-center gap-[10px] border-0 py-[11px]">
              <span className="grid size-[34px] place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
                <FileCheck2 size={17} />
              </span>
              <p className="m-0">
                <strong className="block text-[12px]">1,192 export-ready</strong>
                <small className="mt-[2px] block text-[10px] text-[#84909b]">Approved since Monday</small>
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-[14px] max-[700px]:grid-cols-[1fr]">
        <Panel
          title="Recent field activity"
          subtitle="Latest enumerator and synchronization events"
          action={
            <button className={periodButtonStyles}>
              All activity
              <ChevronDown size={13} />
            </button>
          }
        >
          <div className="mt-[9px]">
            {activity.map((item) => (
              <div className="flex gap-[10px] border-b border-[#edf0f2] py-[10px] last:border-0" key={item.name}>
                <span
                  className={`grid size-[30px] flex-[0_0_30px] place-items-center rounded-full text-[9px] font-bold ${avatarToneStyles[item.tone]}`}
                >
                  {item.initials}
                </span>
                <p className="m-0 text-[11px] leading-[1.45] text-[#667481]">
                  <strong className="text-[#253342]">{item.name}</strong> {item.detail}
                  <small className="mt-[2px] block text-[9px] text-[#9aa3ac]">{item.time}</small>
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Requires attention"
          subtitle="Exceptions ordered by operational impact"
          action={
            <button className={textButtonStyles} onClick={() => navigate("/quality")}>
              View all <ExternalLink size={13} />
            </button>
          }
        >
          <div className="mt-[9px]">
            {alerts.map(({ icon: Icon, ...item }, index) => (
              <div
                className="flex items-center gap-[10px] border-b border-[#edf0f2] py-[11px] last:border-0"
                key={item.title}
              >
                <span
                  className={`grid size-[32px] flex-[0_0_32px] place-items-center rounded-[5px] ${alertToneStyles[item.tone]}`}
                >
                  <Icon size={17} />
                </span>
                <p className="flex-1 m-0">
                  <strong className="block text-[11px] text-[#253342]">{item.title}</strong>
                  <small className="mt-[2px] block text-[10px] text-[#84909b]">{item.text}</small>
                </p>
                <button
                  className="border-0 bg-transparent font-sans text-[10px] font-semibold leading-[normal] text-[#0b51b7]"
                  onClick={() => navigate(index === 0 ? "/quality" : index === 1 ? "/sync" : "/analytics")}
                >
                  {item.action}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
