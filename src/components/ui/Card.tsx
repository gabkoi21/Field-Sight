import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

interface CardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <article className="rounded-lg border border-[#e7e9ed] bg-white p-5">
      <div className="mb-5 flex items-start justify-between text-[#8290a0]">
        <div>
          <h2 className="m-0 text-base font-semibold leading-[1.35] text-[#17212f]">
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
