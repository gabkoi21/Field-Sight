// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { ProjectActionsPage } from "./ProjectActionsPage";
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ loading: false, user: { memberships: [{ organization_id: "org", role: "organization_admin" }] } }) }));
vi.mock("../../services/apiClient", () => ({ apiClient: { getProject: vi.fn(), projectActions: vi.fn(), actionDetail: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(), workspaceTeam: vi.fn(), projectTeam: vi.fn(), submissionPage: vi.fn(), indicators: vi.fn() } }));
const action = { id: "a", project_id: "p", title: "Investigate food shortage", description: "School reported shortage", status: "open", priority: "high", assigned_user_id: null, due_date: "2026-10-01", submission_id: null, indicator_id: null, version: 1, overdue: true, history: [], history_total: 0 };
beforeEach(() => {
  vi.mocked(apiClient.getProject).mockResolvedValue({ id: "p", name: "School Feeding", status: "active" } as never);
  vi.mocked(apiClient.projectActions).mockResolvedValue({ items: [action], total: 23, summary: { unresolved: 23, overdue: 1, high_priority: 1 } } as never);
  vi.mocked(apiClient.workspaceTeam).mockResolvedValue([{ user_id: "officer", full_name: "Project officer", role: "organization_admin", is_active: true }] as never);
  vi.mocked(apiClient.projectTeam).mockResolvedValue([]);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ items: [{ id: "s", external_id: "School record", review_status: "needs_review" }], total: 1, counts: {} } as never);
  vi.mocked(apiClient.indicators).mockResolvedValue([]);
  vi.mocked(apiClient.actionDetail).mockResolvedValue(action as never);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function setup(path = "/projects/p/actions") {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes><Route path="projects/:projectId/actions" element={<ProjectActionsPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
it("creates a project action linked to evidence with an eligible assigned user", async () => {
  vi.mocked(apiClient.createAction).mockResolvedValue(action as never);
  setup("/projects/p/actions?new=1&submission_id=s");
  const form = await screen.findByRole("region", { name: "New action" });
  fireEvent.change(within(form).getByLabelText("Title (required)"), { target: { value: "Investigate food shortage" } });
  await waitFor(() => expect(within(form).getByRole("option", { name: "Project officer" })).toBeTruthy());
  fireEvent.change(within(form).getByLabelText("Assign to"), { target: { value: "officer" } });
  fireEvent.change(within(form).getByLabelText("Due date (UTC)"), { target: { value: "2026-11-01" } });
  fireEvent.click(within(form).getByRole("button", { name: "Save new action" }));
  await waitFor(() => expect(apiClient.createAction).toHaveBeenCalledWith("p", expect.objectContaining({ title: "Investigate food shortage", submission_id: "s", assigned_user_id: "officer", due_date: "2026-11-01" })));
});
it("uses bounded server filters and resets pagination when filters change", async () => {
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Next actions" }));
  await waitFor(() => expect(vi.mocked(apiClient.projectActions).mock.lastCall?.[1]?.get("offset")).toBe("20"));
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "in_progress" } });
  await waitFor(() => expect(vi.mocked(apiClient.projectActions).mock.lastCall?.[1]?.get("status")).toBe("in_progress"));
  expect(vi.mocked(apiClient.projectActions).mock.lastCall?.[1]?.get("offset")).toBe("0");
  expect(vi.mocked(apiClient.projectActions).mock.lastCall?.[1]?.get("limit")).toBe("20");
});
it("persists status changes with the displayed version", async () => {
  vi.mocked(apiClient.updateAction).mockResolvedValue({ ...action, status: "in_progress", version: 2 } as never);
  setup("/projects/p/actions?action_id=a");
  const detail = await screen.findByRole("region", { name: "Action details" });
  fireEvent.change(await within(detail).findByLabelText("Action status"), { target: { value: "in_progress" } });
  fireEvent.change(within(detail).getByLabelText(/Findings/), { target: { value: "Checking school register" } });
  fireEvent.click(within(detail).getByRole("button", { name: "Save action" }));
  await waitFor(() => expect(apiClient.updateAction).toHaveBeenCalledWith("p", "a", expect.objectContaining({ expected_version: 1, status: "in_progress", note: "Checking school register" })));
});
it("shows failed saves and conflict recovery without discarding the server version", async () => {
  vi.mocked(apiClient.updateAction).mockRejectedValue(new Error("Action changed. Reload before editing."));
  setup("/projects/p/actions?action_id=a");
  fireEvent.click(await screen.findByRole("button", { name: "Save action" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reload action" }));
  await waitFor(() => expect(apiClient.actionDetail).toHaveBeenCalledTimes(2));
});
it("keeps archived action history readable and creation disabled", async () => {
  vi.mocked(apiClient.getProject).mockResolvedValue({ id: "p", name: "School", status: "archived" } as never);
  setup("/projects/p/actions?action_id=a");
  expect(await screen.findByRole("button", { name: "Create action" })).toHaveProperty("disabled", true);
  expect(await screen.findByRole("button", { name: "Save action" })).toHaveProperty("disabled", true);
  expect(screen.getByText("Audit timeline (0)")).toBeTruthy();
});
it("keeps empty and failed requests explicit", async () => {
  vi.mocked(apiClient.projectActions).mockRejectedValue(new Error("Unavailable"));
  setup();
  await screen.findByRole("button", { name: "Retry actions" });
  vi.mocked(apiClient.projectActions).mockResolvedValue({ items: [], total: 0, summary: { unresolved: 0, overdue: 0, high_priority: 0 } } as never);
  fireEvent.click(screen.getByRole("button", { name: "Retry actions" }));
  expect(await screen.findByText("No actions match these filters.")).toBeTruthy();
  expect(apiClient.projectActions).toHaveBeenCalledTimes(2);
});
