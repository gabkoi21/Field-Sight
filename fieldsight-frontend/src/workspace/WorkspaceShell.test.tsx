// @vitest-environment jsdom
import React, { lazy } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { WorkspaceShell } from "./WorkspaceShell";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: { email: "review@example.test", memberships: [{ organization_id: "org", role: "organization_admin" }] }, logout: vi.fn() }) }));
vi.mock("../services/apiClient", () => ({ apiClient: {
  organizationProjects: async () => [{ id: "p1", name: "Health" }, { id: "p2", name: "Education" }],
  pendingKoboSync: async () => ({ pending_count: 0 }),
} }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });
function Location() { const location = useLocation(); return <p data-testid="location">{location.pathname}{location.search}</p>; }
function setup(path: string) {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><Routes><Route element={<WorkspaceShell />}><Route path="*" element={<Location />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
}

it("preserves navigation and context without an Overview sidebar link", async () => {
  setup("/dashboards?project_id=p2");
  expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
  expect(screen.queryByLabelText("Current project")).toBeNull();
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getAllByRole("link").slice(0, 2).map(link => link.textContent)).toEqual(["Dashboard", "Projects"]);
  expect(within(nav).queryByRole("link", { name: "Data Quality" })).toBeNull();
  expect(within(nav).getByRole("link", { name: "Project dashboards" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav).queryByRole("link", { name: "Overview" })).toBeNull();
  for (const name of ["Forms", "Indicators", "Field Team", "Actions & Follow-ups", "Explore & analyze"]) {
    expect(within(nav).queryByRole("link", { name })).toBeNull();
  }
  expect(within(nav).getByRole("link", { name: "Reports" }).getAttribute("href")).toBe("/reports");
  fireEvent.click(within(nav).getByRole("link", { name: "Projects" }));
  expect(within(nav).getByRole("link", { name: "Projects" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(nav).getByRole("link", { name: "Project dashboards" }));
  expect(screen.getByTestId("location").textContent).toBe("/dashboards");
});

it("preserves nested project navigation without the header selector", async () => {
  setup("/projects/p1/indicators?project_id=p1&view=results&page=3&offset=50");
  await waitFor(() => expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/projects"));
  expect(screen.queryByLabelText("Current project")).toBeNull();
});

it("keeps the workspace shell mounted through a lazy route and back/forward navigation", async () => {
  let finish!: (module: { default: () => React.ReactElement }) => void;
  const Slow = lazy(() => new Promise<{ default: () => React.ReactElement }>(resolve => { finish = resolve; }));
  function HistoryControls() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button></>;
  }
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/projects/p2"]}><HistoryControls /><Routes><Route element={<WorkspaceShell />}><Route path="projects/:projectId" element={<h1>Project details ready</h1>} /><Route path="overview" element={<h1>Project details ready</h1>} /><Route path="dashboards" element={<Slow />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  const navigation = screen.getByRole("navigation", { name: "Main navigation" });
  const userMenu = screen.getByRole("button", { name: "User menu" });
  const dashboards = within(navigation).getByRole("link", { name: "Project dashboards" });
  await waitFor(() => expect(dashboards.getAttribute("href")).toBe("/dashboards"));
  fireEvent.click(dashboards);
  expect(screen.getByRole("status").textContent).toContain("Preparing dashboard…");
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBe(navigation);
  expect(screen.getByRole("button", { name: "User menu" })).toBe(userMenu);
  await act(async () => { finish({ default: () => <h1>Dashboard ready</h1> }); });
  expect(await screen.findByRole("heading", { name: "Dashboard ready" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByRole("heading", { name: "Project details ready" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Forward" }));
  expect(await screen.findByRole("heading", { name: "Dashboard ready" })).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBe(navigation);
  expect(screen.getByRole("button", { name: "User menu" })).toBe(userMenu);
});

it("shows a red zero notification badge and updates the count without remounting navigation", async () => {
  const cache = new QueryClient();
  render(<QueryClientProvider client={cache}><MemoryRouter><Routes><Route element={<WorkspaceShell />}><Route path="*" element={<p>Page</p>} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  const zero = await screen.findByLabelText("0 pending sync notifications");
  expect(zero.className).toContain("bg-[#dc2626]");
  const nav = screen.getByRole("navigation", {name: "Main navigation"});
  await waitFor(() => expect(cache.getQueryState(["kobo-pending-sync"])?.status).toBe("success"));
  act(() => cache.setQueryData(["kobo-pending-sync"], {pending_count: 3}));
  expect(await screen.findByLabelText("3 pending sync notifications")).toBeTruthy();
  expect(screen.getByRole("navigation", {name: "Main navigation"})).toBe(nav);
});

it.each([1024, 1366])("collapses and expands navigation at %ipx without changing project links", async (width) => {
  vi.stubGlobal("innerWidth", width);
  setup("/projects/p1/overview");
  expect(document.querySelector(".workspace-collapsed")).toBeNull();
  const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
  fireEvent.click(toggle);
  expect(document.querySelector(".workspace-collapsed")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(document.querySelector(".workspace-collapsed")).toBeNull();
});

it("opens the application Dashboard without a project filter", async () => {
  setup("/projects");
  const dashboard = screen.getByRole("link", { name: "Dashboard" });
  expect(dashboard.getAttribute("href")).toBe("/dashboard");
  fireEvent.click(dashboard);
  expect(screen.getByTestId("location").textContent).toBe("/dashboard");
  expect(dashboard.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Project dashboards" }).getAttribute("aria-current")).toBeNull();
});

it("hides Overview on organization pages even with a remembered project", async () => {
  sessionStorage.setItem("fieldsight.selected-project::org", "p1");
  setup("/dashboard");
  await waitFor(() => expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/projects"));
  expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Projects" }));
  expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
});

it("keeps Overview out of the sidebar after opening a particular project", async () => {
  setup("/projects/p2/overview");
  expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
  expect(screen.getByTestId("location").textContent).toMatch(/overview/);
  fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
});
