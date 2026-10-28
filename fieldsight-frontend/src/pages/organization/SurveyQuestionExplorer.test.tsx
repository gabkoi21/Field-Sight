// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SurveyQuestionExplorer } from "./SurveyQuestionExplorer";
import { apiClient, type AnalysisQuery, type AnalysisResult, type SurveyCatalogue } from "../../services/apiClient";
configure({asyncUtilTimeout: 5000});
const workspace = vi.hoisted(() => ({projectId: "wash", project: {name: "WASH"}, selectProject: vi.fn()}));
vi.mock("../../workspace/WorkspaceContext", () => ({useWorkspace: () => workspace}));
vi.mock("../../auth/AuthContext", () => ({useAuth: () => ({user: {memberships: [{organization_id: "org", role: "organization_admin"}]}, loading: false})}));
vi.mock("../../services/apiClient", () => ({apiClient: {organizationProjects: vi.fn(), surveyFields: vi.fn(), queryAnalysis: vi.fn(), savedAnalyses: vi.fn(), saveAnalysis: vi.fn()}}));
vi.mock("../../components/charts/SurveyResultChart", async original => {
  const actual = await original<typeof import("../../components/charts/SurveyResultChart")>();
  return {...actual, SurveyResultChart: ({result,chart}: {result: AnalysisResult;chart:string}) => <div role="img" aria-label={chart + " responses"}>{result.series.map(point => point.name).join(", ")}</div>};
});
const comment = "Drinking water is available, and the hand pump is functioning properly...";
const fields = [
  {source_field: "additional_comments", label: "Additional comments", type: "text", choices: [], supported: true, source: "kobo"},
  {source_field: "water_available", label: "Is drinking water available today?", type: "select_one", choices: [{value: "yes",label: "Yes"},{value: "no",label: "No"}], supported: true, source: "kobo"},
] as SurveyCatalogue["fields"];
function answer(query: AnalysisQuery): AnalysisResult {
  const field = fields.find(item => item.source_field === query.source_field)!;
  return {project_id: query.project_id, form_id: "form", field, measure: "count", total_records: 1, eligible_records: 1, answered_records: 1, missing_records: 0, invalid_answers: 0, denominator: 1, value: 1, filters: query.filters, group_by: query.group_by, note: "Answered denominator", generated_at: "2026-10-28T00:00:00Z", series: field.type === "text" ? [{name: comment,group: query.group_by ? "Yes" : null,count: 1,value: 1,percent: 100}] : [{name: "Yes",group: null,count: 1,value: 1,percent: 100},{name: "No",group: null,count: 0,value: 0,percent: 0}]};
}
beforeEach(() => {
  workspace.projectId = "wash";
  vi.mocked(apiClient.organizationProjects).mockResolvedValue([{id: "wash"},{id: "other"}] as never);
  vi.mocked(apiClient.surveyFields).mockImplementation(async project => ({project_id: project, form_id: "form", fields: [fields[1], fields[0]], forms: ["form"], locations: [], enumerators: []} as unknown as SurveyCatalogue));
  vi.mocked(apiClient.queryAnalysis).mockImplementation(async query => answer(query));
  vi.mocked(apiClient.savedAnalyses).mockResolvedValue([]);
});
afterEach(() => {cleanup();vi.resetAllMocks();});
function setup() {
  const cache = new QueryClient({defaultOptions: {queries: {retry: false}}});
  function TestApp() {return <QueryClientProvider client={cache}><MemoryRouter><SurveyQuestionExplorer /></MemoryRouter></QueryClientProvider>;}
  return {...render(<TestApp />), TestApp};
}
it("selects the exact Kobo response field, switches charts, and persists Pie with current filters", async () => {
  setup();
  await screen.findByRole("button", {name: /Is drinking water available today/});
  fireEvent.click(screen.getByRole("button", {name: /Is drinking water available today/}));
  await screen.findByRole("rowheader", {name: "Yes"});
  expect(screen.getByRole("img", {name: "pie responses"}).textContent).toBe("Yes, No");
  expect(screen.queryByRole("rowheader", {name: comment})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Doughnut"}));
  expect(screen.getByRole("img", {name: "pie responses"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "table"}));
  expect(screen.getByRole("table")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Doughnut"}));
  fireEvent.click(screen.getByRole("button", {name: "Save visualization"}));
  fireEvent.click(screen.getByRole("button", {name: "Save"}));
  await waitFor(() => expect(apiClient.saveAnalysis).toHaveBeenCalledWith(expect.objectContaining({chart: "pie", query: expect.objectContaining({project_id: "wash", source_field: "water_available", group_by: null, filters: expect.objectContaining({review_status: "ready"})})})));
});
it("scopes results to a changed project and clears prior question and grouping settings", async () => {
  const view = setup();
  await screen.findByRole("button", {name: /Is drinking water available today/});
  fireEvent.click(screen.getByRole("button", {name: /Is drinking water available today/}));
  await screen.findByRole("rowheader", {name: "Yes"});
  workspace.projectId = "other";
  view.rerender(<view.TestApp />);
  await waitFor(() => expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({project_id: "other", source_field: "water_available", group_by: null})));
});

it("defaults to the first question in the assigned Kobo form", async () => {
  setup();
  expect(await screen.findByRole("rowheader", {name: "Yes"})).toBeTruthy();
  expect(screen.getByRole("img", {name: "pie responses"}).textContent).toBe("Yes, No");
  expect(screen.queryByRole("rowheader", {name: comment})).toBeNull();
  expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({source_field: "water_available", group_by: null}));
});

it("uses the route project even if workspace context still refers to another project", async () => {
  const cache = new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={["/projects/other/analytics"]}><Routes><Route path="projects/:projectId/analytics" element={<SurveyQuestionExplorer />} /></Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByRole("rowheader", {name: "Yes"});
  expect(apiClient.surveyFields).toHaveBeenCalledWith("other", null);
  expect(apiClient.surveyFields).not.toHaveBeenCalledWith("wash", expect.anything());
  expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({project_id: "other"}));
  const navigation = screen.getByRole("navigation", {name: "Project sections"});
  expect(navigation.querySelector('a[href="/projects/other/analytics"]')).toBeTruthy();
});
it("never falls back to another project for an inaccessible route project", async () => {
  const cache = new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={["/projects/unknown/analytics"]}><Routes><Route path="projects/:projectId/analytics" element={<SurveyQuestionExplorer />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText(/Choose a project you have access to/)).toBeTruthy();
  expect(apiClient.surveyFields).not.toHaveBeenCalled();
  expect(apiClient.queryAnalysis).not.toHaveBeenCalled();
  expect(apiClient.savedAnalyses).not.toHaveBeenCalled();
});

it("keeps Kobo form order in the question list and Disaggregate by options", async () => {
  const ordered = [fields[1], {...fields[0], source_field: "z_last", label: "Z first in form"}, {...fields[0], source_field: "a_first", label: "A last in form"}];
  vi.mocked(apiClient.surveyFields).mockResolvedValue({project_id: "wash", form_id: "form", fields: ordered, forms: ["form"], locations: [], enumerators: []} as unknown as SurveyCatalogue);
  setup();
  await screen.findByRole("button", {name: /Z first in form/});
  const buttons = Array.from(document.querySelectorAll('button[title]')).filter(button => ["water_available", "z_last", "a_first"].includes(button.getAttribute("title") ?? ""));
  expect(buttons.map(button => button.getAttribute("title"))).toEqual(["water_available", "z_last", "a_first"]);
  const grouping = screen.getByRole("combobox", {name: /Disaggregate by/i}) as HTMLSelectElement;
  expect(Array.from(grouping.options).map(option => option.value)).toEqual(["", "water_available", "z_last", "a_first"]);
});

it("excludes historical stored fields outside the current Kobo form", async () => {
  const ordered = [fields[1], {...fields[0], label: "Current comments"}, {...fields[0], source_field: "legacy", source: "inferred", label: "Older answer"}];
  vi.mocked(apiClient.surveyFields).mockResolvedValue({project_id: "wash", form_id: "form", fields: ordered, forms: ["form"], locations: [], enumerators: []} as unknown as SurveyCatalogue);
  setup();
  await screen.findByRole("button", {name: /Current comments/});
  expect(screen.queryByText("Older stored fields (not in current form)")).toBeNull();
  expect(screen.queryByRole("button", {name: /Older answer/})).toBeNull();
  const grouping = screen.getByRole("combobox", {name: /Disaggregate by/i});
  expect(grouping.querySelector('option[value="additional_comments"]')?.textContent).toBe("Current comments");
  expect(grouping.querySelector('option[value="legacy"]')).toBeNull();
});

it("turns a Yes/No selection from a comment view into a doughnut plus category table", async () => {
  setup();
  await screen.findByRole("rowheader", {name: "Yes"});
  fireEvent.click(screen.getByRole("button", {name: /Additional comments TEXT/i}));
  await screen.findByRole("rowheader", {name: comment});
  fireEvent.change(screen.getByRole("combobox", {name: /Disaggregate by/i}), {target: {value: "water_available"}});
  expect(await screen.findByRole("img", {name: "pie responses"})).toBeTruthy();
  expect(screen.getByRole("rowheader", {name: "Yes"})).toBeTruthy();
  expect(screen.getByRole("rowheader", {name: "No"})).toBeTruthy();
  expect(screen.queryByRole("rowheader", {name: comment})).toBeNull();
  expect(screen.getByRole("combobox", {name: /Disaggregate by/i}).getAttribute("value") ?? (screen.getByRole("combobox", {name: /Disaggregate by/i}) as HTMLSelectElement).value).toBe("water_available");
  expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({source_field: "water_available", group_by: null}));
});

it("normalizes an older comments-grouped-by-water view without querying comment categories", async () => {
  const query: AnalysisQuery = {project_id: "wash", form_id: "form", source_field: "additional_comments", measure: "auto", group_by: "water_available", time_grain: "day", filters: {date_from: "2026-10-01", date_to: null, review_status: "ready", location: null, enumerator: null, categories: [comment]}};
  vi.mocked(apiClient.savedAnalyses).mockResolvedValue([{id: "old", title: "Older water view", chart: "table", query, created_at: "2026-10-28T00:00:00Z"}]);
  setup();
  await screen.findByRole("button", {name: "Saved visualizations (1)"});
  fireEvent.click(screen.getByRole("button", {name: "Saved visualizations (1)"}));
  fireEvent.click(screen.getByRole("button", {name: /^Older water view/}));
  expect(await screen.findByRole("img", {name: "pie responses"})).toBeTruthy();
  expect(screen.getByRole("rowheader", {name: "Yes"})).toBeTruthy();
  expect(screen.queryByRole("rowheader", {name: comment})).toBeNull();
  expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({source_field: "water_available", group_by: null, filters: expect.objectContaining({date_from: "2026-10-01", categories: []})}));
  expect(apiClient.queryAnalysis).not.toHaveBeenCalledWith(expect.objectContaining({source_field: "additional_comments", group_by: "water_available"}));
});

it("shows a doughnut and exact Yes/No table for every Yes/No question in the form", async () => {
  const questions = [
    ["water_available", "Is drinking water available today?"],
    ["water_point_working", "Is the water point working?"],
    ["toilet_available", "Is there a usable toilet or latrine?"],
    ["handwashing_available", "Is there a handwashing station?"],
    ["soap_available", "Is soap available at the station?"],
    ["wash_issue", "Was any WASH problem observed?"],
    ["followup_needed", "Is follow-up action needed?"],
  ];
  const formFields = questions.map(([source_field, label]) => ({...fields[1], source_field, label}));
  vi.mocked(apiClient.surveyFields).mockResolvedValue({project_id: "wash", form_id: "form", fields: formFields, forms: ["form"], locations: [], enumerators: []} as unknown as SurveyCatalogue);
  vi.mocked(apiClient.queryAnalysis).mockImplementation(async query => ({...answer({...query, source_field: "water_available"}), field: formFields.find(field => field.source_field === query.source_field)!}));
  setup();
  await screen.findByRole("rowheader", {name: "Yes"});
  for (const [source, label] of questions) {
    fireEvent.click(screen.getByRole("button", {name: label + " select one"}));
    await waitFor(() => expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({source_field: source, group_by: null})));
    expect(await screen.findByRole("img", {name: "pie responses"})).toBeTruthy();
    expect(screen.getByRole("rowheader", {name: "Yes"})).toBeTruthy();
    expect(screen.getByRole("rowheader", {name: "No"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Doughnut"}).getAttribute("aria-pressed")).toBe("true");
  }
});

it("puts Additional comments last without changing the order of the other Kobo questions", async () => {
  const ordered = [fields[0], fields[1], {...fields[0], source_field: "county", label: "County"}];
  vi.mocked(apiClient.surveyFields).mockResolvedValue({project_id: "wash", form_id: "form", fields: ordered, forms: ["form"], locations: [], enumerators: []} as unknown as SurveyCatalogue);
  setup();
  await screen.findByRole("button", {name: /County text/i});
  const buttons = Array.from(document.querySelectorAll('button[title]')).filter(button => ["additional_comments", "water_available", "county"].includes(button.getAttribute("title") ?? ""));
  expect(buttons.map(button => button.getAttribute("title"))).toEqual(["water_available", "county", "additional_comments"]);
});

it("loads metadata for a new current form without falling back to older fields", async () => {
  vi.mocked(apiClient.surveyFields).mockImplementation(async (_project, _form, refresh) => ({project_id: "wash", form_id: "form", forms: ["form"], fields: refresh ? [fields[1], fields[0]] : [], locations: [], enumerators: []} as unknown as SurveyCatalogue));
  setup();
  await screen.findByRole("rowheader", {name: "Yes"});
  expect(apiClient.surveyFields).toHaveBeenCalledWith("wash", "form", true);
});
it("retains the current form and retry control when metadata loading fails", async () => {
  vi.mocked(apiClient.surveyFields).mockImplementation(async (_project, _form, refresh) => {
    if (refresh) throw new Error("Current Kobo metadata unavailable");
    return {project_id: "wash", form_id: "form", forms: ["form"], fields: [], locations: [], enumerators: []} as unknown as SurveyCatalogue;
  });
  setup();
  expect(await screen.findByText(/Current Kobo metadata unavailable/)).toBeTruthy();
  expect(apiClient.queryAnalysis).not.toHaveBeenCalled();
  expect(screen.getByRole("button", {name: "Refresh Kobo fields"}).hasAttribute("disabled")).toBe(false);
});

it("opens the first Kobo question even when a Yes/No question comes later", async () => {
  const first = {...fields[0], source_field: "visit_date", label: "Date of monitoring visit", type: "date" as const};
  vi.mocked(apiClient.surveyFields).mockResolvedValue({project_id: "wash", form_id: "form", forms: ["form"], fields: [first, fields[1], fields[0]], locations: [], enumerators: []} as unknown as SurveyCatalogue);
  vi.mocked(apiClient.queryAnalysis).mockImplementation(async query => ({...answer({...query, source_field: "water_available"}), field: first, series: [{name: "2026-10-28", group: null, value: 1, count: 1, percent: 100}]}));
  setup();
  expect(await screen.findByRole("heading", {name: "Date of monitoring visit"})).toBeTruthy();
  await waitFor(() => expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({source_field: "visit_date", group_by: null})));
  expect(await screen.findByRole("img", {name: "line responses"})).toBeTruthy();
});

it("keeps the dropdown, heading, sidebar highlight and results on the selected question", async () => {
  const first = {...fields[0], source_field: "visit_date", label: "Date of monitoring visit", type: "date" as const};
  vi.mocked(apiClient.surveyFields).mockResolvedValue({project_id: "wash", form_id: "form", forms: ["form"], fields: [first, fields[1]], locations: [], enumerators: []} as unknown as SurveyCatalogue);
  vi.mocked(apiClient.queryAnalysis).mockImplementation(async query => ({...answer({...query, source_field: "water_available"}), field: query.source_field === "visit_date" ? first : fields[1]}));
  setup();
  const dateButton = await screen.findByRole("button", {name: /Date of monitoring visit DATE/i});
  expect(dateButton.getAttribute("aria-current")).toBe("true");
  fireEvent.change(screen.getByRole("combobox", {name: /Disaggregate by/i}), {target: {value: "water_available"}});
  expect(await screen.findByRole("heading", {name: "Is drinking water available today?"})).toBeTruthy();
  expect(screen.getByRole("button", {name: /Is drinking water available today.*select one/i}).getAttribute("aria-current")).toBe("true");
  expect(dateButton.getAttribute("aria-current")).toBeNull();
  expect((screen.getByRole("combobox", {name: /Disaggregate by/i}) as HTMLSelectElement).value).toBe("water_available");
  expect(await screen.findByRole("img", {name: "pie responses"})).toBeTruthy();
  expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({source_field: "water_available", group_by: null}));
});

it("provides compact filters, keeps filter values while collapsed, and clears them", async () => {
  setup();
  await screen.findByRole("rowheader", {name: "Yes"});
  fireEvent.click(screen.getByRole("button", {name: "Filters"}));
  expect(screen.getByRole("region", {name: "Survey filters"})).toBeTruthy();
  fireEvent.change(screen.getByLabelText("From"), {target: {value: "2026-10-01"}});
  fireEvent.change(screen.getByLabelText("To"), {target: {value: "2026-10-28"}});
  await waitFor(() => expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({filters: expect.objectContaining({date_from: "2026-10-01", date_to: "2026-10-28"})})));
  fireEvent.click(screen.getByRole("button", {name: "Filters"}));
  expect(screen.queryByRole("region", {name: "Survey filters"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Filters"}));
  expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-10-01");
  fireEvent.click(screen.getByRole("button", {name: "Clear all"}));
  expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("");
  await waitFor(() => expect(apiClient.queryAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({filters: expect.objectContaining({date_from: null, date_to: null, review_status: "ready"})})));
});
