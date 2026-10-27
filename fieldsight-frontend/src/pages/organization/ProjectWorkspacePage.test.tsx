// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { apiClient, type Indicator } from "../../services/apiClient";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";
import { overviewIssues, reportingCompleteness } from "./projectOverview";

const auth = vi.hoisted(() => ({ role: "organization_admin" }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ loading: false, user: { memberships: [{ organization_id: "org", role: auth.role }] } }) }));
vi.mock("../../services/apiClient", () => ({ apiClient: { getProject: vi.fn(), submissionPage: vi.fn(), syncSettings: vi.fn(), indicators: vi.fn(), qualityQueue: vi.fn(), syncProjectKoboForm: vi.fn() } }));

const indicator = (changes: Partial<Indicator> = {}): Indicator => ({
  id: "feeding", project_id: "school", name: "Feeding sessions completed", is_active: true,
  current_value: 0, target_value: 10, unit: "number", result_source: "table", setup_complete: true,
  mapping_health: "healthy", schedule_status: "not_due", quality_excluded_records: 2,
  ...changes,
} as Indicator);

beforeEach(() => {
  auth.role = "organization_admin";
  vi.mocked(apiClient.getProject).mockImplementation(async (_org, id) => ({ id, name: id === "school" ? "Daily School Feeding Monitoring Form" : "Other project", status: "active", kobo_connection_id: "connection", kobo_form_id: "form" }) as never);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ total: 123, counts: { ready: 100, needs_review: 20, invalid: 3 }, items: [] });
  vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 60, pending: false, last_successful_sync: "2026-10-25T12:00:00Z", latest_status: "completed" });
  vi.mocked(apiClient.indicators).mockResolvedValue([indicator(), indicator({ id: "students", name: "Students fed", current_value: 450 }), indicator({ id: "shortages", name: "Food shortage incidents", current_value: 2, direction: "decrease", target_value: 0 })]);
  vi.mocked(apiClient.qualityQueue).mockResolvedValue({ total: 4, counts: {}, items: [], snapshot_note: "Last validation" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function SwitchProject() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/projects/other")}>Switch project</button><ProjectWorkspacePage /></>;
}
function setup(switchable = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/school"]}><Routes><Route path="/projects/:projectId" element={switchable ? <SwitchProject /> : <ProjectWorkspacePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

it("uses project-scoped all-time counts and configured School Feeding indicators, including zero values", async () => {
  setup();
  await screen.findByText("Students fed");
  expect(screen.getByText("123")).toBeTruthy();
  expect(screen.getByText("20")).toBeTruthy();
  expect(screen.getByText("450")).toBeTruthy();
  expect(screen.getByText("0")).toBeTruthy();
  expect(screen.getByText(/Oct.*25.*2026.*UTC/)).toBeTruthy();
  const params = vi.mocked(apiClient.submissionPage).mock.calls[0][0];
  expect(params.get("project_id")).toBe("school");
  expect(params.get("limit")).toBe("5");
  expect(params.has("date_from")).toBe(false);
  expect(apiClient.indicators).toHaveBeenCalledWith("school");
  expect(screen.getByRole("link", { name: "View Students fed" }).getAttribute("href")).toBe("/projects/school/indicators?view=results&indicator_id=students");
  expect(screen.getByText(/not frozen, approved/)).toBeTruthy();
  expect(screen.getByText(/school roster and reporting schedule/)).toBeTruthy();
});

it("links attention issues to the existing project-filtered screens and indicator", async () => {
  vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 60, pending: false, last_successful_sync: "2026-10-25T12:00:00Z", latest_status: "failed" });
  vi.mocked(apiClient.indicators).mockResolvedValue([indicator({ schedule_status: "overdue", target_date: "2026-10-01" }), indicator({ id: "unmapped", name: "Students fed", setup_complete: false })]);
  setup();
  const attention = await screen.findByRole("region", { name: "Needs Your Attention" });
  await within(attention).findByText("Latest synchronization failed");
  expect(within(attention).getByRole("link", { name: /20 records awaiting review/ }).getAttribute("href")).toBe("/submissions?project_id=school&review=needs_review");
  expect(within(attention).getByRole("link", { name: /invalid records/ }).getAttribute("href")).toContain("review=invalid");
  expect(within(attention).getByRole("link", { name: /Open data quality/ }).getAttribute("href")).toBe("/quality?project_id=school");
  expect(within(attention).getByRole("link", { name: /target overdue/ }).getAttribute("href")).toContain("indicator_id=feeding");
  expect(within(attention).getByRole("link", { name: /setup needs attention/ }).getAttribute("href")).toContain("indicator_id=unmapped");
});

it("shows honest empty states without creating school completeness or indicator metrics", async () => {
  vi.mocked(apiClient.getProject).mockResolvedValue({ id: "school", name: "School", status: "active", kobo_connection_id: null, kobo_form_id: null } as never);
  vi.mocked(apiClient.indicators).mockResolvedValue([]);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ total: 0, counts: {}, items: [] });
  vi.mocked(apiClient.qualityQueue).mockResolvedValue({ total: 0, counts: {}, items: [], snapshot_note: "" });
  vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 60, pending: false, last_successful_sync: null });
  setup();
  await screen.findByText("No active indicators configured");
  expect(screen.getByText("No Kobo form connected")).toBeTruthy();
  expect(screen.getByText("Not recorded")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Sync data" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("Students fed")).toBeNull();
  expect(reportingCompleteness.state).toBe("unavailable");
  expect("expected" in reportingCompleteness).toBe(false);
});

it("does not show zero counts or an all-clear when required APIs fail", async () => {
  vi.mocked(apiClient.submissionPage).mockRejectedValue(new Error("Unavailable"));
  vi.mocked(apiClient.qualityQueue).mockRejectedValue(new Error("Unavailable"));
  setup();
  await screen.findByRole("button", { name: "Retry collection counts" });
  expect(screen.queryByText("Submitted records")).toBeNull();
  expect(screen.queryByText(/No actionable issues/)).toBeNull();
  expect(screen.getByRole("button", { name: "Retry some attention checks" })).toBeTruthy();
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
  expect(apiClient.qualityQueue).not.toHaveBeenCalled();
});

it("changes scope on project navigation and does not keep the previous project's results", async () => {
  vi.mocked(apiClient.indicators).mockImplementation(async id => id === "school" ? [indicator()] : []);
  setup(true);
  await screen.findByText("Feeding sessions completed");
  fireEvent.click(screen.getByRole("button", { name: "Switch project" }));
  await screen.findByText("No active indicators configured");
  expect(screen.queryByText("Feeding sessions completed")).toBeNull();
  await waitFor(() => expect(apiClient.syncSettings).toHaveBeenCalledWith("other"));
  const calls = vi.mocked(apiClient.submissionPage).mock.calls;
  expect(calls.at(-1)?.[0].get("project_id")).toBe("other");
});

it("does not infer missing school reports, stale sync, or validation success", () => {
  const issues = overviewIssues({ projectId: "school", connected: true, counts: { ready: 5 }, sync: { mode: "manual", interval_minutes: 60, pending: false, last_successful_sync: "2020-01-01T00:00:00Z" }, indicators: [], findings: 0 });
  expect(issues).toEqual([]);
});

it("refreshes the saved overview after the existing synchronization action succeeds", async () => {
  vi.mocked(apiClient.syncProjectKoboForm).mockResolvedValue({ received: 5, created: 3, updated: 2 } as never);
  setup();
  await screen.findByText("Students fed");
  const before = vi.mocked(apiClient.submissionPage).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Sync data" }));
  await screen.findByText("Sync complete: 5 received, 3 new, 2 updated.");
  expect(apiClient.syncProjectKoboForm).toHaveBeenCalledWith("school");
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.calls.length).toBeGreaterThan(before));
});
