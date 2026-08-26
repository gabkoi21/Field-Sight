import { useState } from "react";
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
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  UserCog,
  Users,
  LogOut,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

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
      { name: "Field Enumerator", path: "/enumerators", icon: Users },
      { name: "Sync history", path: "/sync", icon: RefreshCw },
    ],
  },
  {
    label: "Data quality",
    items: [
      { name: "Explore & analyze", path: "/analytics", icon: BarChart3 },
      { name: "Reports", path: "/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Team", path: "/team", icon: UserCog },
      { name: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
        <div className="flex w-full flex-none items-center gap-2.5 border-t border-[#294966] px-[19px] py-[15px] max-[1440px]:px-5 max-[1440px]:py-[11px] [@media(max-height:760px)_and_(min-width:1051px)]:py-[9px]">
          <span className="grid size-[29px] place-items-center rounded-[7px] bg-[#d9af63] text-[10px] font-bold text-[#563d15] max-[1440px]:size-[27px]">
            AJ
          </span>
          <div>
            <strong className="block text-[13px] text-white max-[1440px]:text-xs">Amara Johnson</strong>
            <small className="block text-[10px] tracking-[.8px] text-[#91a9bb] max-[1440px]:text-[9px]">
              Data Manager
            </small>
          </div>
          <MoreHorizontal className="ml-auto" size={17} />
        </div>
        <button
          className="mx-3 mb-3 flex items-center gap-2 rounded-[7px] border-0 bg-transparent px-3 py-2 text-xs text-[#b5c7d5] hover:bg-[rgba(11,81,183,.52)] hover:text-white"
          onClick={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
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
            <strong className="font-medium text-[#1b2836] max-[560px]:hidden">Tuesday, August 19</strong>
          </div>
          <div className="flex items-center gap-[17px] max-[560px]:gap-3">
            <Search size={19} />
            <span className="relative after:absolute after:-right-[3px] after:-top-[3px] after:size-1.5 after:rounded-full after:border after:border-white after:bg-[#d85962] after:content-['']">
              <Bell size={19} />
            </span>
            <span className="flex items-center gap-[5px] border-l border-[#e7e9ed] pl-[17px] text-[13px] max-[560px]:hidden">
              <HelpCircle size={17} /> Help
            </span>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] px-6 pb-10 pt-6 max-[1440px]:px-7 max-[1440px]:pb-[42px] max-[1440px]:pt-[27px] max-[560px]:px-[14px] max-[560px]:pb-[35px] max-[560px]:pt-[21px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
