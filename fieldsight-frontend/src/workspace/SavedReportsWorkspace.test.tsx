// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SavedReportsWorkspace, ReportDocument } from "./SavedReportsWorkspace";
import { apiClient, type Indicator, type ReportPreview, type SavedReport } from "../services/apiClient";
import { reportPeriod } from "./reportPeriods";

vi.mock("../services/apiClient", () => ({apiClient: {reportTemplates: vi.fn(), savedReports: vi.fn(), indicators: vi.fn(), createReport: vi.fn(), updateReport: vi.fn(), savedReport: vi.fn(), reportPreview: vi.fn(), publishReport: vi.fn(), savedReportPdf: vi.fn()}}));
vi.mock("recharts", async importOriginal => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {...actual, ResponsiveContainer: ({children}: {children: React.ReactElement}) => React.cloneElement(children, {width: 500, height: 200})};
});
vi.mock("./WorkspaceContext", () => ({useWorkspace: () => ({projectId: "p1", project: {id: "p1", name: "Health"}, projects: [{id: "p1", name: "Health"}], selectProject: vi.fn(), loading: false})}));
const report: SavedReport = {id: "r1", project_id: "p1", organization_id: "o1", title: "October results", description: "", template_key: "monthly", reporting_period_start: "2026-10-01", reporting_period_end: "2026-10-31", sections: {executive_summary: "<script>literal text</script>", recommendations: ""}, indicator_ids: [], status: "draft", revision_number: 1, created_at: "2026-10-31T12:00:00Z", updated_at: "2026-10-31T12:00:00Z", created_by_id: "u1", updated_by_id: "u1", published_at: null, published_by_id: null};
const indicator = {id: "i1", code: "COUNT", name: "Households reached", unit: "number", direction: "increase", current_value: 12, target_value: 100, baseline_value: 0, progress_percent: 12, schedule_status: "no_deadline", result_source: "manual", eligible_records: 0, quality_excluded_records: 0, reporting_frequency: "monthly", calculation_note: "Manual sum, UTC dates.", history: [{period: "2026-10", value: 12, target_value: 10, target_achieved: true}]} as Indicator;
const preview: ReportPreview = {content_hash: "a".repeat(64), data: {report, organization: {name: "NGO"}, project: {name: "Health", description: "Project background"}, indicators: [], framework: [], review_counts: {ready: 3}, methodology: "UTC. Targets are not prorated."}};
function setup() {return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})}><MemoryRouter><SavedReportsWorkspace /></MemoryRouter></QueryClientProvider>);}
beforeEach(() => {
  vi.mocked(apiClient.reportTemplates).mockResolvedValue([{key: "monthly", name: "Monthly monitoring", sections: ["executive_summary", "recommendations"]}, {key: "donor", name: "Donor progress", sections: ["executive_summary", "corrective_actions"]}]);
  vi.mocked(apiClient.savedReports).mockResolvedValue({items: [], total: 0});
  vi.mocked(apiClient.indicators).mockResolvedValue([]);
  vi.mocked(apiClient.createReport).mockResolvedValue(report);
  vi.mocked(apiClient.updateReport).mockResolvedValue({...report, revision_number: 2});
  vi.mocked(apiClient.savedReport).mockResolvedValue(report);
  vi.mocked(apiClient.reportPreview).mockResolvedValue(preview);
});
afterEach(() => {cleanup(); vi.resetAllMocks();});
it("calculates calendar periods in UTC including leap years and year boundaries", () => {
  expect(reportPeriod("monthly", 2028, 2)).toEqual(["2028-02-01", "2028-02-29"]);
  expect(reportPeriod("quarterly", 2026, 4)).toEqual(["2026-10-01", "2026-12-31"]);
  expect(reportPeriod("semiannual", 2026, 2)).toEqual(["2026-07-01", "2026-12-31"]);
  expect(reportPeriod("annual", 2026, 1)).toEqual(["2026-01-01", "2026-12-31"]);
  expect(() => reportPeriod("monthly", 2026, 13)).toThrow();
});
it("creates a report with template sections, period and authored narratives then previews and publishes", async () => {
  vi.mocked(apiClient.indicators).mockResolvedValue([indicator]);
  setup(); await screen.findByText(/No saved reports yet/);
  fireEvent.click(screen.getByRole("button", {name: "Create report"}));
  fireEvent.change(screen.getByLabelText("Report title"), {target: {value: "October results"}});
  fireEvent.change(screen.getByLabelText("Report template"), {target: {value: "donor"}});
  expect(screen.getByText(/Corrective actions/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Report template"), {target: {value: "monthly"}});
  fireEvent.click(screen.getByRole("button", {name: "Continue"}));
  fireEvent.change(screen.getByLabelText("Period type"), {target: {value: "quarterly"}});
  fireEvent.change(screen.getByLabelText("Quarter"), {target: {value: "4"}});
  expect(screen.getByText(/2026-10-01 — 2026-12-31/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Continue"}));
  fireEvent.click(await screen.findByRole("checkbox", {name: /Households reached/}));
  fireEvent.change(screen.getByLabelText("Executive summary"), {target: {value: "Field findings"}});
  fireEvent.click(screen.getByRole("button", {name: "Save and preview"}));
  await screen.findByRole("article", {name: "Report preview"});
  expect(vi.mocked(apiClient.createReport).mock.calls[0][1].sections.executive_summary).toBe("Field findings");
  expect(vi.mocked(apiClient.createReport).mock.calls[0][1].indicator_ids).toEqual(["i1"]);
  expect(document.querySelector("script")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Continue to publication"}));
  vi.mocked(apiClient.publishReport).mockResolvedValue({...report, status: "published"});
  fireEvent.click(screen.getByRole("button", {name: "Publish report"}));
  await screen.findByText("Published • read-only");
  expect(apiClient.publishReport).toHaveBeenCalledWith("r1", 1, "a".repeat(64));
  expect(screen.queryByRole("button", {name: "Save draft"})).toBeNull();
});
it("reopens and saves a draft with its expected revision", async () => {
  vi.mocked(apiClient.savedReports).mockResolvedValue({items: [report], total: 1});
  vi.mocked(apiClient.savedReport).mockImplementation(() => new Promise(() => {}));
  setup(); fireEvent.click(await screen.findByRole("button", {name: "Edit report: October results"}));
  const title = screen.getByLabelText("Report title");
  expect(apiClient.savedReport).not.toHaveBeenCalled();
  fireEvent.change(title, {target: {value: "Revised report"}});
  fireEvent.click(screen.getByRole("button", {name: "Save draft"}));
  await screen.findByText("Draft saved.");
  expect(apiClient.updateReport).toHaveBeenCalledWith("r1", expect.objectContaining({title: "Revised report", expected_revision: 1}));
});
it("opens a published snapshot read-only and downloads its stored PDF", async () => {
  const published = {...report, status: "published" as const, published_at: "2026-11-01T12:00:00Z"};
  vi.mocked(apiClient.savedReports).mockResolvedValue({items: [published], total: 1});
  vi.mocked(apiClient.savedReport).mockResolvedValue(published);
  vi.mocked(apiClient.reportPreview).mockResolvedValue({...preview, data: {...preview.data, report: published, published_at: published.published_at}});
  vi.mocked(apiClient.savedReportPdf).mockResolvedValue(new ArrayBuffer(10));
  URL.createObjectURL = vi.fn(() => "blob:pdf"); URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  setup(); fireEvent.click(await screen.findByRole("button", {name: "October results"}));
  await screen.findByRole("article", {name: "Report preview"});
  expect(screen.queryByLabelText("Executive summary")).toBeNull();
  expect(apiClient.indicators).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Download saved PDF"}));
  await waitFor(() => expect(apiClient.savedReportPdf).toHaveBeenCalledWith("r1", undefined));
  click.mockRestore();
});
it("shows report loading errors and retains the editor when save fails", async () => {
  vi.mocked(apiClient.createReport).mockRejectedValue(new Error("Save failed"));
  setup(); await screen.findByText(/No saved reports yet/);
  fireEvent.click(screen.getByRole("button", {name: "Create report"}));
  fireEvent.click(screen.getByRole("button", {name: "Save draft"}));
  await screen.findByText("Save failed");
  expect(screen.getByLabelText("Report title")).toBeTruthy();
});
it("renders empty previews with plain text narratives", () => {
  render(<ReportDocument preview={preview} />);
  expect(screen.getByText("<script>literal text</script>")).toBeTruthy();
  expect(screen.getByText("No indicators selected.")).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
});

it("renders actual-target and trend charts with separate overall and period targets", () => {
  render(<ReportDocument preview={{...preview, data: {...preview.data, indicators: [indicator]}}} />);
  expect(screen.getByRole("img", {name: "Households reached actual versus overall target, number"})).toBeTruthy();
  expect(screen.getByRole("img", {name: "Households reached reporting period trend"})).toBeTruthy();
  expect(screen.getByRole("cell", {name: "2026-10"})).toBeTruthy();
  expect(screen.getByRole("cell", {name: "10"})).toBeTruthy();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
});

it("retries a failed preview without saving the draft again", async () => {
  vi.mocked(apiClient.reportPreview).mockRejectedValueOnce(new Error("Preview timed out")).mockResolvedValueOnce(preview);
  setup(); await screen.findByText(/No saved reports yet/);
  fireEvent.click(screen.getByRole("button", {name: "Create report"}));
  fireEvent.click(screen.getByRole("button", {name: "3. Report content"}));
  fireEvent.click(screen.getByRole("button", {name: "Save and preview"}));
  await screen.findByText("Preview timed out");
  expect(screen.getByText("Draft saved.")).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Retry loading reports"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Retry preview"}));
  await screen.findByRole("article", {name: "Report preview"});
  expect(apiClient.createReport).toHaveBeenCalledTimes(1);
  expect(apiClient.updateReport).not.toHaveBeenCalled();
  expect(apiClient.reportPreview).toHaveBeenCalledTimes(2);
});
