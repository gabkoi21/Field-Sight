// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../services/apiClient";
import { WorkspacesPage } from "./WorkspacesPage";

const workspace = vi.hoisted(() => ({
  organizationId: "org",
  projectId: "project",
  isAdmin: true,
  loading: false,
  project: undefined as unknown,
  selectProject: vi.fn(),
  projects: [
    {
      id: "project",
      name: "School Feed Program",
      status: "active",
      start_date: null,
      end_date: null,
      kobo_connection_id: "connection" as string | null,
      kobo_form_id: "attendance",
      kobo_form_name: "School Attendance",
    },
  ],
}));
vi.mock("./WorkspaceContext", () => ({ useWorkspace: () => workspace }));
vi.mock("../services/apiClient", () => ({
  apiClient: {
    organizationSectors: vi.fn(),
    deleteProject: vi.fn(),
    submissions: vi.fn(),
  },
}));
beforeEach(() => {
  workspace.isAdmin = true;
  workspace.projects[0].kobo_connection_id = "connection";
  workspace.project = workspace.projects[0];
  vi.mocked(apiClient.organizationSectors).mockResolvedValue([]);
  vi.mocked(apiClient.deleteProject).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function setup() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <WorkspacesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function openDelete() {
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Actions for School Feed Program",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  return screen.findByRole("dialog", { name: "Delete project?" });
}
it("requires confirmation, warns about Kobo, supports cancel and deletes the selected project", async () => {
  setup();
  let dialog = await openDelete();
  expect(
    within(dialog).getByText(/permanently deleted from KoboToolbox/),
  ).toBeTruthy();
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Delete project",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(apiClient.deleteProject).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  dialog = await screen.findByRole("dialog", { name: "Delete project?" });
  fireEvent.change(
    within(dialog).getByLabelText("Type the project name to confirm"),
    { target: { value: "  School Feed Program  " } },
  );
  expect((within(dialog).getByRole("button", { name: "Delete project" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.blur(within(dialog).getByLabelText("Type the project name to confirm"));
  expect((within(dialog).getByLabelText("Type the project name to confirm") as HTMLInputElement).value).toBe("School Feed Program");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Delete project" }),
  );
  await waitFor(() =>
    expect(apiClient.deleteProject).toHaveBeenCalledWith("org", "project"),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("keeps a readable failure in the confirmation modal", async () => {
  vi.mocked(apiClient.deleteProject).mockRejectedValue(
    new Error("Kobo unavailable. Try again."),
  );
  setup();
  const dialog = await openDelete();
  fireEvent.change(
    within(dialog).getByLabelText("Type the project name to confirm"),
    { target: { value: "School Feed Program" } },
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Delete project" }),
  );
  expect(await screen.findByText("Kobo unavailable. Try again.")).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "Delete project?" })).toBeTruthy();
});
it("does not expose project deletion to non-administrators", async () => {
  workspace.isAdmin = false;
  setup();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Actions for School Feed Program",
    }),
  );
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
});

it("explains that a form without a connection is only removed from FieldSight", async () => {
  workspace.projects[0].kobo_connection_id = null;
  setup();
  const dialog = await openDelete();
  expect(within(dialog).getByText(/Any form or submissions on KoboToolbox will remain/)).toBeTruthy();
  expect(within(dialog).queryByText(/permanently deleted from KoboToolbox/)).toBeNull();
});
