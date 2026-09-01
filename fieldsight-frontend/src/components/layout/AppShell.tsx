import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  FileBarChart,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  RefreshCw,
  Users,
  LogOut,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiClient } from "../../services/apiClient";

interface NavigationItem {
  name: string;
  path: string;
  icon: LucideIcon;
  count?: number;
}
interface NavSection {
  label: string;
  items: NavigationItem[];
}
const navigation: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { name: "Dashboard", path: "/", icon: LayoutDashboard },
      { name: "Projects", path: "/projects", icon: FolderKanban },
    ],
  },
  {
    label: "Data collection",
    items: [
      { name: "Kobo connections", path: "/forms/connections", icon: FileText },
      { name: "Submissions", path: "/submissions", icon: FileText },
      { name: "Field enumerators", path: "/enumerators", icon: Users },
      { name: "Sync history", path: "/sync", icon: RefreshCw },
    ],
  },
  {
    label: "Analysis & reporting",
    items: [
      { name: "Quality center", path: "/quality", icon: ShieldCheck },
      { name: "Explore & analyze", path: "/analytics", icon: BarChart3 },
      { name: "Reports", path: "/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Team", path: "/team", icon: Users },
      { name: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

function UserMenu({ logout, navigate, name, role }: { logout: () => Promise<void>; navigate: (path: string, opts?: object) => void; name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center border-l border-[#e7e9ed] pl-[17px]">
      <button
        id="user-menu-button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-[30px] place-items-center rounded-[7px] bg-[#d9af63] text-[10px] font-bold text-[#563d15] border-0 cursor-pointer hover:opacity-90 transition-opacity"
        aria-haspopup="true"
        aria-expanded={open}
        title="User menu"
      >
        {initials}
      </button>
      {open && (
        <div
          id="user-menu-dropdown"
          className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[200px] rounded-[10px] border border-[#e7e9ed] bg-white shadow-[0_8px_24px_rgba(23,33,47,.12)] overflow-hidden"
        >
          <div className="flex items-center gap-2.5 border-b border-[#f0f2f5] px-4 py-3">
            <span className="grid size-[32px] flex-none place-items-center rounded-[7px] bg-[#d9af63] text-[10px] font-bold text-[#563d15]">
              {initials}
            </span>
            <div>
              <strong className="block text-[13px] font-semibold text-[#1b2836]">{name}</strong>
              <small className="block text-[11px] text-[#657182]">{role}</small>
            </div>
          </div>
          <button
            id="sign-out-button"
            className="flex w-full items-center gap-2.5 border-0 bg-transparent px-4 py-3 text-[13px] text-[#657182] hover:bg-[#f5f7fa] hover:text-[#d85962] cursor-pointer transition-colors"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { logout, user } = useAuth();
  const isOrganizationAdmin = user?.memberships.some((membership) => membership.role === "organization_admin") ?? false;
  const pendingSyncQuery = useQuery({ queryKey: ["kobo-pending-sync"], queryFn: apiClient.pendingKoboSync, enabled: isOrganizationAdmin, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const pendingSync = pendingSyncQuery.data;
  const pendingCount = pendingSync?.pending_count ?? 0;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const displayName = user?.username || user?.email || "User";
  const displayRole = isOrganizationAdmin ? "Organization administrator" : "Field team member";
  const currentDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const page =
    pathname === "/" ? "Dashboard" : pathname.split("/")[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <div className="min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-[5] flex w-[258px] flex-col overflow-hidden bg-navy text-[#b5c7d5] max-[1440px]:w-[232px] max-[1050px]:w-[245px] max-[1050px]:shadow-[12px_0_30px_rgba(7,31,71,.16)] max-[1050px]:transition-transform max-[1050px]:duration-[240ms] max-[1050px]:ease-snappy max-[560px]:w-[min(280px,86vw)] ${open ? "max-[1050px]:translate-x-0" : "max-[1050px]:-translate-x-full"}`}
      >
        <NavLink
          to="/"
          className="flex h-[60px] flex-none items-center px-5 text-[18px] font-bold tracking-[-.25px] text-white no-underline max-[1440px]:h-16 max-[1440px]:px-[21px] max-[1440px]:text-lg [@media(max-height:760px)_and_(min-width:1051px)]:h-[58px] [@media(max-height:760px)_and_(min-width:1051px)]:py-[13px]"
        >
          <b className="mr-[9px] grid size-[30px] place-items-center rounded-[7px] bg-brand shadow-[inset_0_0_0_1px_#ffffff20] max-[1440px]:size-7">
            <BarChart3 className="stroke-2" size={16} />
          </b>
          <span className="leading-none">FieldSight</span>
        </NavLink>
        <div className="mx-3 mb-4 mt-1 flex flex-none items-center gap-[9px] rounded-[9px] border border-[#234d82] bg-[#103564] px-2.5 py-3 max-[1440px]:mx-3 max-[1440px]:mb-[13px] max-[1440px]:mt-1 max-[1440px]:p-[9px] [@media(max-height:760px)_and_(min-width:1051px)]:mb-2 [@media(max-height:760px)_and_(min-width:1051px)]:px-[9px] [@media(max-height:760px)_and_(min-width:1051px)]:py-[7px]">
          <span className="grid size-[29px] place-items-center rounded-[7px] bg-[#d9af63] text-[10px] font-bold text-[#563d15] max-[1440px]:size-[27px]">
            CH
          </span>
          <div>
            <small className="block text-[10px] tracking-[.8px] text-[#91a9bb] max-[1440px]:text-[9px]">
              ORGANIZATION
            </small>
            <strong className="text-[13px] text-white max-[1440px]:text-xs">Community Health</strong>
          </div>
          <ChevronDown className="ml-auto" size={15} />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigation.map((section) => (
            <div key={section.label}>
              <p className="mx-[14px] mb-[7px] mt-[18px] text-[10px] font-semibold uppercase tracking-[.09em] text-[#91a9bb] max-[1440px]:mx-3 max-[1440px]:mb-[5px] max-[1440px]:mt-3 max-[1440px]:text-[9px] [@media(max-height:760px)_and_(min-width:1051px)]:mb-[3px] [@media(max-height:760px)_and_(min-width:1051px)]:mt-2">
                {section.label}
              </p>
              {section.items.map(({ name, path, icon: Icon, count }) => (
                <NavLink
                  end={path === "/"}
                  key={path}
                  to={path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `my-0.5 flex min-h-10 w-full items-center gap-3 rounded-[7px] px-[13px] py-[9px] text-[13px] font-medium leading-[1.25] no-underline transition-colors hover:bg-[rgba(11,81,183,.52)] hover:text-white max-[1440px]:min-h-9 max-[1440px]:gap-2.5 max-[1440px]:px-[11px] max-[1440px]:py-[7px] max-[1440px]:text-xs [@media(max-height:760px)_and_(min-width:1051px)]:min-h-8 [@media(max-height:760px)_and_(min-width:1051px)]:py-[5px] ${isActive ? "bg-[rgba(11,81,183,.52)] text-white" : "text-[#b5c7d5]"}`
                  }
                >
                  <Icon className="max-[1440px]:size-[17px]" size={18} />
                  {name}
                  {count && <em className="ml-auto text-[11px] not-italic">{count}</em>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

      </aside>
      <main className="ml-[258px] min-h-screen max-[1440px]:ml-[232px] max-[1050px]:ml-0">
        <header className="sticky top-0 z-[4] flex h-[60px] w-full items-center justify-between border-b border-[#eceff5] bg-white px-6 text-[#657182] shadow-[0_1px_4px_rgba(23,33,47,.04)] max-[1440px]:h-16 max-[1440px]:px-7 max-[1050px]:px-5 max-[560px]:h-[58px] max-[560px]:px-[14px] [@media(max-height:760px)_and_(min-width:1051px)]:h-[58px]">
          <button
            className="hidden place-items-center border-0 bg-transparent max-[1050px]:grid"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <div className="flex items-center gap-3 text-[13px]">
            <span>{page}</span>
            <i className="not-italic text-[#d0d5dc]">/</i>
            <strong className="font-medium text-[#1b2836] max-[560px]:hidden">{currentDate}</strong>
          </div>
          <div className="flex items-center gap-[17px] max-[560px]:gap-3">
            <Search size={19} />
            <span className="relative grid size-7 place-items-center" title={`${pendingCount} Kobo submission${pendingCount === 1 ? "" : "s"} waiting to sync`}>
              <Bell size={19} />
              <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full border-2 border-white bg-[#d85962] px-1 text-[9px] font-bold leading-4 text-white">{pendingCount > 99 ? "99+" : pendingCount}</span>
            </span>
            <span className="flex items-center gap-[5px] border-l border-[#e7e9ed] pl-[17px] text-[13px] max-[560px]:hidden">
              <HelpCircle size={17} /> Help
            </span>
            <UserMenu logout={logout} navigate={navigate} name={displayName} role={displayRole} />
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] px-6 pb-10 pt-6 max-[1440px]:px-7 max-[1440px]:pb-[42px] max-[1440px]:pt-[27px] max-[560px]:px-[14px] max-[560px]:pb-[35px] max-[560px]:pt-[21px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
