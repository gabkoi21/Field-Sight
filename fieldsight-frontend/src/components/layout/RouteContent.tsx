import { QueryClientContext, useIsFetching } from "@tanstack/react-query";
import { Component, Suspense, useContext, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LoadingSkeleton } from "../ui";

function RouteLoading({ pathname }: { pathname: string }) {
  if (pathname === "/dashboard" || pathname.endsWith("/dashboards") || pathname === "/overview" || pathname.endsWith("/overview") || pathname === "/superadmin") return <LoadingSkeleton metricCount={4} layout="dashboard" label="Preparing dashboard…" />;
  if (["/details", "/settings", "/profile", "/superadmin/settings"].includes(pathname) || pathname.endsWith("/details")) return <LoadingSkeleton layout="details" label="Loading page details..." />;
  if (pathname.includes("indicators")) return <LoadingSkeleton label="Loading indicators…" />;
  return <LoadingSkeleton layout="table-page" label={(pathname === "/analytics" || pathname.endsWith("/analytics")) ? "Preparing analysis…" : "Loading page…"} />;
}

function PageLoadingIndicator() {
  const fetching = useIsFetching({ predicate: query => query.getObserversCount() > 0 && !query.meta?.backgroundRefresh && query.queryKey[0] !== "kobo-pending-sync" });
  const loading = useIsFetching({ predicate: query => query.getObserversCount() > 0 && query.state.data === undefined && !query.meta?.backgroundRefresh && query.queryKey[0] !== "kobo-pending-sync" });
  return fetching ? <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5" aria-busy="true"><span className="sr-only">{loading ? "Loading page data…" : "Refreshing page data…"}</span><span aria-hidden="true" className="block h-full bg-[var(--fs-primary)] motion-safe:animate-pulse" /></div> : null;
}

class PageLoadBoundary extends Component<{ path: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ path: string; children: ReactNode }>) {
    if (this.state.failed && previous.path !== this.props.path) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><h1 className="text-lg font-semibold">Unable to load this page</h1><p>Reload to try again, or choose another page from navigation.</p><button type="button" className="min-h-11 rounded-lg px-3 font-semibold underline focus-visible:outline focus-visible:outline-2" onClick={() => window.location.reload()}>Reload page</button></section>;
    return this.props.children;
  }
}

/** Only route content suspends; the authenticated shell remains mounted. */
export function RouteContent() {
  const { pathname } = useLocation();
  const queryClient = useContext(QueryClientContext);
  return <PageLoadBoundary path={pathname}><div className="relative min-w-0 w-full">{queryClient && <PageLoadingIndicator />}<Suspense key={pathname} fallback={<RouteLoading pathname={pathname} />}><Outlet /></Suspense></div></PageLoadBoundary>;
}
