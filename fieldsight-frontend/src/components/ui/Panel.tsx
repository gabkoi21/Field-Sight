import type { ReactNode } from "react";
import { Card, CardHeader } from "./Card";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`min-w-0 ${className}`}>
      <CardHeader title={title} subtitle={subtitle}>
        {action}
      </CardHeader>
      <div className="px-5 pb-3">{children}</div>
    </Card>
  );
}
