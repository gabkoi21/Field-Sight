// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireOrganizationMember, RequireSuperAdmin } from "./RouteGuards";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import { apiClient } from "../services/apiClient";
const auth = vi.hoisted(() => ({ user: null as unknown, loading: true, status: "checking", retry: vi.fn(), logout: vi.fn() }));
vi.mock("./AuthContext", () => ({useAuth: () => auth}));
vi.mock("./developmentAccess", () => ({skipLogin: false}));
vi.mock("../services/apiClient", () => ({apiClient: {hasStoredAccessToken: vi.fn(), organizationProjects: vi.fn().mockResolvedValue([]), pendingKoboSync: vi.fn().mockResolvedValue({pending_count: 0})}}));
beforeEach(() => { vi.mocked(apiClient.hasStoredAccessToken).mockReturnValue(false); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("hides the workspace until session restoration succeeds", async () => {
  auth.user = null; auth.loading = true; auth.status = "checking";
  const cache = new QueryClient({defaultOptions: {queries: {retry: false}}});
  function TestApp() { return <QueryClientProvider client={cache}><MemoryRouter initialEntries={["/projects"]}><Routes><Route element={<RequireOrganizationMember><WorkspaceShell /></RequireOrganizationMember>}><Route path="projects" element={<h1>Protected projects</h1>} /></Route></Routes></MemoryRouter></QueryClientProvider>; }
  const view = render(<TestApp />);
  expect(screen.queryByRole("navigation", {name: "Main navigation"})).toBeNull();
  expect(screen.queryByRole("heading", {name: "Protected projects"})).toBeNull();
  expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Checking your session");
  expect(apiClient.organizationProjects).not.toHaveBeenCalled();
  expect(apiClient.pendingKoboSync).not.toHaveBeenCalled();
  auth.user = {email: "test@example.test", memberships: [{organization_id: "org", role: "organization_admin"}]};
  auth.loading = false; auth.status = "authenticated";
  view.rerender(<TestApp />);
  expect(await screen.findByRole("heading", {name: "Protected projects"})).toBeTruthy();
  expect(screen.getByRole("navigation", {name: "Main navigation"})).toBeTruthy();
  expect(screen.queryByText("Checking your session…")).toBeNull();
});

it("keeps project content gated without restoring removed sidebar links", () => {
  auth.user = null; auth.loading = true; auth.status = "checking";
  const cache = new QueryClient();
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={["/projects/p1/overview"]}><Routes><Route element={<RequireOrganizationMember><WorkspaceShell /></RequireOrganizationMember>}><Route path="projects/:projectId/overview" element={<h1>Overview data</h1>} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  expect(screen.queryByRole("link", {name: "Overview"})).toBeNull();
  expect(screen.queryByRole("navigation", {name: "Main navigation"})).toBeNull();
  expect(screen.queryByRole("heading", {name: "Overview data"})).toBeNull();
});

it.each([RequireOrganizationMember, RequireSuperAdmin])("redirects signed-out visitors without mounting a dashboard", Guard => {
  auth.user = null; auth.loading = true; auth.status = "checking";
  const mounted = vi.fn();
  function Dashboard() { mounted(); return <h1>Private dashboard</h1>; }
  function TestApp() { return <MemoryRouter initialEntries={["/dashboard"]}><Routes><Route path="/dashboard" element={<Guard><Dashboard /></Guard>} /><Route path="/login" element={<h1>Sign in</h1>} /></Routes></MemoryRouter>; }
  const view = render(<TestApp />);
  expect(screen.getByRole("status").textContent).toContain("Checking your session");
  expect(mounted).not.toHaveBeenCalled();
  auth.loading = false; auth.status = "signed_out";
  view.rerender(<TestApp />);
  expect(screen.getByRole("heading", {name: "Sign in"})).toBeTruthy();
  expect(mounted).not.toHaveBeenCalled();
});

it("keeps the dashboard shell on refresh while protecting data until the session is verified", async () => {
  auth.user = null; auth.loading = true; auth.status = "checking";
  vi.mocked(apiClient.hasStoredAccessToken).mockReturnValue(true);
  const cache = new QueryClient({defaultOptions: {queries: {retry: false}}});
  function TestApp() { return <QueryClientProvider client={cache}><MemoryRouter initialEntries={["/dashboard"]}><Routes><Route element={<RequireOrganizationMember><WorkspaceShell /></RequireOrganizationMember>}><Route path="dashboard" element={<h1>Private dashboard data</h1>} /></Route></Routes></MemoryRouter></QueryClientProvider>; }
  const view = render(<TestApp />);
  const navigation = screen.getByRole("navigation", {name: "Main navigation"});
  expect(screen.queryByText("Checking your session…")).toBeNull();
  expect(screen.queryByRole("heading", {name: "Private dashboard data"})).toBeNull();
  expect(apiClient.organizationProjects).not.toHaveBeenCalled();
  expect(apiClient.pendingKoboSync).not.toHaveBeenCalled();
  auth.user = {id: "user", email: "test@example.test", memberships: [{organization_id: "org", role: "organization_admin"}]};
  auth.loading = false; auth.status = "authenticated";
  view.rerender(<TestApp />);
  expect(await screen.findByRole("heading", {name: "Private dashboard data"})).toBeTruthy();
  expect(screen.getByRole("navigation", {name: "Main navigation"})).toBe(navigation);
});
