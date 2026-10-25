import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  FileBarChart,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Settings,
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
      title: "Project",
      items: [
        { name: "Projects", path: "/projects", icon: FolderKanban },
        {
          name: "Details & activity",
          path: workspace.hasSelectedProject
            ? `/projects/${workspace.projectId}`
            : "/projects",
          icon: ClipboardList,
        },
        { name: "Forms", path: "/forms", icon: FileText },
        { name: "Indicators", path: workspace.projectId ? `/projects/${workspace.projectId}/indicators` : "/indicators", icon: BarChart3 },
        { name: "Field Team", path: workspace.projectId ? `/projects/${workspace.projectId}/team` : "/team", icon: ClipboardList },
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
        { name: "Kobo connections", path: "/forms/connections", icon: Link2 },
        { name: "Submissions", path: "/submissions", icon: FileText },
        { name: "Data Quality", path: "/quality", icon: ClipboardList },
      ],
    },
    {
      title: "Administration",
      items: [
        { name: "Organization settings", path: "/settings", icon: Settings },
      ],
    },
  ];
  function active(path: string) {
    if (path === "/projects") return location.pathname === "/projects";
    if (workspace.projectId && path === `/projects/${workspace.projectId}`)
      return location.pathname === path;
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
        id="fieldsight-navigation"
        className={`fixed bottom-0 left-0 top-16 z-40 w-[220px] flex-col border-r border-[#173d6e] bg-[#071f47] text-[#b5c7d5] transition-transform ${open ? "flex translate-x-0" : "hidden lg:flex"}`}
      >
        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-5"
        >
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#91a9bb]">
                {section.title}
              </p>
              {section.items.map(({ name, path, icon: Icon }) => name === "Details & activity" && !workspace.hasSelectedProject ? (
                <div key={name} className="my-0.5 px-3 py-2">
                  <span aria-disabled="true" className="flex items-center gap-2.5 text-xs text-[#91a9bb] opacity-60">
                    <Icon size={15} />{name}
                  </span>
                  <NavLink to="/projects" onClick={() => setOpen(false)} className="mt-1 block pl-6 text-[12px] text-[#b5c7d5] underline underline-offset-2">
                    Choose a project first
                  </NavLink>
                </div>
              ) : (
                <NavLink
                  key={name}
                  to={workspace.projectId && ["/forms", "/data-tables", "/analytics", "/dashboards", "/submissions", "/quality", "/reports"].includes(path)
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
      <main className="min-h-screen pt-16 lg:ml-[220px]">
        <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-4 border-b border-[#e1e7eb] bg-white px-6 max-sm:px-4">
          <button
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="fieldsight-navigation"
            className="border-0 bg-transparent lg:hidden"
            onClick={() => setOpen(!open)}
          >
            <Menu size={20} />
          </button>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs">
            <span className="max-sm:hidden">Project</span>
            <select aria-label="Selected project" className="min-w-0 max-w-sm rounded border border-[#dce4e8] bg-white p-2" value={workspace.projectId} onChange={event => workspace.selectProject(event.target.value)} disabled={workspace.loading || !workspace.projects.length}>
              {!workspace.projects.length && <option value="">{workspace.loading ? "Loading projects…" : "No projects"}</option>}
              {workspace.projects.map(project => <option key={project.id} value={project.id}>{project.name}{project.status === "archived" ? " (archived)" : ""}</option>)}
            </select>
          </label>
          <div className="relative">
            <button
              aria-label="Sync notifications"
              onClick={() => setNotifications(!notifications)}
              className="relative grid size-8 place-items-center rounded-md border-0 bg-transparent text-[#71858e]"
            >
              <Bell size={17} />
              {Boolean(pending.data?.pending_count) && (
                <span className="absolute -right-1 -top-1 rounded-full bg-[#d85962] px-1 text-[11px] text-white">
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
              className="fieldsight-avatar grid size-9 shrink-0 place-items-center rounded-full border-0 bg-[#e6f1f2] p-0 text-[12px] font-semibold text-[#197b8a]"
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
