import { useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Globe2,
  KeyRound,
  Link2,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
  Webhook,
  type LucideIcon,
} from "lucide-react";

const tabs = [
  {
    id: "general",
    label: "General",
    description: "Workspace details and defaults",
    icon: Building2,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Kobo and connected services",
    icon: Link2,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and email preferences",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security & access",
    description: "Sign-in and session policies",
    icon: ShieldCheck,
  },
  {
    id: "data",
    label: "Data management",
    description: "Retention, exports, and privacy",
    icon: Database,
  },
];
const field =
  "w-full rounded-[5px] border border-[#dce5ef] bg-white px-[9px] py-2 font-['Roboto',sans-serif] text-[10px] font-normal leading-[normal] text-[#506076] disabled:bg-[#f5f7fa] disabled:text-[#929eae]";
const label = "flex flex-col gap-[5px] text-[9px] font-bold text-[#536278]";
const smallButton =
  "rounded border border-[#dce5ef] bg-white px-2 py-1.5 font-['Roboto',sans-serif] text-[9px] font-semibold leading-[normal] text-brand";

function Toggle({
  label: toggleLabel,
  description,
  defaultOn = false,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between border-b border-[#edf1f5] px-4 py-[13px] last:border-0 max-[560px]:items-start max-[560px]:gap-2.5">
      <div>
        <strong className="block text-[10px] text-[#4d5c72]">{toggleLabel}</strong>
        <small className="mt-[3px] block text-[9px] text-[#8c99aa]">{description}</small>
      </div>
      <button
        type="button"
        className={`relative h-[18px] w-[34px] cursor-pointer rounded-[10px] border-0 [transition:.2s] max-[560px]:flex-none ${on ? "bg-brand" : "bg-[#cbd3de]"}`}
        onClick={() => setOn(!on)}
        aria-pressed={on}
      >
        <i
          className={`absolute left-[3px] top-[3px] size-3 rounded-full bg-white [transition:.2s] ${on ? "translate-x-4" : ""}`}
        />
      </button>
    </div>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={description}>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

export function SettingsPage() {
  const [active, setActive] = useState("general");
  const [saved, setSaved] = useState(false);
  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className="text-[#25324a]">
      <div className="mb-[18px] flex items-start justify-between max-[560px]:flex-col max-[560px]:gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase leading-[1.4] tracking-[.08em] text-brand">
            ORGANIZATION ADMINISTRATION
          </p>
          <h1 className="[margin:4px_0_6px] font-sans text-[28px] font-bold leading-[1.2] tracking-[-.45px]">
            Settings
          </h1>
          <p className="m-0 text-[13px] text-[#75849a]">
            Manage workspace configuration, integrations, security, and data preferences.
          </p>
        </div>
        <button
          className={`flex items-center gap-1.5 rounded-[5px] border px-3 py-[9px] font-['Roboto',sans-serif] text-[11px] font-semibold leading-[normal] text-white ${saved ? "border-[#22a779] bg-[#22a779]" : "border-brand bg-brand"}`}
          onClick={save}
        >
          {saved ? <CheckCircle2 size={15} /> : <Save size={15} />} {saved ? "Changes saved" : "Save changes"}
        </button>
      </div>
      <div className="grid grid-cols-[230px_minmax(0,1fr)_225px] items-start gap-[15px] max-[1180px]:grid-cols-[210px_minmax(0,1fr)] max-[800px]:grid-cols-1">
        <div
          className="overflow-hidden rounded-[7px] border border-[#e4eaf2] bg-white p-[7px] max-[800px]:flex max-[800px]:overflow-x-auto max-[560px]:mx-[-2px]"
          role="navigation"
          aria-label="Settings sections"
        >
          {tabs.map(({ icon: Icon, ...tab }) => (
            <button
              className={`grid w-full cursor-pointer grid-cols-[30px_1fr_14px] items-center gap-2 rounded-[5px] border-0 px-2 py-[9px] text-left max-[800px]:min-w-max max-[800px]:grid-cols-[27px_auto] ${active === tab.id ? "bg-[#edf4fd] text-brand" : "bg-transparent text-[#66768b] hover:bg-[#f7f9fc]"}`}
              onClick={() => setActive(tab.id)}
              key={tab.id}
            >
              <span
                className={`grid size-[29px] place-items-center rounded-[5px] ${active === tab.id ? "bg-white" : "bg-[#f0f3f7]"}`}
              >
                <Icon size={17} />
              </span>
              <div>
                <strong className="block text-[10px]">{tab.label}</strong>
                <small
                  className={`mt-0.5 block text-[8px] leading-[1.25] max-[800px]:hidden ${active === tab.id ? "text-muted" : "text-[#929eae]"}`}
                >
                  {tab.description}
                </small>
              </div>
              <ChevronRight className="max-[800px]:hidden" size={14} />
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-[14px] max-[800px]:col-start-1">
          {active === "general" && <General />}
          {active === "integrations" && <Integrations />}
          {active === "notifications" && (
            <Panel
              title="Notification preferences"
              description="Choose which operational events should notify your team."
            >
              <div>
                <h3 className="m-0 px-4 pb-1.5 pt-[13px] text-[8px] tracking-[.45px] text-[#94a0b0]">
                  DATA COLLECTION
                </h3>
                <Toggle
                  label="Failed synchronization"
                  description="Notify administrators when a source fails to synchronize."
                  defaultOn
                />
                <Toggle
                  label="Delayed source"
                  description="Alert when a connected source has not synced for 12 hours."
                  defaultOn
                />
                <Toggle
                  label="Daily collection summary"
                  description="Email project owners a summary of submissions and progress."
                />
                <h3 className="m-0 px-4 pb-1.5 pt-[13px] text-[8px] tracking-[.45px] text-[#94a0b0]">
                  REVIEW & REPORTING
                </h3>
                <Toggle
                  label="Records requiring attention"
                  description="Alert assigned reviewers when new records need follow-up."
                  defaultOn
                />
                <Toggle
                  label="Scheduled report delivery"
                  description="Confirm when reports are delivered to recipients."
                  defaultOn
                />
              </div>
            </Panel>
          )}
          {active === "security" && <Security />}
          {active === "data" && <DataSettings />}
        </div>
        <aside className="overflow-hidden rounded-[7px] border border-[#e4eaf2] bg-white max-[1180px]:hidden">
          <section className="flex items-center gap-[9px] border-b border-[#edf1f5] p-[13px]">
            <span className="grid size-[34px] place-items-center rounded-full bg-[#d9af63] text-[9px] font-bold text-[#563d15]">
              AJ
            </span>
            <div className="flex-1">
              <strong className="block text-[9px] text-[#4a596e]">Amara Johnson</strong>
              <small className="mt-0.5 block text-[8px] text-[#8e9aaa]">Data Manager</small>
            </div>
            <button className="border-0 bg-transparent text-[8px] font-semibold text-brand">Edit profile</button>
          </section>
          <AccountRow icon={<KeyRound size={17} />} title="Organization owner" detail="Full administrative access" />
          <AccountRow icon={<Clock3 size={17} />} title="Last saved" detail="Today at 10:42" />
        </aside>
      </div>
    </div>
  );
}

function Body({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-[14px] p-4 ${className}`}>{children}</div>;
}
function General() {
  return (
    <>
      <Panel title="Organization profile" description="Information shown across this workspace and shared reports.">
        <Body>
          <div className="flex items-center gap-[11px] border-b border-[#edf1f5] pb-[14px]">
            <span className="grid size-[43px] place-items-center rounded-[7px] bg-[#d9af63] text-xs font-bold text-[#563d15]">
              CH
            </span>
            <div>
              <strong className="block text-[10px] text-[#4b5a70]">Organization logo</strong>
              <small className="mt-0.5 block text-[8px] text-[#929eae]">PNG or SVG · maximum 2 MB</small>
              <button className="mt-1.5 border-0 bg-transparent p-0 text-[9px] font-semibold text-brand">
                Upload new logo
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-[800px]:grid-cols-1">
            <label className={label}>
              Organization name
              <input className={field} defaultValue="Community Health Initiative" />
            </label>
            <label className={label}>
              Workspace ID
              <input className={field} defaultValue="community-health" disabled />
            </label>
          </div>
          <label className={label}>
            Organization description
            <textarea
              className={`${field} min-h-[70px] resize-y`}
              defaultValue="Community-led health data collection and monitoring programs."
            />
          </label>
          <div className="grid grid-cols-2 gap-3 max-[800px]:grid-cols-1">
            <label className={label}>
              Country
              <select className={field} defaultValue="Liberia">
                <option>Liberia</option>
                <option>Ghana</option>
                <option>Sierra Leone</option>
              </select>
            </label>
            <label className={label}>
              Time zone
              <select className={field} defaultValue="GMT">
                <option>GMT</option>
                <option>GMT +1</option>
                <option>GMT -5</option>
              </select>
            </label>
          </div>
        </Body>
      </Panel>
      <Panel title="Workspace defaults" description="Defaults applied when a new project is created.">
        <Body>
          <div className="grid grid-cols-2 gap-3 max-[800px]:grid-cols-1">
            <Select label="Default language" options={["English", "French"]} />
            <Select label="Date format" options={["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} />
            <Select
              label="Default project visibility"
              options={["Private to assigned team", "Visible to organization"]}
            />
            <Select label="Default reporting period" options={["Last 30 days", "Current month", "Current quarter"]} />
          </div>
        </Body>
      </Panel>
    </>
  );
}
function Select({ label: selectLabel, options }: { label: string; options: string[] }) {
  return (
    <label className={label}>
      {selectLabel}
      <select className={field}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
function Integrations() {
  return (
    <>
      <Panel
        title="Data connections"
        description="Services providing forms and submissions to this workspace."
        action={<button className={smallButton}>Add connection</button>}
      >
        <Connection
          logo="K"
          name="KoboToolbox"
          detail="9 forms connected · last synchronized 8 minutes ago"
          state="Connected"
          kobo
        />
        <Connection
          logo={<Webhook size={18} />}
          name="Custom webhook"
          detail="Receive records from another collection platform"
          state="Not configured"
        />
      </Panel>
      <Panel title="Business intelligence" description="Connect governed datasets to analysis tools.">
        <Body>
          <Integration
            icon={<Database size={18} />}
            title="Microsoft Power BI"
            detail="Create a secure organization dataset connection."
            action="Connect"
          />
          <Integration
            icon={<Globe2 size={18} />}
            title="OData feed"
            detail="Use a read-only URL in Excel, R, or another BI tool."
            action="Generate URL"
          />
        </Body>
      </Panel>
    </>
  );
}
function Connection({
  logo,
  name,
  detail,
  state,
  kobo = false,
}: {
  logo: ReactNode;
  name: string;
  detail: string;
  state: string;
  kobo?: boolean;
}) {
  return (
    <div className="mx-4 flex items-center gap-2.5 border-b border-[#edf1f5] py-[14px] last:border-0">
      <span
        className={`grid size-9 place-items-center rounded-[7px] ${kobo ? "bg-[#6e55d9] text-[15px] font-bold text-white" : "bg-[#edf4fd] text-brand"}`}
      >
        {logo}
      </span>
      <div className="flex-1">
        <strong className="block text-[10px] text-[#47566c]">{name}</strong>
        <small className="mt-[3px] block text-[8px] text-[#8996a8]">{detail}</small>
        <p className={`mt-[5px] text-[8px] font-bold ${state === "Connected" ? "text-[#22a779]" : "text-[#8c99aa]"}`}>
          {state === "Connected" && <i className="mr-1 inline-block size-[5px] rounded-full bg-[#22a779]" />}
          {state}
        </p>
      </div>
      <button className={smallButton}>{kobo ? "Manage" : "Configure"}</button>
    </div>
  );
}
function Integration({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-[#e6ebf2] p-[11px]">
      <span className="text-brand">{icon}</span>
      <div className="flex-1">
        <strong className="block text-[10px] text-[#4c5b70]">{title}</strong>
        <small className="mt-[3px] block text-[8px] text-[#8b98aa]">{detail}</small>
      </div>
      <button className={smallButton}>{action}</button>
    </div>
  );
}
function Security() {
  return (
    <>
      <Panel title="Authentication policy" description="Sign-in requirements for all organization members.">
        <Toggle
          label="Require multi-factor authentication"
          description="Members must use an additional verification method."
        />
        <Toggle
          label="Block inactive accounts"
          description="Disable accounts after 90 days without activity."
          defaultOn
        />
        <Toggle
          label="Restrict concurrent sessions"
          description="Allow a maximum of three active sessions per member."
          defaultOn
        />
      </Panel>
      <Panel
        title="Active sessions"
        description="Your recent account activity."
        action={<button className={`${smallButton} !border-[#f0c5cb] !text-[#c95664]`}>Sign out other sessions</button>}
      >
        <Session
          icon={<UserRound size={17} />}
          title="Windows · Chrome"
          detail="Monrovia, Liberia · current session"
          active
        />
        <Session icon={<LockKeyhole size={17} />} title="Android · Chrome" detail="Monrovia, Liberia · 2 days ago" />
      </Panel>
    </>
  );
}
function Session({
  icon,
  title,
  detail,
  active = false,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div className="mx-4 flex items-center gap-[9px] border-b border-[#edf1f5] py-[13px] last:border-0">
      <span className="grid size-[31px] place-items-center rounded-md bg-[#edf4fd] text-brand">{icon}</span>
      <div className="flex-1">
        <strong className="block text-[10px] text-[#4a596e]">{title}</strong>
        <small className="mt-[3px] block text-[8px] text-[#8d99aa]">{detail}</small>
      </div>
      {active && <b className="text-[8px] text-[#22a779]">Active now</b>}
    </div>
  );
}
function DataSettings() {
  return (
    <>
      <Panel title="Data retention" description="Control how long records and exports remain available.">
        <Body>
          <div className="grid grid-cols-2 gap-3 max-[800px]:grid-cols-1">
            <Select label="Submission retention" options={["Keep indefinitely", "7 years", "5 years", "2 years"]} />
            <Select label="Generated export expiry" options={["30 days", "14 days", "7 days"]} />
          </div>
          <Toggle
            label="Automatically remove expired exports"
            description="Delete generated files when their expiry period ends."
            defaultOn
          />
          <Toggle
            label="Keep submission audit history"
            description="Retain edits, review decisions, and user activity."
            defaultOn
          />
        </Body>
      </Panel>
      <Panel title="Privacy controls" description="Protect sensitive data in analysis and reporting.">
        <Toggle
          label="Mask personal identifiers"
          description="Hide sensitive fields from users without permission."
          defaultOn
        />
        <Toggle
          label="Require reason for bulk export"
          description="Ask users to record why organization data is being exported."
          defaultOn
        />
      </Panel>
    </>
  );
}
function AccountRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <section className="flex items-center gap-[9px] border-b border-[#edf1f5] p-[13px] last:border-0">
      <span className="text-brand">{icon}</span>
      <div>
        <strong className="block text-[9px] text-[#4a596e]">{title}</strong>
        <small className="mt-0.5 block text-[8px] text-[#8e9aaa]">{detail}</small>
      </div>
    </section>
  );
}
