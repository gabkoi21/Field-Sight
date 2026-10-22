import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  Database,
  FileBarChart,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiClient } from "../services/apiClient";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";

export function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
function Shell() {
  const { user, logout } = useAuth();
  const workspace = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const pending = useQuery({
    queryKey: ["kobo-pending-sync"],
    queryFn: apiClient.pendingKoboSync,
    enabled: workspace.isAdmin,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });
  const sections = [
    {
      title: "Workspace",
      items: [
        { name: "Workspaces", path: "/projects", icon: FolderKanban },
        {
          name: "Details & activity",
          path: workspace.projectId
            ? `/projects/${workspace.projectId}`
            : "/projects",
          icon: ClipboardList,
        },
        { name: "Forms", path: "/forms", icon: FileText },
        { name: "Data tables", path: "/data-tables", icon: Database },
      ],
    },
    {
      title: "Results & reporting",
      items: [
        { name: "Dashboards", path: "/dashboards", icon: LayoutDashboard },
        { name: "Explore & analyze", path: "/analytics", icon: BarChart3 },
        { name: "Reports", path: "/reports", icon: FileBarChart },
      ],
    },
    {
      title: "Data operations",
      items: [
        { name: "Collection overview", path: "/", icon: BarChart3 },
        { name: "Kobo connections", path: "/forms/connections", icon: Link2 },
        { name: "Submissions", path: "/submissions", icon: FileText },
        { name: "Data quality", path: "/quality", icon: ShieldCheck },
        { name: "Field team", path: "/enumerators", icon: Users },
      ],
    },
    {
      title: "Administration",
      items: [
        { name: "Team & invitations", path: "/team", icon: Users },
        { name: "Organization settings", path: "/settings", icon: Settings },
      ],
    },
  ];
  function active(path: string) {
    if (path === "/projects") return location.pathname === "/projects";
    if (workspace.projectId && path === `/projects/${workspace.projectId}`)
      return location.pathname === path || location.pathname === `${path}/indicators` || location.pathname === `${path}/team`;
    return location.pathname === path;
  }
  return (
    <div className="fieldsight-workspace min-h-screen bg-[#f5f7f8] text-[#24434c]">
      {open && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 border-0 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-[#173d6e] bg-[#071f47] text-[#b5c7d5] transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <NavLink
          to="/projects"
          className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[#173d6e] px-5 text-xl font-bold tracking-tight text-white no-underline"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-[#0b51b7] text-white">
            <BarChart3 size={18} />
          </span>
          FieldSight
        </NavLink>
        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-5"
        >
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[.12em] text-[#91a9bb]">
                {section.title}
              </p>
              {section.items.map(({ name, path, icon: Icon }) => (
                <NavLink
                  key={name}
                  to={workspace.projectId && ["/forms", "/data-tables", "/analytics", "/dashboards"].includes(path)
                    ? `${path}?project_id=${workspace.projectId}`
                    : path}
                  onClick={() => setOpen(false)}
                  className={`my-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-xs no-underline transition-colors hover:bg-[#0b51b7]/50 hover:text-white ${active(path) ? "bg-[#0b51b7]/50 font-semibold text-white" : "text-[#b5c7d5]"}`}
                >
                  <Icon size={15} />
                  {name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <NavLink
          to="/guide"
          onClick={() => setOpen(false)}
          className="m-3 flex items-center gap-2 rounded-md border border-[#234d82] bg-[#103564] px-3 py-2.5 text-xs font-medium text-[#dceaf5] no-underline"
        >
          <BookOpen size={15} />
          Quick-start guide<span className="ml-auto">↗</span>
        </NavLink>
      </aside>
      <main className="min-h-screen lg:ml-[220px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-[#e1e7eb] bg-white px-6 max-sm:px-4">
          <button
            aria-label="Toggle navigation"
            className="border-0 bg-transparent lg:hidden"
            onClick={() => setOpen(!open)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="relative">
            <button
              aria-label="Sync notifications"
              onClick={() => setNotifications(!notifications)}
              className="relative grid size-8 place-items-center rounded-md border-0 bg-transparent text-[#71858e]"
            >
              <Bell size={17} />
              {Boolean(pending.data?.pending_count) && (
                <span className="absolute -right-1 -top-1 rounded-full bg-[#d85962] px-1 text-[9px] text-white">
                  {pending.data?.pending_count}
                </span>
              )}
            </button>
            {notifications && (
              <div className="absolute right-0 top-11 w-64 rounded-lg border border-[#dce4e8] bg-white p-4 text-xs shadow-lg">
                <strong>Collection sync</strong>
                <p>
                  {pending.isError
                    ? "Unable to check sync status."
                    : `${pending.data?.pending_count ?? 0} submissions waiting to sync.`}
                </p>
                <NavLink
                  className="text-[#117e8f]"
                  to="/forms/connections"
                  onClick={() => setNotifications(false)}
                >
                  Manage sources →
                </NavLink>
              </div>
            )}
          </div>
          <NavLink
            to="/guide"
            aria-label="Help and quick-start guide"
            className="flex items-center gap-1.5 text-xs text-[#71858e] no-underline"
          >
            <HelpCircle size={17} />
            <span className="max-sm:hidden">Help</span>
          </NavLink>
          <div className="relative">
            <button
              aria-label="User menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              className="rounded-full border-0 bg-[#e6f1f2] px-3 py-2 text-[10px] font-semibold text-[#197b8a]"
            >
              {user?.email.slice(0, 2).toUpperCase()}
            </button>
            {menu && (
              <div className="absolute right-0 top-11 w-60 rounded-lg border border-[#e0e8eb] bg-white p-2 shadow-lg">
                <p className="truncate border-b border-[#edf0f2] px-2 pb-3 text-xs text-[#73868d]">
                  {user?.email}
                </p>
                {[
                  ["Profile & security", "/profile"],
                  ["Team & invitations", "/team"],
                  ["Quick-start guide", "/guide"],
                ].map(([label, to]) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMenu(false)}
                    className="block rounded px-2 py-2 text-xs text-inherit no-underline hover:bg-[#f0f7f8]"
                  >
                    {label}
                  </NavLink>
                ))}
                <button
                  onClick={async () => {
                    await logout();
                    navigate("/login", { replace: true });
                  }}
                  className="flex w-full items-center gap-2 border-0 bg-transparent px-2 py-2 text-xs text-[#bc5861]"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="mx-auto max-w-[1600px] px-6 py-7 max-sm:px-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
