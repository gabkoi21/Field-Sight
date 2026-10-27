// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProjectCompletionChart } from "./ProjectCompletionChart";
afterEach(cleanup);
it.each(["active", "draft", "paused", "in_review", "archived", "completed"])("shows saved %s state without fabricated completion", status => {
  render(<ProjectCompletionChart project={{ name: "School feeding", status }} />);
  const panel = screen.getByRole("region", { name: "Project status" });
  expect(within(panel).getByText(status.replaceAll("_", " "))).toBeTruthy();
  expect(within(panel).queryByRole("img")).toBeNull();
  expect(within(panel).queryByText(/%/)).toBeNull();
});
it("updates when the selected project changes", () => {
  const { rerender } = render(<ProjectCompletionChart project={{ name: "Project A", status: "completed" }} />);
  rerender(<ProjectCompletionChart project={{ name: "Project B", status: "active" }} />);
  expect(screen.getByText("Project B")).toBeTruthy();
  expect(screen.getByText("active")).toBeTruthy();
  expect(screen.queryByText("Project A")).toBeNull();
});
