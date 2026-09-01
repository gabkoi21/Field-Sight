import type { ReactNode } from "react";

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`py-10 text-center text-xs text-[#8491a3] ${className}`}>{children}</div>;
}