// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { OrganizationDashboardPage } from "./OrganizationDashboardPage";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ loading: false, user: { memberships: [{ organization_id: "org", role: "organization_admin" }] } }) }));
vi.mock("../../services/apiClient", () => ({ apiClient: { organizationProjects: vi.fn(), dashboardOverview: vi.fn(), pendingKoboSync: vi.fn(), enumerators: vi.fn(), submissions: vi.fn() } }));
// Charts have data-table alternatives; avoid depending on SVG layout in jsdom.
vi.mock("recharts", async (original) => ({ ...await original<object>(), ResponsiveContainer: () => null }));

beforeEach(() => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "p1", name: "Health" }, { id: "p2", name: "Education" }] as never);
  vi.mocked(apiClient.dashboardOverview).mockImplementation(async (filters) => ({
    total_submissions: 3, ready_records: 2, needs_review: 1, invalid_records: 0,
    active_projects: 1, submission_change_percent: null,
    available_locations: ["Recent site", "Older site", "Other project"], trend: [],
    projects: [{ id: filters?.projectId || "p1", name: "Health", actual: 3, target: 100 }],
  }) as never);
  vi.mocked(apiClient.pendingKoboSync).mockResolvedValue({ pending_count: 0, sources: [] } as never);
  vi.mocked(apiClient.enumerators).mockResolvedValue([]);
  vi.mocked(apiClient.submissions).mockResolvedValue([
    { project_id: "p1", location: "Recent site", enumerator: "Recent collector", submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(), review_status: "ready" },
    { project_id: "p1", location: "Older site", enumerator: "Older collector", submitted_at: new Date(Date.now() - 15 * 86400000).toISOString(), review_status: "ready" },
    { project_id: "p2", location: "Other project", enumerator: "Other collector", submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(), review_status: "ready" },
  ] as never);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function setup(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><OrganizationDashboardPage /></MemoryRouter></QueryClientProvider>);
}

it("keeps API metrics, location data, and rankings in the overview project and period scope", async () => {
  setup("/?overview_project=p1");
  await screen.findByRole("heading", { name: "Overview" });
  await screen.findByText("Recent collector");
  expect(screen.queryByText("Older collector")).toBeNull();
  expect(screen.queryByText("Other collector")).toBeNull();
  fireEvent.click(screen.getByText("View location data"));
  const table = screen.getByRole("table", { name: "Submissions by location and quality status" });
  expect(within(table).getByText("Recent site")).toBeTruthy();
  expect(within(table).queryByText("Older site")).toBeNull();
  expect(screen.getByText("Actual: 3")).toBeTruthy();
  expect(screen.getByText("Target: 100")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Reporting period"), { target: { value: "30d" } });
  await screen.findByText("Older collector");
  await waitFor(() => expect(apiClient.dashboardOverview).toHaveBeenLastCalledWith({ projectId: "p1", location: undefined, period: "30d" }));
  expect(screen.queryByText("Other collector")).toBeNull();
  expect(screen.getByText(/Jan 1 – Dec 31/).textContent).toContain("independent of reporting period");
});

it("uses organization-wide filtering independently of the current-project URL", async () => {
  setup("/?project_id=p1");
  await screen.findByText("Other collector");
  expect((screen.getByLabelText("Overview project filter") as HTMLSelectElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Overview project filter"), { target: { value: "p2" } });
  await waitFor(() => expect(apiClient.dashboardOverview).toHaveBeenLastCalledWith({ projectId: "p2", location: undefined, period: "7d" }));
  expect(screen.queryByText("Recent collector")).toBeNull();
});

it("shows a retryable failure instead of zero-valued metrics when overview loading fails", async () => {
  vi.mocked(apiClient.dashboardOverview).mockRejectedValue(new Error("Overview unavailable"));
  setup();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry overview" })).toBeTruthy();
  expect(screen.queryByText("Submissions in period")).toBeNull();
});
