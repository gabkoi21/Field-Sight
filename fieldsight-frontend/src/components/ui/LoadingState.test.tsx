// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoadingState } from "./LoadingState";
import { LoadingSkeleton } from "./LoadingSkeleton";

afterEach(cleanup);
it("announces a contextual initial load while hiding decorative geometry", () => {
  const { container } = render(<LoadingState variant="panel" label="Loading project sites…" />);
  expect(screen.getByRole("status").textContent).toContain("Loading project sites…");
  expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
});
it("keeps background refresh indicators out of repeated live announcements", () => {
  render(<LoadingState variant="inline" label="Updating projects…" />);
  expect(screen.getByText("Updating projects…")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});
it("gives skeletons one accessible label without exposing placeholder values", () => {
  const { container } = render(<LoadingSkeleton layout="dashboard" label="Preparing dashboard…" />);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toBe("Preparing dashboard…");
  expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("");
});
