import type { ReactNode } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { BarChart3, ClipboardList, FileText, LayoutDashboard, Table2, Target, Users } from "lucide-react";
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
      className={`rounded-md border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#d4e8e6] bg-[#f1f9f7] text-[#396d69]"}`}
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
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  breadcrumb?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
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
  const { projectId: selectedProjectId } = useWorkspace();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const projectId = routeProjectId ?? selectedProjectId;
  return (
    <nav
      aria-label="Project sections"
      className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-surface)] p-1"
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
            `flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-primary)] ${isActive ? "bg-[var(--fs-primary)] text-white shadow-sm" : "text-[var(--fs-muted)] hover:bg-blue-50 hover:text-[var(--fs-primary)] active:bg-blue-100"}`
          }
        >
          <Icon size={17} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
