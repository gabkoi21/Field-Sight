import { useState, type FormEvent, type ReactNode } from "react";
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
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminStatus } from "../../components/superadmin/AdminUi";
import { adoptionGrowth, adoptionMonths, auditEvents, organizations } from "../superadmin/data";

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
      <span className={"row-[1/3] grid size-[40px] place-items-center rounded-full " + iconTones[tone]}>
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-[11px] font-medium text-[#6f7d8a]">{label}</span>
        <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">{value}</strong>
      </span>
      <span className="flex items-center gap-[2px] self-start text-[11px] font-semibold text-[#0b51b7]">
        <ArrowUpRight size={14} /> {change}
      </span>
      <small className="col-[2/4] mt-[6px] text-[10px] text-[#88939d]">{detail}</small>
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
          <h2 className="m-0 text-[14px] font-semibold text-[#1d2a38]">{title}</h2>
          {subtitle && <p className="mb-0 mt-1 text-[11px] text-[#84909b]">{subtitle}</p>}
        </div>
        {action ?? <MoreHorizontal className="text-[#87929d]" size={18} />}
      </header>
      {children}
    </section>
  );
}
export function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("This month");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(19);
  const [showCreate, setShowCreate] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationOwner, setOrganizationOwner] = useState("");
  const [organizationPlan, setOrganizationPlan] = useState("Starter");

  function openCreate() {
    setDrawerClosing(false);
    setDrawerVisible(false);
    setShowCreate(true);
    window.requestAnimationFrame(() => setDrawerVisible(true));
  }
  function closeCreate() {
    setDrawerClosing(true);
    setDrawerVisible(false);
    window.setTimeout(() => setShowCreate(false), 220);
  }
  function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationName.trim() || !organizationOwner.trim()) return;
    setOrganizationName("");
    setOrganizationOwner("");
    setOrganizationPlan("Starter");
    closeCreate();
  }
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
            Global usage, platform health, security, and subscription performance
          </p>
        </div>
        <div className="flex gap-[7px] max-[700px]:w-full max-[600px]:grid max-[600px]:grid-cols-2">
          <div className="relative">
            <div className={controlStyles}>
              <button type="button" onClick={() => setCalendarOpen((open) => !open)} className="grid place-items-center border-0 bg-transparent p-0 text-[#546271]" aria-label="Open calendar" aria-expanded={calendarOpen}><CalendarDays size={15} /></button>
              <select className="appearance-none border-0 bg-transparent font-sans text-[12px] font-medium text-[#425162] outline-none" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filter dashboard by period"><option>This month</option><option>Last 30 days</option><option>This quarter</option></select>
              <ChevronDown className="pointer-events-none" size={14} />
            </div>
            {calendarOpen && (
              <div className="absolute right-0 top-[43px] z-20 w-[254px] rounded-[8px] border border-[#e1e7ed] bg-white p-[13px] shadow-[0_12px_28px_rgba(16,42,67,.16)]">
                <div className="mb-[10px] flex items-center justify-between"><strong className="text-[13px] text-[#253342]">August 2026</strong><span className="text-[11px] text-[#84909b]">Choose a date</span></div>
                <div className="mb-[5px] grid grid-cols-7 text-center text-[10px] font-semibold text-[#96a1ad]">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
                <div className="grid grid-cols-7 gap-[3px]">{Array.from({ length: 5 }).map((_, index) => <i key={`blank-${index}`} />)}{calendarDays.map((day) => <button type="button" key={day} onClick={() => { setSelectedDay(day); setCalendarOpen(false); setPeriod(`Aug ${day}, 2026`); }} className={`grid h-[28px] place-items-center rounded-[5px] border-0 p-0 text-[11px] font-medium transition ${selectedDay === day ? "bg-[#0b51b7] text-white" : "bg-transparent text-[#526177] hover:bg-[#edf3fc]"}`}>{day}</button>)}</div>
              </div>
            )}
          </div>
          <button className={buttonStyles + " max-[600px]:justify-center"} onClick={openCreate}>
            <Plus size={15} /> Add organization
          </button>
        </div>
      </div>
      <section className="flex items-center gap-[12px] rounded-[6px] border border-[#f0d8b8] bg-[#fffbf4] px-[15px] py-[13px] max-[900px]:flex-wrap max-[900px]:items-start">
        <span className="grid size-[34px] place-items-center rounded-full bg-[#fff0dc] text-[#ca792b]">
          <ShieldAlert size={19} />
        </span>
        <div className="flex-1">
          <strong className="block text-[13px] text-[#4b3825]">Platform operations are healthy</strong>
          <p className="mb-0 mt-[3px] text-[12px] text-[#80664d]">
            All core services are operational. Review privileged activity and tenant usage below.
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
          <strong>24 organizations</strong> are actively using FieldSight
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
          value="24"
          change="3"
          detail="added this quarter"
          icon={Building2}
          tone="blue"
        />
        <MetricCard
          label="Platform users"
          value="1,286"
          change="8.2%"
          detail="1,104 active this month"
          icon={Users}
          tone="teal"
        />
        <MetricCard
          label="Monthly submissions"
          value="248,390"
          change="18.6%"
          detail="across all organizations"
          icon={Database}
          tone="violet"
        />
        <MetricCard
          label="Monthly revenue"
          value="$42,780"
          change="6.4%"
          detail="96.4% collection rate"
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
              <i className="size-[7px] rounded-full bg-[#0b51b7]" /> Active users
            </span>
            <span className="flex items-center gap-[5px]">
              <i className="size-[7px] rounded-full bg-[#6d81f5]" /> Engaged users
            </span>
          </div>
          <div className="h-[235px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={adoptionData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="platformUsersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#0b51b7" stopOpacity=".22" />
                    <stop offset="1" stopColor="#0b51b7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#7d8996", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9aa4ae", fontSize: 10 }} />
                <Tooltip contentStyle={{ border: "1px solid #e5e8ec", borderRadius: 6, fontSize: 12 }} />
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
          action={<button className="inline-flex items-center gap-[6px] rounded-[5px] border-0 bg-transparent p-[2px] font-sans text-[11px] font-medium text-[#546271]">This week <ChevronDown size={13} /></button>}
        >
          <div className="mt-3 grid grid-cols-[145px_1fr] items-center max-[700px]:grid-cols-[135px_1fr]">
            <div className="relative size-[140px] max-[700px]:size-[130px]">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={platformReviewData} dataKey="value" innerRadius={51} outerRadius={66} paddingAngle={2} stroke="none">{platformReviewData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><strong className="block text-[20px] text-[#1d2a38]">87.2%</strong><span className="text-[10px] text-[#84909b]">approved</span></div>
            </div>
            <div className="flex flex-col gap-[9px]">{platformReviewData.map((item) => <div className="flex justify-between text-[11px] text-[#667481]" key={item.name}><span className="flex items-center gap-[6px]"><i className="size-[7px] rounded-full" style={{ background: item.color }} />{item.name}</span><strong className="text-[#253342]">{item.value}%</strong></div>)}</div>
          </div>
          <button className="mt-[8px] flex w-full items-center gap-[7px] rounded-[5px] border border-[#f0dcc3] bg-[#fff8ed] px-[10px] py-[9px] font-sans text-[11px] font-semibold text-[#9b642f]" onClick={() => navigate("/superadmin/organizations")}><ShieldAlert size={15} /> Open platform review queue <span className="ml-auto rounded-[10px] bg-[#f6e5cf] px-[7px] py-[2px]">421</span></button>
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
                  <th>Plan</th>
                  <th>Users</th>
                  <th>Status</th>
                  <th>Last activity</th>
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
                    <td>{organization.plan}</td>
                    <td>{organization.users}</td>
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
              <div className="flex gap-[10px] border-b border-[#edf0f2] py-[12px] last:border-b-0" key={event.id}>
                <span className="grid size-8 flex-none place-items-center rounded-[7px] bg-[#f0edfa] text-[9px] font-bold text-[#7564b2]">
                  {event.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <strong className="block truncate text-[11px] text-[#253342]">{event.action}</strong>
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
      <section className="grid grid-cols-3 gap-[14px] max-[900px]:grid-cols-1">
        {[
          [Building2, "Manage organizations", "Tenant plans, owners, status, and usage.", "/superadmin/organizations"],
          [Server, "Review infrastructure", "Service availability, latency, and incidents.", "/superadmin/system"],
          [Activity, "Review audit activity", "Inspect privileged platform and account events.", "/superadmin/audit"],
        ].map(([Icon, title, description, path]) => {
          const QuickIcon = Icon as typeof Building2;
          return (
            <button
              key={title as string}
              className="rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left transition hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]"
              onClick={() => navigate(path as string)}
            >
              <span className="grid size-9 place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
                <QuickIcon size={18} />
              </span>
              <strong className="mt-[13px] block text-[13px] text-[#253342]">{title as string}</strong>
              <span className="mt-1 block text-[11px] leading-5 text-[#84909b]">{description as string}</span>
            </button>
          );
        })}
      </section>
      {showCreate && (
        <div
          className={`fixed inset-0 z-50 bg-[rgba(16,42,67,.23)] transition-opacity ${drawerClosing ? "duration-[220ms] ease-in" : "duration-[220ms] ease-out"} ${drawerVisible ? "opacity-100" : "opacity-0"}`}
          onClick={closeCreate}
        >
          <form
            className={`absolute bottom-0 right-0 top-0 flex w-[min(470px,100%)] flex-col bg-white shadow-[-16px_0_35px_rgba(16,42,67,.18)] transition-[opacity,transform] max-[460px]:w-full ${drawerClosing ? "translate-x-[36px] opacity-0 duration-[220ms] ease-[cubic-bezier(.4,0,1,1)]" : `${drawerVisible ? "translate-x-0 opacity-100" : "translate-x-[36px] opacity-0"} duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)]`}`}
            onClick={(event) => event.stopPropagation()}
            onSubmit={createOrganization}
          >
            <header className="!flex !items-start !justify-between !border-b !border-[#e8edf4] !bg-white !px-[22px] !py-[20px]">
              <div>
                <p className="!m-0 !mb-[6px] text-[11px] !leading-[1.4] font-bold tracking-[.08em] text-[#0b51b7] uppercase">
                  PLATFORM TENANT
                </p>
                <h2 className="!m-0 !mb-[6px] !mt-[4px] text-[21px] font-normal tracking-[-.3px] text-[#303e67]">
                  Create organization
                </h2>
                <p className="!m-0 text-[11px] text-[#8391a5]">Set up a new organization on the FieldSight platform.</p>
              </div>
              <button
                className="cursor-pointer border-0 bg-transparent p-0 text-[#8290a2]"
                type="button"
                onClick={closeCreate}
                aria-label="Close form"
              >
                ×
              </button>
            </header>
            <div className="flex flex-1 flex-col gap-[15px] overflow-auto px-[22px] py-[21px]">
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Organization name
                <input
                  autoFocus
                  className="min-h-[36px] w-full rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[12px] text-[#425162] outline-none focus:border-[#aeb8c4]"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="e.g. Community Health Initiative"
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Organization owner
                <input
                  className="min-h-[36px] w-full rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[12px] text-[#425162] outline-none focus:border-[#aeb8c4]"
                  value={organizationOwner}
                  onChange={(event) => setOrganizationOwner(event.target.value)}
                  placeholder="e.g. Amara Johnson"
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Initial plan
                <select
                  className="min-h-[36px] w-full rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[12px] text-[#425162] outline-none focus:border-[#aeb8c4]"
                  value={organizationPlan}
                  onChange={(event) => setOrganizationPlan(event.target.value)}
                >
                  <option>Starter</option>
                  <option>Professional</option>
                  <option>Enterprise</option>
                </select>
              </label>
              <label className="flex flex-row items-start gap-[9px] rounded-[6px] border border-[#e2e9f0] bg-[#f9fbfd] p-[11px] text-[11px] font-bold text-[#526177]">
                <input className="!m-0 !mt-[1px] !h-[15px] !w-[15px] accent-[#0b51b7]" type="checkbox" defaultChecked />
                <span className="flex flex-col gap-[3px]">
                  <strong className="text-[11px] text-[#48586e]">Send owner invitation</strong>
                  <small className="text-[10px] font-normal leading-[1.4] text-[#8997a9]">
                    Invite the organization owner to set up their workspace access.
                  </small>
                </span>
              </label>
            </div>
            <footer className="flex justify-end gap-[8px] border-t border-[#e8edf4] bg-white px-[22px] py-[14px]">
              <button
                className="cursor-pointer rounded-[5px] border border-[#dce5ef] bg-white px-[11px] py-[9px] font-sans text-[11px] font-semibold text-[#5b6a7e]"
                type="button"
                onClick={closeCreate}
              >
                Cancel
              </button>
              <button
                className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] py-[9px] font-sans text-[11px] font-semibold text-white"
                type="submit"
              >
                <Plus size={15} />
                Create organization
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
