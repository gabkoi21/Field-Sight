export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-124px)] flex-col items-center justify-center gap-3.5 bg-transparent text-[14px] font-semibold text-gray-500 max-[1440px]:min-h-[calc(100dvh-133px)] max-[560px]:min-h-[calc(100dvh-114px)]" role="status" aria-live="polite">
      <div className="size-12 animate-spin rounded-full border-4 border-gray-200 border-r-gray-400 border-t-gray-600 shadow-lg shadow-gray-300/50" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
