import { Component, Suspense, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LoadingSkeleton, LoadingState } from "../ui";

function RouteLoading({ pathname }: { pathname: string }) {
  if (pathname.endsWith("/dashboards") || pathname === "/superadmin") return <LoadingSkeleton layout="dashboard" label="Preparing dashboard…" />;
  if (pathname.includes("indicators")) return <LoadingSkeleton label="Loading indicators…" />;
  return <LoadingState variant="page" label={pathname === "/analytics" ? "Preparing analysis…" : "Loading page…"} />;
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
  return <PageLoadBoundary path={pathname}><Suspense key={pathname} fallback={<RouteLoading pathname={pathname} />}><Outlet /></Suspense></PageLoadBoundary>;
}
