import type { ReactNode } from "react";
import { ProjectLink as Link, ProjectNavLink as NavLink } from "./projectRouting";
import { projectUrlKey, useProjectRouteId } from "./projectRouting";
import { ArrowLeft, BarChart3, ClipboardList, FileText, LayoutDashboard, Table2, Target, Users } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { LoadingState, PageHeader } from "../components/ui";
import { controlClass } from "../components/ui/controlStyles";

export const fieldClass = controlClass;
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-surface)] shadow-[0_2px_8px_rgba(23,40,70,.03)] ${className}`}
    >
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium text-[var(--fs-muted)]">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-md border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--fs-primary-border)] bg-[var(--fs-primary-soft)] text-[var(--fs-info-text)]"}`}
    >
      {children}
    </div>
  );
}
export function Page({
  title,
  description,
  actions,
  breadcrumb = "FieldSight / Project",
  backTo,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  breadcrumb?: string;
  backTo?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      {backTo && <Link to={backTo} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--fs-muted)] no-underline hover:text-[var(--fs-primary)]"><ArrowLeft size={16} aria-hidden="true" />Back</Link>}
      <PageHeader eyebrow={breadcrumb} title={title} description={description}>{actions}</PageHeader>
      {children}
    </div>
  );
}
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const state = useWorkspace();
  if (state.loading) return <LoadingState variant="page" label="Loading project…" />;
  if (state.error && !state.project) return <Notice error>{state.error.message} <button className="min-h-11 px-3 font-semibold underline" onClick={state.reload}>Retry project</button></Notice>;
  if (!state.project)
    return (
      <Panel className="p-10 text-center">
        <h2 className="text-lg">Create your first project</h2>
        <p className="text-sm text-[var(--fs-muted)]">
          A project holds your team, data tables, framework and indicator
          plan.
        </p>
        <Link className="text-sm text-[#0b51b7]" to="/projects">
          Open projects →
        </Link>
      </Panel>
    );
  return <>{children}</>;
}
export function WorkspaceTabs() {
  const { projectId: selectedProjectId, projects } = useWorkspace();
  const routeProjectId = useProjectRouteId();
  const id = routeProjectId ?? selectedProjectId;
  const projectId = projectUrlKey(projects?.find(project => project.id === id) ?? { id });
  return (
    <nav
      aria-label="Project sections"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--fs-border)] bg-[var(--fs-surface)] p-1 xl:flex-wrap"
    >
      {[
        { label: "Details", to: `/projects/${projectId}/details`, icon: ClipboardList },
        { label: "Field Team", to: `/projects/${projectId}/team`, icon: Users },
        { label: "Forms", to: `/forms?project_id=${projectId}`, icon: FileText },
        { label: "Data tables", to: `/data-tables?project_id=${projectId}`, icon: Table2 },
        { label: "Explore & analyze", to: `/projects/${projectId}/analytics`, icon: BarChart3 },
        { label: "Actions & Follow-ups", to: `/projects/${projectId}/actions`, icon: ClipboardList },
        { label: "Indicators", to: `/projects/${projectId}/indicators`, icon: Target },
        { label: "Dashboards", to: `/dashboards?project_id=${projectId}`, icon: LayoutDashboard },
      ].map(({ label, to, icon: Icon }) => (
        <NavLink
          key={label}
          to={to}
          end
          className={({ isActive }) =>
            `flex min-h-11 min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-primary)] ${isActive ? "bg-[var(--fs-primary)] text-white shadow-sm" : "text-[var(--fs-muted)] hover:bg-blue-50 hover:text-[var(--fs-primary)] active:bg-blue-100"}`
          }
        >
          <Icon size={17} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
