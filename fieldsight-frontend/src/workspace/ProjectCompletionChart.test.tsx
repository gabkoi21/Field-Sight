// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProjectCompletionChart } from "./ProjectCompletionChart";
afterEach(cleanup);
it.each(["active", "draft", "paused", "in_review", "archived", "completed"])("uses the selected project's %s status", status => {
  render(<ProjectCompletionChart project={{ name: "School feeding", status }} />);
  expect(screen.getByRole("img").getAttribute("aria-label")).toBe(`School feeding: ${status === "completed" ? "Completed" : "Not completed"}. Saved project status: ${status.replaceAll("_", " ")}.`);
  expect(screen.getByText("100.0%")).toBeTruthy();
  expect(screen.getByText("0.0%")).toBeTruthy();
  expect(screen.queryByText(/All organization projects/)).toBeNull();
});
it("updates when the selected project changes", () => {
  const { rerender } = render(<ProjectCompletionChart project={{ name: "Project A", status: "completed" }} />);
  rerender(<ProjectCompletionChart project={{ name: "Project B", status: "active" }} />);
  expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Project B: Not completed. Saved project status: active.");
  expect(screen.queryByText(/Project A/)).toBeNull();
});
