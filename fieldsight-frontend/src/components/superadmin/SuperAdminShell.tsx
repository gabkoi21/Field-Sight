import { SidebarScrollArea } from "../ui/SidebarScrollArea";
import { useEffect, useRef, useState } from "react";
import { Building2, CircleDollarSign, FileClock, LayoutDashboard, LogOut, Menu, PanelLeftClose, Server, Tags, Users } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { RouteContent } from "../layout/RouteContent";
import { AdminDialog } from "./AdminDialog";
import { AdminProfile } from "./AdminProfile";
import "./superadmin.css";
const navigation = [
  { label: "Platform", items: [["Dashboard", "/superadmin", LayoutDashboard], ["Organizations", "/superadmin/organizations", Building2], ["Users & roles", "/superadmin/users", Users], ["Sectors", "/superadmin/sectors", Tags]] },
  { label: "Operations", items: [["System health", "/superadmin/system", Server], ["Audit logs", "/superadmin/audit", FileClock], ["Billing & plans", "/superadmin/billing", CircleDollarSign]] },
] as const;
function Navigation({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  return <><nav aria-label="Super administration">{navigation.map(section => <section key={section.label}><p className="sa-navigation-heading" aria-hidden={collapsed}>{section.label}</p>{section.items.map(([label, path, Icon]) => <NavLink key={path} to={path} end={path === "/superadmin"} title={label} aria-label={label} onClick={onNavigate} className={({ isActive }) => isActive ? "active" : ""}><Icon size={19} aria-hidden="true" /><span className="sa-navigation-label" aria-hidden={collapsed}>{label}</span></NavLink>)}</section>)}</nav></>;
}
export function SuperAdminShell() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false); const [profileOpen, setProfileOpen] = useState(false); const [collapsed, setCollapsed] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1280);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const [logoutError, setLogoutError] = useState(""); const [signingOut, setSigningOut] = useState(false);
  const current = navigation.flatMap(s => [...s.items]).find(item => item[1] === pathname);
  const currentTitle = pathname === "/superadmin/settings" ? "Platform settings" : current?.[0] || "Platform";
  const name = user?.username || user?.email || "Administrator";
  useEffect(() => { setMobileOpen(false); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [accountOpen]);
  async function signOut() { setSigningOut(true); setLogoutError(""); try { await logout(); navigate("/login", { replace: true }); } catch { setLogoutError("Sign out could not complete. Please retry."); } finally { setSigningOut(false); } }
  return <div className={`sa-root ${collapsed ? "sa-collapsed" : ""}`}><a href="#sa-content" className="sa-skip">Skip to content</a>
    <aside className="sa-sidebar"><SidebarScrollArea><Navigation collapsed={collapsed} onNavigate={() => setMobileOpen(false)} /></SidebarScrollArea><button aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(value => !value)}><span className="sa-navigation-label" aria-hidden={collapsed}>Collapse</span><PanelLeftClose size={19} aria-hidden="true" /></button></aside>
    {mobileOpen && <AdminDialog label="Platform navigation" onClose={() => setMobileOpen(false)}><div className="sa-mobile-nav"><button autoFocus onClick={() => setMobileOpen(false)}>Close navigation</button><Navigation collapsed={false} onNavigate={() => setMobileOpen(false)} /></div></AdminDialog>}
    <div className="sa-workspace"><header className="sa-header"><div className="flex min-w-0 items-center gap-3"><button className="sa-menu" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21} /></button><nav aria-label="Breadcrumb" className="text-sm text-[var(--fs-muted)]"><NavLink to="/superadmin">Super admin</NavLink><span aria-hidden="true"> / </span><strong className="font-semibold text-[var(--fs-text)]">{currentTitle}</strong></nav></div><div ref={accountRef} className="sa-account"><button ref={accountButtonRef} type="button" className="sa-avatar" aria-label="User menu" aria-expanded={accountOpen} aria-controls="sa-account-options" onClick={() => setAccountOpen(open => !open)}>{name.slice(0, 2).toUpperCase()}</button>{accountOpen && <nav id="sa-account-options" className="sa-account-dropdown" aria-label="User account"><p title={user?.email}>{user?.email || name}</p><button type="button" onClick={() => { setAccountOpen(false); setProfileOpen(true); }}>Profile & settings</button><NavLink to="/superadmin/settings" onClick={() => setAccountOpen(false)}>Platform settings</NavLink><button type="button" className="sa-account-signout" onClick={() => void signOut()} disabled={signingOut}><LogOut size={14} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button></nav>}</div></header><main id="sa-content" className="sa-content" tabIndex={-1}>{logoutError && <p role="alert">{logoutError}</p>}<RouteContent /></main></div>
    {profileOpen && <AdminDialog label="Administrator profile" onClose={() => setProfileOpen(false)}><AdminProfile onClose={() => setProfileOpen(false)} /></AdminDialog>}
  </div>;
}
