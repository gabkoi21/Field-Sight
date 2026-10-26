import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={`min-w-0 overflow-hidden rounded-xl border border-[var(--fs-border)] bg-[var(--fs-surface)] shadow-[0_2px_8px_rgba(23,40,70,.03)] ${className}`}
    >
      {children}
    </article>
  );
}

export function CardHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--fs-border)] px-5 py-4">
      <div>
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[#1e293b]">{title}</h2>
        <p className="mb-0 mt-0.5 text-xs text-[#64748b]">{subtitle}</p>
      </div>
      {children}
    </header>
  );
}
