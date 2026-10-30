// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProjectCompletionChart } from "./ProjectCompletionChart";
afterEach(cleanup);
it.each(["active", "draft", "paused", "in_review", "archived", "completed"])("shows saved %s status separately from people and records", status => {
  render(<ProjectCompletionChart project={{ name: "School feeding", status }} enumerators={2} collected={123} />);
  const panel = screen.getByRole("region", { name: "Project status" });
  const saved = status === "in_review" ? "In review" : status[0].toUpperCase() + status.slice(1);
  expect(within(panel).getByRole("img").getAttribute("aria-label")).toContain(`Project status: ${saved}.`);
  expect(panel.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  expect(within(panel).getByRole("list").children).toHaveLength(3);
  expect(screen.getByText("Enumerators").closest("li")?.textContent).toContain("2 assigned");
  expect(screen.getByText("Data collected so far").closest("li")?.textContent).toContain("123 records");
  expect(within(panel).queryByText(/%/)).toBeNull();
});
it("updates the saved state when the selected project changes", () => {
  const { rerender } = render(<ProjectCompletionChart project={{ name: "Project A", status: "completed" }} />);
  rerender(<ProjectCompletionChart project={{ name: "Project B", status: "active" }} />);
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Project status: Active.");
  expect(screen.getByRole("list").querySelector('[aria-current="true"]')?.textContent).toContain("Not completed");
});
it("distinguishes unavailable and loading counts from a genuine zero and supports retry", () => {
  const retry = vi.fn();
  const { rerender } = render(<ProjectCompletionChart project={{ name: "A", status: "active" }} teamError retryTeam={retry} dataLoading />);
  expect(screen.getByText("Enumerators").closest("li")?.textContent).toContain("Unavailable");
  expect(screen.getByText("Data collected so far").closest("li")?.textContent).toContain("Loading");
  fireEvent.click(screen.getByRole("button", { name: "Retry enumerators" }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<ProjectCompletionChart project={{ name: "A", status: "active" }} enumerators={0} collected={0} />);
  expect(screen.getByText("Enumerators").closest("li")?.textContent).toContain("0 assigned");
  expect(screen.getByText("Data collected so far").closest("li")?.textContent).toContain("0 records");
});


it.each(["draft", "active", "in_review", "paused", "archived"])("keeps completed at zero for %s and draws a visible status color", status => {
  const { rerender } = render(<ProjectCompletionChart project={{ name: "A", status }} />);
  expect(screen.getByText("Not completed", { selector: "li > span" }).closest("li")?.textContent).toContain("0 project");
  expect(screen.getByText("Not completed yet")).toBeTruthy();
  expect(screen.queryByText("In Progress")).toBeNull();
  const ring = screen.getByRole("img").querySelector("circle[data-status]");
  expect(ring?.getAttribute("stroke")).toMatch(/^#[0-9a-f]{6}$/);
  expect(ring?.getAttribute("stroke-width")).toBe("16");
  rerender(<ProjectCompletionChart project={{ name: "A", status: "completed" }} />);
  expect(screen.getByText("Completed", { selector: "li > span" }).closest("li")?.textContent).toContain("1 project");
  expect(screen.queryByText("Not completed yet")).toBeNull();
  expect(screen.getByRole("img").querySelector("circle[data-status]")?.getAttribute("stroke")).toBe("#16a34a");
});
