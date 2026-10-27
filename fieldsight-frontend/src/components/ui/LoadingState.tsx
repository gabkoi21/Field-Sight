import { LoadingSkeleton } from "./LoadingSkeleton";

type LoadingStateProps = {
  label?: string;
  variant?: "page" | "panel" | "inline";
  /** Background refreshes should not repeat live announcements. */
  announce?: boolean;
};

export function LoadingState({ label = "Loading…", variant = "page", announce = variant !== "inline" }: LoadingStateProps) {
  if (variant === "page") return <LoadingSkeleton layout="table-page" label={label} announce={announce} />;
  if (variant === "panel") return <LoadingSkeleton layout="chart" label={label} announce={announce} />;
  return <span className="inline-flex min-w-24 items-center gap-2 align-middle" role={announce ? "status" : undefined} aria-atomic={announce ? true : undefined}>
    <span className="sr-only">{label}</span>
    <span aria-hidden="true" className="inline-flex w-full items-center gap-2 motion-safe:animate-pulse"><span className="size-4 shrink-0 rounded bg-slate-100" /><span className="h-3 w-24 rounded bg-slate-100" /></span>
  </span>;
}
