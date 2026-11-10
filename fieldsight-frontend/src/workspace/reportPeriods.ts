export type PeriodKind = "monthly" | "quarterly" | "semiannual" | "annual" | "custom";

/** Calendar boundaries are UTC, matching authoritative indicator period keys. */
export function reportPeriod(kind: Exclude<PeriodKind, "custom">, year: number, part: number): [string, string] {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new Error("Choose a valid year.");
  const months = kind === "annual" ? 12 : kind === "semiannual" ? 6 : kind === "quarterly" ? 3 : 1;
  if (!Number.isInteger(part) || part < 1 || part > 12 / months) throw new Error("Choose a valid period.");
  const startMonth = (part - 1) * months;
  const date = new Date(0);
  date.setUTCFullYear(year, startMonth + months, 0);
  return [`${String(year).padStart(4, "0")}-${String(startMonth + 1).padStart(2, "0")}-01`,
    `${String(year).padStart(4, "0")}-${String(startMonth + months).padStart(2, "0")}-${date.getUTCDate()}`];
}
