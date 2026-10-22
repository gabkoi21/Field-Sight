import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Search,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Page, Panel, fieldClass } from "./WorkspaceUI";
import { useWorkspace } from "./WorkspaceContext";

const chapters = [
  {
    id: "welcome",
    title: "Welcome to FieldSight",
    summary: "Move from field evidence to measurable results.",
    body: "FieldSight brings your project team, survey tables, indicator plan and results together. Start with a project, define what success means, then bring in your data and report your progress.",
    steps: [
      "Open a project from the Projects page. Your selection follows you between screens.",
      "Use Indicators for your monitoring plan, Data tables for evidence, and Dashboards for reporting.",
      "Keep collection activity separate from outcome measures: a submitted form is evidence, not automatically an achieved outcome.",
    ],
    action: "Explore projects",
    to: "/projects",
  },
  {
    id: "account",
    title: "Login and account setup",
    summary: "Set your profile, password and landing page.",
    body: "Sign in with the email or username on your FieldSight account. Open your user menu to manage your profile and security settings.",
    steps: [
      "Ask an organization administrator for an invitation if you do not yet have an account.",
      "Open your invitation link, enter your name and choose your own password. Organization administrators can then sign in to this portal; field staff collect through KoboToolbox.",
      "Choose a landing page under Profile & security. Change your password there using your current password.",
    ],
    action: "Open profile & security",
    to: "/profile",
  },
  {
    id: "workspaces",
    title: "Understanding projects",
    summary: "One home for a project, programme or country package.",
    body: "A FieldSight project brings together its results framework, indicator plan, source tables and team assignments. Organization administrators can manage every project in their organization.",
    steps: [
      "Open Projects and choose a project from the list to switch context.",
      "Keep related forms, indicators and reporting targets within the same project.",
      "Each project keeps its own data and reporting targets together.",
    ],
    action: "View projects",
    to: "/projects",
  },
  {
    id: "invite",
    title: "Invite new users",
    summary: "Give colleagues a secure account setup link.",
    body: "Open Team & invitations, choose Invite member, and enter an email address and organization role. FieldSight creates a one-time invitation valid for seven days.",
    steps: [
      "Use Field team member for collection staff, or Organization administrator for organization-wide management.",
      "Copy the generated invitation link and share it with the intended colleague. Local development does not send invitation email.",
      "Pending links can be revoked. Reissuing an invitation invalidates the earlier link.",
    ],
    action: "Invite a colleague",
    to: "/team",
  },
  {
    id: "create",
    title: "Create a project",
    summary: "Start with a name, sector and project dates.",
    body: "Projects organize the work you intend to monitor. Use Add project, enter a name and dates, and select one of your organization's enabled sectors.",
    steps: [
      "Choose a short, recognizable project name.",
      "Set the start and end date, and add a description to explain the scope.",
      "Save the project, then open Details, Team or Indicators to continue.",
    ],
    action: "Create a project",
    to: "/projects",
  },
  {
    id: "add-team",
    title: "Add project team members",
    summary: "Assign existing field staff to a project.",
    body: "Invite colleagues to the organization first. After they accept, use the Project team tab to assign active field members to the selected project.",
    steps: [
      "Open the relevant project from the Projects page.",
      "Open Team & invitations → Project team, then choose an active field member.",
      "Organization administrators already have access to every project. Field access uses FieldSight's existing collection assignments.",
    ],
    action: "Open project team",
    to: "/team?scope=workspace",
  },
  {
    id: "permissions",
    title: "Manage team members",
    summary: "Review roles and enable or deactivate access.",
    body: "FieldSight retains its existing Organization administrator and Field team member roles. Use the organization team list to change roles or deactivate membership; use project assignments to manage field collection access.",
    steps: [
      "Organization administrators manage organization data, connections and team settings.",
      "Field team members collect through KoboToolbox. This FieldSight portal remains administrator-only; an invitation does not create a Kobo account.",
      "You cannot remove your own administrator access. Ask another administrator to make that change.",
    ],
    action: "Manage organization access",
    to: "/team",
  },
  {
    id: "indicators",
    title: "Add indicators",
    summary: "Start simply, then configure the detail.",
    body: "Open Indicators and choose Add indicator. Enter its name and choose Numeric, Percentage or Qualitative only. You can add the rest of the definition afterward.",
    steps: [
      "Use Edit to add a baseline, overall target, deadline, reporting frequency and framework group.",
      "For numeric indicators, select a question and calculation using Link data table.",
      "For qualitative indicators, add a dated narrative under Collected data. Open the name to see details and results.",
    ],
    action: "Build your indicator plan",
    to: "/indicators",
  },
  {
    id: "framework",
    title: "Add a results framework",
    summary: "Organize your plan into goals, outcomes and outputs.",
    body: "Open Indicators → Results framework and build the logic of your programme. Connect goals, objectives, outcomes, outputs and activities, then assign indicators to the relevant result.",
    steps: [
      "Add a top-level result, then use its add action to create child results.",
      "Move an indicator to a group with its Edit form or drag its row onto a group heading.",
      "Switch between the framework tree and indicator register to inspect the plan.",
    ],
    action: "Open results framework",
    to: "/indicators?view=framework",
  },
  {
    id: "import",
    title: "Import data",
    summary: "Connect Kobo or import a CSV table.",
    body: "Data tables holds the survey responses stored in your project. Import a CSV file, or use a verified Kobo connection and sync the form assigned to your project.",
    steps: [
      "Use Import table and choose Local CSV or KoboToolbox.",
      "CSV files need unique column headings. Optionally identify the date and location columns; preview the file before saving.",
      "Imported CSV rows start in Needs review. Review quality before including them in indicator calculations. Reimporting the identical file with the same mapping is rejected.",
    ],
    action: "Open data tables",
    to: "/data-tables",
  },
  {
    id: "results",
    title: "Add collected results",
    summary: "Enter a result or link a stored table.",
    body: "Open an indicator's Collected data action. Choose manual entry for a dated numeric result or narrative, or link an imported table and select a question and calculation.",
    steps: [
      "Numeric manual entries are summed; percentage, rate and ratio entries use an unweighted mean. Qualitative results show the latest dated narrative.",
      "A linked indicator uses ready records from its selected table. Missing and invalid answers are reported separately.",
      "Manual and linked results are kept separate. Remove the existing source before switching modes to avoid counting the same evidence twice.",
    ],
    action: "Open indicators",
    to: "/indicators",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Resolve common access, import and results issues.",
    body: "If a screen is empty, first check the current project and any date or quality filters. An empty result means there is no eligible evidence for that selection.",
    steps: [
      "Sign-in: retype your email and password. If you do not have an account, request a fresh invitation from your administrator.",
      "Kobo sync: verify the connection, assign a form, then inspect sync history. Failed or partial imports are not reported as successful.",
      "Missing actuals: check source mapping, answer type, ready status and reporting dates. Needs-review and invalid records are excluded from indicator actuals.",
      "Access denied: ask an organization administrator to review your membership or field assignment.",
    ],
    action: "Inspect data quality",
    to: "/quality",
  },
  {
    id: "help",
    title: "Where to get in-app help",
    summary: "Keep the full guide close to the work.",
    body: "Use Help in the top bar or Quick-start guide in the sidebar to return here. Each chapter links directly to the relevant FieldSight screen.",
    steps: [
      "Search this guide for a workflow or issue.",
      "Share the exact error message and project name with your administrator when asking for support.",
      "For result questions, include the source table, question, calculation, date range and quality selection.",
    ],
    action: "Open organization team",
    to: "/team",
  },
];
export function QuickStartPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const { projects } = useWorkspace();
  const index = Math.max(
    0,
    chapters.findIndex((c) => c.id === params.get("chapter")),
  );
  const chapter = chapters[index];
  return (
    <Page
      title="Quick-start guide"
      description="Set up your project, connect evidence and track your results."
    >
      <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-5 max-md:grid-cols-1">
        <Panel className="self-start p-3">
          <div className="relative mb-3">
            <Search
              size={15}
              className="absolute left-3 top-3 text-[#9aaab1]"
            />
            <input
              aria-label="Search guide"
              placeholder="Search the guide…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${fieldClass} pl-9`}
            />
          </div>
          <nav aria-label="Guide chapters" className="grid gap-1">
            {chapters
              .filter((c) =>
                (c.title + " " + c.summary)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => setParams({ chapter: c.id })}
                  className={`rounded-md border-0 px-3 py-2.5 text-left text-xs leading-5 ${chapter.id === c.id ? "bg-[#eaf5f5] font-semibold text-[#107b8c]" : "bg-transparent text-[#6b7d86] hover:bg-[#f6f8f9]"}`}
                >
                  {c.title}
                </button>
              ))}
          </nav>
        </Panel>
        <Panel className="p-7 max-sm:p-5">
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-widest text-[#168596]">
            <BookOpen size={15} />
            Getting started · {index + 1} of {chapters.length}
          </div>
          <h2 className="mb-3 mt-6 text-2xl font-semibold">{chapter.title}</h2>
          <p className="text-base text-[#73868d]">{chapter.summary}</p>
          <p className="mt-6 text-sm leading-7 text-[#576f7b]">
            {chapter.body}
          </p>
          <ol className="my-7 grid list-none gap-4 p-0">
            {chapter.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#edf5f6] text-xs font-semibold text-[#168596]">
                  {i + 1}
                </span>
                <p className="m-0 text-sm leading-6 text-[#576f7b]">{step}</p>
              </li>
            ))}
          </ol>
          <Link
            to={chapter.to}
            className="inline-flex items-center gap-2 rounded-md bg-[#147f90] px-4 py-2.5 text-xs font-semibold text-white no-underline"
          >
            {chapter.action}
            <ArrowRight size={14} />
          </Link>
          {index === 0 && projects.length > 0 && (
            <p className="mt-5 flex items-center gap-2 text-xs text-[#398169]">
              <CheckCircle2 size={14} />
              {projects.length} projects available in your organization.
            </p>
          )}
          <div className="mt-10 flex justify-between border-t border-[#e4ebed] pt-5">
            {index > 0 ? (
              <button
                onClick={() => setParams({ chapter: chapters[index - 1].id })}
                className="flex items-center gap-2 border-0 bg-transparent text-xs text-[#73868d]"
              >
                <ArrowLeft size={13} />
                Previous
              </button>
            ) : (
              <span />
            )}
            {index < chapters.length - 1 && (
              <button
                onClick={() => setParams({ chapter: chapters[index + 1].id })}
                className="flex items-center gap-2 border-0 bg-transparent text-xs text-[#168596]"
              >
                Next: {chapters[index + 1].title}
                <ArrowRight size={13} />
              </button>
            )}
          </div>
          <a
            className="mt-8 inline-flex items-center gap-1 text-[12px] text-[#8d9ca3]"
            href="https://www.toladata.com/docs/quick-start-guide/welcome-to-toladata/"
            target="_blank"
            rel="noreferrer"
          >
            Workflow reference: TolaData quick start
            <ExternalLink size={11} />
          </a>
        </Panel>
      </div>
    </Page>
  );
}
