import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ClipboardList,
  FileBarChart,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ProjectLink as Link, ProjectNavLink as NavLink } from "./projectRouting";
import { useAuth } from "../auth/AuthContext";
import { apiClient } from "../services/apiClient";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { cleanProjectPath, projectUrlKey } from "./projectRouting";
import { LoadingState } from "../components/ui";
import { RouteContent } from "../components/layout/RouteContent";

export function WorkspaceShell({ loading = false }: { loading?: boolean }) {
  return (
    <WorkspaceProvider>
      <Shell loading={loading} />
    </WorkspaceProvider>
  );
}
function Shell({ loading }: { loading: boolean }) {
  const { user, logout } = useAuth();
  const workspace = useWorkspace();
  const projectKey = projectUrlKey(workspace.project ?? { id: workspace.projectId });
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const drawer = navigation.current;
    const controls = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    controls()[0]?.focus();
    if (main.current) main.current.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", keyboard);
    desktop.addEventListener("change", resize);
    return () => {
      if (main.current) main.current.inert = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
      desktop.removeEventListener("change", resize);
      navigationToggle.current?.focus();
    };
  }, [open]);
  const pending = useQuery({
    queryKey: ["kobo-pending-sync"],
    queryFn: apiClient.pendingKoboSync,
    enabled: workspace.isAdmin && !loading,
    staleTime: 5000,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    meta: { backgroundRefresh: true },
  });
  // The URL still identifies the current page while project data is loading.
  const navigationHasProject = workspace.hasSelectedProject ||
    Boolean(workspace.projectId && (loading || workspace.loading));
  const sections = [
    {
      title: "Project",
      items: [
        { name: "Projects", path: "/projects", icon: FolderKanban },
        {
          name: "Overview",
          path: navigationHasProject
            ? `/projects/${projectKey}/overview`
            : "/projects",
          icon: LayoutDashboard,
        },
        {
          name: "Details & activity",
          path: navigationHasProject
            ? `/projects/${projectKey}/details`
            : "/projects",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Results & reporting",
      items: [
        { name: "Project dashboards", path: "/dashboards", icon: LayoutDashboard },
        { name: "Reports", path: "/reports", icon: FileBarChart },
      ],
    },
    {
      title: "Data operations",
      items: [
        { name: "Kobo connections", path: "/forms/connections", icon: Link2 },
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
    path = cleanProjectPath(path);
    if (path.endsWith("/indicators") && location.pathname === "/indicators") return true;
    if (path.endsWith("/team") && ["/team", "/enumerators"].includes(location.pathname)) return true;
    if (path === "/projects") return location.pathname === "/projects";
    if (workspace.projectId && path === `/projects/${projectKey}`)
      return location.pathname === path;
    return location.pathname === path;
  }
  return (
    <div className={`fieldsight-workspace min-h-screen bg-[var(--fs-canvas)] text-[var(--fs-text)] ${collapsed ? "workspace-collapsed" : ""}`}>
      <a href="#main-content" className="sr-only fixed left-4 top-2 z-[100] rounded-lg bg-white px-4 py-3 font-semibold text-brand shadow-lg focus:not-sr-only">Skip to main content</a>
      {open && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 border-0 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={navigation}
        id="fieldsight-navigation"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Navigation" : undefined}
        className={`fixed bottom-0 left-0 top-16 z-40 w-[240px] flex-col border-r border-[#173d6e] bg-[#071f47] text-[#b5c7d5] transition-transform ${open ? "flex translate-x-0" : "hidden lg:flex"}`}
      >
        {open && <button className="m-3 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-white lg:hidden" onClick={() => setOpen(false)}><X size={18} aria-hidden="true" />Close navigation</button>}
        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-5"
        >
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="navigation-section-label mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#91a9bb]">
                {section.title}
              </p>
              {section.items.map(({ name, path, icon: Icon }) => ["Overview", "Details & activity"].includes(name) && !navigationHasProject ? (
                <div key={name} aria-disabled="true" className="navigation-project-hint my-0.5 flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#91a9bb] opacity-60">
                  <Icon size={17} aria-hidden="true" /><span className="navigation-label">{name}</span>
                </div>
              ) : (
                <Link
                  key={name}
                  title={name}
                  aria-label={name}
                  aria-current={active(path) ? "page" : undefined}
                  to={workspace.projectId && ["/forms", "/data-tables", "/dashboards", "/submissions", "/reports"].includes(path)
                    ? `${path}?project_id=${projectKey}`
                    : path}
                  onClick={() => setOpen(false)}
                  className={`my-0.5 flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm no-underline transition-colors focus-visible:outline-white hover:bg-[#0b51b7]/50 hover:text-white ${active(path) ? "bg-[#0b51b7]/50 font-semibold text-white" : "text-[#b5c7d5]"}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span className="navigation-label">{name}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="fieldsight-navigation" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(value => !value)} className="m-3 hidden min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-white hover:bg-white/10 focus-visible:outline-white lg:flex"><PanelLeftClose size={19} className="shrink-0" aria-hidden="true" /></button>
      </aside>
      <main ref={main} className="min-h-screen pt-16 lg:ml-[240px]">
        <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-2 sm:gap-4 border-b border-[var(--fs-border)] bg-white px-4 sm:px-6">
          <button
            ref={navigationToggle}
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="fieldsight-navigation"
            className="grid size-11 shrink-0 place-items-center border-0 bg-transparent lg:hidden"
            onClick={() => setOpen(!open)}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1" />
          <div className="relative">
            <button
              aria-label="Sync notifications"
              aria-expanded={notifications}
              onClick={() => { setNotifications(!notifications); if (workspace.isAdmin && !loading) void pending.refetch(); }}
              className="relative grid size-11 shrink-0 place-items-center rounded-md border-0 bg-transparent text-[var(--fs-muted)] transition-colors hover:text-[var(--fs-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-primary)]"
            >
              <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
              <span
                aria-label={`${pending.data?.pending_count ?? 0} pending sync notifications`}
                aria-live="polite"
                aria-atomic="true"
                className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#dc2626] px-1 text-[10px] font-bold leading-none tabular-nums text-white"
              >
                {pending.data?.pending_count ?? 0}
              </span>
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
                  className="text-[var(--fs-primary)]"
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
            className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 text-xs text-[var(--fs-muted)] no-underline"
          >
            <HelpCircle size={17} />
            <span className="max-sm:hidden">Help</span>
          </NavLink>
          <div className="relative">
            <button
              aria-label="User menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              className="fieldsight-avatar grid size-11 shrink-0 place-items-center rounded-full border-0 bg-blue-50 p-0 text-[12px] font-semibold text-[var(--fs-primary)]"
            >
              {user?.email.slice(0, 2).toUpperCase()}
            </button>
            {menu && (
              <div className="absolute right-0 top-11 w-60 rounded-lg border border-[var(--fs-border)] bg-white p-2 shadow-lg">
                <p className="truncate border-b border-[#edf0f2] px-2 pb-3 text-xs text-[var(--fs-muted)]">
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
                    className="block rounded px-2 py-2 text-xs text-inherit no-underline hover:bg-blue-50"
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
        <div id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {loading ? <LoadingState label="Loading your session..." /> : workspace.invalidProject ? (
            <section role="alert" className="rounded-xl border border-[var(--fs-border)] bg-white p-6">
              <h1 className="text-xl font-semibold">Project not found</h1>
              <p className="mt-2 text-sm text-[var(--fs-muted)]">This project link is unavailable in your organization.</p>
              <Link className="mt-4 inline-block text-sm font-semibold text-brand" to="/projects">Back to projects</Link>
            </section>
          ) : <RouteContent />}
        </div>
      </main>
    </div>
  );
}
