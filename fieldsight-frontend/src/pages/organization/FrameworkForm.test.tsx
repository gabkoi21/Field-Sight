// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FrameworkForm } from "./IndicatorForms";
import type { FrameworkNode } from "../../services/apiClient";

afterEach(cleanup);

it("opens a child result form and saves the chosen parent and next level", () => {
  const onSave = vi.fn();
  const parent: FrameworkNode = {
    id: "outcome", project_id: "project", title: "Better health",
    node_type: "outcome", parent_id: null, sort_order: 0, created_at: "2026-10-25",
  };
  render(<FrameworkForm node={null} parentId={parent.id} nodes={[parent]} error="" saving={false} onClose={vi.fn()} onSave={onSave} />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.queryByText(/Active for reporting/)).toBeNull();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Health visits  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave).toHaveBeenCalledWith({ title: "Health visits", node_type: "output", parent_id: "outcome", sort_order: 0 });
});
