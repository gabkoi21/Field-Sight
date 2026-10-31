// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteConfirmation } from "./DeleteConfirmation";
afterEach(cleanup);
function setup(onConfirm = vi.fn(), onClose = vi.fn()) {
  render(<DeleteConfirmation title="Delete Project" name="FieldSight" phrase="delete my project" description="Permanently delete this project and its records." actionLabel="Delete Project" onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
}
function typeConfirmation() {
  fireEvent.change(screen.getByLabelText('To confirm, type “FieldSight”'), { target: { value: "FieldSight" } });
  fireEvent.change(screen.getByLabelText('To confirm, type “delete my project”'), { target: { value: "delete my project" } });
}
it("requires both exact confirmations before invoking deletion", async () => {
  const { onConfirm, onClose } = setup();
  const submit = screen.getByRole("button", { name: "Delete Project" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.blur(screen.getByLabelText('To confirm, type “FieldSight”'));
  expect(screen.getByText(/exactly is required/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('To confirm, type “FieldSight”'), { target: { value: "FieldSight" } });
  expect(submit.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('To confirm, type “delete my project”'), { target: { value: "delete my project" } });
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onConfirm).toHaveBeenCalledOnce();
});
it("supports cancellation without performing deletion", () => {
  const { onConfirm, onClose } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});
it("retains entered confirmations and shows a failed request for retry", async () => {
  const onConfirm = vi.fn().mockRejectedValueOnce(new Error("Request failed")).mockResolvedValueOnce(undefined);
  const { onClose } = setup(onConfirm);
  typeConfirmation();
  fireEvent.click(screen.getByRole("button", { name: "Delete Project" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Request failed");
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete Project" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});
it("prevents duplicate submission and dismissal while a request is pending", async () => {
  let finish!: () => void;
  const { onConfirm, onClose } = setup(vi.fn(() => new Promise<void>(resolve => { finish = resolve; })));
  typeConfirmation();
  fireEvent.click(screen.getByRole("button", { name: "Delete Project" }));
  expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  expect(onConfirm).toHaveBeenCalledOnce();
  finish();
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});
