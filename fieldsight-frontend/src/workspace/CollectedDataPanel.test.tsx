// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CollectedDataPanel } from "./CollectedDataPanel";
import { apiClient, type Indicator } from "../services/apiClient";

vi.mock("../services/apiClient", () => ({ apiClient: { collectedResults: vi.fn(), addCollectedResult: vi.fn(), indicatorPolicy: vi.fn(), updateIndicator: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("submits numerator and denominator without an ambiguous separate value", async () => {
  vi.mocked(apiClient.indicatorPolicy).mockResolvedValue({ manual: { percentage: ["pooled", "latest"] } } as never);
  vi.mocked(apiClient.collectedResults).mockResolvedValue([]);
  vi.mocked(apiClient.addCollectedResult).mockResolvedValue({} as never);
  const indicator = { id: "i", project_id: "p", name: "Coverage", unit: "percentage", manual_aggregation: "pooled", mapping: null } as Indicator;
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CollectedDataPanel indicator={indicator} onMap={vi.fn()} /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Add manual result" }));
  fireEvent.change(screen.getByLabelText("Numerator"), { target: { value: "9" } });
  fireEvent.change(screen.getByLabelText("Denominator"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Save result" }));
  await waitFor(() => expect(apiClient.addCollectedResult).toHaveBeenCalledWith("i", expect.objectContaining({ numerator: 9, denominator: 10, value: null })));
});

it("configures manual aggregation where results are entered", async () => {
  vi.mocked(apiClient.collectedResults).mockResolvedValue([]);
  vi.mocked(apiClient.indicatorPolicy).mockResolvedValue({manual: {number: ["sum", "latest"]}} as never);
  vi.mocked(apiClient.updateIndicator).mockResolvedValue({} as never);
  const indicator = {id: "i", project_id: "p", unit: "number", manual_aggregation: "legacy", mapping: null} as Indicator;
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CollectedDataPanel indicator={indicator} onMap={vi.fn()} /></MemoryRouter></QueryClientProvider>);
  await screen.findByRole("option", {name: "Sum"});
  fireEvent.change(screen.getByLabelText("Manual result aggregation"), {target: {value: "sum"}});
  fireEvent.click(screen.getByRole("button", {name: "Save manual settings"}));
  await waitFor(() => expect(apiClient.updateIndicator).toHaveBeenCalledWith("i", {manual_aggregation: "sum", manual_rate_multiplier: 1}));
});
