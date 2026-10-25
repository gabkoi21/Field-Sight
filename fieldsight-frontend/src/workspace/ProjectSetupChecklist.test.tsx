// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ProjectSetupChecklist } from "./ProjectSetupChecklist";

const source = vi.hoisted(() => ({ success: null as string | null, indicators: [] as { result_source: string }[], dashboards: [] as { project_id: string }[] }));
vi.mock("./WorkspaceContext", () => ({ useWorkspace: () => ({ project: { id: "p", kobo_connection_id: "c", kobo_form_id: "f" }, projectId: "p", organizationId: "o" }) }));
vi.mock("../services/apiClient", () => ({ apiClient: {
  syncSettings: async () => ({ last_successful_sync: source.success }),
  indicators: async () => source.indicators,
  dashboards: async () => source.dashboards,
} }));
afterEach(() => { cleanup(); source.success = null; source.indicators = []; source.dashboards = []; });
function show() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><ProjectSetupChecklist /></MemoryRouter></QueryClientProvider>);
}
it("links incomplete steps using saved project scope", async () => {
  show();
  expect(await screen.findByText("Project setup · 2 of 5 complete")).toBeTruthy();
  expect(screen.getByRole("link", { name: /First successful sync/ }).getAttribute("href")).toBe("/forms?project_id=p");
  expect(screen.getByRole("link", { name: /Indicator configured/ }).getAttribute("href")).toBe("/projects/p/indicators");
});
it("uses saved success and configuration, ignoring other project dashboards", async () => {
  source.success = "2026-10-24T00:00:00Z";
  source.indicators = [{ result_source: "manual" }];
  source.dashboards = [{ project_id: "other" }];
  show();
  expect(await screen.findByText("Project setup · 4 of 5 complete")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Dashboard created/ })).toBeTruthy();
});
