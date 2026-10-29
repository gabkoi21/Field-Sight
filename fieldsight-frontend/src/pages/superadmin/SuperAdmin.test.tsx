// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { UsersPage } from "./UsersPage";
import { OrganizationsPage } from "./OrganizationsPage";
import { SectorsPage } from "./SectorsPage";
import { BillingPage } from "./BillingPage";
import { PlatformSettingsPage } from "./PlatformSettingsPage";
import { SystemHealthPage } from "./SystemHealthPage";
import { AuditLogPage } from "./AuditLogPage";
import { type ApiUserDirectoryItem, apiClient } from "../../services/apiClient";
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function setup(element: React.ReactElement) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>); }
const users: ApiUserDirectoryItem[] = Array.from({ length: 12 }, (_, index) => ({ id: String(index), email: `user${index}@example.org`, full_name: `Person ${index}`, username: null, platform_role: index === 0 ? "super_admin" : null, is_active: index !== 11, created_at: "2026-01-01T00:00:00Z", memberships: index ? [{ organization_id: "org", organization_name: "Partner NGO", role: "enumerator", is_active: true }] : [] }));
it("paginates the real user directory, filters account status, and opens read-only details", async () => {
  vi.spyOn(apiClient, "users").mockResolvedValue(users); setup(<UsersPage />);
  await screen.findByText("Person 0"); expect(screen.queryByText("Person 11")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" })); expect(screen.getByText("Person 11")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Account status"), { target: { value: "Suspended" } });
  expect(screen.queryByText("Person 0")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Actions for Person 11" }));
  expect(screen.getByRole("dialog", { name: "User details" }).textContent).toContain("Active membership");
});
it("paginates and searches organizations without modifying tenant data", async () => {
  vi.spyOn(apiClient, "organizations").mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `Organization ${i}`, slug: `organization-${i}`, is_active: true, created_at: "2026-01-01T00:00:00Z", country: "Liberia", timezone: "UTC", owner_email: null, sector_ids: [] })));
  vi.spyOn(apiClient, "sectors").mockResolvedValue([]); setup(<OrganizationsPage />);
  await screen.findByText("Organization 0"); fireEvent.click(screen.getByRole("button", { name: "Next" })); expect(screen.getByText("Organization 11")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search organizations"), { target: { value: "Organization 3" } }); expect(screen.getByText("Organization 3")).toBeTruthy(); expect(screen.queryByText("Organization 11")).toBeNull();
});
it("shows genuine inactive sector status and a retry on failure", async () => {
  vi.spyOn(apiClient, "adminSectors").mockResolvedValue([{ id: "s", code: "health", name: "Health", is_active: false }]); setup(<SectorsPage />);
  await screen.findByText("Health"); expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0); expect((screen.getByRole("button", { name: "Deactivate Health" }) as HTMLButtonElement).disabled).toBe(true);
});
it("does not claim billing or settings are configured", () => {
  const view = setup(<BillingPage />); expect(screen.getByText("Not configured")).toBeTruthy(); expect(screen.queryByText(/42,780/)).toBeNull(); view.unmount();
  setup(<PlatformSettingsPage />); expect(screen.getByText("Not configured")).toBeTruthy(); expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});
it("uses recorded audit events and requests server pagination", async () => {
  const query = vi.spyOn(apiClient, "platformEvents").mockResolvedValue({ total: 26, items: [{ id: "e", actor: "admin@example.org", action: "project.archived", target: "project-id", organization: "NGO", occurred_at: "2026-01-01T00:00:00Z" }] });
  setup(<AuditLogPage />); await screen.findByText("project.archived"); fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(query.mock.calls.at(-1)?.[0].get("offset")).toBe("25"));
});
it("offers retry when user data is unavailable", async () => {
  vi.spyOn(apiClient, "users").mockRejectedValue(new Error("Unavailable")); setup(<UsersPage />);
  await screen.findByRole("alert"); expect(screen.getByRole("button", { name: "Retry users" })).toBeTruthy();
});

it("creates sectors through the API and displays validation failures", async () => {
  vi.spyOn(apiClient, "adminSectors").mockResolvedValue([]);
  const create = vi.spyOn(apiClient, "createSector").mockRejectedValue(new Error("Unavailable"));
  setup(<SectorsPage />);
  fireEvent.change(screen.getByLabelText("Sector code"), { target: { value: "health" } });
  fireEvent.change(screen.getByLabelText("Sector name"), { target: { value: "Health" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create sector" }).closest("form")!);
  await screen.findByText("Unable to create the sector.");
  expect(create).toHaveBeenCalledWith({ code: "health", name: "Health" }, expect.anything());
});

it("reports unavailable operations without fabricated worker metrics", async () => {
  vi.spyOn(apiClient, "live").mockRejectedValue(new Error("Offline"));
  vi.spyOn(apiClient, "ready").mockRejectedValue(new Error("Offline"));
  vi.spyOn(apiClient, "status").mockRejectedValue(new Error("Offline"));
  setup(<SystemHealthPage />);
  await screen.findByText("The service could not be reached.");
  expect(screen.getByText(/Queue, scheduler and worker status: Unknown/)).toBeTruthy();
  expect(screen.queryByText("99.99%")).toBeNull();
});
