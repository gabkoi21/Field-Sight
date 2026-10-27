// A roster and reporting schedule are required before completeness can be computed.
export type ReportingCompleteness =
  | { state: "unavailable"; reason: string }
  | { state: "available"; rosterId: string; scheduleId: string; expected: number; received: number };

export const reportingCompleteness: ReportingCompleteness = {
  state: "unavailable",
  reason: "A school roster and reporting schedule are required before expected or missing reports can be calculated.",
};
