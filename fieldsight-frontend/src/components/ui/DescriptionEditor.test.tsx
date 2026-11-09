// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DescriptionEditor, descriptionMarkup } from "./DescriptionEditor";

afterEach(cleanup);
it("allows HTTPS images for widgets while removing unsafe image URLs and handlers", () => {
  const html = descriptionMarkup('<img src="https://example.com/chart.png" onerror="alert(1)"><img src="javascript:alert(1)">', true);
  expect(html).toContain('src="https://example.com/chart.png"');
  expect(html).not.toMatch(/onerror|javascript/);
});
it("saves only images in image-only mode", () => {
  const change = vi.fn();
  render(<DescriptionEditor value="" onChange={change} disabled={false} allowImages imageOnly />);
  fireEvent.input(screen.getByRole("textbox"), { target: { innerHTML: 'Discard text<img src="https://example.com/chart.png">' } });
  expect(change).toHaveBeenCalledWith('<img src="https://example.com/chart.png" alt="">');
});
it("preserves safe formatting and removes executable markup and unsafe links", () => {
  const html = descriptionMarkup('<p onclick="alert(1)"><b>Safe</b><script>alert(1)</script><a href="javascript:alert(1)">link</a><img src=x onerror=alert(1)></p>');
  expect(html).toContain("<b>Safe</b>");
  expect(html).not.toMatch(/onclick|script|javascript|onerror|<img/);
  expect(descriptionMarkup("Plain < text\nSecond line")).toBe("Plain &lt; text<br>Second line");
});
it("locks the editor and hides formatting when read-only", () => {
  render(<DescriptionEditor value="Saved description" onChange={vi.fn()} disabled />);
  expect(screen.getByRole("textbox").getAttribute("contenteditable")).toBe("false");
  expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
});
it("sends formatted input to the save handler and restores the saved value on cancel", () => {
  const change = vi.fn();
  const view = render(<DescriptionEditor value="Original" onChange={change} disabled={false} />);
  const editor = screen.getByRole("textbox");
  editor.innerHTML = "<b>Updated</b>";
  fireEvent.input(editor);
  expect(change).toHaveBeenCalledWith("<b>Updated</b>");
  view.rerender(<DescriptionEditor value="Original" onChange={change} disabled />);
  expect(editor.textContent).toBe("Original");
});
