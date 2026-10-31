// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { KoboConnectionsPage } from "./KoboConnectionsPage";
vi.mock("../../services/apiClient", () => ({ apiClient: { koboConnections: vi.fn(), deleteKoboConnection: vi.fn() }, ApiError: class extends Error {} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function setup() {
  let removed = false;
  vi.mocked(apiClient.koboConnections).mockImplementation(async () => removed ? [] : [{ id: "connection", name: "Offline account", is_verified: false, server_url: "https://example.invalid" }] as never);
  vi.mocked(apiClient.deleteKoboConnection).mockImplementation(async () => { removed = true; });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><KoboConnectionsPage /></MemoryRouter></QueryClientProvider>);
}
it("confirms connection removal, supports cancel and refreshes the account list", async () => {
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Delete Offline account" }));
  expect(screen.getByText(/Kobo forms, submissions, and imported FieldSight data remain/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(apiClient.deleteKoboConnection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete Offline account" }));
  fireEvent.change(screen.getByLabelText('To confirm, type “Offline account”'), { target: { value: "Offline account" } });
  fireEvent.change(screen.getByLabelText('To confirm, type “delete connection”'), { target: { value: "delete connection" } });
  fireEvent.click(screen.getByRole("button", { name: "Delete connection" }));
  await screen.findByText("No Kobo account connected");
  expect(apiClient.deleteKoboConnection).toHaveBeenCalledWith("connection", expect.anything());
});
it("keeps a failed deletion visible for retry", async () => {
  setup();
  vi.mocked(apiClient.deleteKoboConnection).mockRejectedValue(new Error("Connection is used by a project."));
  fireEvent.click(await screen.findByRole("button", { name: "Delete Offline account" }));
  fireEvent.change(screen.getByLabelText('To confirm, type “Offline account”'), { target: { value: "Offline account" } });
  fireEvent.change(screen.getByLabelText('To confirm, type “delete connection”'), { target: { value: "delete connection" } });
  fireEvent.click(screen.getByRole("button", { name: "Delete connection" }));
  expect(await screen.findByText("Connection is used by a project.")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Delete Kobo connection" })).toBeTruthy());
});
