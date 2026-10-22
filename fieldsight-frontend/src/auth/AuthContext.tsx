import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient, type CurrentUser } from "../services/apiClient";
import { skipLogin } from "./developmentAccess";

const previewUser: CurrentUser = {
  id: "local-preview",
  email: "preview@fieldsight.local",
  username: "Local preview",
  platform_role: "super_admin",
  memberships: [],
};

interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (login: string, password: string, remember: boolean) => Promise<CurrentUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(skipLogin && !apiClient.hasStoredAccessToken() ? previewUser : null);
  const [loading, setLoading] = useState(!skipLogin || apiClient.hasStoredAccessToken());

  useEffect(() => {
    const handleSessionExpired = () => setUser(skipLogin ? previewUser : null);
    window.addEventListener("fieldsight-session-expired", handleSessionExpired);
    if (!apiClient.hasStoredAccessToken()) {
      setLoading(false);
      return () => window.removeEventListener("fieldsight-session-expired", handleSessionExpired);
    }
    apiClient.me().then(setUser).catch(() => setUser(skipLogin ? previewUser : null)).finally(() => setLoading(false));
    return () => window.removeEventListener("fieldsight-session-expired", handleSessionExpired);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    async login(login, password, remember) {
      await apiClient.login(login, password, remember);
      const currentUser = await apiClient.me();
      setUser(currentUser);
      return currentUser;
    },
    async logout() {
      if (skipLogin && !apiClient.hasStoredAccessToken()) return;
      try {
        await apiClient.logout();
      } finally {
        setUser(skipLogin ? previewUser : null);
      }
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

