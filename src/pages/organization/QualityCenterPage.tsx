import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Filter,
  MapPin,
  MessageSquare,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

type Severity = "Blocking" | "High" | "Medium" | "Low";
type IssueState = "Open" | "In review" | "Resolved" | "False positive";
type QualityIssue = {
  id: string;
  severity: Severity;
  rule: string;
  submission: string;
  enumerator: string;
  location: string;
  project: string;
  assignee: string;
  state: IssueState;
  age: string;
  submitted: string;
  detail: string;
  evidence: string;
};

const seedIssues: QualityIssue[] = [
  {
    id: "Q-2048",
    severity: "Blocking",
    rule: "Required consent is missing",
    submission: "CHA-02481",
    enumerator: "Joseph N.",
    location: "Kibera East · Nairobi",
    project: "Community Health Assessment",
    assignee: "Unassigned",
    state: "Open",
    age: "18m",
    submitted: "Today, 09:42",
    detail:
      "This submission was sent without a recorded consent response. It cannot be included in exports or indicators until reviewed.",
    evidence:
      "consent_given is blank; form version 2.4 marks this field as required.",
  },
  {
    id: "Q-2047",
    severity: "Blocking",
    rule: "GPS point outside assigned area",
    submission: "CHA-02479",
    enumerator: "Esther W.",
    location: "Mukuru · Nairobi",
    project: "Community Health Assessment",
    assignee: "Amara Johnson",
    state: "In review",
    age: "31m",
    submitted: "Today, 09:29",
    detail:
      "The submitted location is 18.6 km outside the enumerator’s active assignment boundary.",
    evidence: "Captured: -1.215, 36.822 · assigned ward: Mukuru.",
  },
  {
    id: "Q-2046",
    severity: "High",
    rule: "Possible duplicate household",
    submission: "CHA-02472",
    enumerator: "Mary A.",
    location: "Kibera South · Nairobi",
    project: "Community Health Assessment",
    assignee: "Unassigned",
    state: "Open",
    age: "1h",
    submitted: "Today, 08:58",
    detail:
      "A likely match exists for the household name, phone number, and GPS point within the current collection round.",
    evidence: "Matches CHA-02194 with 92% confidence.",
  },
  {
    id: "Q-2045",
    severity: "High",
    rule: "Interview duration is unusually short",
    submission: "CHA-02468",
    enumerator: "Joseph N.",
    location: "Kibera East · Nairobi",
    project: "Community Health Assessment",
    assignee: "David Okoth",
    state: "Open",
    age: "1h",
    submitted: "Today, 08:37",
    detail:
      "The interview was completed in 2 minutes 14 seconds; the expected range is 9–28 minutes.",
    evidence: "Duration is below the 5 minute validation threshold.",
  },
  {
    id: "Q-2044",
    severity: "Medium",
    rule: "Age does not match date of birth",
    submission: "CHA-02461",
    enumerator: "Esther W.",
    location: "Mukuru · Nairobi",
    project: "Community Health Assessment",
    assignee: "Amara Johnson",
    state: "In review",
    age: "2h",
    submitted: "Today, 08:01",
    detail:
      "Calculated age and the respondent-entered age differ by more than one year.",
    evidence: "Date of birth: 2009-04-11 · entered age: 14.",
  },
  {
    id: "Q-2042",
    severity: "Medium",
    rule: "Missing photo evidence",
    submission: "CHA-02453",
    enumerator: "Mary A.",
    location: "Kibera South · Nairobi",
    project: "Community Health Assessment",
    assignee: "Unassigned",
    state: "Open",
    age: "3h",
    submitted: "Today, 07:12",
    detail:
      "A photo was required because the household is marked as a new registration.",
    evidence: "household_photo attachment is missing.",
  },
  {
    id: "Q-2039",
    severity: "Low",
    rule: "Follow-up date is overdue",
    submission: "CHA-02411",
    enumerator: "David O.",
    location: "Mukuru · Nairobi",
    project: "Community Health Assessment",
    assignee: "David Okoth",
    state: "Open",
    age: "5h",
    submitted: "Yesterday, 16:27",
    detail:
      "The entered follow-up date precedes today. Confirm whether the visit occurred.",
    evidence: "Follow-up date: 2026-08-18.",
  },
];

const states: IssueState[] = [
  "Open",
  "In review",
  "Resolved",
  "False positive",
];

const pillClass =
  "inline-block w-max rounded-[4px] px-[6px] py-[4px] text-[9px] font-bold leading-none uppercase tracking-[.25px]";
const summaryCardClass =
  "flex items-center gap-[11px] rounded-[8px] border border-[#e8edf4] bg-white p-4";
const summaryIconClass = "grid size-[37px] place-items-center rounded-[8px]";
const summaryLabelClass =
  "block text-[10px] font-bold tracking-[.45px] text-[#92a0b5]";
const summaryValueClass = "mt-[2px] block text-[22px] tracking-[-.4px]";
const summaryCopyClass = "mt-px text-[11px] text-[#8794a9]";
const filterSelectClass =
  "rounded-[5px] border border-[#dfe6ee] bg-white py-[7px] pl-[9px] pr-[25px] font-['Roboto',sans-serif] text-[12px] text-[#536278]";
const rowGridClass =
  "grid grid-cols-[1.48fr_1.2fr_.76fr_.65fr_36px] items-center gap-3 max-[1120px]:grid-cols-[1.4fr_1.1fr_.75fr_.65fr_30px] max-[760px]:grid-cols-[1fr_auto] max-[760px]:gap-[7px]";
const metadataCellClass = "flex min-w-0 items-start gap-2";
const metadataStrongClass =
  "block overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[#303c51]";
const metadataSmallClass = "mt-[3px] block text-[10px] text-[#8a98aa]";
const drawerBlockClass = "border-b border-[#edf1f5] px-4 py-[15px]";
const drawerHeadingClass =
  "mb-2 text-[11px] uppercase tracking-[.25px] text-[#627189]";
const linkButtonClass =
  "inline-flex cursor-pointer items-center gap-[5px] border-0 bg-transparent p-0 font-['Roboto',sans-serif] text-[12px] font-semibold text-[#0b51b7]";
const decisionButtonClass =
  "cursor-pointer rounded-[5px] border border-[#dce4ec] bg-white px-[6px] py-2 font-['Roboto',sans-serif] text-[11px] font-semibold text-[#59687c]";

const severityClasses: Record<Severity, string> = {
  Blocking: "bg-[#fff0f0] text-[#cb3e51]",
  High: "bg-[#fff5e8] text-[#cf7a13]",
  Medium: "bg-[#eef4ff] text-[#477bc4]",
  Low: "bg-[#f1f4f7] text-[#788597]",
};

const stateClasses: Record<IssueState, string> = {
  Open: "bg-[#fff4e8] text-[#b96b0c]",
  "In review": "bg-[#ecf4ff] text-[#3979c8]",
  Resolved: "bg-[#eaf8f2] text-[#208360]",
  "False positive": "bg-[#f0f2f5] text-[#718094]",
};

export function QualityCenterPage() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState(seedIssues);
  const [selectedId, setSelectedId] = useState<string | null>(seedIssues[0].id);
  const [severity, setSeverity] = useState("All severities");
  const [status, setStatus] = useState("Open");
  const [owner, setOwner] = useState("All reviewers");
  const [comment, setComment] = useState("");
  const selected = issues.find((issue) => issue.id === selectedId) ?? null;
  const visible = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (severity === "All severities" || issue.severity === severity) &&
          (status === "All statuses" || issue.state === status) &&
          (owner === "All reviewers" ||
            (owner === "Assigned to me"
              ? issue.assignee === "Amara Johnson"
              : issue.assignee === "Unassigned")),
      ),
    [issues, owner, severity, status],
  );
  const update = (id: string, patch: Partial<QualityIssue>) =>
    setIssues((current) =>
      current.map((issue) =>
        issue.id === id ? { ...issue, ...patch } : issue,
      ),
    );
  const decide = (state: IssueState) => {
    if (selected) update(selected.id, { state });
    setComment("");
  };
  const totalOpen = issues.filter(
    (issue) => issue.state === "Open" || issue.state === "In review",
  ).length;

  return (
    <div className="text-[#243047]">
      <div className="mb-[22px] flex items-start justify-between max-[760px]:flex-col max-[760px]:gap-3">
        <div>
          <p className="[margin:0_0_6px] text-[11px] font-bold uppercase leading-[1.4] tracking-[.08em] text-[#0b51b7]">
            Data quality
          </p>
          <h1 className="m-0 font-sans text-[28px] font-bold leading-[1.2] tracking-[-.45px]">
            Quality center
          </h1>
          <p className="m-0 text-[14px] text-[#708099]">
            Resolve collection issues before they flow into analysis, reporting,
            or exports.
          </p>
        </div>
        <button className="inline-flex cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-[#0b51b7] px-[14px] py-[10px] font-['Roboto',sans-serif] text-[13px] font-semibold text-white">
          <ShieldCheck size={16} />
          Run validation
        </button>
      </div>
      <section
        className="mb-5 grid grid-cols-4 gap-[14px] max-[1120px]:grid-cols-2 max-[760px]:grid-cols-1"
        aria-label="Quality summary"
      >
        <article className={summaryCardClass}>
          <span className={`${summaryIconClass} bg-[#fff0f0] text-[#dc5361]`}>
            <CircleAlert size={19} />
          </span>
          <div>
            <small className={summaryLabelClass}>NEED REVIEW</small>
            <strong className={summaryValueClass}>{totalOpen}</strong>
            <p className={summaryCopyClass}>across active projects</p>
          </div>
        </article>
        <article className={summaryCardClass}>
          <span className={`${summaryIconClass} bg-[#fff7e9] text-[#d9911c]`}>
            <AlertTriangle size={19} />
          </span>
          <div>
            <small className={summaryLabelClass}>BLOCKING EXPORT</small>
            <strong className={summaryValueClass}>
              {
                issues.filter(
                  (i) => i.severity === "Blocking" && i.state !== "Resolved",
                ).length
              }
            </strong>
            <p className={summaryCopyClass}>must be decided first</p>
          </div>
        </article>
        <article className={summaryCardClass}>
          <span className={`${summaryIconClass} bg-[#eaf8f3] text-[#188b69]`}>
            <Check size={19} />
          </span>
          <div>
            <small className={summaryLabelClass}>AUTO-RESOLVED TODAY</small>
            <strong className={summaryValueClass}>32</strong>
            <p className={summaryCopyClass}>by validation rules</p>
          </div>
        </article>
        <article className={summaryCardClass}>
          <span className={`${summaryIconClass} bg-[#edf5ff] text-[#397bcc]`}>
            <Clock3 size={19} />
          </span>
          <div>
            <small className={summaryLabelClass}>MEDIAN REVIEW TIME</small>
            <strong className={summaryValueClass}>3h 12m</strong>
            <p className={summaryCopyClass}>within your 8h target</p>
          </div>
        </article>
      </section>
      <div className="flex gap-6 border-b border-[#e4eaf2] max-[760px]:gap-[14px] max-[760px]:overflow-auto">
        <button className="cursor-pointer whitespace-nowrap border-0 border-b-2 border-[#0b51b7] bg-transparent px-px pb-[11px] font-['Roboto',sans-serif] text-[13px] font-semibold text-[#0b51b7]">
          Review queue
          <b className="ml-1 inline-grid h-[18px] min-w-[18px] place-items-center rounded-[10px] bg-[#eff2f6] text-[10px] text-[#6c7b92]">
            {totalOpen}
          </b>
        </button>
        <button className="cursor-pointer whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-px pb-[11px] font-['Roboto',sans-serif] text-[13px] font-semibold text-[#77869d]">
          My work
          <b className="ml-1 inline-grid h-[18px] min-w-[18px] place-items-center rounded-[10px] bg-[#eff2f6] text-[10px] text-[#6c7b92]">
            12
          </b>
        </button>
        <button className="cursor-pointer whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-px pb-[11px] font-['Roboto',sans-serif] text-[13px] font-semibold text-[#77869d]">
          Rules
          <b className="ml-1 inline-grid h-[18px] min-w-[18px] place-items-center rounded-[10px] bg-[#eff2f6] text-[10px] text-[#6c7b92]">
            16
          </b>
        </button>
        <button className="cursor-pointer whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-px pb-[11px] font-['Roboto',sans-serif] text-[13px] font-semibold text-[#77869d]">
          History
        </button>
      </div>
      <section className="mt-4 grid min-h-[608px] grid-cols-[minmax(620px,1fr)_365px] overflow-hidden rounded-[8px] border border-[#e2e9f1] bg-white max-[1120px]:grid-cols-1 max-[760px]:mx-[-4px]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 border-b border-[#ebeff4] px-4 py-[14px] max-[760px]:flex-wrap">
            <div className="mr-[3px] flex items-center gap-[5px] text-[12px] font-bold text-[#66768d]">
              <Filter size={15} />
              Filters
            </div>
            <select
              className={filterSelectClass}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option>All severities</option>
              <option>Blocking</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <select
              className={filterSelectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>All statuses</option>
              {states.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              className={filterSelectClass}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option>All reviewers</option>
              <option>Assigned to me</option>
              <option>Unassigned</option>
            </select>
          </div>
          <div
            className={`${rowGridClass} bg-[#fafbfd] px-4 py-[10px] text-[10px] font-bold uppercase tracking-[.35px] text-[#91a0b4] max-[760px]:hidden`}
          >
            <div>Priority & issue</div>
            <div>Submission</div>
            <div>Owner</div>
            <div>State</div>
            <div>Age</div>
          </div>
          <div>
            {visible.map((issue) => (
              <button
                key={issue.id}
                onClick={() => {
                  setSelectedId(issue.id);
                  setComment("");
                }}
                className={`${rowGridClass} w-full cursor-pointer border-0 border-b border-[#edf1f5] px-4 py-[13px] text-left ${selected?.id === issue.id ? "bg-[#f1fbf9] shadow-[inset_3px_0_#0b51b7]" : "bg-white hover:bg-[#f9fcfc]"}`}
              >
                <div className={metadataCellClass}>
                  <span
                    className={`${pillClass} ${severityClasses[issue.severity]}`}
                  >
                    {issue.severity}
                  </span>
                  <div>
                    <strong className={metadataStrongClass}>
                      {issue.rule}
                    </strong>
                    <small className={metadataSmallClass}>
                      {issue.project}
                    </small>
                  </div>
                </div>
                <div className={`${metadataCellClass} max-[760px]:hidden`}>
                  <strong className={metadataStrongClass}>
                    {issue.submission}
                  </strong>
                  <small className={metadataSmallClass}>
                    {issue.enumerator} · {issue.location}
                  </small>
                </div>
                <div className="flex items-center gap-[6px] max-[760px]:hidden">
                  <span className="grid size-[22px] place-items-center rounded-full bg-[#e6f2f2] text-[9px] font-bold text-[#19776f]">
                    {issue.assignee === "Unassigned"
                      ? "—"
                      : issue.assignee
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                  </span>
                  <small className="block max-w-[68px] overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-[#8a98aa]">
                    {issue.assignee}
                  </small>
                </div>
                <span
                  className={`${pillClass} ${stateClasses[issue.state]} max-[760px]:col-start-2 max-[760px]:row-start-1`}
                >
                  {issue.state}
                </span>
                <small className="text-[11px] text-[#8796a9] max-[760px]:hidden">
                  {issue.age}
                </small>
              </button>
            ))}
            {visible.length === 0 && (
              <div className="p-10 text-center text-[13px] text-[#7e8ca0]">
                No issues match these filters.
              </div>
            )}
          </div>
        </div>
        {selected && (
          <aside className="overflow-auto border-l border-[#e2e9f1] bg-white max-[1120px]:border-l-0 max-[1120px]:border-t">
            <div className="flex items-center justify-between px-4 pt-[14px]">
              <div className="flex gap-[6px]">
                <span
                  className={`${pillClass} ${severityClasses[selected.severity]}`}
                >
                  {selected.severity}
                </span>
                <span
                  className={`${pillClass} ${stateClasses[selected.state]}`}
                >
                  {selected.state}
                </span>
              </div>
              <button
                className="cursor-pointer border-0 bg-transparent text-[#8492a5]"
                onClick={() => setSelectedId(null)}
                aria-label="Close issue"
              >
                <X size={18} />
              </button>
            </div>
            <div className="border-b border-[#e9eef4] px-4 pb-4 pt-3">
              <p className="m-0 text-[11px] font-bold text-[#8b98ab]">
                {selected.id}
              </p>
              <h2 className="mb-2 mt-1 text-[18px] leading-[1.25] tracking-[-.25px] text-[#26344a]">
                {selected.rule}
              </h2>
              <button
                className={linkButtonClass}
                onClick={() => navigate("/submissions")}
              >
                Open submission <ExternalLink size={14} />
              </button>
            </div>
            <div className={drawerBlockClass}>
              <h3 className={drawerHeadingClass}>Why this was flagged</h3>
              <p className="m-0 text-[12px] leading-[1.55] text-[#56657a]">
                {selected.detail}
              </p>
              <div className="mt-[10px] flex gap-[7px] rounded-[5px] bg-[#fff8ec] p-2 text-[11px] leading-[1.4] text-[#9b681f]">
                <AlertTriangle className="mt-px flex-none" size={15} />
                <span>{selected.evidence}</span>
              </div>
            </div>
            <div className={drawerBlockClass}>
              <h3 className={drawerHeadingClass}>Submission context</h3>
              <dl className="m-0 grid grid-cols-2 gap-[10px]">
                <div>
                  <dt className="mb-[3px] text-[10px] text-[#94a1b3]">
                    Submission
                  </dt>
                  <dd className="m-0 flex items-center gap-[3px] text-[11px] font-semibold text-[#46546a]">
                    {selected.submission}
                  </dd>
                </div>
                <div>
                  <dt className="mb-[3px] text-[10px] text-[#94a1b3]">
                    Collected by
                  </dt>
                  <dd className="m-0 flex items-center gap-[3px] text-[11px] font-semibold text-[#46546a]">
                    {selected.enumerator}
                  </dd>
                </div>
                <div>
                  <dt className="mb-[3px] text-[10px] text-[#94a1b3]">
                    Location
                  </dt>
                  <dd className="m-0 flex items-center gap-[3px] text-[11px] font-semibold text-[#46546a]">
                    <MapPin size={13} />
                    {selected.location}
                  </dd>
                </div>
                <div>
                  <dt className="mb-[3px] text-[10px] text-[#94a1b3]">
                    Submitted
                  </dt>
                  <dd className="m-0 flex items-center gap-[3px] text-[11px] font-semibold text-[#46546a]">
                    {selected.submitted}
                  </dd>
                </div>
              </dl>
            </div>
            <div className={drawerBlockClass}>
              <h3 className={drawerHeadingClass}>Review ownership</h3>
              <label className="flex items-center gap-[7px] rounded-[5px] border border-[#e1e7ee] px-2 text-[#718198]">
                <UserRound size={15} />
                <select
                  className="w-full border-0 bg-white px-[3px] py-2 font-['Roboto',sans-serif] text-[12px] text-[#536278]"
                  value={selected.assignee}
                  onChange={(e) =>
                    update(selected.id, { assignee: e.target.value })
                  }
                >
                  <option>Unassigned</option>
                  <option>Amara Johnson</option>
                  <option>David Okoth</option>
                </select>
              </label>
              <button
                className={`${linkButtonClass} mt-[10px]`}
                onClick={() =>
                  update(selected.id, {
                    assignee: "Amara Johnson",
                    state: "In review",
                  })
                }
              >
                Assign to me <ChevronRight size={14} />
              </button>
            </div>
            <div className={drawerBlockClass}>
              <h3 className={drawerHeadingClass}>Review notes</h3>
              <div className="mb-[9px] flex gap-[7px]">
                <span className="grid size-6 place-items-center rounded-full bg-[#e8f3f3] text-[9px] font-bold text-[#177870]">
                  AJ
                </span>
                <p className="m-0 text-[11px] text-[#69788c]">
                  <strong className="text-[#4a596e]">Amara Johnson</strong>{" "}
                  opened this issue for review.
                  <small className="mt-[2px] block text-[#9aa6b5]">Today</small>
                </p>
              </div>
              <textarea
                className="min-h-[58px] w-full resize-y rounded-[5px] border border-[#dfe6ee] p-2 font-['Roboto',sans-serif] text-[12px]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note for your team…"
              />
              <button
                className="mt-[6px] flex cursor-pointer items-center gap-[5px] border-0 bg-transparent p-0 font-['Roboto',sans-serif] text-[11px] font-semibold text-[#0b51b7] disabled:cursor-not-allowed disabled:text-[#b1bbc8]"
                disabled={!comment.trim()}
              >
                <MessageSquare size={14} />
                Add note
              </button>
            </div>
            <div className="grid grid-cols-2 gap-[7px] px-4 py-[14px]">
              <button
                className={decisionButtonClass}
                onClick={() => decide("False positive")}
              >
                False positive
              </button>
              <button
                className={decisionButtonClass}
                onClick={() => decide("In review")}
              >
                Put on hold
              </button>
              <button
                className={`${decisionButtonClass} border-[#f1c9cf] text-[#c54e5a]`}
                onClick={() => decide("Resolved")}
              >
                Reject record
              </button>
              <button
                className={`${decisionButtonClass} flex items-center justify-center gap-1 border-[#0b51b7] bg-[#0b51b7] text-white`}
                onClick={() => decide("Resolved")}
              >
                <Check size={15} />
                Approve
              </button>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
