// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SuperAdminShell } from "./SuperAdminShell";
const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { username: "Admin", email: "admin@test.org" }, logout }) }));
vi.mock("./AdminProfile", () => ({ AdminProfile: () => <div>Account profile form</div> }));
vi.mock("../layout/RouteContent", () => ({ RouteContent: () => <div>Page content</div> }));
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
afterEach(() => { cleanup(); logout.mockReset(); });
it("opens mobile navigation, exposes sectors and audits, and closes on selection", () => {
  render(<MemoryRouter><SuperAdminShell /></MemoryRouter>);
  const menu = screen.getByRole("button", { name: "Open navigation" });
  fireEvent.click(menu);
  const dialog = screen.getByRole("dialog", { name: "Platform navigation" });
  expect(dialog.textContent).toContain("Audit logs");
  expect(dialog.textContent).toContain("Sectors");
  fireEvent.click(Array.from(dialog.querySelectorAll("a")).find(a => a.textContent === "Sectors")!);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "Search unavailable" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Notifications unavailable" })).toBeNull();
});


it("moves account settings and sign out from both sidebars to the header dropdown", () => {
  render(<MemoryRouter><SuperAdminShell /></MemoryRouter>);
  const sidebar = screen.getByRole("complementary");
  expect(within(sidebar).queryByRole("link", { name: "Platform settings" })).toBeNull();
  expect(within(sidebar).queryByRole("button", { name: "Sign out" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  const mobile = screen.getByRole("dialog", { name: "Platform navigation" });
  expect(within(mobile).queryByRole("link", { name: "Platform settings" })).toBeNull();
  expect(within(mobile).queryByRole("button", { name: "Sign out" })).toBeNull();
  fireEvent.click(within(mobile).getByRole("button", { name: "Close navigation" }));
  const trigger = screen.getByRole("button", { name: "User menu" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);
  const account = screen.getByRole("navigation", { name: "User account" });
  expect(within(account).getByText("admin@test.org")).toBeTruthy();
  expect(within(account).getByRole("button", { name: "Profile & settings" })).toBeTruthy();
  expect(within(account).getByRole("link", { name: "Platform settings" }).getAttribute("href")).toBe("/superadmin/settings");
  expect(within(account).getByRole("button", { name: "Sign out" })).toBeTruthy();
  fireEvent.click(within(account).getByRole("link", { name: "Platform settings" }));
  expect(screen.queryByRole("navigation", { name: "User account" })).toBeNull();
  expect(screen.getByRole("navigation", { name: "Breadcrumb" }).textContent).toContain("Platform settings");
});

it("dismisses the dropdown with Escape or an outside click and opens the profile", () => {
  render(<MemoryRouter><SuperAdminShell /></MemoryRouter>);
  const trigger = screen.getByRole("button", { name: "User menu" });
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("navigation", { name: "User account" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByText("Page content"));
  expect(screen.queryByRole("navigation", { name: "User account" })).toBeNull();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Profile & settings" }));
  expect(screen.getByRole("dialog", { name: "Administrator profile" })).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "User account" })).toBeNull();
});

it("keeps sign out available for retry when logout fails", async () => {
  logout.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(undefined);
  render(<MemoryRouter><SuperAdminShell /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "User menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("navigation", { name: "User account" })).toBeNull());
});
