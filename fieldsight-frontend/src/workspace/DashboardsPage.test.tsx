// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
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
  type AnalysisResult,
  type Indicator,
  type WorkspaceDashboard,
} from "../services/apiClient";
import { DashboardsPage } from "./DashboardsPage";

const workspace = vi.hoisted(() => ({
  projectId: "p1",
  organizationId: "org1",
  project: { id: "p1", name: "Health" },
  projects: [
    { id: "p1", name: "Health" },
    { id: "p2", name: "Education" },
  ],
  selectProject: vi.fn(),
  loading: false,
  error: null,
  hasSelectedProject: true,
  isAdmin: true,
}));
vi.mock("./WorkspaceContext", () => ({ useWorkspace: () => workspace }));
vi.mock("../services/apiClient", () => ({
  apiClient: {
    dashboards: vi.fn(),
    createDashboard: vi.fn(),
    saveDashboard: vi.fn(),
    deleteDashboard: vi.fn(),
    indicators: vi.fn(),
    savedAnalyses: vi.fn(),
    syncSettings: vi.fn(),
    dashboardWidgetResult: vi.fn(),
    dashboardPdf: vi.fn(),
  },
}));

let stored: WorkspaceDashboard[];
const note = (id: string, title: string) => ({
  id,
  title,
  kind: "text" as const,
  source_id: null,
  text: `${title} content`,
  width: 1 as const,
  height: 360,
});
const indicator = (value: number | null = 20): Indicator =>
  ({
    id: "source",
    name: "Attendance",
    unit: "percentage",
    current_value: value,
    target_value: 100,
    result_source: "table",
    mapping_health: "healthy",
    progress_percent: value,
    eligible_records: 2,
    status: "in_progress",
    manual_result_count: 0,
  }) as Indicator;

function setup(path = "/") {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <DashboardsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { cache, ...view };
}

beforeEach(() => {
  workspace.projectId = "p1";
  workspace.project = { id: "p1", name: "Health" };
  workspace.selectProject.mockReset();
  stored = [
    {
      id: "dash",
      project_id: "p1",
      title: "Health evidence",
      description: "Project results",
      created_at: "2026-10-01",
      widgets: [note("a", "Alpha"), note("b", "Beta")],
      version: 1,
    },
  ];
  vi.mocked(apiClient.dashboards).mockImplementation(async () =>
    structuredClone(stored),
  );
  vi.mocked(apiClient.indicators).mockResolvedValue([]);
  vi.mocked(apiClient.savedAnalyses).mockResolvedValue([]);
  vi.mocked(apiClient.syncSettings).mockResolvedValue({
    mode: "scheduled",
    interval_minutes: 1,
    interval_seconds: 1.6,
    pending: false,
    last_successful_sync: "2026-10-23T10:00:00Z",
  });
  vi.mocked(apiClient.saveDashboard).mockImplementation(async (id, input) => {
    const result = {
      ...stored.find((d) => d.id === id)!,
      ...input,
      version: (input.version ?? 1) + 1,
    };
    stored = stored.map((d) => (d.id === id ? result : d));
    return structuredClone(result);
  });
  vi.mocked(apiClient.createDashboard).mockImplementation(async (input) => {
    const result = {
      ...input,
      id: `new-${stored.length + 1}`,
      created_at: "2026-10-23",
      version: 1,
    };
    stored.push(result);
    return structuredClone(result);
  });
  vi.mocked(apiClient.deleteDashboard).mockImplementation(async (id) => {
    stored = stored.filter((d) => d.id !== id);
  });
  vi.stubGlobal("PointerEvent", MouseEvent);
});

it("opens the saved chart handoff with its source and title prefilled", async () => {
  vi.mocked(apiClient.savedAnalyses).mockResolvedValue([{id: "chart-one", title: "Water availability", chart: "pie"}] as never);
  setup("/?add_visualization=chart-one");
  const dialog = await screen.findByRole("dialog");
  expect((within(dialog).getByLabelText("Widget title") as HTMLInputElement).value).toBe("Water availability");
  expect((within(dialog).getByLabelText("Saved visualization") as HTMLSelectElement).value).toBe("chart-one");
  expect((within(dialog).getByLabelText("Widget type") as HTMLSelectElement).value).toBe("analysis");
});

it("suggests a source title while preserving a manually entered widget title", async () => {
  vi.mocked(apiClient.savedAnalyses).mockResolvedValue([{id: "chart-one", title: "Water availability", chart: "pie"}, {id: "chart-two", title: "Soap availability", chart: "pie"}] as never);
  setup();
  fireEvent.click(await screen.findByRole("button", {name: "Add widget"}));
  fireEvent.change(screen.getByLabelText("Widget type"), {target: {value: "analysis"}});
  await screen.findByRole("option", {name: "Water availability"});
  fireEvent.change(screen.getByLabelText("Saved visualization"), {target: {value: "chart-one"}});
  expect((screen.getByLabelText("Widget title") as HTMLInputElement).value).toBe("Water availability");
  fireEvent.change(screen.getByLabelText("Widget title"), {target: {value: "My custom title"}});
  fireEvent.change(screen.getByLabelText("Saved visualization"), {target: {value: "chart-two"}});
  expect((screen.getByLabelText("Widget title") as HTMLInputElement).value).toBe("My custom title");
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("opens the exact linked dashboard rather than the first dashboard", async () => {
  stored.push({...stored[0], id: "second", title: "Second dashboard", widgets: [note("second-note", "Linked context")]});
  setup("/?dashboard=second");
  expect(await screen.findByText("Linked context content")).toBeTruthy();
  expect((screen.getByRole("combobox", {name: "Dashboard"}) as HTMLSelectElement).value).toBe("second");
  expect(screen.queryByText("Alpha content")).toBeNull();
});

it("downloads a PDF for the selected dashboard and active date range", async () => {
  vi.mocked(apiClient.dashboardPdf).mockResolvedValue(new ArrayBuffer(8));
  const createUrl = vi.fn().mockReturnValue("blob:dashboard");
  Object.defineProperty(URL, "createObjectURL", {configurable: true, value: createUrl});
  Object.defineProperty(URL, "revokeObjectURL", {configurable: true, value: vi.fn()});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  setup();
  fireEvent.click(await screen.findByRole("button", {name: "Download PDF"}));
  await waitFor(() => expect(apiClient.dashboardPdf).toHaveBeenCalledWith("dash", "", ""));
  await waitFor(() => expect(click).toHaveBeenCalled());
  expect(createUrl).toHaveBeenCalled();
});

describe("existing saved dashboard builder", () => {
  it("shows an honest empty state without sample values", async () => {
    stored = [];
    setup();
    expect(await screen.findByText("Your results, together")).toBeTruthy();
    expect(apiClient.dashboardWidgetResult).not.toHaveBeenCalled();
  });

  it("creates, copies a link, renames and deletes persisted dashboards", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText}});
    stored = [];
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Create first dashboard" }),
    );
    fireEvent.change(screen.getByLabelText("Dashboard name"), {
      target: { value: "Clinic outcomes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save dashboard" }));
    await screen.findByRole("button", { name: "Rename dashboard" });
    expect(stored[0].title).toBe("Clinic outcomes");
    fireEvent.click(screen.getByRole("button", { name: "Rename dashboard" }));
    fireEvent.change(screen.getByLabelText("Dashboard name"), {
      target: { value: "Clinic results" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save dashboard" }));
    await waitFor(() => expect(stored[0].title).toBe("Clinic results"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Copy dashboard link" }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/projects/p1/dashboards?dashboard=new-1")));
    expect(stored).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete dashboard" }));
    const confirmation = await screen.findByRole("dialog", { name: "Delete dashboard" });
    fireEvent.change(within(confirmation).getByLabelText('To confirm, type “Clinic results”'), { target: { value: "Clinic results" } });
    fireEvent.change(within(confirmation).getByLabelText('To confirm, type “delete dashboard”'), { target: { value: "delete dashboard" } });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Delete dashboard" }));
    await waitFor(() => expect(stored).toHaveLength(0));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("persists keyboard ordering and height across a reload", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Move Alpha down" }),
    );
    await waitFor(() => expect(stored[0].widgets[0].id).toBe("b"));
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Height of Alpha") as HTMLSelectElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.change(screen.getByLabelText("Height of Alpha"), {
      target: { value: "600" },
    });
    await waitFor(() => expect(stored[0].widgets[1].height).toBe(600));
    cleanup();
    setup();
    await screen.findByText("Alpha content");
    expect(
      (screen.getByLabelText("Height of Alpha") as HTMLSelectElement).value,
    ).toBe("600");
    expect(
      (
        screen.getByRole("button", {
          name: "Move Beta up",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("supports dragging a widget to another position", async () => {
    setup();
    const handle = await screen.findByRole("button", { name: "Drag Alpha" });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => document.querySelector('[data-widget-id="b"]'),
    });
    fireEvent.pointerDown(handle, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(window);
    await waitFor(() =>
      expect(stored[0].widgets.map((w) => w.id)).toEqual(["b", "a"]),
    );
  });

  it("keeps legacy full-width widgets side by side without width resize controls", async () => {
    stored[0].widgets[1].width = 2;
    setup();
    await screen.findByText("Beta content");
    for (const id of ["a", "b"]) {
      const card = document.querySelector(`[data-widget-id="${id}"]`)!;
      expect(card.className).not.toContain("col-span-2");
    }
    expect(screen.queryByRole("button", { name: "Resize Alpha" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Drag to resize Alpha" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expand Alpha" })).toBeTruthy();
    expect(apiClient.saveDashboard).not.toHaveBeenCalled();
  });

  it("previews date filters, saves them and restores them on reload", async () => {
    setup();
    await screen.findByText("Alpha content");
    fireEvent.change(screen.getByLabelText("Results from"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Results through"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save filters" }));
    await waitFor(() => expect(stored[0].date_from).toBe("2026-10-01"));
    cleanup();
    setup();
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Results through") as HTMLInputElement).value,
      ).toBe("2026-10-31"),
    );
    fireEvent.change(screen.getByLabelText("Results from"), {
      target: { value: "2026-12-01" },
    });
    expect(
      screen.getByText("Start date must be on or before end date."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Save filters",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("presents all dashboard widgets together and closes without saving", async () => {
    stored[0].widgets = [note("a", "Boys attendance"), note("b", "Girls attendance")];
    setup();
    const expand = await screen.findByRole("button", { name: "Expand dashboard" });
    expand.focus();
    fireEvent.click(expand);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Boys attendance" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Girls attendance" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(expand);
    fireEvent.click(expand);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(apiClient.saveDashboard).not.toHaveBeenCalled();
  });

  it("expands a widget for presentation and closes without saving its layout", async () => {
    stored[0].widgets = [note("a", "Attendance")];
    setup();
    const expand = await screen.findByRole("button", { name: "Expand Attendance" });
    expand.focus();
    fireEvent.click(expand);
    let dialog = await screen.findByRole("dialog", { name: "Attendance" });
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(expand);
    expect(document.body.style.overflow).not.toBe("hidden");
    fireEvent.click(expand);
    dialog = await screen.findByRole("dialog", { name: "Attendance" });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(apiClient.saveDashboard).not.toHaveBeenCalled();
  });

  it("refreshes existing widget results after a successful background sync", async () => {
    stored[0].widgets = [
      { ...note("a", "Attendance"), kind: "indicator", source_id: "source" },
    ];
    let finishRefresh!: (value: Awaited<ReturnType<typeof apiClient.dashboardWidgetResult>>) => void;
    const refreshed = new Promise<Awaited<ReturnType<typeof apiClient.dashboardWidgetResult>>>((resolve) => {
      finishRefresh = resolve;
    });
    vi.mocked(apiClient.dashboardWidgetResult)
      .mockResolvedValueOnce({ kind: "indicator", indicator: indicator(20) })
      .mockReturnValueOnce(refreshed)
      .mockResolvedValue({ kind: "indicator", indicator: indicator(55) });
    const { cache } = setup();
    expect(await screen.findByText("20%")).toBeTruthy();
    await act(async () => {
      cache.setQueryData(["sync-settings", "p1"], {
        mode: "scheduled",
        pending: false,
        interval_minutes: 1,
        last_successful_sync: "2026-10-23T10:01:00Z",
      });
    });
    await waitFor(() => expect(apiClient.dashboardWidgetResult).toHaveBeenCalledTimes(2));
    expect(screen.getByText("20%")).toBeTruthy();
    await act(async () => {
      finishRefresh({ kind: "indicator", indicator: indicator(55) });
    });
    expect(await screen.findByText("55%")).toBeTruthy();
    expect(apiClient.dashboardWidgetResult).toHaveBeenCalledWith(
      "dash",
      "a",
      "",
      "",
    );
    fireEvent.change(screen.getByLabelText("Results from"), {
      target: { value: "2026-10-01" },
    });
    await waitFor(() =>
      expect(apiClient.dashboardWidgetResult).toHaveBeenLastCalledWith(
        "dash",
        "a",
        "2026-10-01",
        "",
      ),
    );
    expect(
      await screen.findByText(
        /Overall target: 100 \(unchanged by date filters\)/,
      ),
    ).toBeTruthy();
  });

  it("does not append a percent sign to unavailable values", async () => {
    stored[0].widgets = [
      { ...note("a", "Attendance"), kind: "indicator", source_id: "source" },
    ];
    vi.mocked(apiClient.dashboardWidgetResult).mockResolvedValue({
      kind: "indicator",
      indicator: indicator(null),
    });
    setup();
    expect(await screen.findByText("Not reported")).toBeTruthy();
    expect(screen.queryByText("Not reported%")).toBeNull();
  });

  it("shows source failures and retries without fabricated results", async () => {
    stored[0].widgets = [
      { ...note("a", "Attendance"), kind: "indicator", source_id: "source" },
    ];
    vi.mocked(apiClient.dashboardWidgetResult)
      .mockRejectedValueOnce(new Error("Source no longer available"))
      .mockResolvedValue({ kind: "indicator", indicator: indicator(25) });
    setup();
    expect(await screen.findByText("Source no longer available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry widget" }));
    expect(await screen.findByText("25%")).toBeTruthy();
  });

  it("renders saved survey results from the shared endpoint and handles empty data", async () => {
    stored[0].widgets = [
      {
        ...note("a", "Survey results"),
        kind: "analysis",
        source_id: "analysis",
      },
    ];
    const result = {
      field: {source_field: "county", label: "County", type: "select_one", choices: [], source: "kobo", supported: true},
      project_id: "p1", form_id: "form", total_records: 3, value: 17, filters: {review_status: "ready", categories: [], date_from: null, date_to: null, location: null, enumerator: null}, note: "Percentages use answered records", generated_at: "2026-10-28T00:00:00Z",
      measure: "count", group_by: null, denominator: 2,
      series: [{ name: "North", value: 17, count: 2, group: null, percent: 100 }],
      answered_records: 2,
      eligible_records: 3,
      missing_records: 1,
      invalid_answers: 0,
    } as AnalysisResult;
    vi.mocked(apiClient.dashboardWidgetResult).mockResolvedValue({
      kind: "analysis",
      chart: "table",
      analysis: result,
    });
    const { cache } = setup();
    expect(await screen.findByRole("rowheader", { name: "North" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "17" })).toBeTruthy();
    vi.mocked(apiClient.dashboardWidgetResult).mockResolvedValue({
      kind: "analysis",
      chart: "table",
      analysis: { ...result, series: [] },
    });
    await act(async () => {
      await cache.invalidateQueries({ queryKey: ["dashboard-widget"] });
    });
    expect(
      await screen.findByText(
        "No answered records match this chart's source and filters.",
      ),
    ).toBeTruthy();
  });

  it("adds and edits a text widget using the existing save flow", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Add widget" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "text" },
    });
    fireEvent.change(screen.getByLabelText("Widget title"), {
      target: { value: "Context" },
    });
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Documented field context" },
    });
    const buttons = screen.getAllByRole("button", { name: "Add widget" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText("Documented field context")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Context" }));
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Revised context" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save widget" }));
    expect(await screen.findByText("Revised context")).toBeTruthy();
    expect(stored[0].widgets).toHaveLength(3);
  });

  it("keeps save conflicts visible and leaves the last saved layout intact", async () => {
    vi.mocked(apiClient.saveDashboard).mockRejectedValue(
      new Error("Dashboard changed in another session. Reload it."),
    );
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Move Alpha down" }),
    );
    expect(
      await screen.findByText(
        "Dashboard changed in another session. Reload it.",
      ),
    ).toBeTruthy();
    expect(stored[0].widgets[0].id).toBe("a");
  });

  it("shows loading and request errors without presenting a create-first empty state", async () => {
    vi.mocked(apiClient.dashboards).mockRejectedValue(
      new Error("Dashboard service unavailable"),
    );
    setup();
    expect(
      await screen.findByText("Dashboard service unavailable"),
    ).toBeTruthy();
    expect(screen.queryByText("Your results, together")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry loading dashboards" }),
    ).toBeTruthy();
  });

  it("uses current project context without duplicating the header selector or changing widget provenance", async () => {
    const { cache, rerender } = setup();
    await screen.findByText("Health evidence");
    expect(screen.queryByLabelText("Project")).toBeNull();
    workspace.projectId = "p2";
    workspace.project = { id: "p2", name: "Education" };
    rerender(<QueryClientProvider client={cache}><MemoryRouter><DashboardsPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Your results, together")).toBeTruthy();
    expect(apiClient.saveDashboard).not.toHaveBeenCalled();
  });});
