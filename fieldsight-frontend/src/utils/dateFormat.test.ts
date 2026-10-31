import { expect, it } from "vitest";
import { formatDate, formatDateTime, formatDateValue } from "./dateFormat";

it("formats dates consistently without shifting date-only answers", () => {
  expect(formatDate("2026-10-31")).toBe("31 Oct 2026");
  expect(formatDateValue("2026-01-05")).toBe("05 Jan 2026");
  expect(formatDateTime("2026-10-31T14:30:00Z")).toBe("31 Oct 2026, 14:30 UTC");
});
it("preserves ordinary survey answers and handles invalid dates", () => {
  expect(formatDateValue("School visit")).toBe("School visit");
  expect(formatDateValue("2026-99-99")).toBe("2026-99-99");
  expect(formatDate("invalid")).toBe("—");
});
