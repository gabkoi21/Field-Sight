// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SurveyResultChart, SurveyResultsTable, conciseLabel, effectiveSurveyChart, surveyChartData, surveyChartTypes, surveyCategoryColor } from "./SurveyResultChart";
import type { AnalysisResult } from "../../services/apiClient";
vi.mock("recharts", () => ({
  ResponsiveContainer: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
  PieChart: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
  Pie: ({data, children, innerRadius}: {data: unknown[]; children: React.ReactNode; innerRadius: string}) => <div data-testid="pie" data-slices={data.length} data-inner-radius={innerRadius}>{children}</div>,
  Cell: () => null, Tooltip: () => null,
  BarChart: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
  LineChart: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
  Bar: () => null, Line: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
}));
afterEach(cleanup);
export const result = {
  project_id: "wash", field: {source_field: "water_available", label: "Is drinking water available today?", type: "select_one", choices: [{value: "yes", label: "Yes"}, {value: "no", label: "No"}]},
  measure: "count", group_by: null, answered_records: 1, denominator: 1, eligible_records: 1,
  series: [{name: "No", group: null, count: 0, value: 0, percent: 0}, {name: "Yes", group: null, count: 1, value: 1, percent: 100}],
} as AnalysisResult;
it("uses response labels and exact API counts and percentages, excluding zero slices", () => {
  render(<><SurveyResultChart result={result} chart="pie" /><SurveyResultsTable result={result} /></>);
  expect(screen.getByTestId("pie").getAttribute("data-slices")).toBe("1");
  expect(screen.getByRole("rowheader", {name: "Yes"})).toBeTruthy();
  expect(screen.getByRole("rowheader", {name: "No"})).toBeTruthy();
  expect(screen.getByRole("table").textContent).toContain("100%");
  expect(surveyChartData(result).map(row => row.label)).toEqual(["No", "Yes"]);
});
it("supports Bar/Pie/Table switching and preserves old Donut with numeric and multi-select fallbacks", () => {
  expect(surveyChartTypes(result.field, null)).toEqual(["bar", "pie", "table"]);
  const view = render(<SurveyResultChart result={result} chart="bar" />);
  expect(screen.queryByTestId("pie")).toBeNull();
  view.rerender(<SurveyResultChart result={result} chart="pie" />);
  expect(screen.getByTestId("pie")).toBeTruthy();
  view.rerender(<SurveyResultChart result={result} chart="table" />);
  expect(screen.getByRole("table")).toBeTruthy();
  expect(effectiveSurveyChart(result, "donut")).toBe("donut");
  for (const type of ["number", "select_multiple", "date", "geopoint"] as const) expect(effectiveSurveyChart({...result, field: {...result.field, type}}, "pie")).toBe("bar");
  expect(effectiveSurveyChart({...result, group_by: "county"}, "pie")).toBe("bar");
});
it("preserves full long labels and explicitly identifies an additional grouping dimension", () => {
  const comment = "Drinking water is available, and the hand pump is functioning properly...";
  const grouped = {...result, group_by: "water_available", series: [{name: comment, group: "Yes", count: 1, value: 1, percent: 100}]};
  expect(surveyChartData(grouped)[0].label).toBe(comment + " / Group: Yes");
  expect(conciseLabel(comment).length).toBeLessThanOrEqual(30);
  render(<SurveyResultsTable result={grouped} />);
  expect(screen.getByRole("rowheader", {name: comment})).toBeTruthy();
});
it("shows no-data state without manufacturing a slice or percent", () => {
  render(<SurveyResultChart result={{...result, answered_records: 0, denominator: 0, series: []}} chart="pie" />);
  expect(screen.getByRole("status").textContent).toContain("No usable answers");
  expect(screen.queryByTestId("pie")).toBeNull();
});
it("uses the API denominator rather than renormalizing category percentages", () => {
  const multiple = {...result, answered_records: 4, denominator: 4, series: [{name: "A", group: null, count: 1, value: 1, percent: 25}, {name: "B", group: null, count: 3, value: 3, percent: 75}, {name: "C", group: null, count: 0, value: 0, percent: 0}]};
  render(<><SurveyResultChart result={multiple} chart="pie" /><SurveyResultsTable result={multiple} /></>);
  expect(screen.getByTestId("pie").getAttribute("data-slices")).toBe("2");
  expect(screen.getByRole("table").textContent).toContain("75%");
  expect(screen.getByLabelText("Response legend").textContent).not.toContain("75%");
});

it("keeps free-text comments in the table instead of creating comment slices", () => {
  const text = {...result, field: {...result.field, type: "text" as const}};
  expect(surveyChartTypes(text.field, null)).toEqual(["table"]);
  expect(effectiveSurveyChart(text, "pie")).toBe("table");
  expect(effectiveSurveyChart(text, "donut")).toBe("table");
  render(<SurveyResultChart result={text} chart="pie" />);
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.queryByTestId("pie")).toBeNull();
});

it("uses the reference doughnut style with consistent Yes/No colors", () => {
  render(<SurveyResultChart result={result} chart="pie" />);
  expect(screen.getByTestId("pie").getAttribute("data-inner-radius")).toBe("42%");
  expect(surveyCategoryColor(result, "Yes", 0)).toBe("#245493");
  expect(surveyCategoryColor(result, "No", 1)).toBe("#38843f");
});

it("shows only response labels in the doughnut legend", () => {
  render(<SurveyResultChart result={result} chart="pie" />);
  expect(screen.getByLabelText("Response legend").textContent).toBe("NoYes");
});

it("collapses long narrative responses into a short expandable preview", () => {
  const comment = "Drinking water is available, and the hand pump is functioning properly. However, follow-up is required to address sanitation and hygiene gaps.";
  render(<SurveyResultsTable result={{...result, series: [{name: comment, group: null, value: 1, count: 1, percent: 100}]}} />);
  const row = screen.getByRole("rowheader", {name: comment});
  const details = row.querySelector("details")!;
  expect(details.hasAttribute("open")).toBe(false);
  expect(row.querySelector("summary")!.textContent!.length).toBeLessThan(comment.length);
  expect(row.querySelector("p")!.textContent).toBe(comment);
});
