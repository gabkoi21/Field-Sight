import { Navigate, useSearchParams } from "react-router-dom";

/** Old bookmarked analysis URLs must carry an explicit project scope. */
export function ProjectAnalyticsRedirect() {
  const [params] = useSearchParams();
  const projectId = params.get("project_id");
  return <Navigate replace to={projectId ? `/projects/${encodeURIComponent(projectId)}/analytics` : "/projects"} />;
}
