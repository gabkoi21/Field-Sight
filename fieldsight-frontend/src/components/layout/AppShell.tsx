import { LoadingState } from "../ui";
import { WorkspaceShell } from "../../workspace/WorkspaceShell";

/** Compatibility entry point for the workspace shell. */
export function AppShell({ loading = false }: { loading?: boolean }) {
  return loading ? <LoadingState variant="page" label="Preparing workspace…" /> : <WorkspaceShell />;
}
