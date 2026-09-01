import { useEffect, useState } from "react";

const minimumRouteLoaderDurationMs = 1_500;

export function useMinimumRouteLoader(routeKey: string) {
  const [completedRouteKey, setCompletedRouteKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setCompletedRouteKey(routeKey),
      minimumRouteLoaderDurationMs,
    );
    return () => window.clearTimeout(timer);
  }, [routeKey]);

  return completedRouteKey !== routeKey;
}
