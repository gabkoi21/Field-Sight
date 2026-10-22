import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingState } from "../components/ui";
import { useAuth } from "./AuthContext";
import { skipLogin } from "./developmentAccess";

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (skipLogin) return children;
  if (loading) return <LoadingState />;
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  if (user.platform_role !== "super_admin") return <Navigate replace to="/" />;
  return children;
}

export function RequireOrganizationMember({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (skipLogin) return children;
  if (loading) return <LoadingState />;
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  if (user.platform_role === "super_admin" && user.memberships.length === 0) {
    return <Navigate replace to="/superadmin" />;
  }
  return children;
}
