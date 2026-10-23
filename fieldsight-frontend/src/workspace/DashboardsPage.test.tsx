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

function setup() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
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
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("existing saved dashboard builder", () => {
  it("shows an honest empty state without sample values", async () => {
    stored = [];
    setup();
    expect(await screen.findByText("Your results, together")).toBeTruthy();
    expect(apiClient.dashboardWidgetResult).not.toHaveBeenCalled();
  });

  it("creates, duplicates, renames and deletes persisted dashboards", async () => {
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
      screen.getByRole("button", { name: "Duplicate dashboard" }),
    );
    await waitFor(() => expect(stored).toHaveLength(2));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("combobox", {
            name: "Dashboard",
          }) as HTMLSelectElement
        ).value,
      ).toBe("new-2"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete dashboard" }));
    await waitFor(() => expect(stored).toHaveLength(1));
  });

  it("persists keyboard ordering, width and height across a reload", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Move Alpha down" }),
    );
    await waitFor(() => expect(stored[0].widgets[0].id).toBe("b"));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Resize Alpha",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Resize Alpha" }));
    await waitFor(() => expect(stored[0].widgets[1].width).toBe(2));
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

  it("persists pointer resizing once the handle is released", async () => {
    setup();
    const handle = await screen.findByRole("button", {
      name: "Drag to resize Alpha",
    });
    fireEvent.pointerDown(handle, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 460, clientY: 110 });
    expect(apiClient.saveDashboard).not.toHaveBeenCalled();
    fireEvent.pointerUp(window);
    await waitFor(() => expect(stored[0].widgets[0].height).toBe(460));
    expect(stored[0].widgets[0].width).toBe(2);
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

  it("refreshes existing widget results after a successful background sync", async () => {
    stored[0].widgets = [
      { ...note("a", "Attendance"), kind: "indicator", source_id: "source" },
    ];
    vi.mocked(apiClient.dashboardWidgetResult)
      .mockResolvedValueOnce({ kind: "indicator", indicator: indicator(20) })
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
      series: [{ name: "North", value: 17, count: 2, group: null }],
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
    expect(await screen.findByRole("cell", { name: "North" })).toBeTruthy();
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

  it("uses project selection to choose dashboards rather than changing widget provenance", async () => {
    setup();
    fireEvent.change(await screen.findByLabelText("Project"), {
      target: { value: "p2" },
    });
    expect(workspace.selectProject).toHaveBeenCalledWith("p2");
    expect(apiClient.saveDashboard).not.toHaveBeenCalled();
  });
});
