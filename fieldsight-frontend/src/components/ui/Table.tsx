import type { ComponentProps } from "react";

function join(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <div className="w-full overflow-x-auto"><table className={join("w-full text-left text-[13px]", className)} {...props} /></div>;
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={join("border-b border-[#e7e9ed] bg-[#f8fafc]", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={join("divide-y divide-[#edf0f2]", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={join("transition-colors hover:bg-[#f8fbff]", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th className={join("h-11 px-5 text-[11px] font-semibold uppercase tracking-[.04em] text-[#728093]", className)} {...props} />;
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={join("px-5 py-3.5 align-middle text-[#344562]", className)} {...props} />;
}
