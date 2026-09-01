import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={`overflow-hidden rounded-none border border-[#edf0f4] bg-white shadow-[0_4px_14px_rgba(23,40,70,.04)] ${className}`}
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
    <header className="flex items-start justify-between gap-3 border-b border-[#edf0f4] px-5 py-3">
      <div>
        <h2 className="m-0 flex items-center gap-2 text-[0.9375rem] font-semibold text-[#24334a]">{title}</h2>
        <p className="mb-0 mt-0.5 text-[10px] text-[#8491a3]">{subtitle}</p>
      </div>
      {children}
    </header>
  );
}
