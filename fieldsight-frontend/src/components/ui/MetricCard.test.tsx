// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Database } from "lucide-react";
import { MetricCard } from "./MetricCard";

afterEach(cleanup);

it("keeps zero values and descriptive status values available", () => {
  render(<><MetricCard label="Submissions" value={0} icon={Database} /><MetricCard label="Service" value="Unavailable" icon={Database} context="Retry the service check" /></>);
  expect(screen.getByText("0")).toBeTruthy();
  expect(screen.getByText("Unavailable")).toBeTruthy();
  expect(screen.getByText("Retry the service check")).toBeTruthy();
});

it("preserves the action of an interactive KPI", () => {
  const open = vi.fn();
  render(<MetricCard label="Submissions" value={31} icon={Database} onClick={open} />);
  fireEvent.click(screen.getByRole("button", { name: "Submissions 31" }));
  expect(open).toHaveBeenCalledOnce();
});

it("preserves project-scoped navigation without exposing decorative icons", () => {
  render(<MemoryRouter><MetricCard label="Enumerators" value={2} icon={Database} to="/projects/school/team" title="Open field team" /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Enumerators 2" }).getAttribute("href")).toBe("/projects/school/team");
  expect(screen.queryByRole("img")).toBeNull();
});
