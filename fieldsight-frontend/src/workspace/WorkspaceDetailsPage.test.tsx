// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceDetailsPage } from "./WorkspaceDetailsPage";
import { apiClient } from "../services/apiClient";

vi.mock("./WorkspaceContext", () => ({ useWorkspace: () => ({
  projectId: "p1", organizationId: "org", project: {
    id: "p1", name: "Water project", description: "Water monitoring",
    start_date: "2026-10-27", end_date: "2026-12-31", updated_at: "2026-10-31",
    workspace_details: { countries: ["Liberia"], topics: ["WASH"] },
  },
}) }));
vi.mock("./WorkspaceUI", () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Page: Container, Panel: Container, WorkspaceGate: Container, Notice: Container, WorkspaceTabs: () => null };
});
vi.mock("../services/apiClient", () => ({ apiClient: { updateProject: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup() {
  render(<QueryClientProvider client={new QueryClient()}><WorkspaceDetailsPage /></QueryClientProvider>);
}
it("locks details initially and restores saved values when editing is canceled", () => {
  setup();
  const name = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
  expect(name.matches(":disabled")).toBe(true);
  expect(screen.getByRole("combobox", { name: "Stage" }).matches(":disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  expect(name.matches(":disabled")).toBe(false);
  fireEvent.change(name, { target: { value: "Edited project" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(name.value).toBe("Water project");
  expect(name.matches(":disabled")).toBe(true);
  expect(apiClient.updateProject).not.toHaveBeenCalled();
});
it("locks the details after a successful save", async () => {
  vi.mocked(apiClient.updateProject).mockResolvedValue({ id: "p1" } as never);
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Edited project" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit profile" })).toBeTruthy());
  expect(screen.getByRole("textbox", { name: "Name" }).matches(":disabled")).toBe(true);
  expect(apiClient.updateProject).toHaveBeenCalledWith("org", "p1", expect.objectContaining({ name: "Edited project" }));
});
