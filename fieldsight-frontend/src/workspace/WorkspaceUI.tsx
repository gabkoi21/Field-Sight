import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useWorkspace } from "./WorkspaceContext";
import { LoadingState } from "../components/ui";

export const fieldClass =
  "w-full rounded-md border border-[#dce4e8] bg-white px-3 py-2.5 text-sm text-[#28434d] outline-none focus:border-[#0b51b7] focus:ring-2 focus:ring-[#0b51b7]/10";
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-[#e1e7eb] bg-white ${className}`}
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
    <label className="grid gap-1.5 text-xs font-medium text-[#637580]">
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[.16em] text-[#73868d]">
            {breadcrumb}
          </p>
          <h1 className="m-0 text-[27px] font-semibold tracking-tight text-[#193a49]">
            {title}
          </h1>
          <p className="mb-0 mt-2 text-sm text-[#73828b]">{description}</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>
      </header>
      {children}
    </div>
  );
}
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const state = useWorkspace();
  if (state.loading) return <LoadingState />;
  if (state.error) return <Notice error>{state.error.message}</Notice>;
  if (!state.project)
    return (
      <Panel className="p-10 text-center">
        <h2 className="text-lg">Create your first project</h2>
        <p className="text-sm text-[#73828b]">
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
  const { projectId } = useWorkspace();
  return (
    <nav
      aria-label="Project sections"
      className="flex gap-5 overflow-x-auto border-b border-[#e1e7eb] bg-white px-5 text-sm text-[#607882]"
    >
      {[
        ["Details", `/projects/${projectId}`],
        ["Field Team", `/projects/${projectId}/team`],
        ["Indicators", `/projects/${projectId}/indicators`],
        ["Forms", `/forms?project_id=${projectId}`],
        ["Data tables", `/data-tables?project_id=${projectId}`],
        ["Analysis", `/analytics?project_id=${projectId}`],
        ["Dashboards", `/dashboards?project_id=${projectId}`],
      ].map(([label, to]) => (
        <NavLink
          key={label}
          to={to}
          end={label === "Details"}
          className={({ isActive }) =>
            `shrink-0 border-b-2 py-3 no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b51b7] ${isActive ? "border-[#0b51b7] font-semibold text-[#0b51b7]" : "border-transparent text-[#607882] hover:border-[#b8ccea] hover:text-[#0b51b7]"}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
