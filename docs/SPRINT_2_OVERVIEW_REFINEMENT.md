# Sprint 2 — Overview refinement

Retained the project header, shared MetricCard visuals, project-scoped collection
trend and all-dates review breakdown. Four cards show submissions, connected forms,
awaiting review and active indicators; source-linked cards navigate to the relevant
screen. Review legend includes the exact status filter introduced in Sprint 1.

ProjectCompletionChart now renders Project status as saved lifecycle text, without
rings or invented 0/100 percentages. ProjectTimeline explicitly labels time elapsed
in the planned period, never work/target completion. The Needs attention panel
shows genuine review backlog, the latest source sync outcome, last successful UTC
sync, unavailable scheduled worker and overdue indicator counts. Query failures
remain unknown; the page never infers an all-clear or school reporting completeness.

No backend calculation or persistence changes. Existing dates, no-source,
no-indicator, undated submission, unauthorized project, archived and error states
remain supported. Collection period and all-date review labels remain distinct.

Verification: ProjectWorkspacePage 16 tests passed and ProjectCompletionChart 7
status tests. Production build outcome is recorded below and in the final report.
The first attempted test run encountered a temporary source-write encoding failure;
the committed source was restored, UTF-8 edits reapplied, and verification rerun.
No failed checks are counted as successful results.

Manual viewport/keyboard checklist (browser verification recorded in final report):
- Desktop 1440px: header, four cards, chart labels and attention links remain readable.
- Tablet 768px: cards reflow, panels retain readable headings and state labels.
- Mobile 375px: no page-level horizontal overflow, text wraps, controls remain reachable.
- Tab through links, chart period buttons, refresh and sync; visible focus remains.
- Open each review legend link; project and status match destination filters.
- API failure must show a retry/unknown state rather than zero or all-clear.
- Archived project disables synchronization; historical summaries remain readable.

Screenshots must come from the running app; no generated mockups substitute for
browser validation. Human NGO usability acceptance remains Sprint 4 external work.

Final Sprint 2: 23 tests passed (35.54s), production build passed (40.41s), git diff whitespace check passed. Backend unchanged from Sprint 1 full regression.
