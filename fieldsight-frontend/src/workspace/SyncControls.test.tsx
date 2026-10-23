// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "../services/apiClient";
import { SyncControls } from "./SyncControls";

vi.mock("../services/apiClient", () => ({ apiClient: {
  syncSettings: vi.fn(), syncRuns: vi.fn(), updateSyncSettings: vi.fn(), queueSync: vi.fn(),
} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function setup(pending = false, connected = true) {
  vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 60, last_successful_sync: null, pending });
  vi.mocked(apiClient.syncRuns).mockResolvedValue([]);
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cache}><SyncControls projectId="project-1" connected={connected} /></QueryClientProvider>);
}
describe("synchronization controls", () => {
  it("enables automatic sync with the selected interval", async () => {
    setup();
    const toggle = await screen.findByRole("checkbox");
    fireEvent.change(screen.getByLabelText("Sync interval in seconds"), { target: { value: "1.6" } });
    fireEvent.click(toggle);
    await waitFor(() => expect(apiClient.updateSyncSettings).toHaveBeenCalledWith("project-1", "scheduled", 1.6));
  });
  it("queues a manual sync and shows readable failures", async () => {
    vi.mocked(apiClient.queueSync).mockRejectedValue(new Error("Kobo connection is unavailable."));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));
    expect(await screen.findByText("Kobo connection is unavailable.")).toBeTruthy();
    expect(apiClient.queueSync).toHaveBeenCalledWith("project-1");
  });
  it("prevents duplicate queue requests", async () => {
    setup(true);
    const button = await screen.findByRole("button", { name: "Sync pending…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps pending state in the button without a status banner", async () => {
    setup();
    cleanup();
    vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 5,
      last_successful_sync: null, pending: true, attempts: 0,
      queued_at: new Date(Date.now() - 180000).toISOString(), next_attempt_at: null });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={cache}><SyncControls projectId="project-1" connected /></QueryClientProvider>);
    expect(await screen.findByRole("button", { name: "Sync pending…" })).toBeTruthy();
    expect(screen.queryByText(/Sync requested|pending for 3 minutes|synchronization service may be stopped/)).toBeNull();
  });
  it("shows when a failed request will be retried", async () => {
    setup();
    cleanup();
    vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "manual", interval_minutes: 5,
      last_successful_sync: null, pending: true, attempts: 1,
      queued_at: new Date(Date.now() - 180000).toISOString(),
      next_attempt_at: new Date(Date.now() + 60000).toISOString() });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={cache}><SyncControls projectId="project-1" connected /></QueryClientProvider>);
    expect(await screen.findByRole("button", { name: "Retry scheduled…" })).toBeTruthy();
    expect(screen.queryByText(/The last attempt failed. Next retry/)).toBeNull();
  });
  it("shows settings failures", async () => {
    setup();
    vi.mocked(apiClient.syncSettings).mockRejectedValue(new Error("Unable to load synchronization settings."));
    // The first request is pending when the mock is changed; remount to issue a fresh request.
    cleanup();
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={cache}><SyncControls projectId="project-2" connected /></QueryClientProvider>);
    expect(await screen.findByText("Unable to load synchronization settings.")).toBeTruthy();
  });
  it("disables actions without a connected form", async () => {
    setup(false, false);
    expect((await screen.findByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Sync now" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows the last successful timestamp without loading a history table", async () => {
    setup();
    cleanup();
    const timestamp = "2026-10-22T12:00:00Z";
    vi.mocked(apiClient.syncSettings).mockResolvedValue({ mode: "scheduled", interval_minutes: 60, last_successful_sync: timestamp, pending: false });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={cache}><SyncControls projectId="project-1" connected /></QueryClientProvider>);
    expect(await screen.findByText(`Last successful sync: ${new Date(timestamp).toLocaleString()}`)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Recent sync history")).toBeNull();
    expect(apiClient.syncRuns).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(apiClient.updateSyncSettings).toHaveBeenCalledWith("project-1", "manual", 3600));
  });
});
