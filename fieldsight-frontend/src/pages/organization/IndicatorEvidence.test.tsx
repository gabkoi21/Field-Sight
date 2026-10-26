// @vitest-environment jsdom
import React from "react";
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {IndicatorEvidence} from "./IndicatorWorkspacePage";
import {apiClient, type Indicator} from "../../services/apiClient";
vi.mock("../../services/apiClient", () => ({apiClient: {indicatorEvidence: vi.fn(), indicatorVersions: vi.fn()}}));
afterEach(() => {cleanup(); vi.resetAllMocks();});
function mount() {
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <IndicatorEvidence indicator={{id:"i", definition_version:1} as Indicator} from="" to="" />
  </QueryClientProvider>);
}
it("shows readable contribution states and traceable authors", async () => {
  vi.mocked(apiClient.indicatorVersions).mockResolvedValue([]);
  vi.mocked(apiClient.indicatorEvidence).mockResolvedValue({source:"manual", method:"latest", definition_version:1,
    total:3, notice:"Live evidence", items:[
      {id:"new", contribution_state:"contributes", included:true, author:"Example Administrator", created_by_id:"author-id", value:80},
      {id:"old", contribution_state:"superseded", included:false, reason:"superseded", value:20},
      {id:"missing", contribution_state:"missing_components", included:false, reason:"missing_components"},
    ]});
  mount();
  expect(await screen.findByText("Contributes")).toBeTruthy();
  expect(screen.getByText("Superseded")).toBeTruthy();
  expect(screen.getByText("Missing components")).toBeTruthy();
  expect(screen.getByText("Example Administrator")).toBeTruthy();
  expect(screen.getByText("author-id")).toBeTruthy();
});
it("loads, reports errors, retries and shows an accurate empty range", async () => {
  vi.mocked(apiClient.indicatorVersions).mockResolvedValue([]);
  vi.mocked(apiClient.indicatorEvidence).mockRejectedValueOnce(new Error("Evidence temporarily unavailable"));
  mount();
  expect(screen.getByText("Loading evidence…")).toBeTruthy();
  expect(await screen.findByText("Evidence temporarily unavailable")).toBeTruthy();
  vi.mocked(apiClient.indicatorEvidence).mockResolvedValue({source:"manual", method:"latest", definition_version:1,
    total:0, notice:"Live evidence", items:[]});
  fireEvent.click(screen.getByRole("button", {name:"Retry evidence"}));
  expect(await screen.findByText("No evidence in this scope.")).toBeTruthy();
  expect(screen.getByText("0–0 of 0")).toBeTruthy();
  expect(screen.queryByText("1–0 of 0")).toBeNull();
});
