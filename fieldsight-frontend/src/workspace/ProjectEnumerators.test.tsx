// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient, type ProjectCollector } from "../services/apiClient";
import { ProjectEnumerators } from "./ProjectEnumerators";

vi.mock("../services/apiClient", () => ({ apiClient: { projectEnumerators: vi.fn(), eligibleEnumerators: vi.fn(), assignEnumerator: vi.fn(), updateEnumeratorAssignment: vi.fn(), removeEnumeratorAssignment: vi.fn(), manageEnumeratorKoboAccess: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const form = { connection_id: "connection", form_id: "form", name: "WASH Survey", server_url: "https://kf.kobotoolbox.org" };
const item: ProjectCollector = { id: "assignment", collector_id: "collector", membership_id: null, full_name: "Alice", email: "alice@example.com", kobo_username: "alice_kobo", is_active: true, assigned_at: "2026-10-30T00:00:00Z", forms: [{ ...form, id: "access", state: "reported_configured_unverified", is_selected: true, mapping_current: true, updated_at: "2026-10-30" }] };
function setup() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><ProjectEnumerators projectId="project" /></QueryClientProvider>);
}
it("shows loading and empty states", async () => {
  vi.mocked(apiClient.projectEnumerators).mockReturnValue(new Promise(() => {})); setup();
  expect(screen.getByText("Loading project enumerators…")).toBeTruthy(); cleanup();
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [], connected_forms: [form] }); setup();
  expect(await screen.findByText(/No enumerators found/)).toBeTruthy();
});
it("shows errors and retry", async () => {
  vi.mocked(apiClient.projectEnumerators).mockRejectedValue(new Error("Unable to load")); setup();
  expect(await screen.findByText("Unable to load")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});
it("registers a collection-only contact and selected form", async () => {
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [], connected_forms: [form] });
  vi.mocked(apiClient.eligibleEnumerators).mockResolvedValue([]);
  vi.mocked(apiClient.assignEnumerator).mockResolvedValue(item); setup();
  await screen.findByText(/No enumerators found/);
  fireEvent.click(screen.getByRole("button", { name: "Add Enumerator" }));
  fireEvent.change(screen.getByLabelText("Enumerator type"), { target: { value: "new" } });
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alice" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
  fireEvent.change(screen.getByLabelText("Kobo username"), { target: { value: "alice_kobo" } });
  expect((screen.getByLabelText("Kobo username") as HTMLInputElement).required).toBe(true);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.assignEnumerator).toHaveBeenCalledWith("project", { full_name: "Alice", email: "alice@example.com", kobo_username: "alice_kobo", forms: [{ connection_id: "connection", form_id: "form", state: "not_configured" }] }));
});
it("selects existing contacts, shows honest reports and confirms removal", async () => {
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [item], connected_forms: [form] });
  vi.mocked(apiClient.eligibleEnumerators).mockResolvedValue([item]);
  vi.mocked(apiClient.removeEnumeratorAssignment).mockResolvedValue(undefined); setup();
  expect(await screen.findByText(/Reported configured — not verified/)).toBeTruthy();
  expect(screen.getByRole("cell", { name: "WASH Survey" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(apiClient.removeEnumeratorAssignment).not.toHaveBeenCalled();
  expect(screen.getByText(/Kobo access is not automatically revoked/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  await waitFor(() => expect(apiClient.removeEnumeratorAssignment).toHaveBeenCalledWith("project", "assignment"));
  fireEvent.click(screen.getByRole("button", { name: "Add Enumerator" }));
  await screen.findByRole("option", { name: "Alice — alice@example.com" });
  fireEvent.change(screen.getByLabelText("Organization enumerator"), { target: { value: "collector" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.assignEnumerator).toHaveBeenCalledWith("project", { collector_id: "collector", kobo_username: "alice_kobo", forms: [] }));
});
it("updates forms with manual pending status", async () => {
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [item], connected_forms: [form] });
  vi.mocked(apiClient.updateEnumeratorAssignment).mockResolvedValue(item); setup();
  fireEvent.click(await screen.findByRole("button", { name: "Edit forms & Kobo access" }));
  fireEvent.change(screen.getByLabelText("Manually recorded Kobo access"), { target: { value: "pending" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.updateEnumeratorAssignment).toHaveBeenCalledWith("project", "assignment", { kobo_username: "alice_kobo", forms: [{ connection_id: "connection", form_id: "form", state: "pending" }] }));
});

it("confirms Kobo grants, reconciles verified status and checks access", async () => {
  const granted: ProjectCollector = { ...item, forms: [{ ...item.forms[0], state: "verified_granted", permission_username: "alice_kobo", last_checked_at: "2026-10-30T01:00:00Z" }] };
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [item], connected_forms: [form] });
  vi.mocked(apiClient.manageEnumeratorKoboAccess).mockImplementation(async () => {
    vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [granted], connected_forms: [form] });
    return granted;
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Grant Kobo access" }));
  expect(apiClient.manageEnumeratorKoboAccess).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm grant" }));
  await waitFor(() => expect(apiClient.manageEnumeratorKoboAccess).toHaveBeenCalledWith("project", "assignment", "access", "grant"));
  expect(await screen.findByText("Granted — verified in Kobo")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Granted" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Grant Kobo access" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));
  await waitFor(() => expect(apiClient.manageEnumeratorKoboAccess).toHaveBeenCalledWith("project", "assignment", "access", "verify"));
});

it("shows saved provider failures and confirms revocation for inactive assignments", async () => {
  const failed: ProjectCollector = { ...item, is_active: false, forms: [{ ...item.forms[0], state: "failed", last_error: "Kobo rejected access." }] };
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [failed], connected_forms: [form] });
  vi.mocked(apiClient.manageEnumeratorKoboAccess).mockResolvedValue(failed);
  setup();
  expect(await screen.findByText("Kobo rejected access.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Grant Kobo access" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Revoke collection" }));
  expect(apiClient.manageEnumeratorKoboAccess).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
  await waitFor(() => expect(apiClient.manageEnumeratorKoboAccess).toHaveBeenCalledWith("project", "assignment", "access", "revoke"));
});

