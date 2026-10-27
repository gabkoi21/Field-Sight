// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  apiClient,
  type Indicator,
  type SurveyCatalogue,
} from "../../services/apiClient";
import { IndicatorWorkspacePage } from "./IndicatorWorkspacePage";
import { IndicatorMappingForm } from "./IndicatorForms";

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
    indicatorPolicy: vi.fn(),
    indicatorMappingPreview: vi.fn(),
  },
}));
beforeEach(() => {
  vi.mocked(apiClient.indicatorPolicy).mockResolvedValue({linked: {number: ["sum", "average", "count_records", "count_matching"]}, manual: {number: ["sum", "latest", "unweighted_mean"]}} as never);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("opens the indicator requested by an overview action instead of the first indicator", async () => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "project", name: "School feeding" }] as never);
  vi.mocked(apiClient.resultsFramework).mockResolvedValue([]);
  vi.mocked(apiClient.indicators).mockResolvedValue(["Sessions", "Shortage incidents"].map((name, index) => ({
    id: String(index), project_id: "project", name, code: `KPI-${index}`, unit: "number",
    is_active: true, status: "not_started", direction: "decrease", baseline_value: 0,
    target_value: 0, target_date: null, current_value: null, progress_percent: null,
    target_achieved: null, reporting_frequency: "monthly", mapping_health: "unmapped", mapping: null,
    result_source: "unconfigured", qualitative_value: null, framework_node_id: null,
    schedule_status: "no_data", history: [], location_breakdown: [], eligible_records: 0,
    mapped_records: 0, numerator: null, denominator: 0, missing_records: 0, invalid_answers: 0,
    quality_excluded_records: 0, undated_records: 0,
    manual_result_count: 0, description: null, calculation_note: "No source configured.", source_form_id: null,
    date_from: null, date_to: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
  } as Indicator)));
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={["/projects/project/indicators?view=results&indicator_id=1"]}><Routes><Route path="/projects/:projectId/indicators" element={<IndicatorWorkspacePage />} /></Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByRole("combobox", { name: "Indicator" });
  expect((screen.getByRole("combobox", { name: "Indicator" }) as HTMLSelectElement).value).toBe("1");
});

it.each([false, true])("reviews source mapping and requires fresh confirmation after stale=%s", async (stale) => {
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
    { id: "other-project", name: "Other Project" },
  ] as never);
  vi.mocked(apiClient.indicators).mockImplementation(async () => [...items]);
  vi.mocked(apiClient.resultsFramework).mockResolvedValue([
    {
      id: "empty-group",
      parent_id: null,
      title: "Empty group",
      node_type: "output",
    },
  ] as never);
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
  vi.mocked(apiClient.indicatorMappingPreview).mockResolvedValue({
    expected_version: 0, preview_token: "signed-preview", affected_periods: [], notice: "Current evidence, not frozen history",
    before: items[1], after: {...items[1], mapped_records: 0, missing_records: 0, invalid_answers: 0, quality_excluded_records: 0, denominator: 0},
  });
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
  if (stale) {
    vi.mocked(apiClient.saveIndicatorMapping).mockRejectedValueOnce(new Error("Evidence changed since preview. Refresh the preview and confirm again."));
    vi.mocked(apiClient.indicatorMappingPreview).mockResolvedValueOnce({
      expected_version: 0, preview_token: "old-preview", affected_periods: [], notice: "Initial preview",
      before: items[1], after: {...items[1], current_value: 10},
    });
  }
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/projects/project/indicators"]}>
        <Routes>
          <Route
            path="/projects/:projectId/indicators"
            element={<IndicatorWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Map source for Girls present" });
  expect(screen.queryByRole("combobox", { name: "Project" })).toBeNull();
  expect(
    screen.getByText("FieldSight / School Feed Program / Monitoring & evaluation"),
  ).toBeTruthy();
  expect(apiClient.indicators).toHaveBeenCalledWith("project", "", "");
  expect(
    screen.queryByRole("button", { name: "Collapse Empty group" }),
  ).toBeNull();
  expect(screen.queryByLabelText("Submitted from")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.change(screen.getByLabelText("Submitted from"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Filters Active/ }));
  expect(screen.queryByLabelText("Submitted from")).toBeNull();
  expect(screen.getByRole("button", { name: "Indicators" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Results framework" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Results summary" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Filters Active/ }));
  expect(
    (screen.getByLabelText("Submitted from") as HTMLInputElement).value,
  ).toBe("2026-10-01");
  fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Collapse Ungrouped indicators" }),
  );
  expect(
    screen.queryByRole("button", { name: "Map source for Girls present" }),
  ).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Expand Ungrouped indicators" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  fireEvent.click(
    screen.getByRole("button", { name: "Expand Ungrouped indicators" }),
  );
  expect(
    screen.getByRole("button", { name: "Map source for Girls present" }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Search indicators")).toBeNull();
  fireEvent.change(screen.getByLabelText("Filter indicators"), {
    target: { value: "mapped" },
  });
  expect(screen.getByText("No indicators match these filters.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
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
    (
      (await within(dialog).findByRole("option", {
        name: "School Attendance",
      })) as HTMLOptionElement
    ).value,
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
  const review = await screen.findByRole("dialog", {name: "Review definition change"});
  expect(apiClient.saveIndicatorMapping).not.toHaveBeenCalled();
  const confirm = within(review).getByRole("button", {name: "Confirm change"});
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(within(review).getByRole("textbox"), {target: {value: "Reviewed source mapping"}});
  fireEvent.click(within(review).getByRole("checkbox"));
  fireEvent.click(confirm);
  if (stale) {
    await within(review).findByText(/The preview was stale/);
    expect(within(review).getByRole("textbox")).toHaveProperty("value", "Reviewed source mapping");
    expect(within(review).getByRole("checkbox")).toHaveProperty("checked", false);
    expect(within(review).getByRole("button", {name: "Confirm change"})).toHaveProperty("disabled", true);
    expect(apiClient.saveIndicatorMapping).toHaveBeenCalledTimes(1);
    fireEvent.click(within(review).getByRole("checkbox"));
    fireEvent.click(within(review).getByRole("button", {name: "Confirm change"}));
  }
  await waitFor(() =>
    expect(apiClient.saveIndicatorMapping).toHaveBeenCalledWith("1", {
      source_form_id: "attendance",
      source_field: "girls",
      calculation: "sum",
      match_value: null,
      confirm_change: true, change_reason: "Reviewed source mapping", expected_version: 0, preview_token: "signed-preview",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

function renderMapping() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <IndicatorMappingForm
          projectId="project"
          indicator={
            { id: "indicator", name: "Attendance", unit: "number", mapping: null } as Indicator
          }
          saving={false}
          error=""
          onClose={vi.fn()}
          onSave={vi.fn()}
          onRemove={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const emptyCatalogue = {
  project_id: "project",
  form_id: "attendance",
  form_name: "School Attendance",
  forms: ["attendance"],
  fields: [],
  warning: null,
} as unknown as SurveyCatalogue;
it("fetches Kobo metadata for a new form with no stored questions or submissions", async () => {
  let refreshed = false;
  const field = {
    source_field: "boys",
    label: "Boys present",
    type: "number" as const,
    supported: true,
    choices: [],
    form_id: "attendance",
    source: "kobo" as const,
  };
  vi.mocked(apiClient.surveyFields).mockImplementation(
    async (_project, _form, refresh) => {
      if (refresh) refreshed = true;
      return {
        ...emptyCatalogue,
        fields: refreshed ? [field] : [],
      } as SurveyCatalogue;
    },
  );
  vi.mocked(apiClient.indicatorFields).mockImplementation(async () =>
    refreshed ? [field] : [],
  );
  renderMapping();
  expect(
    await screen.findByRole("option", { name: "Boys present · number" }),
  ).toBeTruthy();
  expect(apiClient.surveyFields).toHaveBeenCalledWith(
    "project",
    "attendance",
    true,
  );
});
it("keeps the form selected after metadata failure and lets the user retry", async () => {
  let fail = true;
  vi.mocked(apiClient.surveyFields).mockImplementation(
    async (_project, _form, refresh) => {
      if (refresh && fail)
        throw new Error("Kobo questions unavailable. Try again.");
      return emptyCatalogue;
    },
  );
  vi.mocked(apiClient.indicatorFields).mockResolvedValue([]);
  renderMapping();
  expect(await screen.findByText(/Kobo questions unavailable/)).toBeTruthy();
  expect(
    (screen.getByLabelText("Source form") as HTMLSelectElement).value,
  ).toBe("attendance");
  fail = false;
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
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh Kobo questions" }),
  );
  expect(
    await screen.findByRole("option", { name: "Girls present · number" }),
  ).toBeTruthy();
});
