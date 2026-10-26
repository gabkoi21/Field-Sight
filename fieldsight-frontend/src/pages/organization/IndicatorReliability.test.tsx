// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IndicatorDefinitionForm } from "./IndicatorForms";
import { apiClient, type Indicator } from "../../services/apiClient";

vi.mock("../../services/apiClient", () => ({ apiClient: { indicatorPolicy: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("offers only the authoritative percentage methods and preserves unknown legacy selection", async () => {
  vi.mocked(apiClient.indicatorPolicy).mockResolvedValue({ linked: {} as never, manual: { percentage: ["unweighted_mean", "pooled", "latest"] } as never });
  const save = vi.fn();
  const indicator = { id: "i", project_id: "p", name: "Coverage", code: "COV", unit: "percentage", direction: "increase", reporting_frequency: "monthly", manual_aggregation: "legacy", is_active: false } as Indicator;
  render(<QueryClientProvider client={new QueryClient()}><IndicatorDefinitionForm indicator={indicator} nodes={[]} error="" saving={false} onClose={vi.fn()} onSave={save} /></QueryClientProvider>);
  const method = screen.getByLabelText("Manual result aggregation") as HTMLSelectElement;
  await waitFor(() => expect(method.options.length).toBe(4));
  expect(Array.from(method.options).map(option => option.value)).toEqual(["legacy", "unweighted_mean", "pooled", "latest"]);
  expect(method.value).toBe("legacy");
  fireEvent.change(method, {target: {value: "pooled"}});
  fireEvent.submit(screen.getByRole("button", {name: "Save changes"}).closest("form")!);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({manual_aggregation: "pooled", is_active: false}));
});

it("saves a new incomplete definition as a draft", () => {
  vi.mocked(apiClient.indicatorPolicy).mockResolvedValue({linked: {} as never, manual: {} as never});
  const save = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><IndicatorDefinitionForm indicator={null} nodes={[]} error="" saving={false} onClose={vi.fn()} onSave={save} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Indicator name"), {target: {value: "Draft indicator"}});
  fireEvent.submit(screen.getByRole("button", {name: "Create indicator"}).closest("form")!);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({is_active: false, manual_aggregation: "legacy"}));
});
