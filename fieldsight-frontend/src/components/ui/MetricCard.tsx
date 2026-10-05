import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

type MetricTone = "brand" | "warning" | "success" | "danger";

const tones: Record<MetricTone, string> = {
  brand: "bg-[#eaf2ff] text-brand",
  warning: "bg-[#fff0e8] text-[#c56b2c]",
  success: "bg-[#eaf8f2] text-[#188b69]",
  danger: "bg-[#fff0f2] text-[#b42318]",
};

export function MetricCard({
  label,
  value,
  context,
  icon: Icon,
  tone = "brand",
  className = "",
  onClick,
}: {
  label: string;
  value: number | string;
  context?: ReactNode;
  icon: LucideIcon;
  tone?: MetricTone;
  className?: string;
  onClick?: () => void;
}) {
  const content = (
    <Card className={`h-full p-4 ${onClick ? "transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md" : ""} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <small className="text-xs font-bold uppercase tracking-wider text-[#64748b]">{label}</small>
          <strong className="mt-2 block text-[1.85rem] font-bold leading-none tracking-tight text-[#1e293b]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </strong>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      {context && <div className="mb-0 mt-2 text-xs text-[#64748b]">{context}</div>}
    </Card>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full cursor-pointer border-0 bg-transparent p-0 text-left">
      {content}
    </button>
  ) : content;
}
