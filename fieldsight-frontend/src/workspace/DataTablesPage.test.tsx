// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { apiClient } from "../services/apiClient";
import { DataTablesPage } from "./DataTablesPage";

vi.mock("./WorkspaceContext", () => ({ useWorkspace: () => ({ projectId: "project", project: { name: "WASH" }, projects: [{ id: "project" }], selectProject: vi.fn(), loading: false, error: null }) }));
vi.mock("../services/apiClient", () => ({ apiClient: { tables: vi.fn(), tableRows: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows the Kobo submitter and Unknown for unattributed records", async () => {
  vi.mocked(apiClient.tables).mockResolvedValue([{ id: "form", title: "Survey", source: "Kobo", records: 2 }]);
  vi.mocked(apiClient.tableRows).mockResolvedValue({ fields: [], total: 2, offset: 0, rows: [
    { id: "known", review_status: "ready", submitted_at: null, submitted_by: "gabakoi_", county_assignment_found: true, assigned_counties: ["Bong", "Nimba"], answers: {} },
    { id: "unknown", review_status: "ready", submitted_at: null, submitted_by: null, answers: { name: "Not an authenticated username" } },
  ] });
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DataTablesPage /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Open data table →" }));
  const table = await screen.findByRole("table");
  expect(within(table).getByRole("columnheader", { name: "Submitted by" })).toBeTruthy();
  expect(within(table).getByText("gabakoi_")).toBeTruthy();
  expect(within(table).getByText("Unknown")).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "Assigned counties" })).toBeTruthy();
  expect(within(table).getByText("Bong, Nimba")).toBeTruthy();
  expect(within(table).getByText("Not assigned")).toBeTruthy();
});

function CurrentUrl() {
  const location = useLocation();
  return <output aria-label="Current URL">{location.pathname}{location.search}</output>;
}

it("keeps the open table and record page in the URL across a reload", async () => {
  vi.mocked(apiClient.tables).mockResolvedValue([{ id: "form", title: "Survey", source: "Kobo", records: 120 }]);
  vi.mocked(apiClient.tableRows).mockResolvedValue({ fields: [], total: 120, offset: 0, rows: [] });
  function mount(url: string) {
    return render(<MemoryRouter initialEntries={[url]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CurrentUrl /><DataTablesPage /></QueryClientProvider></MemoryRouter>);
  }
  const first = mount("/data-tables");
  fireEvent.click(await screen.findByRole("button", { name: "Open data table →" }));
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const savedUrl = screen.getByLabelText("Current URL").textContent!;
  expect(savedUrl).toContain("table=form");
  expect(savedUrl).toContain("offset=50");
  first.unmount();
  mount(savedUrl);
  await screen.findByRole("table");
  expect(apiClient.tableRows).toHaveBeenLastCalledWith("project", "form", 50);
  fireEvent.click(screen.getByRole("button", { name: "All tables" }));
  await screen.findByRole("button", { name: "Open data table →" });
  expect(screen.getByLabelText("Current URL").textContent).toBe("/data-tables");
});

it("does not restore another project's table", async () => {
  vi.mocked(apiClient.tables).mockResolvedValue([{ id: "form", title: "Survey", source: "Kobo", records: 2 }]);
  render(<MemoryRouter initialEntries={["/data-tables?table=form&table_project=other&offset=50"]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DataTablesPage /></QueryClientProvider></MemoryRouter>);
  await screen.findByRole("button", { name: "Open data table →" });
  expect(apiClient.tableRows).not.toHaveBeenCalled();
});
