# Sprint 4 — UAT checklist and evidence

Actual practitioner UAT: PENDING EXTERNAL VALIDATION. No interviews were conducted.
Automated tests and an agent-operated synthetic browser exercise are separate
from usability acceptance by an NGO project officer and M&E professional.

## Session script

Recruit one project officer and one M&E professional. Explain that this is a
synthetic test, obtain consent for observations, and record role/date/environment
without collecting unnecessary personal data. Give each participant the following
tasks unaided; do not explain navigation until they finish or request help.

1. Select the school-feeding project. Explain its saved status and timeline.
2. Find the latest sync outcome and explain whether new evidence is available.
3. Find a pending record, inspect the complete answers, approve/reject with reason.
4. Configure/map a portions indicator, explain target versus actual and missing data.
5. Explain submissions versus eligible results and the effect of invalid evidence.
6. Create/assign a shortage follow-up and record resolution plus verification.
7. Generate a named-period report and explain figures and limitations.
8. Switch projects and demonstrate where the first project's actions went.

For each task record: attempted/completed/assisted/failed, time, wrong turns,
confusion, errors, participant quote (with consent), suggested change and severity.
Use a fresh fixture per participant, keep an anonymized evidence reference and
assign each finding an owner. Repeat failed tasks after fixes. Sign-off requires
both roles' evidence and a decision from the designated NGO pilot owner.

| Role | Session date | Environment | Unaided task results | Findings | Sign-off |
|---|---|---|---|---|---|
| Project officer | Pending | Pending | Pending | Pending | Pending |
| M&E professional | Pending | Pending | Pending | Pending | Pending |

## Validation actually performed on 2026-10-27

- Authenticated the synthetic officer through the real browser login and cookie
  session, then opened Projects and the School Feeding Overview.
- Overview displayed six saved records, six pending, one source and three indicators.
- Verified responsive page widths: 1440 viewport / 1425 document; 768 / 753;
  375 / 360. No page-level horizontal overflow. Action page at 375 / 360 also fit.
- Tab from Refresh overview moved to Edit project with a solid focus outline.
  Enter on the review legend opened the exact project + needs_review filter.
- Opened SYNTHETIC-1 by keyboard; expanded answers, saved Ready with notes and
  saw persisted review history. Browser fixture now has one Ready and five pending;
  this differs intentionally from the independent six-record reconciliation test.
- Follow-up link preserved the exact submission ID. Created a high-priority action
  assigned to the synthetic collector, moved In progress, entered a past due date
  with native keyboard input, and observed one overdue action.
- Resolved with a summary and closed with a verification note; reload preserved
  Closed and five audit events (create, progress, due edit, resolve, close).
- Switched to the other project: the register was empty. Tenant/role denial and
  concurrency were verified by API tests, not impersonated browser sessions.
- CUA native date fill alone did not commit a React change; a native ArrowDown
  edit committed 2026-09-26, verified in the persisted action and overdue summary.
  This automation detail is not evidence of a manual user usability failure.

Actual app screenshots (synthetic environment, not mockups):

- [Desktop Overview](verification/pilot-overview-desktop.jpg)
- [Tablet Overview](verification/pilot-overview-tablet.jpg)
- [Mobile Overview](verification/pilot-overview-mobile.jpg)
- [Submission review](verification/pilot-submission-review.jpg)
- [Mobile actions](verification/pilot-actions-mobile.jpg)
- [Closed action and audit](verification/pilot-action-audit.jpg)
- [Other project empty](verification/pilot-other-project-empty.jpg)

Pending: practitioner sessions; live Kobo credentials/provider smoke; hosted
Vercel/backend/worker validation; PostgreSQL execution; assistive technology testing
with actual screen readers. Visible focus and DOM semantics are verified locally,
not a complete accessibility conformance audit.

Temporary test servers were stopped after verification. All persistent changes in
the browser exercise belong only to the disposable synthetic database.
