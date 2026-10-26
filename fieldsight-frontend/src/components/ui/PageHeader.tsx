import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-2 mt-0 text-xs font-semibold leading-5 tracking-wide text-[var(--fs-muted)]">{eyebrow}</p>}
        <h1 className="m-0 break-words text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--fs-text)]">{title}</h1>
        <p className="mb-0 mt-2 max-w-[68ch] text-sm leading-6 text-[var(--fs-muted)]">{description}</p>
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2 lg:justify-end">{children}</div>}
    </header>
  );
}
