// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireOrganizationMember } from "./RouteGuards";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import { apiClient } from "../services/apiClient";
const auth = vi.hoisted(() => ({ user: null as unknown, loading: true, status: "checking", retry: vi.fn(), logout: vi.fn() }));
vi.mock("./AuthContext", () => ({useAuth: () => auth}));
vi.mock("./developmentAccess", () => ({skipLogin: false}));
vi.mock("../services/apiClient", () => ({apiClient: {organizationProjects: vi.fn().mockResolvedValue([]), pendingKoboSync: vi.fn().mockResolvedValue({pending_count: 0})}}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("keeps navigation mounted during session restoration and gates protected content", async () => {
  const cache = new QueryClient({defaultOptions: {queries: {retry: false}}});
  function TestApp() { return <QueryClientProvider client={cache}><MemoryRouter initialEntries={["/projects"]}><Routes><Route element={<RequireOrganizationMember><WorkspaceShell /></RequireOrganizationMember>}><Route path="projects" element={<h1>Protected projects</h1>} /></Route></Routes></MemoryRouter></QueryClientProvider>; }
  const view = render(<TestApp />);
  const navigation = screen.getByRole("navigation", {name: "Main navigation"});
  expect(screen.queryByRole("heading", {name: "Protected projects"})).toBeNull();
  expect(navigation.textContent).not.toContain("Choose a project first");
  const placeholders = navigation.querySelectorAll(".navigation-project-hint");
  expect(placeholders.length).toBe(2);
  for (const row of placeholders) expect(row.classList.contains("min-h-11")).toBe(true);
  expect(document.getElementById("main-content")?.textContent).toContain("Loading your session");
  expect(apiClient.organizationProjects).not.toHaveBeenCalled();
  expect(apiClient.pendingKoboSync).not.toHaveBeenCalled();
  auth.user = {email: "test@example.test", memberships: [{organization_id: "org", role: "organization_admin"}]};
  auth.loading = false; auth.status = "authenticated";
  view.rerender(<TestApp />);
  expect(await screen.findByRole("heading", {name: "Protected projects"})).toBeTruthy();
  expect(screen.getByRole("navigation", {name: "Main navigation"})).toBe(navigation);
});

it("keeps the current project highlight during session restoration", () => {
  auth.user = null; auth.loading = true; auth.status = "checking";
  const cache = new QueryClient();
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={["/projects/p1/overview"]}><Routes><Route element={<RequireOrganizationMember><WorkspaceShell /></RequireOrganizationMember>}><Route path="projects/:projectId/overview" element={<h1>Overview data</h1>} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  const overview = screen.getByRole("link", {name: "Overview"});
  expect(overview.getAttribute("aria-current")).toBe("page");
  expect(overview.getAttribute("href")).toBe("/projects/p1/overview");
  expect(screen.queryByRole("heading", {name: "Overview data"})).toBeNull();
});
