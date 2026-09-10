import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient, type CurrentUser } from "../services/apiClient";

interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (login: string, password: string, remember: boolean) => Promise<CurrentUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener("fieldsight-session-expired", handleSessionExpired);
    apiClient.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
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
      try {
        await apiClient.logout();
      } finally {
        setUser(null);
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

