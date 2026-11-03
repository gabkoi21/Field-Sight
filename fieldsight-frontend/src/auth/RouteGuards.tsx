import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { skipLogin } from "./developmentAccess";
import { apiClient } from "../services/apiClient";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "../components/ui/Button";

function SessionLoading() {
  return <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-[var(--fs-surface)] text-sm text-[var(--fs-muted)]">Checking your session…</div>;
}

function SessionUnavailable() {
  const { retry, logout } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--fs-canvas)] px-5 py-12">
      <section aria-labelledby="session-error-title" className="w-full max-w-md rounded-2xl border border-[var(--fs-border)] bg-[var(--fs-surface)] p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[var(--fs-primary)]">
          <WifiOff size={26} aria-hidden="true" />
        </div>
        <div role="alert">
          <h1 id="session-error-title" className="m-0 text-2xl font-semibold tracking-tight text-[var(--fs-text)]">Oops! We couldn’t connect</h1>
          <p className="mb-0 mt-3 text-sm leading-6 text-[var(--fs-muted)]">We’re having trouble connecting to your session. Check your internet connection and try again.</p>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={retry}><RefreshCw size={16} aria-hidden="true" />Retry connection</Button>
          <Button variant="secondary" onClick={() => { void logout().catch(() => undefined); }}>Sign out</Button>
        </div>
      </section>
    </main>
  );
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, loading, status, retry, logout } = useAuth();
  const location = useLocation();
  if (skipLogin) return children;
  if (status === "unavailable") return <SessionUnavailable />;
  if (status === "forbidden") return <div role="alert" className="p-8">
    <p>Your account does not have workspace access.</p>
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
  if (status === "unavailable") return <SessionUnavailable />;
  if (status === "forbidden") return <div role="alert" className="p-8">
    <p>Your account does not have workspace access.</p>
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
