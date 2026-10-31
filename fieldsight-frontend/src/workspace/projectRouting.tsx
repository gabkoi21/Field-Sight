import { createContext, forwardRef, useContext } from "react";
import {
  Link, NavLink, useLocation, useParams, useSearchParams,
  type LinkProps, type NavLinkProps, type SetURLSearchParams, type To,
} from "react-router-dom";
import type { ApiProject } from "../services/apiClient";

export function projectUrlKey(project: Pick<ApiProject, "id" | "slug">): string {
  return project.slug || project.id;
}

export function resolveProjectKey(projects: ApiProject[], key: string | null | undefined): ApiProject | undefined {
  if (!key) return undefined;
  let decoded = key;
  try { decoded = decodeURIComponent(key); } catch { /* Invalid URLs simply do not resolve. */ }
  return projects.find(project => project.id === decoded) ?? projects.find(project => project.slug === decoded);
}

export type ProjectLocationState = {
  scope: string;
  projectId: string;
  projectFilter?: string | null;
};

const projectPages = new Set(["overview", "details", "actions", "analytics", "indicators", "team", "dashboards"]);
export function cleanProjectPath(path: string): string {
  const match = path.match(/^\/projects\/[^/]+(?:\/([^/]+))?\/?$/);
  if (!match) return path;
  const page = match[1] ?? "overview";
  if (!projectPages.has(page)) return path;
  return page === "team" ? "/project-team" : `/${page}`;
}
export const scopedProjectPages = new Set(["/overview", "/details", "/actions", "/analytics", "/indicators", "/project-team", "/dashboards"]);

export const ProjectRouteContext = createContext<{
  scope: string;
  projects: ApiProject[];
  projectId: string;
  pendingProjectKey?: string;
  routeProjectId: string | undefined;
  queryProjectId: string | undefined;
  selectQueryProject: (id: string) => void;
} | null>(null);

function useProjectDestination(to: To, state: LinkProps["state"]) {
  const context = useContext(ProjectRouteContext);
  const rawPath = typeof to === "string" ? to : to.pathname ?? "";
  if (!context || !/^\/(?!\/)/.test(rawPath)) return { to, state };
  const url = new URL(typeof to === "string" ? to : `${rawPath}${to.search ?? ""}${to.hash ?? ""}`, "https://workspace.invalid");
  const routeKey = url.pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const queryKey = url.searchParams.get("project_id");
  const routeProject = resolveProjectKey(context.projects, routeKey);
  const queryProject = resolveProjectKey(context.projects, queryKey);
  if ((routeKey && !routeProject) || (queryKey && !queryProject)) return { to, state };
  const selected = routeProject ?? queryProject ?? context.projects.find(project => project.id === context.projectId);
  const selectedKey = selected?.id ?? context.pendingProjectKey;
  if (!selectedKey) return { to, state };
  if (routeProject) url.pathname = cleanProjectPath(url.pathname);
  if (queryProject) url.searchParams.delete("project_id");
  const projectState: ProjectLocationState = { scope: context.scope, projectId: selectedKey,
    ...(queryProject ? { projectFilter: queryProject.id } : {}) };
  return { to: `${url.pathname}${url.search}${url.hash}`,
    state: { ...state, fieldSightProject: projectState } };
}

export const ProjectLink = forwardRef<HTMLAnchorElement, LinkProps>(function ProjectLink({ to, state, ...props }, ref) {
  const destination = useProjectDestination(to, state);
  return <Link {...props} {...destination} ref={ref} />;
});
export const ProjectNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function ProjectNavLink({ to, state, ...props }, ref) {
  const destination = useProjectDestination(to, state);
  return <NavLink {...props} {...destination} ref={ref} />;
});

/** Keep internal project context while changing visible filters/pagination. */
export function useProjectSearchParams(): ReturnType<typeof useSearchParams> {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const setScoped: SetURLSearchParams = (next, options) => setParams(next,
    { ...options, state: options?.state ?? location.state });
  return [params, setScoped];
}

export function useSelectProjectFilter(): (id: string) => void {
  const context = useContext(ProjectRouteContext);
  const [params, setParams] = useSearchParams();
  return context?.selectQueryProject ?? ((id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("project_id", id); else next.delete("project_id");
    setParams(next);
  });
}

/** Route names are resolved to UUIDs before any project API request. */
export function useProjectRouteId(): string | undefined {
  const context = useContext(ProjectRouteContext);
  const params = useParams<{ projectId: string }>();
  return context ? context.routeProjectId : params.projectId;
}

export function useProjectQueryId(): string | undefined {
  const context = useContext(ProjectRouteContext);
  const [params] = useSearchParams();
  return context ? context.queryProjectId : params.get("project_id") ?? undefined;
}
