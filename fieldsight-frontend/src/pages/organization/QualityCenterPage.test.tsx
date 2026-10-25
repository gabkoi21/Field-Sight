// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { QualityCenterPage } from "./QualityCenterPage";
import { apiClient } from "../../services/apiClient";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ loading: false, user: { memberships: [{ organization_id: "o" }] } }) }));
vi.mock("../../services/apiClient", () => ({ ApiError: class extends Error {}, apiClient: {
  organizationProjects: vi.fn(), qualityQueue: vi.fn(), submissionReview: vi.fn(), assignReviewer: vi.fn(),
  addReviewNote: vi.fn(), runQualityValidation: vi.fn(), updateSubmissionReviewStatus: vi.fn(),
} }));
const detail = { reviewer_id: null, reviewers: [{ id: "admin", name: "QA Administrator" }], events: [],
  submission: { id: "s", project_id: "p", raw_answers: { visits: 3 } } };
beforeEach(() => {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{ id: "p", name: "QA" }] as never);
  vi.mocked(apiClient.qualityQueue).mockResolvedValue({ items: [{ id: "issue", submission_id: "s", severity: "High", rule: "Short interview", detail: "10 seconds", external_id: "1", project_name: "QA" }], total: 23, counts: { needs_review: 23 }, snapshot_note: "Saved validation findings." } as never);
  vi.mocked(apiClient.submissionReview).mockResolvedValue(detail as never);
  vi.mocked(apiClient.addReviewNote).mockResolvedValue({});
  vi.mocked(apiClient.assignReviewer).mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/quality?project_id=p"]}><QualityCenterPage /></MemoryRouter></QueryClientProvider>);
}
it("saves review notes and displays persisted author/time history", async () => {
  show();
  const note = await screen.findByLabelText("Review note");
  fireEvent.change(note, { target: { value: "Verified context" } });
  vi.mocked(apiClient.submissionReview).mockResolvedValue({ ...detail, events: [{ id: "e", actor: "QA Administrator", action: "note", occurred_at: "2026-10-24T12:00:00Z", note: "Verified context" }] } as never);
  fireEvent.click(screen.getByRole("button", { name: "Add note" }));
  await waitFor(() => expect(apiClient.addReviewNote).toHaveBeenCalledWith("s", "Verified context"));
  expect(await screen.findByText("Verified context", { selector: "span" })).toBeTruthy();
  expect(screen.getByText("QA Administrator", { selector: "strong" })).toBeTruthy();
});
it("persists reviewer assignment and requests the next scoped queue page", async () => {
  show();
  const picker = await screen.findByLabelText("Assigned reviewer");
  await waitFor(() => expect((picker as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(picker, { target: { value: "admin" } });
  await waitFor(() => expect(apiClient.assignReviewer).toHaveBeenCalledWith("s", "admin"));
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(vi.mocked(apiClient.qualityQueue).mock.calls.some(([params]) => params.get("offset") === "20" && params.get("project_id") === "p")).toBe(true));
});
