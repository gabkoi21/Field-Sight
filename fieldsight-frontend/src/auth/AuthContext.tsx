import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError, type CurrentUser } from "../services/apiClient";
import { skipLogin } from "./developmentAccess";

const previewUser: CurrentUser = { id: "local-preview", email: "preview@fieldsight.local", username: "Local preview", platform_role: "super_admin", memberships: [] };
type SessionStatus = "checking" | "unavailable" | "authenticated" | "signed_out" | "forbidden";
interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  status: SessionStatus;
  retry: () => void;
  login: (login: string, password: string, remember: boolean) => Promise<CurrentUser>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);
// Shared across StrictMode's setup/cleanup/setup cycle.
let startup: Promise<CurrentUser | null> | null = null;
function restore() {
  if (!startup) startup = apiClient.restore().finally(() => { startup = null; });
  return startup;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(skipLogin ? previewUser : null);
  const [status, setStatus] = useState<SessionStatus>(skipLogin ? "authenticated" : "checking");
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0);
  const identity = useRef<string | null>(null);
  const retry = () => setAttempt(value => value + 1);
  useEffect(() => {
    let active = true;
    const initialEpoch = epoch.current;
    const accept = (current: CurrentUser | null) => {
      if (identity.current !== current?.id) { void queryClient.cancelQueries(); queryClient.clear(); }
      identity.current = current?.id ?? null;
      setUser(current);
      setStatus(current ? "authenticated" : "signed_out");
    };
    const expired = () => { epoch.current++; accept(skipLogin ? previewUser : null); };
    const changed = (event: Event) => setStatus((event as CustomEvent<SessionStatus>).detail);
    const renewed = () => {
      const generation = epoch.current;
      void apiClient.me().then(current => { if (active && generation === epoch.current) accept(current); })
        .catch(error => { if (active && generation === epoch.current) setStatus(error instanceof ApiError && error.status === 403 ? "forbidden" : "unavailable"); });
    };
    const online = () => { if (active) retry(); };
    window.addEventListener("fieldsight-session-expired", expired);
    window.addEventListener("fieldsight-session-state", changed);
    window.addEventListener("fieldsight-session-renewed", renewed);
    window.addEventListener("online", online);
    if (!skipLogin || apiClient.hasStoredAccessToken()) {
      setStatus("checking");
      void restore().then(current => { if (active && initialEpoch === epoch.current) accept(current); })
        .catch(error => {
          if (!active || initialEpoch !== epoch.current) return;
          if (error instanceof ApiError && error.status === 401) accept(null);
          else setStatus(error instanceof ApiError && error.status === 403 ? "forbidden" : "unavailable");
        });
    }
    return () => {
      active = false;
      window.removeEventListener("fieldsight-session-expired", expired);
      window.removeEventListener("fieldsight-session-state", changed);
      window.removeEventListener("fieldsight-session-renewed", renewed);
      window.removeEventListener("online", online);
    };
  }, [attempt, queryClient]);
  const value = useMemo<AuthValue>(() => ({
    user, status, loading: status === "checking", retry,
    async login(login, password, remember) {
      epoch.current++;
      await queryClient.cancelQueries(); queryClient.clear();
      await apiClient.login(login, password, remember);
      const loginEpoch = epoch.current;
      const current = await apiClient.me();
      if (loginEpoch !== epoch.current) throw new Error("Session changed during sign in.");
      identity.current = current.id;
      setUser(current); setStatus("authenticated");
      return current;
    },
    async logout() {
      epoch.current++;
      setUser(skipLogin ? previewUser : null); setStatus("signed_out");
      await queryClient.cancelQueries(); queryClient.clear(); identity.current = null;
      await apiClient.logout();
    },
  }), [status, user, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
