const dateOptions: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" };

export function formatDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", dateOptions).format(date);
}

export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date)}, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date)} UTC`;
}

// Only recognize complete ISO dates, preserving ordinary answer text and identifiers.
export function formatDateValue(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}.*)?$/.test(value) && !Number.isNaN(Date.parse(value))) {
    return value.includes("T") ? formatDateTime(value) : formatDate(value);
  }
  return String(value);
}
