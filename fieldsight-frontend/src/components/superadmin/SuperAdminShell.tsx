import { useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  CircleDollarSign,
  FileClock,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

const navigation: NavigationSection[] = [
  {
    label: "Platform",
    items: [
      { label: "Dashboard", path: "/superadmin", icon: LayoutDashboard, end: true },
      { label: "Organizations", path: "/superadmin/organizations", icon: Building2 },
      { label: "Users & roles", path: "/superadmin/users", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Billing & plans", path: "/superadmin/billing", icon: CircleDollarSign },
      { label: "System health", path: "/superadmin/system", icon: Server },
      { label: "Audit log", path: "/superadmin/audit", icon: FileClock },
    ],
  },
  {
    label: "Configuration",
    items: [{ label: "Platform settings", path: "/superadmin/settings", icon: Settings }],
  },
];

const pageTitles: Record<string, string> = {
  "/superadmin": "Platform overview",
  "/superadmin/organizations": "Organizations",
  "/superadmin/users": "Users & roles",
  "/superadmin/billing": "Billing & plans",
  "/superadmin/system": "System health",
  "/superadmin/audit": "Audit log",
  "/superadmin/settings": "Platform settings",
};

export function SuperAdminShell() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileClosing, setProfileClosing] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileName, setProfileName] = useState(user?.username ?? "Super Admin");
  const [profileEmail, setProfileEmail] = useState(user?.email ?? "");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pageTitle = pageTitles[pathname] ?? "Super administration";

  function openProfile() {
    setProfileClosing(false);
    setProfileVisible(false);
    setProfileOpen(true);
    window.requestAnimationFrame(() => setProfileVisible(true));
  }

  function closeProfile() {
    setProfileClosing(true);
    setProfileVisible(false);
    window.setTimeout(() => setProfileOpen(false), 220);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    closeProfile();
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-10 hidden border-0 bg-[#071f4770] max-[1050px]:block"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-[258px] flex-col overflow-hidden bg-navy text-[#b5c7d5] transition-transform duration-200 max-[1440px]:w-[232px] max-[1050px]:w-[258px] ${mobileOpen ? "max-[1050px]:translate-x-0" : "max-[1050px]:-translate-x-full"}`}
      >
        <NavLink
          to="/superadmin"
          className="flex h-[74px] flex-none items-center px-[27px] text-[19px] font-bold text-white no-underline max-[1440px]:h-16 max-[1440px]:px-[21px]"
          onClick={() => setMobileOpen(false)}
        >
          <b className="mr-[9px] grid size-[30px] place-items-center rounded-[7px] bg-brand shadow-[inset_0_0_0_1px_#ffffff20]">
            <BarChart3 size={16} />
          </b>
          FieldSight
        </NavLink>

        <div className="mx-4 mb-3 flex flex-none items-center gap-2.5 rounded-[9px] border border-[#234d82] bg-[#103564] p-3 max-[1440px]:mx-3">
          <span className="grid size-[30px] place-items-center rounded-[7px] bg-[#d9af63] text-[10px] font-bold text-[#563d15]">SA</span>
          <div className="min-w-0">
            <small className="block text-[9px] font-semibold tracking-[.1em] text-[#91a9bb]">PLATFORM</small>
            <strong className="block truncate text-xs text-white">Super Administration</strong>
          </div>
          <ShieldCheck className="ml-auto text-[#8db6f5]" size={15} />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigation.map((section) => (
            <div key={section.label}>
              <p className="mx-[14px] mb-1.5 mt-4 text-[9px] font-semibold uppercase tracking-[.1em] text-[#71899c]">
                {section.label}
              </p>
              {section.items.map(({ label, path, icon: Icon, end }) => (
                <NavLink
                  end={end}
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `my-0.5 flex min-h-10 w-full items-center gap-3 rounded-[7px] px-[13px] py-[9px] text-[13px] font-medium no-underline transition-colors hover:bg-[rgba(11,81,183,.52)] hover:text-white max-[1440px]:min-h-9 max-[1440px]:py-2 max-[1440px]:text-xs ${isActive ? "bg-[rgba(11,81,183,.52)] text-white" : "text-[#b5c7d5]"}`
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex-none border-t border-[#294966] p-3">
          <NavLink
            to="/"
            className="mb-1 flex w-full items-center gap-3 rounded-[7px] px-[13px] py-2.5 text-xs text-[#b5c7d5] no-underline hover:bg-[rgba(11,81,183,.52)] hover:text-white"
          >
            <Building2 size={17} /> Organization workspace
          </NavLink>
          <button
            className="flex w-full items-center gap-3 rounded-[7px] border-0 bg-transparent px-[13px] py-2.5 text-left text-xs text-[#b5c7d5] hover:bg-[rgba(11,81,183,.52)] hover:text-white"
            onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="ml-[258px] min-h-screen max-[1440px]:ml-[232px] max-[1050px]:ml-0">
        <header className="sticky top-0 z-[5] flex h-[74px] items-center justify-between border-b border-line bg-white px-[38px] shadow-[0_1px_4px_rgba(23,33,47,.04)] max-[1440px]:h-16 max-[1440px]:px-7 max-[560px]:h-[58px] max-[560px]:px-4">
          <div className="flex items-center gap-3 text-[13px] text-[#657182]">
            <button
              aria-label="Open navigation"
              className="mr-1 hidden border-0 bg-transparent p-0 text-[#657182] max-[1050px]:block"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Super admin</span>
            <i className="not-italic text-[#d0d5dc]">/</i>
            <strong className="font-medium text-[#1b2836] max-[560px]:hidden">{pageTitle}</strong>
          </div>
          <div className="flex items-center gap-4 text-[#657182]">
            <button aria-label="Search" className="border-0 bg-transparent p-0 text-inherit"><Search size={18} /></button>
            <button aria-label="Notifications" className="relative border-0 bg-transparent p-0 text-inherit after:absolute after:-right-0.5 after:-top-0.5 after:size-1.5 after:rounded-full after:bg-[#d85962] after:content-['']"><Bell size={18} /></button>
            <button type="button" onClick={openProfile} className="grid size-8 place-items-center rounded-full border-2 border-white bg-[#d9af63] p-0 text-[10px] font-bold text-[#563d15] shadow-[0_2px_8px_rgba(177,124,38,.35)] transition hover:scale-105 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71808e]" aria-label="Open profile settings">GA</button>
          </div>
        </header>
        <div className="mx-auto max-w-[1560px] p-[34px_38px_48px] max-[1440px]:p-7 max-[700px]:p-4">
          <Outlet />
        </div>
      </main>
      {profileOpen && (
        <div className={`fixed inset-0 z-50 bg-[rgba(16,42,67,.23)] transition-opacity ${profileClosing ? "duration-[220ms] ease-in" : "duration-[220ms] ease-out"} ${profileVisible ? "opacity-100" : "opacity-0"}`} onClick={closeProfile}>
          <form className={`absolute bottom-0 right-0 top-0 flex w-[min(470px,100%)] flex-col bg-white text-[#25324a] shadow-[-16px_0_35px_rgba(16,42,67,.18)] transition-[opacity,transform] max-[460px]:w-full ${profileClosing ? "translate-x-[36px] opacity-0 duration-[220ms] ease-[cubic-bezier(.4,0,1,1)]" : `${profileVisible ? "translate-x-0 opacity-100" : "translate-x-[36px] opacity-0"} duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)]`}`} onClick={(event) => event.stopPropagation()} onSubmit={saveProfile}>
            <header className="!flex !items-start !justify-between !border-b !border-[#e8edf4] !bg-white !px-[22px] !py-[20px]"><div><p className="!m-0 !mb-[6px] text-[11px] !leading-[1.4] font-bold tracking-[.08em] text-[#0b51b7] uppercase">PROFILE SETTINGS</p><h2 className="!m-0 !mb-[6px] !mt-[4px] text-[21px] font-normal tracking-[-.3px] text-[#303e67]">Update profile</h2><p className="!m-0 text-[11px] text-[#8391a5]">Manage your platform administrator details.</p></div><button className="cursor-pointer border-0 bg-transparent p-0 text-[#8290a2]" type="button" onClick={closeProfile} aria-label="Close profile form">×</button></header>
            <div className="flex flex-1 flex-col gap-[15px] overflow-auto px-[22px] py-[21px]"><div className="flex items-center gap-[11px] rounded-[6px] border border-[#e2e9f0] bg-[#f9fbfd] p-[11px]"><span className="grid size-10 place-items-center rounded-full bg-[#d9af63] text-[11px] font-bold text-[#563d15]">GA</span><div><strong className="block text-[12px] text-[#48586e]">Platform administrator</strong><small className="text-[10px] text-[#8997a9]">Full platform access</small></div></div><label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Full name<input className="min-h-[36px] w-full rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[12px] text-[#425162] outline-none focus:border-[#aeb8c4]" value={profileName} onChange={(event) => setProfileName(event.target.value)} required /></label><label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Email address<input className="min-h-[36px] w-full rounded-[5px] border border-[#dce2e7] bg-white px-[9px] text-[12px] text-[#425162] outline-none focus:border-[#aeb8c4]" type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} required /></label><label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Role<input className="min-h-[36px] w-full cursor-not-allowed rounded-[5px] border border-[#e2e7ec] bg-[#f7f9fb] px-[9px] text-[12px] text-[#84909b] outline-none" value="Super Admin" readOnly /></label></div>
            <footer className="flex justify-end gap-[8px] border-t border-[#e8edf4] bg-white px-[22px] py-[14px]"><button className="cursor-pointer rounded-[5px] border border-[#dce5ef] bg-white px-[11px] py-[9px] font-sans text-[11px] font-semibold text-[#5b6a7e]" type="button" onClick={closeProfile}>Cancel</button><button className="cursor-pointer rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] py-[9px] font-sans text-[11px] font-semibold text-white" type="submit">Save changes</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}