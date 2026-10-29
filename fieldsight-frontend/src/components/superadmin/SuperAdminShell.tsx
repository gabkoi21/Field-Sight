import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Bell, Building2, CircleDollarSign, FileClock, LayoutDashboard, LogOut, Menu, PanelLeftClose, Search, Server, Settings, Tags, Users } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { RouteContent } from "../layout/RouteContent";
import { AdminDialog } from "./AdminDialog";
import "./superadmin.css";
const navigation = [
  { label: "Platform", items: [["Dashboard", "/superadmin", LayoutDashboard], ["Organizations", "/superadmin/organizations", Building2], ["Users & roles", "/superadmin/users", Users], ["Sectors", "/superadmin/sectors", Tags]] },
  { label: "Operations", items: [["System health", "/superadmin/system", Server], ["Audit logs", "/superadmin/audit", FileClock], ["Billing & plans", "/superadmin/billing", CircleDollarSign]] },
  { label: "Configuration", items: [["Platform settings", "/superadmin/settings", Settings]] },
] as const;
function Navigation({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  return <><NavLink to="/superadmin" className="sa-logo" onClick={onNavigate} aria-label="FieldSight platform"><BarChart3 aria-hidden="true" />{!collapsed && "FieldSight"}</NavLink><p className="sa-context">{collapsed ? "SA" : "SUPER ADMINISTRATION"}</p><nav aria-label="Super administration">{navigation.map(section => <section key={section.label}><p>{collapsed ? "·" : section.label}</p>{section.items.map(([label, path, Icon]) => <NavLink key={path} to={path} end={path === "/superadmin"} title={label} aria-label={label} onClick={onNavigate} className={({ isActive }) => isActive ? "active" : ""}><Icon size={19} aria-hidden="true" />{!collapsed && label}</NavLink>)}</section>)}</nav></>;
}
export function SuperAdminShell() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false); const [profileOpen, setProfileOpen] = useState(false); const [collapsed, setCollapsed] = useState(false);
  const [logoutError, setLogoutError] = useState(""); const [signingOut, setSigningOut] = useState(false);
  const current = navigation.flatMap(s => [...s.items]).find(item => item[1] === pathname);
  const name = user?.username || user?.email || "Administrator";
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  async function signOut() { setSigningOut(true); setLogoutError(""); try { await logout(); navigate("/login", { replace: true }); } catch { setLogoutError("Sign out could not complete. Please retry."); } finally { setSigningOut(false); } }
  const signOutButton: ReactNode = <button onClick={() => void signOut()} disabled={signingOut}><LogOut size={18} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button>;
  return <div className={`sa-root ${collapsed ? "sa-collapsed" : ""}`}><a href="#sa-content" className="sa-skip">Skip to content</a>
    <aside className="sa-sidebar"><Navigation collapsed={collapsed} onNavigate={() => setMobileOpen(false)} /><button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(value => !value)}><PanelLeftClose size={19} aria-hidden="true" />{!collapsed && "Collapse sidebar"}</button>{signOutButton}</aside>
    {mobileOpen && <AdminDialog label="Platform navigation" onClose={() => setMobileOpen(false)}><div className="sa-mobile-nav"><button autoFocus onClick={() => setMobileOpen(false)}>Close navigation</button><Navigation collapsed={false} onNavigate={() => setMobileOpen(false)} />{signOutButton}</div></AdminDialog>}
    <div className="sa-workspace"><header className="sa-header"><div className="flex min-w-0 items-center gap-3"><button className="sa-menu" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21} /></button><nav aria-label="Breadcrumb" className="text-sm text-[var(--fs-muted)]"><NavLink to="/superadmin">Super admin</NavLink><span aria-hidden="true"> / </span><strong className="font-semibold text-[var(--fs-text)]">{current?.[0] || "Platform"}</strong></nav></div><div className="flex shrink-0 items-center gap-2"><span title="Global search is unavailable. Use each directory’s search field."><button disabled aria-label="Search unavailable"><Search size={18} /></button></span><span title="Notification delivery is not configured"><button disabled aria-label="Notifications unavailable"><Bell size={18} /></button></span><button className="sa-avatar" aria-label="Open profile settings" onClick={() => setProfileOpen(true)}>{name.slice(0, 2).toUpperCase()}</button></div></header><main id="sa-content" className="sa-content" tabIndex={-1}>{logoutError && <p role="alert">{logoutError}</p>}<RouteContent /></main></div>
    {profileOpen && <AdminDialog label="Administrator profile" onClose={() => setProfileOpen(false)}><h2 className="text-xl font-semibold">Administrator profile</h2><dl className="space-y-3 py-4"><dt>Name</dt><dd>{name}</dd><dt>Email</dt><dd className="break-all">{user?.email || "Unavailable"}</dd><dt>Role</dt><dd>Super administrator</dd></dl><p className="text-sm text-[var(--fs-muted)]">Profile editing is unavailable.</p><div className="mt-5 flex gap-3">{signOutButton}<button onClick={() => setProfileOpen(false)}>Close profile</button></div>{logoutError && <p role="alert">{logoutError}</p>}</AdminDialog>}
  </div>;
}
