import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-[27px] flex items-start justify-between max-[560px]:flex-col max-[560px]:gap-[14px]">
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase leading-[1.4] tracking-[.08em] text-brand">
          {eyebrow}
        </p>
        <h1 className="m-0 text-[28px] font-bold leading-[1.2] tracking-[-.45px] text-ink">
          {title}
        </h1>
        <p className="mt-[7px] max-w-[680px] text-sm leading-[1.55] text-[#758092]">
          {description}
        </p>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
