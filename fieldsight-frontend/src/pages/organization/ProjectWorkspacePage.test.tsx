// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { apiClient, type Indicator } from "../../services/apiClient";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";
import { reportingCompleteness } from "./projectOverview";

const auth = vi.hoisted(() => ({ role: "organization_admin" }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ loading: false, user: { memberships: [{ organization_id: "org", role: auth.role }] } }) }));
vi.mock("../../services/apiClient", () => ({ apiClient: { organizationProjects: vi.fn(), getProject: vi.fn(), submissionPage: vi.fn(), syncSettings: vi.fn(), indicators: vi.fn(), syncProjectKoboForm: vi.fn(), organizationSectors: vi.fn(), sectors: vi.fn(), projectTeam: vi.fn(), analyticsOverview: vi.fn() } }));
// Chart values are verified through their accessible data alternatives in jsdom.
vi.mock("recharts", async original => ({ ...await original<object>(), ResponsiveContainer: () => null }));

const indicator = (changes: Partial<Indicator> = {}): Indicator => ({
  id: "feeding", project_id: "school", name: "Feeding sessions completed", is_active: true,
  current_value: 0, target_value: 10, unit: "number", result_source: "table", setup_complete: true,
  mapping_health: "healthy", schedule_status: "not_due", quality_excluded_records: 2,
  ...changes,
} as Indicator);

beforeEach(() => {
  auth.role = "organization_admin";
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ status: "completed" }, { status: "active" }] as never);
  vi.mocked(apiClient.projectTeam).mockResolvedValue([{ user_id: "collector-1", role: "enumerator", is_active: true }, { user_id: "collector-2", role: "enumerator", is_active: true }] as never);
  vi.mocked(apiClient.analyticsOverview).mockResolvedValue({ trend: [{ day: "Oct 25", submissions: 8, approved: 5 }, { day: "Oct 26", submissions: 12, approved: 9 }] } as never);
  vi.mocked(apiClient.getProject).mockImplementation(async (_org, id) => ({ id, organization_sector_id: "org-education", name: id === "school" ? "Daily School Feeding Monitoring Form" : "Other project", description: "Daily feeding monitoring across partner schools.", country: "Liberia", start_date: "2026-08-01", end_date: "2027-07-31", workspace_details: { code: "SFP-26", stage: "Implementation" }, status: "active", kobo_connection_id: "connection", kobo_form_id: "form", kobo_form_name: "School Feeding Form" }) as never);
  vi.mocked(apiClient.organizationSectors).mockResolvedValue([{ id: "org-education", sector_id: "education", is_active: true }]);
  vi.mocked(apiClient.sectors).mockResolvedValue([{ id: "education", name: "Education" }] as never);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ total: 123, counts: { ready: 100, needs_review: 20, invalid: 3 }, items: [{ id: "latest", submitted_at: "2026-10-26T14:00:00Z" }] } as never);
  vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 60, pending: false, last_successful_sync: "2026-10-25T12:00:00Z", latest_status: "completed" });
  vi.mocked(apiClient.indicators).mockResolvedValue([indicator(), indicator({ id: "students", name: "Students fed", current_value: 450 }), indicator({ id: "shortages", name: "Food shortage incidents", current_value: 2, direction: "decrease", target_value: 0 })]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function SwitchProject() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/projects/other/overview")}>Switch project</button><ProjectWorkspacePage /></>;
}
function setup(switchable = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/school/overview"]}><Routes><Route path="/projects/:projectId/overview" element={switchable ? <SwitchProject /> : <ProjectWorkspacePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

it("uses four display-only project-scoped summary cards", async () => {
  setup();
  await screen.findByRole("article", { name: /Active indicators/ }, { timeout: 5000 });
  const summary = screen.getByRole("region", { name: "Project summary" });
  expect(within(summary).getByText("123")).toBeTruthy();
  expect(within(summary).getByRole("article", { name: "Connected forms 1" })).toBeTruthy();
  expect(within(summary).getByRole("article", { name: "Total enumerators 2" })).toBeTruthy();
  expect(within(summary).queryByText("Awaiting review")).toBeNull();
  expect(within(summary).queryByText("Ready records")).toBeNull();
  expect(within(summary).getByText("3")).toBeTruthy();
  expect(within(summary).getAllByRole("article")).toHaveLength(4);
  expect(within(summary).queryByRole("link")).toBeNull();
  expect(within(summary).queryByRole("button")).toBeNull();
  expect(screen.queryByText("450")).toBeNull();
  expect(screen.queryByText("Students fed")).toBeNull();

  const params = vi.mocked(apiClient.submissionPage).mock.calls[0][0];
  expect(params.get("project_id")).toBe("school");
  expect(params.get("limit")).toBe("5");
  expect(params.has("date_from")).toBe(false);
  expect(apiClient.indicators).toHaveBeenCalledWith("school");
  expect(screen.getByRole("link", { name: /Edit project/ }).getAttribute("href")).toBe("/projects/school/details");
  expect(screen.queryByRole("navigation", { name: "Project sections" })).toBeNull();
  expect(screen.getByText(/not frozen, approved/)).toBeTruthy();
  expect(screen.getByText(/school roster and reporting schedule/)).toBeTruthy();
});

it("shows honest empty states without creating school completeness or indicator metrics", async () => {
  vi.mocked(apiClient.getProject).mockResolvedValue({ id: "school", name: "School", status: "active", kobo_connection_id: null, kobo_form_id: null } as never);
  vi.mocked(apiClient.indicators).mockResolvedValue([]);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ total: 0, counts: {}, items: [] });
  vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 60, pending: false, last_successful_sync: null });
  setup();
  await screen.findByRole("article", { name: /Active indicators 0/ });


  expect(within(screen.getByRole("region", { name: "Project summary" })).getAllByText("0")).toHaveLength(3);

  expect((screen.getByRole("button", { name: "Sync data" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("Students fed")).toBeNull();
  expect(reportingCompleteness.state).toBe("unavailable");
  expect("expected" in reportingCompleteness).toBe(false);
});

it("does not show zero counts or an all-clear when required APIs fail", async () => {
  vi.mocked(apiClient.submissionPage).mockRejectedValue(new Error("Unavailable"));
  setup();
  await screen.findByRole("button", { name: "Retry collection counts" });
  expect(screen.queryByText("Submitted records")).toBeNull();
  expect(screen.queryByText(/No actionable issues/)).toBeNull();

});

it("does not load project data for an enumerator or an unauthorized project", async () => {
  auth.role = "enumerator";
  setup();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(apiClient.getProject).not.toHaveBeenCalled();
  expect(apiClient.submissionPage).not.toHaveBeenCalled();
});

it("waits for authorized project detail before loading operational or result APIs", async () => {
  vi.mocked(apiClient.getProject).mockRejectedValue(new Error("Not found"));
  setup();
  await screen.findByRole("button", { name: "Retry project" });
  expect(apiClient.indicators).not.toHaveBeenCalled();
  expect(apiClient.syncSettings).not.toHaveBeenCalled();
});

it("changes scope on project navigation and does not keep the previous project's results", async () => {
  vi.mocked(apiClient.indicators).mockImplementation(async id => id === "school" ? [indicator()] : []);
  setup(true);
  await screen.findByRole("article", { name: /Active indicators/ });
  fireEvent.click(screen.getByRole("button", { name: "Switch project" }));
  await screen.findByRole("article", { name: /Active indicators 0/ });
  expect(screen.queryByText("Feeding sessions completed")).toBeNull();
  await waitFor(() => expect(apiClient.syncSettings).toHaveBeenCalledWith("other"));
  const calls = vi.mocked(apiClient.submissionPage).mock.calls;
  expect(calls.at(-1)?.[0].get("project_id")).toBe("other");
});

it("refreshes the saved overview after the existing synchronization action succeeds", async () => {
  vi.mocked(apiClient.syncProjectKoboForm).mockResolvedValue({ received: 5, created: 3, updated: 2 } as never);
  setup();
  await screen.findByRole("article", { name: /Active indicators/ });
  const before = vi.mocked(apiClient.submissionPage).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Sync data" }));
  await screen.findByText("Sync complete: 5 received, 3 new, 2 updated.");
  expect(apiClient.syncProjectKoboForm).toHaveBeenCalledWith("school");
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.calls.length).toBeGreaterThan(before));
});

it("keeps real project context in the header and links to the editable details", async () => {
  setup();
  await screen.findByText("Education");
  expect(screen.getByText("Liberia")).toBeTruthy();
  expect(screen.getByText("SFP-26")).toBeTruthy();
  expect(screen.queryByText("Daily feeding monitoring across partner schools.")).toBeNull();
  expect(screen.getByRole("link", { name: /Edit project/ }).getAttribute("href")).toBe("/projects/school/details");
  expect(apiClient.organizationSectors).toHaveBeenCalledWith("org");

});

it("does not infer sector from topics and keeps missing project metadata explicit", async () => {
  vi.mocked(apiClient.getProject).mockResolvedValue({ id: "school", name: "Unconfigured project", status: "draft", workspace_details: { topics: ["Education"] } } as never);
  setup();
  await screen.findByText("Sector not set");
  expect(screen.getByText("Location not set")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Project information" })).toBeNull();
  expect(apiClient.organizationSectors).not.toHaveBeenCalled();
  expect(apiClient.sectors).not.toHaveBeenCalled();
});

it("uses the project analytics API for chart values and changes only the trend reporting period", async () => {
  setup();
  const chart = await screen.findByRole("region", { name: "Collection trend" });
  const table = await within(chart).findByRole("table", { name: "Daily collection counts", hidden: true });
  expect(within(chart).getByText("70% of records ready")).toBeTruthy();
  expect(within(chart).getByText(/20 submitted · 14 ready for use/)).toBeTruthy();
  expect(within(table).getByText("8")).toBeTruthy();
  expect(within(table).getByText("5")).toBeTruthy();
  expect(within(table).getByText("12")).toBeTruthy();
  expect(apiClient.analyticsOverview).toHaveBeenCalledWith({ projectId: "school", period: "30d" });
  fireEvent.click(within(chart).getByRole("button", { name: "7 days" }));
  await waitFor(() => expect(apiClient.analyticsOverview).toHaveBeenLastCalledWith({ projectId: "school", period: "7d" }));
  expect(screen.getByRole("button", { name: "7 days" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(screen.getByRole("region", { name: "Project summary" })).getByText("123")).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Review status" })).getByText(/all dates/)).toBeTruthy();
});

it("keeps the review chart scoped to project submissions and the selected review status", async () => {
  setup();
  const chart = await screen.findByRole("region", { name: "Review status" });
  const review = await within(chart).findByRole("link", { name: "Awaiting review 20" });
  expect(review.getAttribute("href")).toBe("/submissions?project_id=school&review_status=needs_review");
  expect(within(chart).getByRole("link", { name: "Invalid 3" }).getAttribute("href")).toBe("/submissions?project_id=school&review_status=invalid");
  expect(within(chart).getByRole("img").getAttribute("aria-label")).toContain("Ready 100");
});

it("shows real chart empty states without drawing fictional values", async () => {
  vi.mocked(apiClient.analyticsOverview).mockResolvedValue({ trend: [] } as never);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ total: 0, counts: {}, items: [] });
  setup();
  await screen.findByText("No dated submissions in this period");
  expect(screen.getByText("No saved records to chart yet.")).toBeTruthy();
  expect(screen.queryByRole("table", { name: "Daily collection counts", hidden: true })).toBeNull();
});

it("keeps operational counts available when the trend request fails", async () => {
  vi.mocked(apiClient.analyticsOverview).mockRejectedValue(new Error("Trend unavailable"));
  setup();
  await screen.findByRole("button", { name: "Retry chart" });
  expect(within(screen.getByRole("region", { name: "Project summary" })).getByText("123")).toBeTruthy();
  expect(screen.queryByRole("table", { name: "Daily collection counts", hidden: true })).toBeNull();
});

it("counts each active project enumerator once and excludes administrators and inactive members", async () => {
  vi.mocked(apiClient.projectTeam).mockResolvedValue([
    { user_id: "collector", role: "enumerator", is_active: true },
    { user_id: "collector", role: "enumerator", is_active: true },
    { user_id: "inactive", role: "enumerator", is_active: false },
    { user_id: "admin", role: "organization_admin", is_active: true },
  ] as never);
  setup();
  expect(await screen.findByRole("article", { name: "Total enumerators 1" })).toBeTruthy();
  expect(apiClient.projectTeam).toHaveBeenCalledWith("school");
  expect(screen.queryByText("Last submission")).toBeNull();
});

it("shows the project timeline while keeping indicator and attention sections hidden", async () => {
  setup();
  await screen.findByRole("article", { name: /Active indicators/ });
  expect(screen.queryByRole("region", { name: "Indicator status" })).toBeNull();
  expect(screen.getByRole("region", { name: "Project timeline" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Needs Your Attention" })).toBeNull();
  expect(screen.queryByText("Last sync")).toBeNull();
  expect(screen.queryByRole("navigation", { name: "Project sections" })).toBeNull();
});

it("shows completion only for the selected project", async () => {
  setup();
  const chart = await screen.findByRole("region", { name: "Project completion" });
  expect(within(chart).getByRole("img").getAttribute("aria-label")).toBe("Daily School Feeding Monitoring Form: Not completed. Saved project status: active.");
  expect(apiClient.organizationProjects).not.toHaveBeenCalled();
});
