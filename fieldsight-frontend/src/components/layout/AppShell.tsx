import { WorkspaceShell } from "../../workspace/WorkspaceShell";

/** Compatibility entry point for the workspace shell. */
export function AppShell({ loading = false }: { loading?: boolean }) {
  return <WorkspaceShell loading={loading} />;
}
