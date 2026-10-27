// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { SubmissionsPage } from "./SubmissionsPage";
import { apiClient } from "../../services/apiClient";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { memberships: [{ organization_id: "org" }] }, loading: false }) }));
vi.mock("../../services/apiClient", () => ({ apiClient: { submissionPage: vi.fn(), organizationProjects: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("requests bounded pages in project scope instead of fetching the full submission list", async () => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "p", name: "QA" }] as never);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ items: [], total: 23, counts: { ready: 23 } });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/submissions?project_id=p"]}><SubmissionsPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByText("Submissions", { selector: "h1" });
  await waitFor(() => expect(apiClient.submissionPage).toHaveBeenCalled());
  const first = vi.mocked(apiClient.submissionPage).mock.calls[0][0];
  expect(first.get("project_id")).toBe("p");
  expect(first.get("limit")).toBe("10");
  expect(screen.getByRole("button", { name: /Export all filtered data/ })).toBeTruthy();
  expect(await screen.findByRole("columnheader", { name: "Review" })).toBeTruthy();
  expect(screen.getByLabelText("Review status filter")).toBeTruthy();
  expect(screen.getByText("Needs review")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.calls.some(([params]) => params.get("offset") === "10")).toBe(true));
});

function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/submissions?project_id=other")}>Global project</button><button onClick={() => navigate(-1)}>Browser back</button><button onClick={() => navigate(1)}>Browser forward</button></>;
}

it("resets a later page on global project switching and browser navigation", async () => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "p", name: "QA" }, { id: "other", name: "Other" }] as never);
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ items: [], total: 23, counts: { ready: 23 } });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })}><MemoryRouter initialEntries={["/submissions?project_id=p"]}><Navigation /><SubmissionsPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "3" }));
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("offset")).toBe("20"));
  fireEvent.click(screen.getByRole("button", { name: "Global project" }));
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("project_id")).toBe("other"));
  expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("offset")).toBe("0");
  fireEvent.click(await screen.findByRole("button", { name: "2" }));
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("offset")).toBe("10"));
  fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("project_id")).toBe("p"));
  expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("offset")).toBe("0");
  fireEvent.click(screen.getByRole("button", { name: "Browser forward" }));
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("project_id")).toBe("other"));
  expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("offset")).toBe("0");
  expect(vi.mocked(apiClient.submissionPage).mock.calls.filter(([p]) => p.get("project_id") === "other")[0][0].get("offset")).toBe("0");
});

it("recovers when a later page disappears and resets for search changes", async () => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "p", name: "QA" }] as never);
  let shrink = false;
  vi.mocked(apiClient.submissionPage).mockImplementation(async params => {
    if (params.get("offset") === "20") shrink = true;
    return { items: [], total: shrink ? 3 : 23, counts: { ready: 3 } };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/submissions?project_id=p"]}><SubmissionsPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "3" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Next page" })).toHaveProperty("disabled", true));
  expect(screen.queryByRole("button", { name: "3" })).toBeNull();
  fireEvent.change(screen.getByPlaceholderText(/Search ID/), { target: { value: "person" } });
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("search")).toBe("person"));
  expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("offset")).toBe("0");
  expect(screen.getByLabelText("Review status filter")).toBeTruthy();
  expect(await screen.findByRole("columnheader", { name: "Review" })).toBeTruthy();
});

it("keeps filters mounted through slow loads and retains rows and focus during background refresh errors", async () => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "p", name: "QA" }] as never);
  let finish!: (value: unknown) => void;
  vi.mocked(apiClient.submissionPage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve as typeof finish; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/submissions?project_id=p"]}><SubmissionsPage /></MemoryRouter></QueryClientProvider>);
  const search = screen.getByLabelText("Search submissions");
  search.focus();
  expect(screen.getByRole("status").textContent).toBe("Loading submissions…");
  const loaded = { items: [{ id: "local-1", external_id: "RECORD-1", project_id: "p", project_name: "QA", review_status: "ready", submitted_at: null }], total: 1, counts: { ready: 1 } };
  await act(async () => { finish(loaded); });
  await screen.findByText("RECORD-1");
  expect(document.activeElement).toBe(search);
  let rejectRefresh!: (error: Error) => void;
  vi.mocked(apiClient.submissionPage).mockImplementationOnce(() => new Promise((_, reject) => { rejectRefresh = reject; }));
  act(() => { void client.invalidateQueries({ queryKey: ["submissions", "page"] }); });
  await screen.findByText("Updating submissions…");
  expect(screen.getByText("RECORD-1")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  expect(document.activeElement).toBe(search);
  await act(async () => { rejectRefresh(new Error("Refresh unavailable")); });
  expect(await screen.findByRole("button", { name: "Retry submissions" })).toBeTruthy();
  expect(screen.getByText("RECORD-1")).toBeTruthy();
  expect(screen.queryByText("Updating submissions…")).toBeNull();
  vi.mocked(apiClient.submissionPage).mockResolvedValue({ items: [], total: 0, counts: {} });
  fireEvent.click(screen.getByRole("button", { name: "Retry submissions" }));
  expect(await screen.findByText("No submissions match these filters.")).toBeTruthy();
});
