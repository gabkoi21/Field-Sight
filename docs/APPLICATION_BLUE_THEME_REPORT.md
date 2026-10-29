# Application-wide blue UI theme

Implemented on `dev`, 2026-10-28.

Shared theme tokens now define primary blue, blue soft surfaces, blue accent borders and informational text. KPI values use the neutral application text color; KPI icons use primary blue with a pale blue surface. Native checkboxes and radio buttons also use the primary accent.

Replaced remaining nonsemantic teal UI accents across project lists, team management, data tables, form workflows, indicator editors and tabs, dashboards, organization/profile settings, onboarding, platform settings and shared notices. Updated framework connector and child-action controls. Semantic success/error/warning indicators and categorical chart colors were deliberately preserved, including green No and blue Yes survey responses.

Verification:

- Complete frontend suite: 165 tests passed in 30 files.
- Final TypeScript/production build: passed (existing bundle-size advisory only).
- `git diff --check`: passed.
- Browser checks in a disposable local workspace: project overview, quick-start guide and organization settings inspected.
- Browser computed styles confirmed shared KPI icons and organization links use `rgb(11, 81, 183)`; KPI values use neutral `rgb(36, 51, 74)`.
- Temporary verification servers and browser tab were closed. Existing application services and project data were not modified.

Evidence: `tmp/blue-theme-verification/overview.jpg`, `guide.jpg`, `settings.jpg`. Test/build logs: `tmp/application-blue-theme-tests.txt` and `tmp/application-blue-theme-final-build.txt`.

No new dependencies, backend behavior changes, deployment or merge into main.
