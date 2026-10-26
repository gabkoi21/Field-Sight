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
  refreshing: boolean;
  reload: () => void;
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
  const routeId = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const queryId = new URLSearchParams(location.search).get("project_id");
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
  const hasSelectedProject = projects.some((p) => p.id === projectId);
  function selectProject(id: string) {
    setSelected(id);
    const params = new URLSearchParams(location.search);
    params.delete("page");
    params.delete("offset");
    // Nested project routes carry their scope in the path; avoid stale query IDs.
    if (routeId) params.delete("project_id");
    else params.set("project_id", id);
    const path = routeId ? location.pathname.replace(routeId, id) : location.pathname;
    navigate(`${path}${params.size ? `?${params}` : ""}`);
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
        refreshing: query.isFetching && !query.isLoading,
        reload: () => { void query.refetch(); },
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
