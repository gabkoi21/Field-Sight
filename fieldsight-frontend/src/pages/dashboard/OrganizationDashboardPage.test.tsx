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

it("keeps API metrics and rankings in the overview project and period scope", async () => {
  setup("/?overview_project=p1");
  await screen.findByRole("heading", { name: "Dashboard" });
  await screen.findByText("Recent collector");
  expect(screen.queryByText("Older collector")).toBeNull();
  expect(screen.queryByText("Other collector")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Submissions by location" })).toBeNull();
  expect(screen.queryByText("View location data")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Top projects" })).toBeNull();
  const rankings = screen.getByRole("table", { name: "Top three enumerators ranked by period submissions" });
  expect(within(rankings).getByRole("rowheader", { name: "Recent collector" })).toBeTruthy();
  expect(within(rankings).getByRole("columnheader", { name: "Last active" })).toBeTruthy();

});

it("uses organization-wide filtering independently of the current-project URL", async () => {
  setup("/?project_id=p1");
  await screen.findByText("Other collector");
  expect(apiClient.dashboardOverview).toHaveBeenCalledWith({ projectId: undefined, location: undefined, period: "7d" });
});

it("shows a retryable failure instead of zero-valued metrics when overview loading fails", async () => {
  vi.mocked(apiClient.dashboardOverview).mockRejectedValue(new Error("Overview unavailable"));
  setup();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry overview" })).toBeTruthy();
  expect(screen.queryByText("Submissions in period")).toBeNull();
});


it("shows KPIs and charts without the removed dashboard filter bar", async () => {
  setup("/dashboard");
  await screen.findByRole("heading", { name: "Dashboard" });
  expect(screen.queryByRole("region", { name: "Application areas" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Collection trend" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Project Status" })).toBeTruthy();
  expect(screen.getByText("Data readiness")).toBeTruthy();
  expect(screen.queryByText("Collection performance and data quality across your organization.")).toBeNull();
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  expect(screen.queryByText("Filter dashboard")).toBeNull();
  expect(screen.queryByRole("region", { name: "Organization overview filters" })).toBeNull();
});

it("filters the enumerator table with its own project dropdown", async () => {
  setup("/dashboard");
  const select = await screen.findByLabelText("Enumerator project");
  await screen.findByText("Recent collector");
  expect(within(select).getByRole("option", { name: "All Project" })).toBeTruthy();
  expect(within(select).getByRole("option", { name: "Health" })).toBeTruthy();
  expect(within(select).getByRole("option", { name: "Education" })).toBeTruthy();
  expect(screen.queryByText(/Ranked by period submissions/)).toBeNull();
  fireEvent.change(select, { target: { value: "p2" } });
  await waitFor(() => expect(screen.queryByText("Recent collector")).toBeNull());
  expect(screen.getByText("Other collector")).toBeTruthy();
  fireEvent.change(select, { target: { value: "" } });
  await screen.findByText("Recent collector");
  expect(screen.getByText("Other collector")).toBeTruthy();
});

it("compares monthly submissions with records currently ready for analysis", async () => {
  setup("/dashboard");
  await screen.findByRole("heading", { name: "Monthly Collection Performance" });
  expect(screen.queryByText("Projects with submissions")).toBeNull();
  expect(screen.queryByText("View monthly data")).toBeNull();
  const table = screen.getByRole("table", { name: /Monthly collection performance for/ });
  expect(within(table).getByRole("columnheader", { name: "Ready for Analysis" })).toBeTruthy();
  const month = new Date(Date.now() - 2 * 86400000).toLocaleString("en", { month: "short", timeZone: "UTC" });
  const row = within(table).getByRole("rowheader", { name: month }).closest("tr")!;
  const counts = within(row).getAllByRole("cell").map(cell => cell.textContent);
  expect(Number(counts[0])).toBeGreaterThanOrEqual(2);
  expect(counts[1]).toBe(counts[0]);
});

it("charts only active and completed projects using saved project statuses", async () => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([
    { id: "p1", name: "Health", status: "active" },
    { id: "p2", name: "Education", status: "completed" },
    { id: "p3", name: "Draft", status: "draft" },
    { id: "p4", name: "Archived", status: "archived" },
  ] as never);
  setup();
  expect(await screen.findByRole("img", { name: "Project status: Active 1, Completed 1." })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Review status" })).toBeNull();
  const panel = screen.getByRole("heading", { name: "Project Status" }).closest("article")!;
  expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
  expect(within(panel).getByText("2")).toBeTruthy();
});

it("keeps a neutral doughnut visible when no projects are active or completed", async () => {
  setup();
  const chart = await screen.findByRole("img", { name: "Project status: Active 0, Completed 0." });
  expect(chart.querySelector("svg circle")).toBeTruthy();
  expect(within(chart).getByText("0")).toBeTruthy();
  expect(screen.getByText("No active or completed projects yet.")).toBeTruthy();
});
