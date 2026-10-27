// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubmissionReview } from "./SubmissionReview";
import { apiClient } from "../../services/apiClient";
vi.mock("../../services/apiClient", () => ({ apiClient: { submissionDetail: vi.fn(), reviewSubmission: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("inspects evidence and submits the displayed evidence and review tokens", async () => {
  vi.mocked(apiClient.submissionDetail).mockResolvedValue({ id: "s", external_id: "SCHOOL-1", project_id: "p", review_status: "needs_review", raw_answers: { portions: 215 }, evidence_fingerprint: "v1:current", review_token: "event-1", history: [], history_total: 0, findings: [] } as never);
  vi.mocked(apiClient.reviewSubmission).mockResolvedValue({});
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SubmissionReview id="s" onClose={vi.fn()} /></QueryClientProvider>);
  await screen.findByText("Review submission SCHOOL-1");
  fireEvent.click(screen.getByText(/All submission answers/));
  expect(screen.getByText("215")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "invalid" } });
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Reconcile school register" } });
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  await waitFor(() => expect(apiClient.reviewSubmission).toHaveBeenCalledWith("s", { status: "invalid", note: "Reconcile school register", evidence_fingerprint: "v1:current", expected_review_token: "event-1" }));
});
it("shows stale evidence conflict and a reload action", async () => {
  vi.mocked(apiClient.submissionDetail).mockResolvedValue({ external_id: "1", review_status: "ready", raw_answers: {}, evidence_fingerprint: "v1:a", review_token: "a", history: [], findings: [], history_total: 0 } as never);
  vi.mocked(apiClient.reviewSubmission).mockRejectedValue(new Error("Submission evidence changed. Reload the record before reviewing."));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SubmissionReview id="s" onClose={vi.fn()} /></QueryClientProvider>);
  await screen.findByText("Review submission 1");
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload evidence" })).toBeTruthy();
});
