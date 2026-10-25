// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

it("recovers when a later page disappears and resets for search and review filters", async () => {
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
  fireEvent.change(await screen.findByLabelText("Review status filter"), { target: { value: "Invalid" } });
  await waitFor(() => expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("review_status")).toBe("invalid"));
  expect(vi.mocked(apiClient.submissionPage).mock.lastCall?.[0].get("offset")).toBe("0");
});
