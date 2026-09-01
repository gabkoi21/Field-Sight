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
}: {
  label: string;
  value: number | string;
  context?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  className?: string;
}) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <small className="text-[10px] font-bold uppercase tracking-[.07em] text-[#77869a]">{label}</small>
          <strong className="mt-2 block text-[1.5rem] font-semibold leading-none tracking-[-.04em] text-[#24334a]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </strong>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      {context && <p className="mb-0 mt-2 text-[10px] text-[#8491a3]">{context}</p>}
    </Card>
  );
}
