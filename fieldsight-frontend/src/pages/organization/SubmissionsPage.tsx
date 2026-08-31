import { useMemo, useState } from "react";
import { Database, Download, ExternalLink, FileCheck2, MapPin, MoreHorizontal, Search, ShieldAlert, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/Card";
import { apiClient, type ApiSubmission } from "../../services/apiClient";

type Review = "Ready" | "Needs review" | "Invalid";
type ExportPeriod = "daily" | "weekly" | "biweekly" | "monthly";
type Row = { id: string; enumerator: string; location: string; submitted: string; submittedAt: string | null; project: string; form: string; sync: "Synced" | "Pending"; review: Review; device: string };

function toRow(submission: ApiSubmission): Row {
  const review: Review = submission.review_status === "invalid" ? "Invalid" : submission.review_status === "needs_review" ? "Needs review" : "Ready";
  return {
    id: submission.external_id,
    enumerator: submission.enumerator ?? "Unassigned",
    location: submission.location ?? "Not captured",
    submitted: submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "Not recorded",
    submittedAt: submission.submitted_at,
    project: submission.project_name,
    form: submission.form_name ?? "Kobo form",
    sync: "Synced",
    review,
    device: "Kobo Collect",
  };
}
const eyebrowClass = "!m-0 !mb-[6px] text-[11px] !leading-[1.4] font-bold tracking-[.08em] text-[#0b51b7] uppercase";
const reviewBadgeClass = "inline-block rounded-[3px] px-[6px] py-[4px] text-[11px] font-bold";
const reviewStyles: Record<Review, string> = {
  Ready: "bg-[#e9f8f1] text-[#22a779]",
  "Needs review": "bg-[#fff3e5] text-[#d9841c]",
  Invalid: "bg-[#fff0f2] text-[#d95667]",
};
const selectClass =
  "rounded-[5px] border border-[#dce5ef] bg-white px-[9px] py-[8px] font-sans text-[11px] font-normal leading-normal text-[#69798e]";

export function SubmissionsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["submissions"], queryFn: apiClient.submissions });
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(organizationId),
  });
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All projects");
  const [review, setReview] = useState("All records");
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("daily");
  const [selected, setSelected] = useState<string | null>(null);
  const rows: Row[] = data.map(toRow);
  const projects = useMemo(
    () => (projectsQuery.data ?? []).map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    [projectsQuery.data],
  );
  const projectRows = useMemo(
    () => project === "All projects" ? rows : rows.filter((row) => row.project === project),
    [rows, project],
  );
  const visible = useMemo(
    () =>
      projectRows.filter((row) => {
        const text = `${row.id} ${row.enumerator} ${row.location} ${row.form}`.toLowerCase();
        return (
          text.includes(query.toLowerCase()) &&
          (review === "All records" || row.review === review)
        );
      }),
    [projectRows, query, review],
  );
  const record = rows.find((row) => row.id === selected) ?? null;
  const exportRows = useMemo(() => {
    const periodDays: Record<ExportPeriod, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (periodDays[exportPeriod] - 1));
    return visible.filter((row) => row.submittedAt && new Date(row.submittedAt).getTime() >= cutoff.getTime());
  }, [visible, exportPeriod]);
  const exportCsv = () => {
    const columns: Array<[string, keyof Row]> = [
      ["Submission ID", "id"],
      ["Project", "project"],
      ["Form", "form"],
      ["Collector", "enumerator"],
      ["Location", "location"],
      ["Received", "submitted"],
      ["Device", "device"],
      ["Sync", "sync"],
      ["Review", "review"],
    ];
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [
      columns.map(([label]) => escapeCsv(label)).join(","),
      ...exportRows.map((row) => columns.map(([, key]) => escapeCsv(String(row[key]))).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const projectName = project === "All projects" ? "all-projects" : project;
    link.href = url;
    link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${exportPeriod}-submissions.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="rounded-[10px] bg-white p-[60px] text-center text-[#758092]">Loading submission records…</div>
    );
  }

  return (
    <div className="text-[#25324a]">
      <div className="mb-[19px]">
        <div>
          <p className={eyebrowClass}>DATA COLLECTION</p>
          <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px]">Submissions</h1>
          <p className="!m-0 text-[13px] text-[#75849a]">
            Review every completed form sent from your field teams and connected sources.
          </p>
        </div>

      </div>

      <section className="mb-[18px] grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]"><Database size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">All submissions</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">{projectRows.length.toLocaleString()}</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">{project === "All projects" ? "Across active organization projects" : `For ${project}`}</small>
        </button>
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]"><FileCheck2 size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">Ready for analysis</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">{projectRows.filter((row) => row.review === "Ready").length.toLocaleString()}</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Validated and export-ready records</small>
        </button>
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#fff3e5] text-[#d88935]"><ShieldAlert size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">Needs review</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">{projectRows.filter((row) => row.review === "Needs review").length.toLocaleString()}</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Records waiting for quality review</small>
        </button>
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#fcebee] text-[#ca5560]"><ShieldAlert size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">Invalid records</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">{projectRows.filter((row) => row.review === "Invalid").length.toLocaleString()}</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Blocked from export until resolved</small>
        </button>
      </section>

      <div className="mt-[16px] grid grid-cols-[minmax(280px,1fr)_minmax(210px,260px)_minmax(130px,160px)_minmax(130px,auto)] items-center gap-[10px] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <label className="flex w-full items-center gap-[8px] rounded-[6px] border border-[#dce5ef] bg-white px-[11px] text-[#8492a4]">
          <Search size={16} />
          <input
            className="w-full border-0 bg-transparent py-[8px] font-sans text-[12px] font-normal leading-normal text-[#4e5e74] outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ID, collector, location, or form"
          />
        </label>
        <select className={`${selectClass} w-full`} value={project} onChange={(event) => setProject(event.target.value)}>
          <option>All projects</option>
          {projects.map((projectName) => <option key={projectName}>{projectName}</option>)}
        </select>
        <select
          className={`${selectClass} w-full`}
          value={exportPeriod}
          onChange={(event) => setExportPeriod(event.target.value as ExportPeriod)}
          aria-label="CSV export period"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!exportRows.length}
          className="flex min-h-[36px] cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[#dce5ef] bg-white px-[16px] py-[9px] font-sans text-[12px] font-semibold leading-normal text-[#155da6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} />
          Export data
        </button>
      </div>

      <Card className="mt-[16px]">

        <div className="overflow-x-auto">

          <table className="!w-full !min-w-[1040px] !border-collapse !text-left">
            <thead>
              <tr>
                {["Submission", "Project & form", "Collector", "Location", "Received", "Sync", "Review"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="!border-b !border-[#d1d5db] !bg-[#e9ecf0] !px-[16px] !py-[14px] !text-[13px] !font-semibold !text-[#1f2937] !whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ),
                )}
                <th className="!border-b !border-[#d1d5db] !bg-[#e9ecf0] !px-[16px] !py-[14px]" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#f0f2f5] bg-white hover:bg-[#f5f9fe]"
                >
                  <td className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45] !text-[#536177]">
                    <span className="block text-left font-sans text-[13px] font-semibold leading-normal text-[#0b51b7]">
                      {row.id}
                      <small className="mt-[2px] block text-[11px] font-normal text-[#9ca8b6]">Mobile submission</small>
                    </span>
                  </td>
                  <td className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45] !text-[#374151]">
                    <strong className="block text-[13px] font-semibold text-[#1f2937]">{row.project}</strong>
                  </td>
                  <td className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45] !text-[#374151]">
                    <div className="flex items-center gap-[9px]">
                      <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full bg-[#dbeafe] text-[10px] font-bold text-[#1d4ed8]">
                        {row.enumerator
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <span className="text-[13px] font-medium text-[#374151]">{row.enumerator}</span>
                    </div>
                  </td>
                  <td className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45] !text-[#6b7280]">
                    <span className="flex items-center gap-[5px]">
                      <MapPin size={14} className="text-[#9ca3af]" />
                      {row.location}
                    </span>
                  </td>
                  <td className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45] !text-[#374151]">
                    {row.submitted}
                  </td>
                  <td className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45]">
                    <span
                      className={`flex items-center gap-[6px] text-[13px] font-medium ${row.sync === "Pending" ? "text-[#d97706]" : "text-[#059669]"}`}
                    >
                      <i
                        className={`h-[8px] w-[8px] shrink-0 rounded-full ${row.sync === "Pending" ? "bg-[#fbbf24]" : "bg-[#34d399]"}`}
                      />
                      {row.sync}
                    </span>
                  </td>
                  <td className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45]">
                    <span className={`${reviewBadgeClass} ${reviewStyles[row.review]}`}>{row.review}</span>
                  </td>
                  <td
                    className="!whitespace-nowrap !px-[16px] !py-[10px] !text-[13px] !leading-[1.45]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="cursor-pointer border-0 bg-transparent p-0 text-[#9ca3af] hover:text-[#6b7280]"
                      aria-label={`Actions for ${row.id}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]"
                    colSpan={9}
                  >
                    <div className="p-[38px] text-center text-[12px] text-[#8190a4]">
                      No submissions match these filters.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between border-t border-[#e9eef4] px-[14px] py-[11px] text-[10px] text-[#7e8da0]">
          <span>
            Showing <strong className="text-[#4e5e74]">{visible.length}</strong> of {projectRows.length.toLocaleString()} submissions
          </span>
          <div className="flex gap-[4px]">
            <button
              className="min-w-[24px] rounded-[3px] border-0 bg-white p-[4px] font-sans text-[10px] font-normal leading-normal text-[#75849a]"
              disabled
            >
              ‹
            </button>
            <button className="min-w-[24px] rounded-[3px] border-0 bg-[#0b51b7] p-[4px] font-sans text-[10px] font-normal leading-normal text-white">
              1
            </button>
            <button className="min-w-[24px] rounded-[3px] border-0 bg-white p-[4px] font-sans text-[10px] font-normal leading-normal text-[#75849a]">
              2
            </button>
            <button className="min-w-[24px] rounded-[3px] border-0 bg-white p-[4px] font-sans text-[10px] font-normal leading-normal text-[#75849a]">
              3
            </button>
            <button className="min-w-[24px] rounded-[3px] border-0 bg-white p-[4px] font-sans text-[10px] font-normal leading-normal text-[#75849a]">
              ›
            </button>
          </div>
        </footer>
      </Card>

      {record ? false && (
        <div className="fixed inset-0 z-20 bg-[#102a4330]" onClick={() => setSelected(null)}>
          <section
            className="absolute bottom-0 right-0 top-0 flex w-[min(460px,100%)] flex-col bg-white shadow-[-16px_0_35px_#102a4324]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="!flex !h-auto !items-start !justify-between !border-b !border-[#e8eef4] !bg-white !px-[21px] !py-[20px]">
              <div>
                <p className={eyebrowClass}>SUBMISSION RECORD</p>
                <h2 className="my-[4px] mb-[8px] text-[22px] font-normal text-[#303e67]">{record?.id}</h2>
                <span className={`${reviewBadgeClass} ${reviewStyles[record?.review ?? "Ready"]}`}>{record?.review}</span>
              </div>
              <button
                className="cursor-pointer border-0 bg-transparent p-0 text-[#8593a6]"
                onClick={() => setSelected(null)}
                aria-label="Close submission"
              >
                <X size={19} />
              </button>
            </header>

            <div className="flex-1 overflow-auto px-[21px] py-[18px]">
              <div className="mb-[22px] flex gap-[7px]">
                <button className="flex items-center gap-[5px] rounded-[5px] border border-[#dce5ef] bg-white px-[9px] py-[7px] font-sans text-[11px] font-semibold leading-normal text-[#0b51b7]">
                  Open full record <ExternalLink size={14} />
                </button>
                <button className="flex items-center gap-[5px] rounded-[5px] border border-[#dce5ef] bg-white px-[9px] py-[7px] font-sans text-[11px] font-semibold leading-normal text-[#0b51b7]">
                  Download
                </button>
              </div>
              <h3 className="!m-0 !mb-[12px] text-[10px] font-bold tracking-[.35px] text-[#65758c] uppercase">
                Collection details
              </h3>
              <dl className="!m-0 grid grid-cols-2 gap-[14px] max-[460px]:grid-cols-1">
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Project</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record?.project}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Form</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record?.form}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Collector</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record?.enumerator}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Location</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record?.location}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Received</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record?.submitted}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Device</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record?.device}</dd>
                </div>
              </dl>
              <div className="mt-[24px] border-t border-[#edf1f5] pt-[19px]">
                <h3 className="!m-0 !mb-[12px] text-[10px] font-bold tracking-[.35px] text-[#65758c] uppercase">
                  Review activity
                </h3>
                <p className="!m-0 flex items-center gap-[5px] text-[11px] text-[#77869a]">
                  <span className="mr-[3px] grid h-[25px] w-[25px] place-items-center rounded-full bg-[#e8f1fb] text-[8px] font-bold text-[#2866a8]">
                    AJ
                  </span>
                  <b className="text-[#4d5d72]">Amara Johnson</b> has not reviewed this record yet.
                  <small className="ml-auto text-[#9ca8b6]">Today</small>
                </p>
              </div>
            </div>

            <footer className="flex justify-end gap-[7px] border-t border-[#e7edf3] bg-white px-[21px] py-[14px] max-[460px]:flex-wrap">
              <button className="cursor-pointer rounded-[5px] border border-[#e2b8be] bg-white px-[10px] py-[8px] font-sans text-[11px] font-semibold leading-normal text-[#c55763]">
                Reject
              </button>
              <button className="cursor-pointer rounded-[5px] border border-[#dce5ef] bg-white px-[10px] py-[8px] font-sans text-[11px] font-semibold leading-normal text-[#5c6b7f]">
                Request correction
              </button>
              <button className="cursor-pointer rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[10px] py-[8px] font-sans text-[11px] font-semibold leading-normal text-white">
                Mark ready
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
