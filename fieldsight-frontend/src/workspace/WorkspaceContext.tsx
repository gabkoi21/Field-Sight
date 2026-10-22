import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiClient, type ApiProject } from "../services/apiClient";

type WorkspaceState = {
  organizationId: string;
  projects: ApiProject[];
  projectId: string;
  project: ApiProject | undefined;
  hasSelectedProject: boolean;
  selectProject: (id: string) => void;
  loading: boolean;
  error: Error | null;
  isAdmin: boolean;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const membership =
    user?.memberships.find((m) => m.role === "organization_admin") ??
    user?.memberships[0];
  const organizationId = membership?.organization_id ?? "";
  const [selected, setSelected] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId),
    enabled: Boolean(organizationId),
  });
  const projects = query.data ?? [];
  useEffect(() => {
    if (location.pathname === "/projects" || location.pathname === "/workspaces") {
      setSelected("");
    }
  }, [location.pathname]);
  const routeId = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const queryId = new URLSearchParams(location.search).get("project_id");
  const explicitId = routeId ?? queryId ?? selected;
  const hasSelectedProject = projects.some((p) => p.id === explicitId);
  useEffect(() => {
    const id = routeId ?? queryId;
    if (id && projects.some((p) => p.id === id)) setSelected(id);
  }, [routeId, queryId, query.data]);
  const projectId =
    routeId ??
    (projects.some((p) => p.id === queryId)
      ? queryId!
      : projects.some((p) => p.id === selected)
        ? selected
        : (projects[0]?.id ?? ""));
  function selectProject(id: string) {
    setSelected(id);
    if (routeId)
      navigate(location.pathname.replace(routeId, id) + location.search);
    else if (queryId) {
      const params = new URLSearchParams(location.search);
      params.set("project_id", id);
      navigate(`${location.pathname}?${params}`);
    }
  }
  return (
    <WorkspaceContext.Provider
      value={{
        organizationId,
        projects,
        projectId,
        project: projects.find((p) => p.id === projectId),
        hasSelectedProject,
        selectProject,
        loading: query.isLoading,
        error: query.error,
        isAdmin: membership?.role === "organization_admin",
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const state = useContext(WorkspaceContext);
  if (!state) throw new Error("WorkspaceProvider is required");
  return state;
}
