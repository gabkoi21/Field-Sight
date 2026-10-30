// @vitest-environment jsdom
import React, { lazy } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SuperAdminShell } from "../superadmin/SuperAdminShell";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { username: "Admin", email: "review@example.test" }, logout: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("renders fast navigation immediately and keeps the shell and focus during a slow lazy route", async () => {
  let finish!: (module: { default: () => React.ReactElement }) => void;
  const Slow = lazy(() => new Promise<{ default: () => React.ReactElement }>(resolve => { finish = resolve; }));
  render(<MemoryRouter initialEntries={["/superadmin"]}><Routes><Route path="/superadmin" element={<SuperAdminShell />}><Route index element={<h1>Ready platform page</h1>} /><Route path="users" element={<Slow />} /></Route></Routes></MemoryRouter>);
  // No fake timer or elapsed minimum is needed for an already-ready route.
  expect(screen.getByRole("heading", { name: "Ready platform page" })).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  const link = screen.getByRole("link", { name: "Users & roles" });
  link.focus();
  fireEvent.click(link);
  expect(screen.getByRole("status").textContent).toContain("Loading page…");
  expect(screen.getByRole("link", { name: "Organizations" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "User menu" })).toBeTruthy();
  await act(async () => { finish({ default: () => <h1>Loaded users</h1> }); });
  expect(await screen.findByRole("heading", { name: "Loaded users" })).toBeTruthy();
  expect(document.activeElement).toBe(link);
  expect(screen.queryByRole("status")).toBeNull();
});

it("replaces a rejected lazy load with a recoverable error and keeps navigation usable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const Broken = lazy(() => Promise.reject(new Error("Chunk unavailable")));
  render(<MemoryRouter initialEntries={["/superadmin/users"]}><Routes><Route path="/superadmin" element={<SuperAdminShell />}><Route path="users" element={<Broken />} /><Route path="settings" element={<h1>Settings ready</h1>} /></Route></Routes></MemoryRouter>);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "User menu" }));
  fireEvent.click(screen.getByRole("link", { name: "Platform settings" }));
  expect(await screen.findByRole("heading", { name: "Settings ready" })).toBeTruthy();
});
