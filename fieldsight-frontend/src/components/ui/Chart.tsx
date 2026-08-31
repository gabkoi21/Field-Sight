import * as React from "react";
import * as RechartsPrimitive from "recharts";

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>;

const ChartContext = React.createContext<ChartConfig | null>(null);

export function ChartContainer({ className, config, children, ...props }: React.ComponentProps<"div"> & { config: ChartConfig; children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"] }) {
  const colors = Object.fromEntries(Object.entries(config).filter(([, item]) => item.color).map(([key, item]) => [`--color-${key}`, item.color])) as React.CSSProperties;
  return <ChartContext.Provider value={config}><div className={`flex aspect-video justify-center text-xs ${className ?? ""}`} style={{ ...colors, ...(props.style ?? {}) }} {...props}><RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer></div></ChartContext.Provider>;
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export function ChartTooltipContent({ active, payload, label, className }: React.ComponentProps<typeof RechartsPrimitive.Tooltip> & React.ComponentProps<"div">) {
  const config = React.useContext(ChartContext);
  if (!active || !payload?.length) return null;
  return <div className={`grid min-w-32 gap-2 rounded-md border border-[#e5e8ec] bg-white p-2.5 text-xs shadow-sm ${className ?? ""}`}>
    {label != null && <p className="font-semibold text-[#344562]">{String(label)}</p>}
    {payload.filter((item) => item.type !== "none").map((item, index) => { const key = String(item.dataKey ?? item.name ?? "value"); return <div key={`${key}-${index}`} className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-[#728093]"><span className="size-2 rounded-sm" style={{ background: item.color ?? item.payload?.fill }} />{config?.[key]?.label ?? item.name}</span><span className="font-semibold text-[#344562]">{typeof item.value === "number" ? item.value.toLocaleString() : String(item.value ?? "")}</span></div>; })}
  </div>;
}
