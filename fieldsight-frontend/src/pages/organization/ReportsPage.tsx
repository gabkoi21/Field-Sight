import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileBarChart,
  FileText,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { Card } from "../../components/ui/Card";

type ReportStatus = "Published" | "Draft" | "Scheduled";
const reports = [
  {
    name: "Community Health weekly brief",
    type: "Project summary",
    project: "Community Health Assessment",
    period: "12–19 Aug 2026",
    owner: "Amara Johnson",
    updated: "Today, 09:18",
    status: "Published" as ReportStatus,
  },
  {
    name: "Maternal Health baseline findings",
    type: "Analysis report",
    project: "Maternal Health Survey",
    period: "July–August 2026",
    owner: "David Okoth",
    updated: "Yesterday",
    status: "Draft" as ReportStatus,
  },
  {
    name: "Water access progress update",
    type: "Partner report",
    project: "Water Access Mapping",
    period: "August 2026",
    owner: "Amara Johnson",
    updated: "18 Aug 2026",
    status: "Scheduled" as ReportStatus,
  },
  {
    name: "Youth employment monthly report",
    type: "Project summary",
    project: "Youth Employment Study",
    period: "July 2026",
    owner: "Lina Mensah",
    updated: "04 Aug 2026",
    status: "Published" as ReportStatus,
  },
];
const templates = [
  {
    icon: FileText,
    tone: "blue",
    name: "Project progress report",
    description:
      "Targets, collection progress, field coverage, issues, and next actions.",
    use: "Program managers",
  },
  {
    icon: BarChart3,
    tone: "violet",
    name: "Analysis findings report",
    description:
      "Key indicators, charts, comparisons, findings, and interpretation.",
    use: "M&E and research teams",
  },
  {
    icon: Users,
    tone: "amber",
    name: "Partner or donor brief",
    description:
      "A concise, presentation-ready summary for external stakeholders.",
    use: "Partners and donors",
  },
];

const eyebrowStyles =
  "mb-[6px] mt-0 text-[11px] font-bold uppercase leading-[1.4] tracking-[.08em] text-[#0b51b7]";
const sectionTitleStyles = "m-0 text-[13px] text-[#303e67]";
const sectionDescriptionStyles = "mb-0 mt-[3px] text-[10px] text-[#8996a8]";
const headerActionStyles =
  "flex items-center gap-[3px] border-0 bg-transparent p-0 font-['Roboto'] text-[10px] font-semibold leading-[normal] text-[#0b51b7]";
const panelHeaderStyles =
  "flex h-[74px] min-h-[52px] items-center justify-between border-b border-[#e9eef4] bg-white px-[15px] text-[#657182]";
const fieldLabelStyles =
  "flex flex-col gap-[5px] text-[10px] font-bold text-[#536278]";
const fieldControlStyles =
  "w-full rounded-[5px] border border-[#dce5ef] bg-white p-[9px] font-['Roboto'] text-[11px] font-normal leading-[normal] text-[#506076]";
const drawerFooterButtonStyles =
  "flex items-center gap-[5px] rounded-[5px] border border-[#dce5ef] bg-white px-[10px] py-[8px] font-['Roboto'] text-[10px] font-semibold leading-[normal] text-[#5d6c80]";
const toneStyles = {
  blue: "bg-[#edf4fd] text-[#0b51b7]",
  violet: "bg-[#f0effc] text-[#6d64c7]",
  amber: "bg-[#fff3e5] text-[#d9841c]",
  green: "bg-[#e9f8f1] text-[#22a779]",
} as const;
const statusStyles: Record<ReportStatus, string> = {
  Published: "bg-[#e9f8f1] text-[#22a779]",
  Draft: "bg-[#f0f2f5] text-[#738196]",
  Scheduled: "bg-[#edf4fd] text-[#0b51b7]",
};

export function ReportsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All status");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [template, setTemplate] = useState("Project progress report");
  const visible = useMemo(
    () =>
      reports.filter(
        (report) =>
          `${report.name} ${report.project} ${report.type}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === "All status" || report.status === status),
      ),
    [query, status],
  );
  const startReport = (name: string) => {
    setTemplate(name);
    setDrawerEntered(false);
    setDrawerOpen(true);
    requestAnimationFrame(() => setDrawerEntered(true));
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerEntered(false);
  };
  return (
    <div className="text-[#25324a]">
      <div className="mb-[18px] flex items-start justify-between max-[700px]:flex-col max-[700px]:gap-[12px]">
        <div>
          <p className={eyebrowStyles}>REPORTING & DISTRIBUTION</p>
          <h1 className="m-0 font-['Roboto'] text-[28px] font-bold leading-[1.2] tracking-[-.45px]">
            Reports
          </h1>
          <p className="m-0 text-[13px] text-[#75849a]">
            Turn trusted project data into reports for teams, partners, and
            decision-makers.
          </p>
        </div>
        <button
          className="flex cursor-pointer items-center gap-[6px] rounded-[5px] border-0 bg-[#0b51b7] px-[12px] py-[9px] font-['Roboto'] text-[11px] font-semibold leading-[normal] text-white"
          onClick={() => startReport("Project progress report")}
        >
          <Plus size={16} />
          New report
        </button>
      </div>
      <section className="mb-[17px] grid grid-cols-4 gap-[13px] max-[1100px]:grid-cols-2 max-[480px]:grid-cols-1">
        <Card className="flex items-center justify-between px-[15px] py-[14px]">
          <div>
            <small className="block text-[9px] font-bold text-[#667791]">
              PUBLISHED REPORTS
            </small>
            <strong className="mt-[5px] block text-[20px] text-[#303e67]">
              18
            </strong>
            <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">
              Across 4 active projects
            </p>
          </div>
          <span
            className={`grid size-[38px] place-items-center rounded-full ${toneStyles.blue}`}
          >
            <FileBarChart size={19} />
          </span>
        </Card>
        <Card className="flex items-center justify-between px-[15px] py-[14px]">
          <div>
            <small className="block text-[9px] font-bold text-[#667791]">
              SCHEDULED DELIVERY
            </small>
            <strong className="mt-[5px] block text-[20px] text-[#303e67]">
              6
            </strong>
            <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">
              Next delivery tomorrow
            </p>
          </div>
          <span
            className={`grid size-[38px] place-items-center rounded-full ${toneStyles.violet}`}
          >
            <CalendarDays size={19} />
          </span>
        </Card>
        <Card className="flex items-center justify-between px-[15px] py-[14px]">
          <div>
            <small className="block text-[9px] font-bold text-[#667791]">
              REPORT RECIPIENTS
            </small>
            <strong className="mt-[5px] block text-[20px] text-[#303e67]">
              42
            </strong>
            <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">
              Team and partner contacts
            </p>
          </div>
          <span
            className={`grid size-[38px] place-items-center rounded-full ${toneStyles.amber}`}
          >
            <Mail size={19} />
          </span>
        </Card>
        <Card className="flex items-center justify-between px-[15px] py-[14px]">
          <div>
            <small className="block text-[9px] font-bold text-[#667791]">
              DELIVERED THIS MONTH
            </small>
            <strong className="mt-[5px] block text-[20px] text-[#303e67]">
              11
            </strong>
            <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">
              <b className="text-[#22a779]">100%</b> sent successfully
            </p>
          </div>
          <span
            className={`grid size-[38px] place-items-center rounded-full ${toneStyles.green}`}
          >
            <Send size={19} />
          </span>
        </Card>
      </section>
      <section className="mb-[17px]">
        <header className="mb-[10px] flex h-[74px] items-end justify-between border-b border-[#e7e9ed] bg-white px-[38px] text-[#657182] max-[900px]:px-[18px]">
          <div>
            <h2 className={sectionTitleStyles}>Start from a template</h2>
            <p className={sectionDescriptionStyles}>
              Use a structure designed for common data-collection reporting
              needs.
            </p>
          </div>
          <button className={headerActionStyles}>
            View all templates <ChevronRight size={14} />
          </button>
        </header>
        <div className="grid grid-cols-3 gap-[13px] max-[700px]:grid-cols-1">
          {templates.map(({ icon: Icon, ...item }) => (
            <Card
              className="p-[15px] [&>small]:mt-[13px] [&>small]:block [&>small]:text-[8px] [&>small]:font-bold [&>small]:text-[#9aa5b3]"
              key={item.name}
            >
              <span
                className={`grid size-[36px] place-items-center rounded-full ${toneStyles[item.tone as keyof typeof toneStyles]}`}
              >
                <Icon size={19} />
              </span>
              <h3 className="mb-[5px] mt-[13px] text-[12px] text-[#405067]">
                {item.name}
              </h3>
              <p className="m-0 min-h-[32px] text-[10px] leading-[1.5] text-[#7e8da0]">
                {item.description}
              </p>
              <small>BEST FOR · {item.use}</small>
              <button
                className="mt-[11px] flex cursor-pointer items-center gap-[3px] border-0 bg-transparent p-0 font-['Roboto'] text-[10px] font-semibold leading-[normal] text-[#0b51b7]"
                onClick={() => startReport(item.name)}
              >
                Use template <ChevronRight size={14} />
              </button>
            </Card>
          ))}
        </div>
      </section>
      <section className="grid grid-cols-[minmax(0,2.15fr)_minmax(270px,.85fr)] gap-[15px] max-[1100px]:grid-cols-1">
        <Card>
          <header
            className={`${panelHeaderStyles} max-[700px]:h-auto max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[10px] max-[700px]:px-[15px] max-[700px]:py-[12px]`}
          >
            <div>
              <h2 className={sectionTitleStyles}>Saved reports</h2>
              <p className={sectionDescriptionStyles}>
                {visible.length} reports shown
              </p>
            </div>
            <div className="flex gap-[7px] max-[700px]:w-full">
              <label className="flex items-center gap-[5px] rounded-[4px] border border-[#dce5ef] px-[7px] text-[#8795a7] max-[700px]:flex-1">
                <Search size={15} />
                <input
                  className="w-[120px] border-0 py-[7px] font-['Roboto'] text-[10px] font-normal leading-[normal] outline-0 max-[700px]:w-full"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search reports"
                />
              </label>
              <select
                className="rounded-[4px] border border-[#dce5ef] bg-white p-[7px] font-['Roboto'] text-[10px] font-normal leading-[normal] text-[#69798e]"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>All status</option>
                <option>Published</option>
                <option>Draft</option>
                <option>Scheduled</option>
              </select>
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left [&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-[#edf1f5] [&_td]:px-[12px] [&_td]:py-[11px] [&_td]:text-[9px] [&_td]:leading-[1.45] [&_td]:text-[#627186] [&_th]:bg-[#f8fafc] [&_th]:px-[12px] [&_th]:py-[10px] [&_th]:text-[8px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[.04em] [&_th]:text-[#8492a5]">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Project</th>
                  <th>Period</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((report) => (
                  <tr key={report.name}>
                    <td>
                      <div className="flex items-center gap-[7px] bg-transparent">
                        <span className="grid size-[26px] place-items-center rounded-[5px] bg-[#edf4fd] text-[#0b51b7]">
                          <FileText size={14} />
                        </span>
                        <div>
                          <strong className="block text-[10px] text-[#435269]">
                            {report.name}
                          </strong>
                          <small className="mt-[3px] block text-[8px] text-[#95a1b1]">
                            {report.type}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{report.project}</td>
                    <td>{report.period}</td>
                    <td>
                      <span className="flex items-center gap-[5px]">
                        <i className="grid size-[21px] place-items-center rounded-full bg-[#e9f1fb] text-[7px] font-bold not-italic text-[#2866a8]">
                          {report.owner
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </i>
                        {report.owner}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`rounded-[3px] px-[6px] py-[4px] text-[8px] font-bold ${statusStyles[report.status]}`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td>{report.updated}</td>
                    <td>
                      <button className="border-0 bg-transparent p-0 text-[#8b98aa]">
                        <MoreHorizontal size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex justify-between border-t border-[#e9eef4] px-[13px] py-[10px] text-[9px] text-[#8190a4]">
            <span>Showing 1–{visible.length} of 18 reports</span>
            <div className="flex gap-[3px]">
              <button className="rounded-[3px] border-0 bg-[#0b51b7] px-[7px] py-[4px] text-white">
                1
              </button>
              <button className="rounded-[3px] border-0 bg-white px-[7px] py-[4px] text-[#738297]">
                2
              </button>
              <button className="rounded-[3px] border-0 bg-white px-[7px] py-[4px] text-[#738297]">
                3
              </button>
            </div>
          </footer>
        </Card>
        <Card>
          <header className={panelHeaderStyles}>
            <div>
              <h2 className={sectionTitleStyles}>Upcoming deliveries</h2>
              <p className={sectionDescriptionStyles}>
                Automated report schedule
              </p>
            </div>
            <button className={headerActionStyles}>Manage</button>
          </header>
          <div className="mx-[14px] flex gap-[9px] border-b border-[#edf1f5] py-[13px]">
            <span className="grid h-[42px] w-[38px] flex-none place-items-center rounded-[5px] bg-[#edf4fd] text-[#0b51b7]">
              <b className="block text-center text-[14px]">20</b>
              <small className="block text-center text-[7px] font-bold">
                AUG
              </small>
            </span>
            <div className="[&>p]:mb-0 [&>p]:mt-[3px] [&>p]:text-[8px] [&>p]:text-[#8996a8] [&>small]:flex [&>small]:items-center [&>small]:gap-[3px] [&>small]:text-[8px] [&>small]:text-[#7081b9] [&>strong]:block [&>strong]:text-[10px] [&>strong]:text-[#46566c]">
              <strong>Health weekly brief</strong>
              <p>8 recipients · PDF and Excel</p>
              <small>
                <Clock3 size={12} />
                Tomorrow, 08:00
              </small>
            </div>
          </div>
          <div className="mx-[14px] flex gap-[9px] border-b border-[#edf1f5] py-[13px]">
            <span className="grid h-[42px] w-[38px] flex-none place-items-center rounded-[5px] bg-[#edf4fd] text-[#0b51b7]">
              <b className="block text-center text-[14px]">25</b>
              <small className="block text-center text-[7px] font-bold">
                AUG
              </small>
            </span>
            <div className="[&>p]:mb-0 [&>p]:mt-[3px] [&>p]:text-[8px] [&>p]:text-[#8996a8] [&>small]:flex [&>small]:items-center [&>small]:gap-[3px] [&>small]:text-[8px] [&>small]:text-[#7081b9] [&>strong]:block [&>strong]:text-[10px] [&>strong]:text-[#46566c]">
              <strong>Partner progress update</strong>
              <p>14 recipients · PDF</p>
              <small>
                <Clock3 size={12} />
                Monday, 09:00
              </small>
            </div>
          </div>
          <div className="mx-[14px] flex gap-[9px] border-b border-[#edf1f5] py-[13px]">
            <span className="grid h-[42px] w-[38px] flex-none place-items-center rounded-[5px] bg-[#edf4fd] text-[#0b51b7]">
              <b className="block text-center text-[14px]">01</b>
              <small className="block text-center text-[7px] font-bold">
                SEP
              </small>
            </span>
            <div className="[&>p]:mb-0 [&>p]:mt-[3px] [&>p]:text-[8px] [&>p]:text-[#8996a8] [&>small]:flex [&>small]:items-center [&>small]:gap-[3px] [&>small]:text-[8px] [&>small]:text-[#7081b9] [&>strong]:block [&>strong]:text-[10px] [&>strong]:text-[#46566c]">
              <strong>Monthly portfolio report</strong>
              <p>20 recipients · PDF and Excel</p>
              <small>
                <Clock3 size={12} />
                01 Sep, 07:30
              </small>
            </div>
          </div>
          <button className="mx-[14px] my-[13px] flex w-[calc(100%_-_28px)] items-center justify-center gap-[5px] rounded-[5px] border border-dashed border-[#bfcfe5] bg-[#f8fbff] p-[8px] text-[14px] font-normal leading-[1.5] text-[#0b51b7]">
            <Plus size={14} />
            Schedule a report
          </button>
        </Card>
      </section>
      {drawerOpen && (
        <div
          className={`fixed inset-0 z-[25] bg-[#102a4330] transition-opacity duration-200 ease-out ${drawerEntered ? "opacity-100" : "opacity-0"}`}
          onClick={closeDrawer}
        >
          <form
            className={`absolute inset-y-0 right-0 flex w-[min(470px,100%)] flex-col bg-white shadow-[-16px_0_35px_#102a4324] transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)] ${drawerEntered ? "translate-x-0 opacity-100" : "translate-x-[35px] opacity-0"}`}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              closeDrawer();
            }}
          >
            <header className="flex h-[74px] items-start justify-between border-b border-[#e8eef4] bg-white px-[21px] py-[20px] text-[#657182]">
              <div>
                <p className={eyebrowStyles}>REPORT SETUP</p>
                <h2 className="mb-[5px] mt-[4px] text-[21px] text-[#303e67]">
                  Create report
                </h2>
                <p className="m-0 text-[10px] text-[#8391a5]">
                  Choose the data, period, and audience for this report.
                </p>
              </div>
              <button
                className="border-0 bg-transparent p-0 text-[#8492a4]"
                type="button"
                onClick={closeDrawer}
              >
                <X size={19} />
              </button>
            </header>
            <div className="flex flex-1 flex-col gap-[14px] overflow-auto px-[21px] py-[20px]">
              <label className={fieldLabelStyles}>
                Report name
                <input
                  className={fieldControlStyles}
                  required
                  defaultValue="Community Health progress report"
                />
              </label>
              <label className={fieldLabelStyles}>
                Template
                <select
                  className={fieldControlStyles}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  {templates.map((item) => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className={fieldLabelStyles}>
                Project
                <select className={fieldControlStyles}>
                  <option>Community Health Assessment</option>
                  <option>Maternal Health Survey</option>
                  <option>Water Access Mapping</option>
                  <option>Youth Employment Study</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-[11px] max-[700px]:grid-cols-1">
                <label className={fieldLabelStyles}>
                  Reporting period
                  <select className={fieldControlStyles}>
                    <option>Last 30 days</option>
                    <option>This month</option>
                    <option>Previous month</option>
                    <option>Custom period</option>
                  </select>
                </label>
                <label className={fieldLabelStyles}>
                  Output format
                  <select className={fieldControlStyles}>
                    <option>PDF report</option>
                    <option>PDF and Excel</option>
                    <option>Interactive link</option>
                  </select>
                </label>
              </div>
              <label className={fieldLabelStyles}>
                Audience
                <select className={fieldControlStyles}>
                  <option>Internal project team</option>
                  <option>Partners and donors</option>
                  <option>Public summary</option>
                </select>
              </label>
              <label className="flex items-start gap-[8px] rounded-[6px] border border-[#e4eaf1] p-[11px]">
                <input
                  className="mt-[2px] w-[14px] rounded-[5px] border border-[#dce5ef] bg-white p-[9px] font-['Roboto'] text-[11px] font-normal leading-[normal] text-[#506076] accent-[#0b51b7]"
                  type="checkbox"
                />
                <span>
                  <strong className="block text-[10px] text-[#4c5b70]">
                    Schedule delivery
                  </strong>
                  <small className="mt-[3px] block text-[9px] text-[#8c99aa]">
                    Email this report automatically on a recurring schedule.
                  </small>
                </span>
              </label>
            </div>
            <footer className="flex justify-end gap-[7px] border-t border-[#e8eef4] bg-white px-[21px] py-[14px] max-[480px]:flex-wrap">
              <button
                className={drawerFooterButtonStyles}
                type="button"
                onClick={closeDrawer}
              >
                Cancel
              </button>
              <button
                className={`${drawerFooterButtonStyles} text-[#0b51b7]`}
                type="button"
              >
                Preview
              </button>
              <button
                className={`${drawerFooterButtonStyles} border-[#0b51b7] bg-[#0b51b7] text-white`}
                type="submit"
              >
                <FileBarChart size={14} />
                Create report
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
