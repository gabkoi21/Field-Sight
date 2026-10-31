import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiClient, type ApiProject } from "../services/apiClient";
import { ProjectRouteContext, cleanProjectPath, resolveProjectKey, scopedProjectPages, type ProjectLocationState } from "./projectRouting";

type WorkspaceState = {
  organizationId: string;
  projects: ApiProject[];
  projectId: string;
  project: ApiProject | undefined;
  hasSelectedProject: boolean;
  invalidProject: boolean;
  selectProject: (id: string) => void;
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
  error: Error | null;
  isAdmin: boolean;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: sessionLoading } = useAuth();
  const membership =
    user?.memberships.find((m) => m.role === "organization_admin") ??
    user?.memberships[0];
  const organizationId = membership?.organization_id ?? "";
  const scope = `${user?.id ?? ""}:${organizationId}`;
  const storageKey = `fieldsight.selected-project:${scope}`;
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId),
    enabled: Boolean(organizationId) && !sessionLoading,
  });
  const projects = query.data ?? [];
  const routeId = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const queryId = new URLSearchParams(location.search).get("project_id");
  const routeProject = resolveProjectKey(projects, routeId);
  const queryProject = resolveProjectKey(projects, queryId);
  const history = location.state?.fieldSightProject as ProjectLocationState | undefined;
  const historyProject = history?.scope === scope ? resolveProjectKey(projects, history.projectId) : undefined;
  let remembered = selection?.scope === scope ? selection.id : "";
  if (!remembered) {
    try { remembered = sessionStorage.getItem(storageKey) ?? ""; } catch { /* Storage can be disabled. */ }
  }
  const scopedProject = routeId ? routeProject : queryId ? queryProject : history?.scope === scope ?
    historyProject : resolveProjectKey(projects, remembered) ?? projects[0];
  const projectId = scopedProject?.id ?? "";
  function rememberProject(id: string) {
    setSelection({ scope, id });
    try { sessionStorage.setItem(storageKey, id); } catch { /* In-memory selection still works. */ }
  }
  useEffect(() => {
    if (!projectId) return;
    try { sessionStorage.setItem(storageKey, projectId); } catch { /* Storage can be disabled. */ }
  }, [storageKey, projectId]);
  // Legacy links select the right project, then disappear from the visible URL.
  useEffect(() => {
    if (!query.data || !scopedProject) return;
    const params = new URLSearchParams(location.search);
    const path = routeProject ? cleanProjectPath(location.pathname) : location.pathname;
    if (queryProject) params.delete("project_id");
    const search = params.size ? `?${params}` : "";
    if (path !== location.pathname || search !== location.search) {
      const context: ProjectLocationState = { scope, projectId: scopedProject.id,
        ...(queryProject ? { projectFilter: queryProject.id } : {}) };
      navigate({ pathname: path, search, hash: location.hash },
        { replace: true, state: { ...location.state, fieldSightProject: context } });
    }
  }, [location.pathname, location.search, location.hash, routeId, queryId,
      routeProject?.id, queryProject?.id, query.data, navigate, scopedProject?.id, scope]);
  const hasSelectedProject = Boolean(scopedProject);
  function selectProject(id: string) {
    if (!projects.some(project => project.id === id)) return;
    rememberProject(id);
    const params = new URLSearchParams(location.search);
    params.delete("page");
    params.delete("offset");
    params.delete("project_id");
    const context: ProjectLocationState = { scope, projectId: id,
      ...(queryId || history?.projectFilter ? { projectFilter: id } : {}) };
    navigate({ pathname: cleanProjectPath(location.pathname), search: params.size ? `?${params}` : "", hash: location.hash },
      { state: { ...location.state, fieldSightProject: context } });
  }
  function selectQueryProject(id: string) {
    if (id && !projects.some(project => project.id === id)) return;
    if (id) rememberProject(id);
    const params = new URLSearchParams(location.search);
    params.delete("project_id"); params.delete("offset"); params.delete("page");
    const context: ProjectLocationState = { scope, projectId: id || projectId, projectFilter: id || null };
    navigate({ pathname: location.pathname, search: params.size ? `?${params}` : "" },
      { state: { ...location.state, fieldSightProject: context } });
  }
  const historyFilter = history?.scope === scope && history.projectFilter ?
    resolveProjectKey(projects, history.projectFilter)?.id ?? "" : undefined;
  return (
    <WorkspaceContext.Provider
      value={{
        organizationId,
        projects,
        projectId,
        project: scopedProject,
        hasSelectedProject,
        invalidProject: Boolean(query.isSuccess && (routeId ? !routeProject : queryId ? !queryProject :
          history?.scope === scope && !historyProject && scopedProjectPages.has(location.pathname))),
        selectProject,
        loading: query.isLoading,
        refreshing: query.isFetching && !query.isLoading,
        reload: () => { void query.refetch(); },
        error: query.error,
        isAdmin: membership?.role === "organization_admin",
      }}
    >
      <ProjectRouteContext.Provider value={{
        scope, projects, projectId, pendingProjectKey: routeId ?? queryId ?? undefined, selectQueryProject,
        routeProjectId: routeId ? routeProject?.id ?? "" : scopedProjectPages.has(location.pathname) ? projectId : undefined,
        queryProjectId: queryId ? queryProject?.id ?? "" : historyFilter,
      }}>
        {children}
      </ProjectRouteContext.Provider>
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const state = useContext(WorkspaceContext);
  if (!state) throw new Error("WorkspaceProvider is required");
  return state;
}
