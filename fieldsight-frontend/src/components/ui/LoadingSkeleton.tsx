import { metricBody, metricIcon, metricSurface } from "./metricStyles";

type LoadingSkeletonProps = {
  label: string;
  announce?: boolean;
  layout?: "dashboard" | "metrics" | "table" | "table-page" | "chart" | "details";
  rows?: number;
  columns?: number;
  metricCount?: 3 | 4;
};

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-slate-100 ${className}`} />;
}

/** Neutral geometry only: no fabricated chart points, numbers, or record labels. */
export function LoadingSkeleton({ label, layout = "table", rows = 5, columns = 5, metricCount = 3, announce = true }: LoadingSkeletonProps) {
  return (
    <div role={announce ? "status" : undefined} aria-atomic={announce ? true : undefined} className="relative min-w-0">
      {announce && <span className="sr-only">{label}</span>}
      <div aria-hidden="true" className="min-w-0 space-y-4 motion-safe:animate-pulse">
        {["dashboard", "metrics", "table-page"].includes(layout) && (
          <div className={`grid gap-4 ${metricCount === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
            {Array.from({ length: metricCount }, (_, i) => <div key={i} className={`${metricSurface} ${metricBody}`}><div className="min-w-0 flex-1 space-y-3"><Block className="h-3 w-2/3" /><Block className="h-7 w-1/3" /></div><span className={metricIcon}><Block className="size-5" /></span></div>)}
          </div>
        )}
        {layout === "dashboard" && (
          <div className="grid gap-5 lg:grid-cols-2">{[0, 1].map(i => <div key={i} className="space-y-5 rounded-xl border border-[var(--fs-border)] bg-white p-5"><Block className="h-5 w-1/2" /><Block className="h-3 w-3/4" /><Block className="h-64 w-full" /></div>)}</div>
        )}
        {layout === "details" && (
          <div className="space-y-5 py-4">{Array.from({ length: rows }, (_, i) => <div key={i} className="space-y-2"><Block className="h-3 w-1/4" /><Block className="h-9 w-full" /></div>)}</div>
        )}
        {layout === "chart" && <div className="space-y-4 p-5"><Block className="h-4 w-1/2" /><Block className="h-52 w-full" /></div>}
        {(layout === "table" || layout === "table-page") && (
          <div className="overflow-hidden rounded-xl border border-[var(--fs-border)] bg-white">
            <div className="flex h-12 items-center gap-4 border-b border-[var(--fs-border)] bg-slate-50 px-5">{Array.from({ length: columns }, (_, i) => <Block key={i} className="h-3 flex-1" />)}</div>
            {Array.from({ length: rows }, (_, i) => <div key={i} className="flex h-14 items-center gap-4 border-b border-slate-100 px-5 last:border-0">{Array.from({ length: columns }, (_, j) => <Block key={j} className="h-3 flex-1" />)}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
