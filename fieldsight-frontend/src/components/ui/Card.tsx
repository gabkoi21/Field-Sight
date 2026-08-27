import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article className={`overflow-hidden bg-white shadow-[0_4px_14px_rgba(23,40,70,.04)] ${className}`}>
      {children}
    </article>
  );
}

export function CardHeader({ title, subtitle, children }: { title: ReactNode; subtitle: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#e9eef4] px-5 py-4">
      <div>
        <h2 className="m-0 text-sm font-semibold text-[#24334a] flex items-center gap-2">{title}</h2>
        <p className="mb-0 mt-1 text-[10px] text-[#8b98aa]">{subtitle}</p>
      </div>
      {children}
    </header>
  );
}
