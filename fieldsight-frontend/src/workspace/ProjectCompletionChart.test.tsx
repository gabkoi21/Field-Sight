// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProjectCompletionChart } from "./ProjectCompletionChart";
afterEach(cleanup);
it.each(["active", "draft", "paused", "in_review", "archived", "completed"])("highlights only the saved %s state without fabricated completion", status => {
  render(<ProjectCompletionChart project={{ name: "School feeding", status }} />);
  const panel = screen.getByRole("region", { name: "Project status" });
  expect(within(panel).getByRole("img").getAttribute("aria-label")).toContain(`Project status: ${status === "in_review" ? "In review" : status[0].toUpperCase() + status.slice(1)}.`);
  const selected = panel.querySelectorAll('[aria-current="true"]');
  expect(selected).toHaveLength(["active", "completed"].includes(status) ? 1 : 0);
  if (selected.length) expect(selected[0].textContent).toContain("Current");
  expect(within(panel).getByRole("list", { name: "Project lifecycle states" }).children).toHaveLength(2);
  expect(within(panel).queryByText(/%/)).toBeNull();
});
it("updates the highlighted state when the selected project changes", () => {
  const { rerender } = render(<ProjectCompletionChart project={{ name: "Project A", status: "completed" }} />);
  rerender(<ProjectCompletionChart project={{ name: "Project B", status: "active" }} />);
  expect(screen.getByText("Project B")).toBeTruthy();
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Project status: Active.");
  expect(screen.getByRole("list", { name: "Project lifecycle states" }).querySelector('[aria-current="true"]')?.textContent).toContain("Active");
  expect(screen.queryByText("Project A")).toBeNull();
});
