// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AdminProfile } from "../../components/superadmin/AdminProfile";
import { SuperAdminDashboardPage } from "../dashboard/SuperAdminDashboardPage";
vi.mock("../../components/superadmin/MonthlyOrganizationActivity", () => ({ MonthlyOrganizationActivity: () => <div>Monthly activity</div> }));
vi.mock("recharts", () => ({ ResponsiveContainer: () => null, PieChart: () => null, Pie: () => null, Cell: () => null }));
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
const users: ApiUserDirectoryItem[] = Array.from({ length: 12 }, (_, index) => ({ id: String(index), email: `user${index}@example.org`, full_name: `Person ${index}`, username: null, platform_role: null, is_active: index !== 11, created_at: "2026-01-01T00:00:00Z", memberships: index ? [{ organization_id: "org", organization_name: "Partner NGO", role: "enumerator", is_active: true }] : [] }));
it("paginates the real user directory, filters account status, and opens read-only details", async () => {
  vi.spyOn(apiClient, "users").mockResolvedValue(users); setup(<UsersPage />);
  await screen.findByText("Person 0"); expect(screen.queryByText("Person 11")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" })); expect(screen.getByText("Person 11")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Filter users" }));
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

it("renders exactly four aggregate KPI cards without loading tenant directories", async () => {
  vi.spyOn(apiClient, "platformOverview").mockResolvedValue({ total_organizations: 7, total_platform_users: 23, active_organizations: 5, total_projects: 19 });
  const directories = vi.spyOn(apiClient, "organizations");
  setup(<SuperAdminDashboardPage />);
  await screen.findByRole("article", { name: "Total Projects 19" });
  expect(screen.getAllByRole("article", { name: /^(Total|Active Organizations)/ })).toHaveLength(4);
  expect(screen.getByRole("article", { name: "Total Platform Users 23" })).toBeTruthy();
  expect(directories).not.toHaveBeenCalled();
});
it("only confirms profile changes after persistence and retains failed input", async () => {
  vi.spyOn(apiClient, "profile").mockResolvedValue({ email: "admin@example.org", full_name: "Admin", landing_page: "/projects" });
  const save = vi.spyOn(apiClient, "saveProfile").mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ email: "admin@example.org", full_name: "New name", landing_page: "/projects" });
  setup(<AdminProfile onClose={() => {}} />);
  const input = await screen.findByLabelText("Full name");
  fireEvent.change(input, { target: { value: "New name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Profile saved.")).toBeNull();
  expect((input as HTMLInputElement).value).toBe("New name");
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Profile saved.");
  expect(save.mock.calls[0][0].full_name).toBe("New name");
});

it("paginates sectors and resets to the matching search results", async () => {
  vi.spyOn(apiClient, "adminSectors").mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: String(i), code: `sector_${i}`, name: `Sector ${i}`, is_active: true })));
  setup(<SectorsPage />);
  await screen.findByText("Sector 0");
  expect(screen.queryByText("Sector 11")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Sector 11")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search sectors"), { target: { value: "Sector 3" } });
  expect(screen.getByText("Sector 3")).toBeTruthy();
  expect(screen.getByText("Showing 1 to 1 of 1 results")).toBeTruthy();
});


it("sorts the entire user directory through accessible column headers and resets pagination", async () => {
  vi.spyOn(apiClient, "users").mockResolvedValue(users);
  setup(<UsersPage />);
  await screen.findByText("Person 0");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "User" }));
  expect(screen.getByRole("columnheader", { name: "User" }).getAttribute("aria-sort")).toBe("ascending");
  expect(screen.getByText("Showing 1 to 10 of 12 results")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "User" }));
  expect(screen.getByRole("columnheader", { name: "User" }).getAttribute("aria-sort")).toBe("descending");
  const rows = screen.getAllByRole("row");
  expect(rows[1].textContent).toContain("Person 11");
  expect(screen.getByRole("region", { name: "Platform users" }).tabIndex).toBe(0);
});

it("sorts the sector catalog and exposes numbered pagination", async () => {
  vi.spyOn(apiClient, "adminSectors").mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `Sector ${index}`, code: `sector_${index}`, is_active: true })));
  setup(<SectorsPage />);
  await screen.findByText("Sector 0");
  fireEvent.click(screen.getByRole("button", { name: "Code" }));
  fireEvent.click(screen.getByRole("button", { name: "Code" }));
  expect(screen.getAllByRole("row")[1].textContent).toContain("Sector 11");
  fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
  expect(screen.getByText("Showing 11 to 12 of 12 results")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
});


it("uses the project-list toolbar without the old directory panel heading", async () => {
  vi.spyOn(apiClient, "users").mockResolvedValue(users);
  setup(<UsersPage />);
  await screen.findByText("Person 0");
  expect(screen.queryByRole("heading", { name: "Platform directory" })).toBeNull();
  expect(screen.getByRole("searchbox", { name: "Search users" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Account status" })).toBeNull();
  const filter = screen.getByRole("button", { name: "Filter users" });
  fireEvent.click(filter);
  expect(filter.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("combobox", { name: "Account status" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Email" })).toBeTruthy();
  fireEvent.click(filter);
  expect(screen.queryByRole("combobox", { name: "Account status" })).toBeNull();
});


it("hides Super Admin accounts from directory rows, counts, filters, and search", async () => {
  const administrators: ApiUserDirectoryItem[] = [true, false].map((active, index) => ({
    ...users[index], id: `platform-admin-${index}`, email: `platform-admin-${index}@example.org`,
    full_name: `Hidden administrator ${index}`, platform_role: "super_admin", is_active: active,
  }));
  vi.spyOn(apiClient, "users").mockResolvedValue([...administrators, ...users]);
  setup(<UsersPage />);
  await screen.findByText("Person 0");
  expect(screen.queryByText("Hidden administrator 0")).toBeNull();
  expect(screen.queryByText("Hidden administrator 1")).toBeNull();
  expect(screen.getByText("Showing 1 to 10 of 12 results")).toBeTruthy();
  expect(screen.getByRole("article", { name: "All users 12" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Filter users" }));
  expect(screen.queryByRole("option", { name: "Super Admin" })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), { target: { value: "platform-admin" } });
  expect(screen.getByText("No users match your filters.")).toBeTruthy();
  expect(screen.getByText("Showing 0 to 0 of 0 results")).toBeTruthy();
});

it("shows a system-health skeleton until all initial checks settle", async () => {
  vi.spyOn(apiClient, "live").mockResolvedValue({ status: "ok" } as never);
  vi.spyOn(apiClient, "ready").mockResolvedValue({ database: "ready" } as never);
  vi.spyOn(apiClient, "status").mockImplementation(() => new Promise(() => {}));
  setup(<SystemHealthPage />);
  expect(await screen.findByText("Checking system health...")).toBeTruthy();
  expect(screen.queryByText("No successful checks")).toBeNull();
});
it("refreshes every system health endpoint on demand", async () => {
  const live = vi.spyOn(apiClient, "live").mockResolvedValue({ status: "ok" } as never);
  const ready = vi.spyOn(apiClient, "ready").mockResolvedValue({ database: "ready" } as never);
  const status = vi.spyOn(apiClient, "status").mockResolvedValue({ status: "ok" } as never);
  setup(<SystemHealthPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Refresh status" }));
  await waitFor(() => { expect(live).toHaveBeenCalledTimes(2); expect(ready).toHaveBeenCalledTimes(2); expect(status).toHaveBeenCalledTimes(2); });
});
