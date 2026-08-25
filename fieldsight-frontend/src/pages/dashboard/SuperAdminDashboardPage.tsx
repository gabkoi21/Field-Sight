import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Database,
  ExternalLink,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminStatus } from "../../components/superadmin/AdminUi";
import { apiClient } from "../../services/apiClient";
import {
  adoptionGrowth,
  adoptionMonths,
  auditEvents,
} from "../superadmin/data";

const iconTones = {
  blue: "bg-[#edf3fc] text-[#4d7fc6]",
  teal: "bg-[#e8f6f4] text-[#0b51b7]",
  violet: "bg-[#f0edfa] text-[#7868b8]",
  amber: "bg-[#fff3e5] text-[#d88935]",
} as const;
const controlStyles =
  "inline-flex h-[36px] items-center gap-[6px] rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[#546271]";
const buttonStyles =
  "inline-flex h-[36px] items-center gap-[6px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] font-sans text-[12px] font-semibold leading-[normal] text-white";
const textButtonStyles =
  "inline-flex items-center gap-[6px] rounded-[5px] border-0 bg-transparent p-[2px] font-sans text-[11px] font-semibold leading-[normal] text-[#0b51b7]";
const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1);
const platformReviewData = [
  { name: "Approved", value: 82, color: "#0b51b7" },
  { name: "On hold", value: 11, color: "#f0a34a" },
  { name: "Rejected", value: 4, color: "#d85d67" },
  { name: "Unreviewed", value: 3, color: "#dce3e8" },
];

const adoptionData = adoptionMonths.map((month, index) => ({
  month,
  users: adoptionGrowth[index],
  engaged: Math.round(adoptionGrowth[index] * 0.86),
}));

function MetricCard({
  label,
  value,
  change,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  detail: string;
  icon: typeof Database;
  tone: keyof typeof iconTones;
}) {
  return (
    <article className="relative grid w-full grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left">
      <span
        className={
          "row-[1/3] grid size-[40px] place-items-center rounded-full " +
          iconTones[tone]
        }
      >
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-[11px] font-medium text-[#6f7d8a]">
          {label}
        </span>
        <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">
          {value}
        </strong>
      </span>
      <span className="flex items-center gap-[2px] self-start text-[11px] font-semibold text-[#0b51b7]">
        <ArrowUpRight size={14} /> {change}
      </span>
      <small className="col-[2/4] mt-[6px] text-[10px] text-[#88939d]">
        {detail}
      </small>
    </article>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[6px] border border-[#e5e9ed] bg-white p-[17px]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">
            {title}
          </h2>
          {subtitle && (
            <p className="mb-0 mt-1 text-[11px] text-[#84909b]">{subtitle}</p>
          )}
        </div>
        {action ?? <MoreHorizontal className="text-[#87929d]" size={18} />}
      </header>
      {children}
    </section>
  );
}
export function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { data: apiOrganizations = [], isLoading: organizationsLoading } =
    useQuery({
      queryKey: ["platform-organizations"],
      queryFn: apiClient.organizations,
    });
  const { data: apiUsers = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["platform-users"],
    queryFn: apiClient.users,
  });  const statusQuery = useQuery({
    queryKey: ["health", "status"],
    queryFn: apiClient.status,
    refetchInterval: 30_000,
  });
  const organizations = apiOrganizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    initials: organization.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase(),
    ownerEmail: organization.owner_email ?? "—",
    country: organization.country ?? "—",
    status: organization.is_active ? "Active" : "Suspended",
    activity: new Date(organization.created_at).toLocaleDateString(),
  }));
  const activeOrganizationCount = apiOrganizations.filter(
    (organization) => organization.is_active,
  ).length;
  const platformHealthy = statusQuery.data?.status === "ok";
  const platformUsers = apiUsers.filter(
    (user) => user.platform_role !== "super_admin",
  );
  const activeUserCount = platformUsers.filter((user) => user.is_active).length;
  const [period, setPeriod] = useState("This month");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(19);
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="mb-[2px] flex items-end justify-between max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[14px]">
        <div>
          <p className="!mb-[5px] !mt-0 !text-[10px] !font-bold !tracking-[.09em] !text-[#0b51b7]">
            FIELDSIGHT PLATFORM
          </p>
          <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px] !text-[#1d2a38]">
            Platform dashboard
          </h1>
          <p className="mb-0 mt-[6px] text-[13px] text-[#73808d]">
            Global usage, platform health, security, and subscription
            performance
          </p>
        </div>
        <div className="flex gap-[7px] max-[700px]:w-full max-[600px]:grid max-[600px]:grid-cols-2">
          <div className="relative">
            <div className={controlStyles}>
              <button
                type="button"
                onClick={() => setCalendarOpen((open) => !open)}
                className="grid place-items-center border-0 bg-transparent p-0 text-[#546271]"
                aria-label="Open calendar"
                aria-expanded={calendarOpen}
              >
                <CalendarDays size={15} />
              </button>
              <select
                className="appearance-none border-0 bg-transparent font-sans text-[12px] font-medium text-[#425162] outline-none"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Filter dashboard by period"
              >
                <option>This month</option>
                <option>Last 30 days</option>
                <option>This quarter</option>
              </select>
              <ChevronDown className="pointer-events-none" size={14} />
            </div>
            {calendarOpen && (
              <div className="absolute right-0 top-[43px] z-20 w-[254px] rounded-[8px] border border-[#e1e7ed] bg-white p-[13px] shadow-[0_12px_28px_rgba(16,42,67,.16)]">
                <div className="mb-[10px] flex items-center justify-between">
                  <strong className="text-[13px] text-[#253342]">
                    August 2026
                  </strong>
                  <span className="text-[11px] text-[#84909b]">
                    Choose a date
                  </span>
                </div>
                <div className="mb-[5px] grid grid-cols-7 text-center text-[10px] font-semibold text-[#96a1ad]">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <span key={`${day}-${index}`}>{day}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-[3px]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <i key={`blank-${index}`} />
                  ))}
                  {calendarDays.map((day) => (
                    <button
                      type="button"
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setCalendarOpen(false);
                        setPeriod(`Aug ${day}, 2026`);
                      }}
                      className={`grid h-[28px] place-items-center rounded-[5px] border-0 p-0 text-[11px] font-medium transition ${selectedDay === day ? "bg-[#0b51b7] text-white" : "bg-transparent text-[#526177] hover:bg-[#edf3fc]"}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            className={buttonStyles + " max-[600px]:justify-center"}
            onClick={() => navigate("/superadmin/organizations?create=1")}
          >
            <Plus size={15} /> Add organization
          </button>
        </div>
      </div>
      <section className="flex items-center gap-[12px] rounded-[6px] border border-[#f0d8b8] bg-[#fffbf4] px-[15px] py-[13px] max-[900px]:flex-wrap max-[900px]:items-start">
        <span className="grid size-[34px] place-items-center rounded-full bg-[#fff0dc] text-[#ca792b]">
          <ShieldAlert size={19} />
        </span>
        <div className="flex-1">
          <strong className="block text-[13px] text-[#4b3825]">
            {platformHealthy
              ? "Platform operations are healthy"
              : "Platform status is unavailable"}
          </strong>
          <p className="mb-0 mt-[3px] text-[12px] text-[#80664d]">
            {statusQuery.data
              ? `${statusQuery.data.service} ${statusQuery.data.api_version} · ${statusQuery.data.environment}`
              : "Waiting for the backend status API."}
          </p>
        </div>
        <div className="flex gap-[7px] max-[900px]:w-full max-[900px]:pl-[46px] max-[600px]:flex-wrap max-[600px]:pl-0">
          <button
            className="rounded-[5px] border border-[#ecd7ba] bg-white px-[9px] py-[7px] font-sans text-[11px] font-semibold text-[#965c26]"
            onClick={() => navigate("/superadmin/system")}
          >
            View system health
          </button>
          <button
            className="rounded-[5px] border border-[#ecd7ba] bg-white px-[9px] py-[7px] font-sans text-[11px] font-semibold text-[#965c26]"
            onClick={() => navigate("/superadmin/audit")}
          >
            Review audit log
          </button>
        </div>
      </section>
      <section className="flex items-center gap-[11px] px-[2px] text-[11px] text-[#71808e] max-[900px]:flex-wrap [&_strong]:text-[#465667] [&_svg]:text-[#0b51b7]">
        <span className="flex items-center gap-[5px]">
          <RefreshCw size={14} /> Data refreshed <strong>2 min ago</strong>
        </span>
        <i className="size-[3px] rounded-full bg-[#c4cbd2] max-[900px]:hidden" />
        <span className="flex items-center gap-[5px]">
          <CheckCircle2 size={14} />
          <strong>
            {organizationsLoading ? "…" : activeOrganizationCount} organizations
          </strong>{" "}
          are actively using FieldSight
        </span>
        <i className="size-[3px] rounded-full bg-[#c4cbd2] max-[900px]:hidden" />
        <span className="flex items-center gap-[5px]">
          <ShieldCheck size={14} />
          <strong>0 critical incidents</strong> in the last 24 hours
        </span>
      </section>
      <section className="grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        <MetricCard
          label="Organizations"
          value={String(apiOrganizations.length)}
          change="—"
          detail="loaded from the API"
          icon={Building2}
          tone="blue"
        />
        <MetricCard
          label="Platform users"
          value={usersLoading ? "�" : usersError ? "�" : platformUsers.length.toLocaleString()}
          change={usersLoading || usersError ? "�" : `${activeUserCount} active`}
          detail={
            usersLoading
              ? "Loading platform users�"
              : usersError
                ? "Unable to load platform users"
                : `${activeUserCount} active account${activeUserCount === 1 ? "" : "s"}`
          }
          icon={Users}
          tone="teal"
        />
        <MetricCard
          label="Monthly submissions"
          value="—"
          change="—"
          detail="Submission metrics API not available"
          icon={Database}
          tone="violet"
        />
        <MetricCard
          label="Monthly revenue"
          value="—"
          change="—"
          detail="Billing API not available"
          icon={CircleDollarSign}
          tone="amber"
        />
      </section>

      <section className="grid grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)] gap-[14px] max-[1100px]:grid-cols-1">
        <Panel
          title="Platform adoption"
          subtitle={"Active users across organizations · " + period}
          action={
            <button className={textButtonStyles}>
              View organizations <ExternalLink size={13} />
            </button>
          }
        >
          <div className="flex h-[24px] justify-end gap-[14px] pt-[5px] text-[10px] text-[#788591]">
            <span className="flex items-center gap-[5px]">
              <i className="size-[7px] rounded-full bg-[#0b51b7]" /> Active
              users
            </span>
            <span className="flex items-center gap-[5px]">
              <i className="size-[7px] rounded-full bg-[#6d81f5]" /> Engaged
              users
            </span>
          </div>
          <div className="h-[235px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={adoptionData}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="platformUsersFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0" stopColor="#0b51b7" stopOpacity=".22" />
                    <stop offset="1" stopColor="#0b51b7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7d8996", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9aa4ae", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e5e8ec",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Active users"
                  stroke="#0b51b7"
                  strokeWidth={2.4}
                  fill="url(#platformUsersFill)"
                />
                <Area
                  type="monotone"
                  dataKey="engaged"
                  name="Engaged users"
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
          title="Platform review status"
          subtitle="Submission decisions across all organizations"
          action={
            <button className="inline-flex items-center gap-[6px] rounded-[5px] border-0 bg-transparent p-[2px] font-sans text-[11px] font-medium text-[#546271]">
              This week <ChevronDown size={13} />
            </button>
          }
        >
          <div className="mt-3 grid grid-cols-[145px_1fr] items-center max-[700px]:grid-cols-[135px_1fr]">
            <div className="relative size-[140px] max-[700px]:size-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformReviewData}
                    dataKey="value"
                    innerRadius={51}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {platformReviewData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <strong className="block text-[20px] text-[#1d2a38]">
                  87.2%
                </strong>
                <span className="text-[10px] text-[#84909b]">approved</span>
              </div>
            </div>
            <div className="flex flex-col gap-[9px]">
              {platformReviewData.map((item) => (
                <div
                  className="flex justify-between text-[11px] text-[#667481]"
                  key={item.name}
                >
                  <span className="flex items-center gap-[6px]">
                    <i
                      className="size-[7px] rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                  <strong className="text-[#253342]">{item.value}%</strong>
                </div>
              ))}
            </div>
          </div>
          <button
            className="mt-[8px] flex w-full items-center gap-[7px] rounded-[5px] border border-[#f0dcc3] bg-[#fff8ed] px-[10px] py-[9px] font-sans text-[11px] font-semibold text-[#9b642f]"
            onClick={() => navigate("/superadmin/organizations")}
          >
            <ShieldAlert size={15} /> Open platform review queue{" "}
            <span className="ml-auto rounded-[10px] bg-[#f6e5cf] px-[7px] py-[2px]">
              421
            </span>
          </button>
        </Panel>
      </section>

      <section className="grid grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] gap-[14px] max-[1100px]:grid-cols-1">
        <Panel
          title="Recently active organizations"
          subtitle="Tenant usage across the platform"
          action={
            <button className={textButtonStyles}>
              View all <ExternalLink size={13} />
            </button>
          }
        >
          <div className="mt-[12px] overflow-x-auto">
            <table className="min-w-[620px]">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Owner</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {organizations.slice(0, 4).map((organization) => (
                  <tr key={organization.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-[7px] bg-[#e9f0fa] text-[10px] font-bold text-[#4d7fc6]">
                          {organization.initials}
                        </span>
                        <strong>{organization.name}</strong>
                      </div>
                    </td>
                    <td>{organization.ownerEmail}</td>
                    <td>{organization.country}</td>
                    <td>
                      <AdminStatus value={organization.status} />
                    </td>
                    <td>{organization.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Security activity"
          subtitle="Latest privileged platform events"
          action={<ShieldCheck className="text-[#0b51b7]" size={18} />}
        >
          <div className="mt-[8px]">
            {auditEvents.slice(0, 4).map((event) => (
              <div
                className="flex gap-[10px] border-b border-[#edf0f2] py-[12px] last:border-b-0"
                key={event.id}
              >
                <span className="grid size-8 flex-none place-items-center rounded-[7px] bg-[#f0edfa] text-[9px] font-bold text-[#7564b2]">
                  {event.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <strong className="block truncate text-[11px] text-[#253342]">
                    {event.action}
                  </strong>
                  <small className="mt-0.5 block truncate text-[10px] text-[#84909b]">
                    {event.actor} · {event.time}
                  </small>
                </div>
                <AdminStatus value={event.status} />
              </div>
            ))}
          </div>
        </Panel>
      </section>

    </div>
  );
}
