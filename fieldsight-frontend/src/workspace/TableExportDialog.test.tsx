// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "../services/apiClient";
import { TableExportDialog } from "./TableExportDialog";

vi.mock("../services/apiClient", () => ({ apiClient: {
  tableExportSchedules: vi.fn(), exportTable: vi.fn(), createTableExportSchedule: vi.fn(),
  toggleTableExportSchedule: vi.fn(), tableExportReport: vi.fn(),
} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); });

function setup() {
  vi.mocked(apiClient.tableExportSchedules).mockResolvedValue([]);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <TableExportDialog project="project" form="form" title="Survey" fields={[
      { source_field: "visit", label: "Visit date", type: "date", choices: [], source: "kobo", supported: true },
      { source_field: "county", label: "County", type: "text", choices: [], source: "kobo", supported: true },
    ]} onClose={vi.fn()} />
  </QueryClientProvider>);
}

it("exports every record and column by default", async () => {
  setup();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  vi.mocked(apiClient.exportTable).mockResolvedValue({ blob: new Blob(["report"]), filename: "report.xlsx" });
  expect(screen.getAllByRole("combobox")).toHaveLength(3);
  expect(screen.queryByLabelText("Search records (optional)")).toBeNull();
  expect(screen.queryByText("Compare with the previous period")).toBeNull();
  expect(screen.queryByText(/Columns to include/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  await waitFor(() => expect(apiClient.exportTable).toHaveBeenCalledWith("project", "form", expect.objectContaining({
    period: "all", date_field: null, columns: null, content: "records", compare: false, search: "", county: null, county_field: "county",
  })));
  await waitFor(() => expect(click).toHaveBeenCalled());
});

it("offers all 15 counties and exports the selected county", async () => {
  setup();
  expect(screen.getByLabelText("Breakdown by county").querySelectorAll("option")).toHaveLength(16);
  fireEvent.change(screen.getByLabelText("Breakdown by county"), { target: { value: "Montserrado" } });
  vi.mocked(apiClient.exportTable).mockRejectedValue(new Error("Test response"));
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  await waitFor(() => expect(apiClient.exportTable).toHaveBeenCalledWith("project", "form", expect.objectContaining({ county: "Montserrado", period: "all" })));
});

it("shows report failures and permits retry", async () => {
  setup();
  vi.mocked(apiClient.exportTable).mockRejectedValue(new Error("Choose a valid reporting timezone."));
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  expect(await screen.findByText("Choose a valid reporting timezone.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
});

it.each([
  ["weekly", "Date within week", "2026-10-15", "2026-10-15"],
  ["fortnightly", "Two-week start date", "2026-10-15", "2026-10-15"],
  ["monthly", "Month", "2026-10", "2026-10-01"],
])("exports the selected %s period and county", async (period, label, value, anchor) => {
  setup();
  fireEvent.change(screen.getByLabelText("Reporting period"), { target: { value: period } });
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText("Breakdown by county"), { target: { value: "Bong" } });
  vi.mocked(apiClient.exportTable).mockRejectedValue(new Error("Test response"));
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  await waitFor(() => expect(apiClient.exportTable).toHaveBeenCalledWith("project", "form", expect.objectContaining({
    period, anchor, county: "Bong", content: "records", columns: null,
  })));
});

