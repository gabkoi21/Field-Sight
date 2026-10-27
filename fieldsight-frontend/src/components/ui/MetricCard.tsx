import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

import { metricBody, metricIcon, metricSurface } from "./metricStyles";

type MetricTone = "brand" | "warning" | "success" | "danger";

export function MetricCard({
  label, value, context, icon: Icon, className = "", onClick, to, title, valueClassName = "",
}: {
  label: string;
  value: number | string;
  context?: ReactNode;
  icon: LucideIcon;
  tone?: MetricTone;
  className?: string;
  onClick?: () => void;
  to?: string;
  title?: string;
  valueClassName?: string;
}) {
  const content = <>
    <div className={metricBody}>
      <div className="min-w-0">
        <span className="block text-[13px] font-normal leading-5 text-[var(--fs-metric-label)]">{label}</span>
        <strong className={`mt-1 block break-words text-[28px] font-semibold leading-tight tabular-nums text-[var(--fs-metric-value)] ${valueClassName}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </strong>
      </div>
      <span className={metricIcon} aria-hidden="true">
        <Icon size={21} />
      </span>
    </div>
    {context && <div className="sr-only focus-within:not-sr-only">{context}</div>}
  </>;
  const classes = `${metricSurface} ${className}`;
  const tooltip = title ?? (typeof context === "string" ? context : undefined);
  if (to) return <NavLink to={to} title={tooltip} className={classes}>{content}</NavLink>;
  if (onClick) return <button type="button" title={tooltip} onClick={onClick} className={`w-full cursor-pointer ${classes}`}>{content}</button>;
  return <article aria-label={`${label} ${typeof value === "number" ? value.toLocaleString() : value}`} title={tooltip} className={classes}>{content}</article>;
}
