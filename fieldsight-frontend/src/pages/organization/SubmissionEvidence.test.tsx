// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { displayEvidence, flaggedValue, SubmissionEvidence } from "./SubmissionEvidence";

afterEach(cleanup);

it("shows flagged answers beyond ten fields and readable labels with raw paths", () => {
  const answers = Object.fromEntries(Array.from({ length: 15 }, (_, index) => [`q${index}`, index]));
  render(<SubmissionEvidence answers={{ ...answers, gps: "flagged evidence" }} field="gps" fields={[{ source_field: "gps", label: "Interview coordinates", type: "geopoint", choices: [], source: "kobo", supported: true }]} loading={false} error={false} />);
  expect(screen.getByLabelText("Flagged answer").textContent).toContain("flagged evidence");
  expect(screen.getByLabelText("Flagged answer").textContent).toContain("Interview coordinates");
  const summary = screen.getByText(/All submission answers/);
  fireEvent.click(summary);
  expect(summary.closest("details")).toHaveProperty("open", true);
  expect(screen.getAllByText("gps").length).toBe(2);
});

it("resolves flat Kobo paths, nested fields, explicit repeat indexes and repeat groups", () => {
  const answers = { group: { gps: false }, households: [{ age: 0 }, { age: "" }] };
  expect(flaggedValue(answers, "group/gps")).toBe(false);
  expect(flaggedValue(answers, "households/age")).toEqual([0, ""]);
  expect(flaggedValue(answers, "households[0].age")).toBe(0);
  expect(flaggedValue({ "group/gps": "flat" }, "group/gps")).toBe("flat");
  expect(displayEvidence(flaggedValue({ repeats: [{ age: null }, {}] }, "repeats/age"))).toBe('[\n  null,\n  "Missing field"\n]');
  render(<SubmissionEvidence answers={answers} field="group/gps" loading={false} error={false} />);
  expect(screen.getByLabelText("Flagged answer").textContent).toContain("false");
});

it("distinguishes missing, null, empty, zero and false and handles long text", () => {
  expect([undefined, null, "", 0, false, [], {}].map(displayEvidence)).toEqual([
    "Missing field", "No value (null)", "Empty response", "0", "false", "Empty array", "Empty object",
  ]);
  const long = "unbroken".repeat(1000);
  render(<SubmissionEvidence answers={{ note: long }} field="note" loading={false} error={false} />);
  expect(screen.getAllByText(long).length).toBe(2);
});

it("shows explicit loading and error states", () => {
  const view = render(<SubmissionEvidence loading error={false} />);
  expect(screen.getByRole("status").textContent).toContain("Loading");
  view.rerender(<SubmissionEvidence loading={false} error />);
  expect(screen.getByRole("alert").textContent).toContain("Unable to load");
});
