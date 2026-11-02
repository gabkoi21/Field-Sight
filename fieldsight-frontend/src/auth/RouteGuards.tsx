import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { skipLogin } from "./developmentAccess";
import { apiClient } from "../services/apiClient";
import { WorkspaceShell } from "../workspace/WorkspaceShell";

function SessionLoading() {
  return <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-[var(--fs-surface)] text-sm text-[var(--fs-muted)]">Checking your session…</div>;
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, loading, status, retry, logout } = useAuth();
  const location = useLocation();
  if (skipLogin) return children;
  if (status === "unavailable" || status === "forbidden") return <div role="alert" className="p-8">
    <p>{status === "forbidden" ? "Your account does not have workspace access." : "Reconnecting to your session. Protected data is paused."}</p>
    <button onClick={retry}>Retry connection</button>
    <button onClick={() => { void logout().catch(() => undefined); }}>Sign out</button>
  </div>;
  if (loading) return <SessionLoading />;
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  if (user.platform_role !== "super_admin") return <Navigate replace to="/" />;
  return children;
}

export function RequireOrganizationMember({ children }: { children: ReactNode }) {
  const { user, loading, status, retry, logout } = useAuth();
  const location = useLocation();
  if (skipLogin) return children;
  if (status === "unavailable" || status === "forbidden") return <div role="alert" className="p-8">
    <p>{status === "forbidden" ? "Your account does not have workspace access." : "Reconnecting to your session. Protected data is paused."}</p>
    <button onClick={retry}>Retry connection</button>
    <button onClick={() => { void logout().catch(() => undefined); }}>Sign out</button>
  </div>;
  if (loading) return apiClient.hasStoredAccessToken() ? <WorkspaceShell loading /> : <SessionLoading />;
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  if (user.platform_role === "super_admin" && user.memberships.length === 0) {
    return <Navigate replace to="/superadmin" />;
  }
  return children;
}
