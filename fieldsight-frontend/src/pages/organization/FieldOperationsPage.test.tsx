// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { FieldOperationsPage } from "./FieldOperationsPage";
const workspace = vi.hoisted(() => ({ projectId: "p1", project: { name: "School Feeding" }, hasSelectedProject: true }));
vi.mock("../../workspace/WorkspaceContext", () => ({ useWorkspace: () => workspace }));
vi.mock("../../workspace/WorkspaceUI", () => ({ WorkspaceTabs: () => null }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { memberships: [{ role: "organization_admin", organization_id: "org" }] } }) }));
vi.mock("../../services/apiClient", async (original) => {
  const actual = await original<typeof import("../../services/apiClient")>();
  return { ...actual, apiClient: { enumerators: vi.fn(), organizationProjects: vi.fn(), organizationAssignments: vi.fn(), createEnumerator: vi.fn() } };
});
const person = (id: string, full_name: string, is_active = true) => ({ membership_id: id, full_name, email: `${id}@example.com`, username: id, is_active, role: "enumerator", created_at: "2026-10-23T12:00:00Z" });
let people: ReturnType<typeof person>[];
let assignments: { membership_id: string; project_id: string; is_enabled: boolean }[];
beforeEach(() => {
  workspace.projectId = "p1";
  people = [person("alice", "Alice"), person("bob", "Bob", false), person("cara", "Cara")];
  assignments = [{ membership_id: "alice", project_id: "p1", is_enabled: true }, { membership_id: "bob", project_id: "p1", is_enabled: true }, { membership_id: "cara", project_id: "p2", is_enabled: true }];
  vi.mocked(apiClient.enumerators).mockImplementation(async () => [...people] as never);
  vi.mocked(apiClient.organizationAssignments).mockImplementation(async () => [...assignments] as never);
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "p1", name: "School Feeding" }, { id: "p2", name: "Other project" }] as never);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function setup() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><FieldOperationsPage projectEmbedded /></MemoryRouter></QueryClientProvider>);
}
it("scopes cards and rows to project assignments and preserves counts when searching", async () => {
  setup();
  await screen.findByRole("button", { name: "Manage Alice" });
  expect(screen.queryByRole("button", { name: "Manage Cara" })).toBeNull();
  const card = screen.getByText("Project enumerators").closest("section > *")!;
  expect(within(card as HTMLElement).getByText("2")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Search name, username, or email…"), { target: { value: "Bob" } });
  expect(screen.queryByRole("button", { name: "Manage Alice" })).toBeNull();
  expect(within(card as HTMLElement).getByText("2")).toBeTruthy();
  expect(screen.getAllByRole("combobox").some((select) => (select as HTMLSelectElement).value === "p1" && (select as HTMLSelectElement).disabled)).toBe(true);
});
it("shows an unassigned project state instead of organization totals", async () => {
  workspace.projectId = "empty";
  setup();
  await screen.findByText("No enumerators are assigned to this project yet.");
  expect(screen.queryByText("Organization membership accounts")).toBeNull();
  expect(screen.queryByRole("button", { name: "Manage Alice" })).toBeNull();
});
it("assigns new enumerators to the open project and refreshes assignments", async () => {
  vi.mocked(apiClient.createEnumerator).mockImplementation(async (input) => {
    const created = person("new", input.full_name);
    people.push(created);
    assignments.push({ membership_id: "new", project_id: input.project_id!, is_enabled: true });
    return created as never;
  });
  setup();
  await screen.findByRole("button", { name: "Manage Alice" });
  fireEvent.click(screen.getByRole("button", { name: "Create enumerator" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Person" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
  fireEvent.change(screen.getByLabelText("Kobo username"), { target: { value: "new_person" } });
  expect((screen.getByLabelText("Assigned project") as HTMLSelectElement).disabled).toBe(true);
  const form = screen.getByLabelText("Full name").closest("form")!;
  fireEvent.submit(form);
  await waitFor(() => expect(apiClient.createEnumerator).toHaveBeenCalledWith(expect.objectContaining({ project_id: "p1" })));
  await screen.findByRole("button", { name: "Manage New Person" });
  expect(apiClient.organizationAssignments).toHaveBeenCalledTimes(2);
});
