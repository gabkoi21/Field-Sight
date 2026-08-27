import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

interface CardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <article className="rounded-xl border border-[#e1e7ef] bg-white p-5 shadow-[0_5px_18px_rgba(25,43,75,.04)]">
      <div className="mb-5 flex items-start justify-between text-[#8290a0]">
        <div>
          <h2 className="m-0 text-base font-semibold leading-[1.35] text-[#24334a]">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-[#758092]">
            {subtitle}
          </p>
        </div>
        <MoreHorizontal size={19} />
      </div>
      {children}
    </article>
  );
}
