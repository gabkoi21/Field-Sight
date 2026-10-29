// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthlyOrganizationActivity } from "./MonthlyOrganizationActivity";
import { apiClient } from "../../services/apiClient";
vi.mock("recharts", () => ({ ResponsiveContainer: () => <div>Monthly chart</div>, Line: () => null, LineChart: () => null, CartesianGrid: () => null, LabelList: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function setup() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MonthlyOrganizationActivity /></QueryClientProvider>); }
it("shows the monthly leader and fetches the chosen year", async () => {
  const currentYear = new Date().getUTCFullYear();
  const request = vi.spyOn(apiClient, "monthlyOrganizationActivity").mockResolvedValue({ year: currentYear, available_years: [currentYear, currentYear - 1], months: [{ month: 1, organization_id: "ngo", organization_name: "Health NGO", submissions: 12, tied_organizations: 1 }] });
  setup(); await screen.findByRole("img"); expect(screen.queryByText("View monthly organizations and counts")).toBeNull();
  fireEvent.change(screen.getByLabelText("Activity year"), { target: { value: String(currentYear - 1) } });
  await waitFor(() => expect(request).toHaveBeenLastCalledWith(currentYear - 1));
});
it("shows a truthful empty state", async () => {
  vi.spyOn(apiClient, "monthlyOrganizationActivity").mockResolvedValue({ year: 2026, available_years: [2026], months: [] });
  setup(); expect(await screen.findByText(/No dated submissions recorded/)).toBeTruthy(); expect(screen.queryByText("Monthly chart")).toBeNull();
});
it("provides retry when the activity API is unavailable", async () => {
  vi.spyOn(apiClient, "monthlyOrganizationActivity").mockRejectedValue(new Error("Offline")); setup();
  expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByRole("button", { name: "Retry activity" })).toBeTruthy();
});
