// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  apiClient,
  type Indicator,
  type SurveyCatalogue,
} from "../../services/apiClient";
import { IndicatorWorkspacePage } from "./IndicatorWorkspacePage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    loading: false,
    user: {
      memberships: [{ organization_id: "org", role: "organization_admin" }],
    },
  }),
}));
vi.mock("../../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    projectId: "project",
    selectProject: vi.fn(),
    projects: [],
    loading: false,
  }),
}));
vi.mock("../../services/apiClient", () => ({
  apiClient: {
    organizationProjects: vi.fn(),
    indicators: vi.fn(),
    resultsFramework: vi.fn(),
    surveyFields: vi.fn(),
    indicatorFields: vi.fn(),
    saveIndicatorMapping: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("opens source mapping from the selected table row and saves that indicator", async () => {
  const items = ["Boys present", "Girls present"].map(
    (name, index) =>
      ({
        id: String(index),
        name,
        code: `SFP-ATT-00${index + 1}`,
        unit: "number",
        baseline_value: 0,
        target_value: 1000,
        current_value: null,
        status: "not_started",
        reporting_frequency: "monthly",
        mapping_health: "unmapped",
        mapping: null,
        framework_node_id: null,
        progress_percent: null,
        target_achieved: null,
        result_source: "unconfigured",
        qualitative_value: null,
      }) as Indicator,
  );
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([
    { id: "project", name: "School Feed Program" },
  ] as never);
  vi.mocked(apiClient.indicators).mockImplementation(async () => [...items]);
  vi.mocked(apiClient.resultsFramework).mockResolvedValue([]);
  vi.mocked(apiClient.surveyFields).mockResolvedValue({
    project_id: "project",
    form_id: "attendance",
    form_name: "School Attendance",
    forms: ["attendance"],
    fields: [],
    warning: null,
  } as unknown as SurveyCatalogue);
  vi.mocked(apiClient.indicatorFields).mockResolvedValue([
    {
      source_field: "girls",
      label: "Girls present",
      type: "number",
      supported: true,
      choices: [],
      form_id: "attendance",
    },
  ]);
  vi.mocked(apiClient.saveIndicatorMapping).mockImplementation(
    async (id, input) => {
      const item = items.find((item) => item.id === id)!;
      item.mapping_health = "healthy";
      item.mapping = {
        ...input,
        id: "mapping",
        indicator_id: id,
      } as Indicator["mapping"];
      return item.mapping!;
    },
  );
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <IndicatorWorkspacePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const action = await screen.findByRole("button", {
    name: "Map source for Girls present",
  });
  expect(
    screen.queryByRole("button", { name: "Collected data for Girls present" }),
  ).toBeNull();
  fireEvent.click(action);
  const dialog = await screen.findByRole("dialog", {
    name: "Map indicator to survey data",
  });
  expect(within(dialog).getByText(/Girls present: Select a form/)).toBeTruthy();
  expect(
    (await within(dialog).findByRole("option", { name: "School Attendance" }) as HTMLOptionElement).value,
  ).toBe("attendance");
  await waitFor(() =>
    expect(
      (within(dialog).getByLabelText("Source question") as HTMLSelectElement)
        .disabled,
    ).toBe(false),
  );
  await within(dialog).findByRole("option", { name: "Girls present · number" });
  fireEvent.change(within(dialog).getByLabelText("Source question"), {
    target: { value: "girls" },
  });
  fireEvent.change(within(dialog).getByLabelText("Calculation"), {
    target: { value: "sum" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save mapping" }));
  await waitFor(() =>
    expect(apiClient.saveIndicatorMapping).toHaveBeenCalledWith("1", {
      source_form_id: "attendance",
      source_field: "girls",
      calculation: "sum",
      match_value: null,
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
