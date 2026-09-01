import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between max-[560px]:flex-col max-[560px]:gap-[14px]">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase leading-[1.4] tracking-[.08em] text-brand">{eyebrow}</p>
        <h1 className="m-0 text-[2rem] font-bold leading-[1.15] tracking-[-0.05em] text-[#24334a]">{title}</h1>
        <p className="mt-1.5 max-w-[680px] text-[0.8125rem] leading-[1.55] text-[#718096]">{description}</p>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
