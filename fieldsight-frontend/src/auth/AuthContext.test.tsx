// @vitest-environment jsdom
import React, { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ restore: vi.fn(), me: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock("../services/apiClient", () => ({ apiClient: { ...mocks, hasStoredAccessToken: () => false }, ApiError: class extends Error { status = 503; } }));
vi.mock("./developmentAccess", () => ({ skipLogin: false }));
import { AuthProvider, useAuth } from "./AuthContext";
const user = { id: "one", email: "one@example.com", username: null, platform_role: null, memberships: [] };
function Probe() {
  const auth = useAuth();
  return <><span>{auth.status}:{auth.user?.id}</span><button onClick={() => void auth.logout()}>Logout</button><button onClick={() => void auth.login("two", "synthetic", false)}>Login</button><button onClick={auth.retry}>Retry</button></>;
}
beforeEach(() => { vi.clearAllMocks(); mocks.logout.mockResolvedValue(undefined); mocks.login.mockResolvedValue(undefined); });
afterEach(cleanup);
function mount(cache = new QueryClient()) {
  render(<StrictMode><QueryClientProvider client={cache}><AuthProvider><Probe /></AuthProvider></QueryClientProvider></StrictMode>);
  return cache;
}
it("deduplicates StrictMode startup and restores a cookie-only session", async () => {
  let done!: (value: typeof user) => void;
  mocks.restore.mockReturnValue(new Promise(resolve => { done = resolve; })); mount();
  expect(screen.getByText("checking:")).toBeTruthy(); expect(mocks.restore).toHaveBeenCalledTimes(1);
  await act(async () => done(user)); expect(screen.getByText("authenticated:one")).toBeTruthy();
});
it("keeps temporary startup failure distinct from signed out and retries", async () => {
  mocks.restore.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(user); mount();
  await waitFor(() => expect(screen.getByText("unavailable:")).toBeTruthy());
  fireEvent.click(screen.getByText("Retry")); await waitFor(() => expect(screen.getByText("authenticated:one")).toBeTruthy());
});
it("clears user caches across logout and account changes", async () => {
  mocks.restore.mockResolvedValue(user); mocks.me.mockResolvedValue({ ...user, id: "two" });
  const cache = mount(); await waitFor(() => expect(screen.getByText("authenticated:one")).toBeTruthy());
  cache.setQueryData(["private"], "one's synthetic data");
  fireEvent.click(screen.getByText("Logout")); await waitFor(() => expect(screen.getByText("signed_out:")).toBeTruthy());
  expect(cache.getQueryData(["private"])).toBeUndefined();
  fireEvent.click(screen.getByText("Login")); await waitFor(() => expect(screen.getByText("authenticated:two")).toBeTruthy());
  expect(cache.getQueryData(["private"])).toBeUndefined();
});
it("does not accept late startup restoration after logout", async () => {
  let done!: (value: typeof user) => void;
  mocks.restore.mockReturnValue(new Promise(resolve => { done = resolve; })); mount();
  fireEvent.click(screen.getByText("Logout")); await act(async () => done(user));
  expect(screen.getByText("signed_out:")).toBeTruthy();
});
