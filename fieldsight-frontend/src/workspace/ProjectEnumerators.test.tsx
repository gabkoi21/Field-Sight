// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
it("uses numbered pagination with the visible result range", async () => {
  const items = Array.from({ length: 17 }, (_, index) => ({ ...item, id: `assignment-${index}`, full_name: `Enumerator ${index + 1}` }));
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items, connected_forms: [form] });
  setup();
  expect(await screen.findByText("Showing 1 to 10 of 17 results")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
  expect(screen.getByText("Showing 11 to 17 of 17 results")).toBeTruthy();
  expect(screen.getByText("Enumerator 17")).toBeTruthy();
  expect(screen.queryByText("Enumerator 1")).toBeNull();
  expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Sort by Enumerator" }));
  fireEvent.click(screen.getByRole("button", { name: "Sort by Enumerator" }));
  expect(screen.getByText("Showing 1 to 10 of 17 results")).toBeTruthy();
  expect(screen.getAllByRole("row")[1].textContent).toContain("Enumerator 17");
  expect(screen.getByRole("button", { name: "Sort by Enumerator" }).closest("th")?.getAttribute("aria-sort")).toBe("descending");
});
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
it("adds an enumerator using only a Kobo username and selected form", async () => {
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [], connected_forms: [form] });
  vi.mocked(apiClient.eligibleEnumerators).mockResolvedValue([]);
  vi.mocked(apiClient.assignEnumerator).mockResolvedValue(item); setup();
  await screen.findByText(/No enumerators found/);
  fireEvent.click(screen.getByRole("button", { name: "Add Enumerator" }));
  expect(screen.queryByLabelText("Enumerator type")).toBeNull();
  expect(screen.queryByLabelText("Full name")).toBeNull();
  expect(screen.queryByLabelText("Email")).toBeNull();
  fireEvent.change(screen.getByLabelText("Kobo username"), { target: { value: "alice_kobo" } });
  expect((screen.getByLabelText("Kobo username") as HTMLInputElement).required).toBe(true);
  expect(screen.queryByRole("checkbox", { name: "Assign connected form" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.assignEnumerator).toHaveBeenCalledWith("project", { kobo_username: "alice_kobo", counties: null }));
});
it("selects existing contacts, shows honest reports and confirms removal", async () => {
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [item], connected_forms: [form] });
  vi.mocked(apiClient.eligibleEnumerators).mockResolvedValue([item]);
  vi.mocked(apiClient.removeEnumeratorAssignment).mockImplementation(async () => {
    vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [{ ...item, is_active: false }], connected_forms: [form] });
  }); setup();
  expect(await screen.findByText(/Reported configured — not verified/)).toBeTruthy();
  expect(screen.getByRole("cell", { name: "WASH Survey" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(apiClient.removeEnumeratorAssignment).not.toHaveBeenCalled();
  expect(screen.getByText(/Kobo collection access is retained/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('To confirm, type “Alice”'), { target: { value: "Alice" } });
  fireEvent.change(screen.getByLabelText('To confirm, type “remove enumerator”'), { target: { value: "remove enumerator" } });
  fireEvent.click(screen.getByRole("button", { name: "Remove enumerator" }));
  await waitFor(() => expect(apiClient.removeEnumeratorAssignment).toHaveBeenCalledWith("project", "assignment"));
  await screen.findByText(/No enumerators found/);
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Show removed enumerators" }));
  expect(await screen.findByRole("button", { name: "Reassign" })).toBeTruthy();
  expect(screen.getByText("Inactive")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "Show removed enumerators" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Enumerator" }));
  fireEvent.change(screen.getByLabelText("Kobo username"), { target: { value: "alice_kobo" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.assignEnumerator).toHaveBeenCalledWith("project", { kobo_username: "alice_kobo", counties: null }));
});
it("keeps missing email blank and requires only the username when editing", async () => {
  const usernameOnly = { ...item, full_name: null, email: null };
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [usernameOnly], connected_forms: [form] });
  vi.mocked(apiClient.updateEnumeratorAssignment).mockResolvedValue(usernameOnly);
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Edit forms & Kobo access" }));
  expect(screen.queryByRole("button", { name: "Add email" })).toBeNull();
  expect(screen.queryByText(/Email unavailable|Email not provided/)).toBeNull();
  expect(screen.queryByLabelText("Email")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.updateEnumeratorAssignment).toHaveBeenCalledWith("project", "assignment", expect.objectContaining({ kobo_username: "alice_kobo" })));
  expect(vi.mocked(apiClient.updateEnumeratorAssignment).mock.calls[0][2]).not.toHaveProperty("email");
});

it("lets the backend assign forms and manage access status", async () => {
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [item], connected_forms: [form] });
  vi.mocked(apiClient.updateEnumeratorAssignment).mockResolvedValue(item); setup();
  fireEvent.click(await screen.findByRole("button", { name: "Edit forms & Kobo access" }));
  expect(screen.queryByLabelText("Manually recorded Kobo access")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.updateEnumeratorAssignment).toHaveBeenCalledWith("project", "assignment", { kobo_username: "alice_kobo", counties: null }));
});

it("waits for the admin to grant access before showing check and revoke buttons", async () => {
  const granted: ProjectCollector = { ...item, forms: [{ ...item.forms[0], state: "verified_granted" }] };
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [item], connected_forms: [form] });
  vi.mocked(apiClient.manageEnumeratorKoboAccess).mockImplementation(async () => {
    vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [granted], connected_forms: [form] });
    return granted;
  });
  setup();
  expect(await screen.findByText(/Reported configured/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Grant Kobo access" })).toBeTruthy();
  for (const name of ["Granted", "Check access", "Revoke access", "Retry grant", "Retry revoke"]) {
    expect(screen.queryByRole("button", { name })).toBeNull();
  }
  expect(apiClient.manageEnumeratorKoboAccess).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Grant Kobo access" }));
  expect(apiClient.manageEnumeratorKoboAccess).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm grant" }));
  await waitFor(() => expect(apiClient.manageEnumeratorKoboAccess).toHaveBeenCalledWith("project", "assignment", "access", "grant"));
  expect(await screen.findByRole("button", { name: "Revoke access" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Check access" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Granted" }) as HTMLButtonElement).disabled).toBe(true);
});

it.each(["add", "remove"])("shows the refresh loader until the list finishes updating after %s", async action => {
  const updated = action === "add" ? [item] : [];
  let finish!: (value: { items: ProjectCollector[]; connected_forms: typeof form[] }) => void;
  vi.mocked(apiClient.projectEnumerators).mockResolvedValueOnce({ items: action === "add" ? [] : [item], connected_forms: [form] })
    .mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.mocked(apiClient.assignEnumerator).mockResolvedValue(item);
  vi.mocked(apiClient.removeEnumeratorAssignment).mockResolvedValue(undefined);
  setup();
  if (action === "add") {
    await screen.findByText(/No enumerators found/);
    await waitFor(() => expect((screen.getByRole("button", { name: "Add Enumerator" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Add Enumerator" }));
    fireEvent.change(screen.getByLabelText("Kobo username"), { target: { value: "alice_kobo" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  } else {
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    fireEvent.change(screen.getByLabelText('To confirm, type “Alice”'), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText('To confirm, type “remove enumerator”'), { target: { value: "remove enumerator" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove enumerator" }));
  }
  expect(await screen.findByText("Refreshing enumerators…")).toBeTruthy();
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  if (action === "remove") {
    // The successful deletion clears the row even while the refresh is stalled.
    expect(screen.queryByText("alice@example.com")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.getByText(/No enumerators found/)).toBeTruthy();
  }
  await act(async () => { finish({ items: updated, connected_forms: [form] }); });
  await waitFor(() => expect(screen.queryByText("Refreshing enumerators…")).toBeNull());
  if (action === "add") expect(screen.getByText("alice@example.com")).toBeTruthy();
  else expect(screen.getByText(/No enumerators found/)).toBeTruthy();
  expect(apiClient.manageEnumeratorKoboAccess).not.toHaveBeenCalled();
});

it("saves selected counties and restores them when editing", async () => {
  const restricted = { ...item, counties: ["Bong", "Nimba"] };
  vi.mocked(apiClient.projectEnumerators).mockResolvedValue({ items: [restricted], connected_forms: [form] });
  vi.mocked(apiClient.updateEnumeratorAssignment).mockResolvedValue(restricted);
  setup();
  expect(await screen.findByRole("cell", { name: "Bong, Nimba" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit forms & Kobo access" }));
  expect(screen.queryByRole("checkbox", { name: "All counties" })).toBeNull();
  expect((screen.getByRole("combobox", { name: "Assigned counties" }) as HTMLInputElement).value).toBe("Bong, Nimba");
  fireEvent.focus(screen.getByRole("combobox", { name: "Assigned counties" }));
  expect((screen.getByRole("checkbox", { name: "All counties" }) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole("checkbox", { name: "Bong" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Nimba" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Sinoe" }) as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByRole("combobox", { name: "Assigned counties" }), { target: { value: "Mont" } });
  expect(screen.queryByRole("checkbox", { name: "Sinoe" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "All counties" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "All counties" }));
  expect((screen.getByRole("button", { name: "Confirm assignment" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Montserrado" }));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Assigned counties" }), { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "County options" })).toBeNull();
  expect((screen.getByRole("combobox", { name: "Assigned counties" }) as HTMLInputElement).value).toBe("Montserrado");
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await waitFor(() => expect(apiClient.updateEnumeratorAssignment).toHaveBeenCalledWith("project", "assignment", expect.objectContaining({ counties: ["Montserrado"] })));
});
