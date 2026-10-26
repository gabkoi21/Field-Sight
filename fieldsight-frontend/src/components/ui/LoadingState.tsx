type LoadingStateProps = {
  label?: string;
  variant?: "page" | "panel" | "inline";
  /** Background polling should remain visible without repeated live announcements. */
  announce?: boolean;
};

export function LoadingState({ label = "Loading…", variant = "page", announce = variant !== "inline" }: LoadingStateProps) {
  const layout = variant === "page"
    ? "flex min-h-[min(28rem,calc(100dvh-12rem))] flex-col items-center justify-center gap-3 px-4 py-8"
    : variant === "panel"
      ? "flex min-h-32 items-center justify-center gap-3 p-5"
      : "inline-flex shrink-0 items-center gap-2 align-middle";
  return (
    <div className={`${layout} text-sm font-medium text-[var(--fs-muted)]`} role={announce ? "status" : undefined} aria-atomic={announce ? true : undefined}>
      <span className={`${variant === "inline" ? "size-4" : "size-6"} shrink-0 rounded-full border-2 border-blue-100 border-t-[var(--fs-primary)] motion-safe:animate-spin`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
