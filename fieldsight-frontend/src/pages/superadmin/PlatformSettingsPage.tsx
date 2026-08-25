import { useState, type FormEvent, type ReactNode } from "react";
import { Bell, CheckCircle2, Database, KeyRound, Mail, Save, ShieldCheck, Tags } from "lucide-react";
import { Button, PageHeader } from "../../components/ui";
import { AdminPanel, adminInputClass } from "../../components/superadmin/AdminUi";
import { useNavigate } from "react-router-dom";

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (checked: boolean) => void; label: string; detail: string }) {
  return <label className="flex cursor-pointer items-center gap-4 border-b border-line py-4 last:border-b-0"><button type="button" role="switch" aria-checked={checked} className={`relative h-[22px] w-10 flex-none rounded-full border-0 transition-colors ${checked ? "bg-brand" : "bg-[#cfd6df]"}`} onClick={() => onChange(!checked)}><span className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-transform ${checked ? "left-[21px]" : "left-[3px]"}`} /></button><span><strong className="block text-[11px] text-[#324158]">{label}</strong><small className="mt-0.5 block text-[10px] leading-[1.5] text-[#8793a2]">{detail}</small></span></label>;
}

function SettingRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="grid grid-cols-[180px_1fr] gap-6 border-b border-line py-5 last:border-b-0 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div className="flex items-center gap-2.5 text-[#657182]"><span className="grid size-8 place-items-center rounded-[7px] bg-[#f5f8fc]">{icon}</span><strong className="text-[11px] text-[#324158]">{title}</strong></div><div>{children}</div></div>;
}

export function PlatformSettingsPage() {
  const [platformName, setPlatformName] = useState("FieldSight");
  const [supportEmail, setSupportEmail] = useState("support@fieldsight.io");
  const [region, setRegion] = useState("West Africa");
  const [requireMfa, setRequireMfa] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [maintenanceNotices, setMaintenanceNotices] = useState(true);
  const [usageReports, setUsageReports] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();


  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <form onSubmit={saveSettings}>
      <PageHeader eyebrow="Platform configuration" title="Platform settings" description="Configure global defaults, security policies, notifications, and data governance.">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/superadmin/sectors")}>
            <Tags size={15} /> Sectors
          </Button>
          <Button type="submit">{saved ? <CheckCircle2 size={15} /> : <Save size={15} />}{saved ? "Saved" : "Save changes"}</Button>
        </div>
      </PageHeader>

      <AdminPanel title="General settings" description="Identity and global platform defaults">
        <div className="px-5">
          <SettingRow icon={<Database size={15} />} title="Platform identity"><div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1"><label className="text-[10px] font-bold text-[#657182]">Platform name<input className={`mt-2 ${adminInputClass}`} value={platformName} onChange={(event) => setPlatformName(event.target.value)} /></label><label className="text-[10px] font-bold text-[#657182]">Support email<input type="email" className={`mt-2 ${adminInputClass}`} value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} /></label></div></SettingRow>
          <SettingRow icon={<Database size={15} />} title="Primary region"><label className="block max-w-[360px] text-[10px] font-bold text-[#657182]">Data residency<select className={`mt-2 ${adminInputClass}`} value={region} onChange={(event) => setRegion(event.target.value)}><option>West Africa</option><option>Europe</option><option>North America</option></select></label><p className="mb-0 mt-2 text-[10px] text-[#8793a2]">New organization data is provisioned in this region by default.</p></SettingRow>
        </div>
      </AdminPanel>

      <section className="mt-[18px] grid grid-cols-2 gap-[18px] max-[900px]:grid-cols-1">
        <AdminPanel title="Security policy" description="Global administrator and tenant safeguards" action={<ShieldCheck className="text-[#158e7d]" size={18} />}>
          <div className="px-5"><Toggle checked={requireMfa} onChange={setRequireMfa} label="Require MFA for administrators" detail="Applies to super admins and organization administrators." /><Toggle checked={loginAlerts} onChange={setLoginAlerts} label="Suspicious sign-in alerts" detail="Notify platform administrators about high-risk access." /><SettingRow icon={<KeyRound size={15} />} title="Session lifetime"><select className={adminInputClass} defaultValue="12 hours"><option>4 hours</option><option>12 hours</option><option>24 hours</option></select></SettingRow></div>
        </AdminPanel>

        <AdminPanel title="Platform notifications" description="System-wide operational communication" action={<Bell className="text-brand" size={18} />}>
          <div className="px-5"><Toggle checked={maintenanceNotices} onChange={setMaintenanceNotices} label="Maintenance notifications" detail="Email organization owners before planned downtime." /><Toggle checked={usageReports} onChange={setUsageReports} label="Monthly usage reports" detail="Send adoption and billing summaries to super admins." /><SettingRow icon={<Mail size={15} />} title="Sender address"><input className={adminInputClass} defaultValue="notifications@fieldsight.io" /></SettingRow></div>
        </AdminPanel>
      </section>

      <AdminPanel title="Data governance" description="Retention and operational safeguards" className="mt-[18px]">
        <div className="grid grid-cols-3 gap-5 p-5 max-[850px]:grid-cols-1">
          <label className="text-[10px] font-bold text-[#657182]">Audit retention<select className={`mt-2 ${adminInputClass}`} defaultValue="365 days"><option>180 days</option><option>365 days</option><option>730 days</option></select></label>
          <label className="text-[10px] font-bold text-[#657182]">Deleted tenant recovery<select className={`mt-2 ${adminInputClass}`} defaultValue="30 days"><option>7 days</option><option>30 days</option><option>90 days</option></select></label>
          <label className="text-[10px] font-bold text-[#657182]">Default export policy<select className={`mt-2 ${adminInputClass}`} defaultValue="Require reason"><option>Allow exports</option><option>Require reason</option><option>Administrator approval</option></select></label>
        </div>
      </AdminPanel>
    </form>
  );
}
