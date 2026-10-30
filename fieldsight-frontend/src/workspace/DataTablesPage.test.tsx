// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../services/apiClient";
import { DataTablesPage } from "./DataTablesPage";

vi.mock("./WorkspaceContext", () => ({ useWorkspace: () => ({ projectId: "project", project: { name: "WASH" }, projects: [{ id: "project" }], selectProject: vi.fn(), loading: false, error: null }) }));
vi.mock("../services/apiClient", () => ({ apiClient: { tables: vi.fn(), tableRows: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows the Kobo submitter and Unknown for unattributed records", async () => {
  vi.mocked(apiClient.tables).mockResolvedValue([{ id: "form", title: "Survey", source: "Kobo", records: 2 }]);
  vi.mocked(apiClient.tableRows).mockResolvedValue({ fields: [], total: 2, offset: 0, rows: [
    { id: "known", review_status: "ready", submitted_at: null, submitted_by: "gabakoi_", answers: {} },
    { id: "unknown", review_status: "ready", submitted_at: null, submitted_by: null, answers: { name: "Not an authenticated username" } },
  ] });
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DataTablesPage /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Open data table →" }));
  const table = await screen.findByRole("table");
  expect(within(table).getByRole("columnheader", { name: "Submitted by" })).toBeTruthy();
  expect(within(table).getByText("gabakoi_")).toBeTruthy();
  expect(within(table).getByText("Unknown")).toBeTruthy();
});
