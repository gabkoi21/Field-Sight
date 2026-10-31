// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceReportsPage } from "./WorkspaceReportsPage";
import { apiClient } from "../services/apiClient";
vi.mock("../services/apiClient", () => ({ apiClient: { indicators: vi.fn(), tables: vi.fn() } }));
vi.mock("./WorkspaceContext", () => ({ useWorkspace: () => ({ projectId: "p1", project: { id: "p1", name: "Health" }, loading: false }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function setup() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><WorkspaceReportsPage /></MemoryRouter></QueryClientProvider>); }
it("keeps report loading and print disabled while source tables are unresolved", async () => {
  vi.mocked(apiClient.indicators).mockResolvedValue([]);
  vi.mocked(apiClient.tables).mockImplementation(() => new Promise(() => {}));
  setup();
  expect(await screen.findByText(/Preparing project report/)).toBeTruthy();
  expect(screen.queryByText(/0 source tables/)).toBeNull();
  expect((screen.getByRole("button", { name: "Print / save PDF" }) as HTMLButtonElement).disabled).toBe(true);
});
it("does not render an apparently empty report when source tables fail", async () => {
  vi.mocked(apiClient.indicators).mockResolvedValue([]);
  vi.mocked(apiClient.tables).mockRejectedValue(new Error("Tables unavailable"));
  setup();
  expect(await screen.findByText("Tables unavailable")).toBeTruthy();
  expect(screen.queryByText(/0 source tables/)).toBeNull();
  expect((screen.getByRole("button", { name: "Print / save PDF" }) as HTMLButtonElement).disabled).toBe(true);
});
