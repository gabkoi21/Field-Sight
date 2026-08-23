import { useMemo, useState } from "react";
import { Database, Download, ExternalLink, FileCheck2, Filter, MapPin, MoreHorizontal, Search, ShieldAlert, SlidersHorizontal, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, type Submission } from "../../services/mockApi";

type Review = "Ready" | "Needs review" | "Invalid";
type Row = Submission & { project: string; form: string; sync: "Synced" | "Pending"; review: Review; device: string };

const extras = [
  {
    project: "Community Health Assessment",
    form: "CHA Baseline v3",
    sync: "Synced" as const,
    review: "Ready" as Review,
    device: "Samsung SM-A135F",
  },
  {
    project: "Maternal Health Survey",
    form: "MHS Field Survey",
    sync: "Synced" as const,
    review: "Needs review" as Review,
    device: "Tecno Spark 10",
  },
  {
    project: "Community Health Assessment",
    form: "CHA Baseline v3",
    sync: "Pending" as const,
    review: "Ready" as Review,
    device: "Samsung SM-A135F",
  },
  {
    project: "Water Access Mapping",
    form: "Water Point Census",
    sync: "Synced" as const,
    review: "Ready" as Review,
    device: "Redmi Note 11",
  },
  {
    project: "Maternal Health Survey",
    form: "MHS Field Survey",
    sync: "Synced" as const,
    review: "Invalid" as Review,
    device: "Tecno Spark 10",
  },
];

const eyebrowClass = "!m-0 !mb-[6px] text-[11px] !leading-[1.4] font-bold tracking-[.08em] text-[#0b51b7] uppercase";
const reviewBadgeClass = "inline-block rounded-[3px] px-[6px] py-[4px] text-[9px] font-bold";
const reviewStyles: Record<Review, string> = {
  Ready: "bg-[#e9f8f1] text-[#22a779]",
  "Needs review": "bg-[#fff3e5] text-[#d9841c]",
  Invalid: "bg-[#fff0f2] text-[#d95667]",
};
const selectClass =
  "rounded-[5px] border border-[#dce5ef] bg-white px-[9px] py-[8px] font-sans text-[11px] font-normal leading-normal text-[#69798e]";

export function SubmissionsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["submissions"], queryFn: api.submissions });
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All projects");
  const [review, setReview] = useState("All records");
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const rows: Row[] = data.map((submission, index) => ({ ...submission, ...extras[index] }));
  const visible = useMemo(
    () =>
      rows.filter((row) => {
        const text = `${row.id} ${row.enumerator} ${row.location} ${row.form}`.toLowerCase();
        return (
          text.includes(query.toLowerCase()) &&
          (project === "All projects" || row.project === project) &&
          (review === "All records" || row.review === review)
        );
      }),
    [rows, query, project, review],
  );
  const record = rows.find((row) => row.id === selected) ?? null;
  const toggle = (id: string) =>
    setChecked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const toggleAll = () => setChecked(checked.length === visible.length ? [] : visible.map((row) => row.id));

  if (isLoading) {
    return (
      <div className="rounded-[10px] bg-white p-[60px] text-center text-[#758092]">Loading submission records…</div>
    );
  }

  return (
    <div className="text-[#25324a]">
      <div className="mb-[19px] flex items-start justify-between max-[750px]:flex-col max-[750px]:gap-[12px]">
        <div>
          <p className={eyebrowClass}>DATA COLLECTION</p>
          <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px]">Submissions</h1>
          <p className="!m-0 text-[13px] text-[#75849a]">
            Review every completed form sent from your field teams and connected sources.
          </p>
        </div>
        <button className="flex cursor-pointer items-center gap-[7px] rounded-[6px] border border-[#dce5ef] bg-white px-[13px] py-[9px] font-sans text-[12px] font-semibold leading-normal text-[#155da6]">
          <Download size={16} />
          Export data
        </button>
      </div>

      <section className="mb-[18px] grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]"><Database size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">All submissions</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">10,284</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Across active organization projects</small>
        </button>
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]"><FileCheck2 size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">Ready for analysis</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">9,742</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Validated and export-ready records</small>
        </button>
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#fff3e5] text-[#d88935]"><ShieldAlert size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">Needs review</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">421</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Records waiting for quality review</small>
        </button>
        <button className="grid w-full cursor-pointer grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-[6px] border border-[#e5e9ed] bg-white p-[17px] text-left [font:inherit] hover:border-[#b8dcd6] hover:shadow-[0_3px_10px_#102a4309]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#fcebee] text-[#ca5560]"><ShieldAlert size={19} /></span>
          <span className="block text-[11px] font-medium text-[#6f7d8a]">Invalid records</span>
          <strong className="mt-[2px] block text-[23px] leading-[1.15] text-[#1d2a38]">149</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Blocked from export until resolved</small>
        </button>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[#e3eaf2] bg-white">
        <div className="flex items-center gap-[8px] border-b border-[#e9eef4] p-[14px] max-[750px]:flex-wrap">
          <label className="flex max-w-[360px] flex-1 items-center gap-[7px] rounded-[5px] border border-[#dce5ef] px-[9px] text-[#8492a4] max-[750px]:min-w-full max-[750px]:max-w-none">
            <Search size={16} />
            <input
              className="w-full border-0 bg-transparent py-[8px] font-sans text-[12px] font-normal leading-normal text-[#4e5e74] outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, collector, location, or form"
            />
          </label>
          <select className={selectClass} value={project} onChange={(event) => setProject(event.target.value)}>
            <option>All projects</option>
            <option>Community Health Assessment</option>
            <option>Maternal Health Survey</option>
            <option>Water Access Mapping</option>
          </select>
          <select className={selectClass} value={review} onChange={(event) => setReview(event.target.value)}>
            <option>All records</option>
            <option>Ready</option>
            <option>Needs review</option>
            <option>Invalid</option>
          </select>
          <button className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border border-[#dce5ef] bg-white px-[9px] py-[8px] font-sans text-[11px] font-normal leading-normal text-[#69798e]">
            <Filter size={15} />
            More filters
          </button>
          <button
            className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border border-[#dce5ef] bg-white px-[9px] py-[8px] font-sans text-[11px] font-normal leading-normal text-[#69798e]"
            aria-label="Choose columns"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {checked.length > 0 && (
          <div className="flex items-center gap-[8px] bg-[#edf5ff] px-[14px] py-[9px] text-[11px] text-[#426180] max-[750px]:flex-wrap">
            <strong className="mr-[4px] text-[#0b51b7]">{checked.length} selected</strong>
            <button className="cursor-pointer rounded-[4px] border-0 bg-white px-[8px] py-[6px] font-sans text-[10px] font-semibold leading-normal text-[#285d9d]">
              Assign reviewer
            </button>
            <button className="cursor-pointer rounded-[4px] border-0 bg-white px-[8px] py-[6px] font-sans text-[10px] font-semibold leading-normal text-[#285d9d]">
              Mark ready
            </button>
            <button className="cursor-pointer rounded-[4px] border-0 bg-white px-[8px] py-[6px] font-sans text-[10px] font-semibold leading-normal text-[#285d9d]">
              Export selected
            </button>
            <button
              className="ml-auto flex cursor-pointer items-center gap-[3px] rounded-[4px] border-0 bg-transparent px-[8px] py-[6px] font-sans text-[10px] font-semibold leading-normal text-[#285d9d] max-[750px]:ml-0"
              onClick={() => setChecked([])}
            >
              <X size={14} />
              Clear
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="!w-full !min-w-[1040px] !border-collapse !text-left">
            <thead>
              <tr>
                <th className="!bg-[#f8fafc] !px-[13px] !py-[11px] !text-[9px] !font-semibold !tracking-[.35px] !text-[#8391a5] !uppercase">
                  <input
                    className="h-[14px] w-[14px] accent-[#0b51b7]"
                    aria-label="Select all submissions"
                    type="checkbox"
                    checked={visible.length > 0 && checked.length === visible.length}
                    onChange={toggleAll}
                  />
                </th>
                {["Submission", "Project & form", "Collector", "Location", "Received", "Sync", "Review"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="!bg-[#f8fafc] !px-[13px] !py-[11px] !text-[9px] !font-semibold !tracking-[.35px] !text-[#8391a5] !uppercase"
                    >
                      {heading}
                    </th>
                  ),
                )}
                <th className="!bg-[#f8fafc] !px-[13px] !py-[11px] !text-[9px] !font-semibold !tracking-[.35px] !text-[#8391a5] !uppercase" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer hover:bg-[#f5f9fe] ${selected === row.id ? "bg-[#f5f9fe]" : ""}`}
                  onClick={() => setSelected(row.id)}
                >
                  <td
                    className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      className="h-[14px] w-[14px] accent-[#0b51b7]"
                      aria-label={`Select ${row.id}`}
                      type="checkbox"
                      checked={checked.includes(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                  <td className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]">
                    <button
                      className="cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-[11px] font-bold leading-normal text-[#0b51b7]"
                      onClick={() => setSelected(row.id)}
                    >
                      {row.id}
                      <small className="mt-[3px] block text-[9px] font-normal text-[#97a4b4]">Mobile submission</small>
                    </button>
                  </td>
                  <td className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]">
                    <div>
                      <strong className="block text-[11px] text-[#405067]">{row.project}</strong>
                      <small className="mt-[3px] block text-[9px] font-normal text-[#97a4b4]">{row.form}</small>
                    </div>
                  </td>
                  <td className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]">
                    <div className="flex items-center gap-[6px]">
                      <span className="grid h-[24px] w-[24px] place-items-center rounded-full bg-[#eaf1fb] text-[8px] font-bold text-[#2866a8]">
                        {row.enumerator
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <strong className="text-[11px] text-[#526176]">{row.enumerator}</strong>
                    </div>
                  </td>
                  <td className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]">
                    <span className="flex items-center gap-[4px] text-[#66768c]">
                      <MapPin size={13} />
                      {row.location}
                    </span>
                  </td>
                  <td className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]">
                    <div>
                      <strong className="block text-[11px] text-[#405067]">{row.submitted}</strong>
                      <small className="mt-[3px] block text-[9px] font-normal text-[#97a4b4]">19 Aug 2026</small>
                    </div>
                  </td>
                  <td className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]">
                    <span
                      className={`flex items-center gap-[5px] text-[10px] font-bold ${row.sync === "Pending" ? "text-[#d68520]" : ""}`}
                    >
                      <i
                        className={`h-[6px] w-[6px] rounded-full ${row.sync === "Pending" ? "bg-[#ff9f43]" : "bg-[#22b783]"}`}
                      />
                      {row.sync}
                    </span>
                  </td>
                  <td className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]">
                    <span className={`${reviewBadgeClass} ${reviewStyles[row.review]}`}>{row.review}</span>
                  </td>
                  <td
                    className="!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[12px] !text-[11px] !leading-[1.45] !text-[#536177]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="cursor-pointer border-0 bg-transparent p-0 text-[#8897a9]"
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
            Showing <strong className="text-[#4e5e74]">{visible.length}</strong> of 10,284 submissions
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
      </section>

      {record && (
        <div className="fixed inset-0 z-20 bg-[#102a4330]" onClick={() => setSelected(null)}>
          <section
            className="absolute bottom-0 right-0 top-0 flex w-[min(460px,100%)] flex-col bg-white shadow-[-16px_0_35px_#102a4324]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="!flex !h-auto !items-start !justify-between !border-b !border-[#e8eef4] !bg-white !px-[21px] !py-[20px]">
              <div>
                <p className={eyebrowClass}>SUBMISSION RECORD</p>
                <h2 className="my-[4px] mb-[8px] text-[22px] font-normal text-[#303e67]">{record.id}</h2>
                <span className={`${reviewBadgeClass} ${reviewStyles[record.review]}`}>{record.review}</span>
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
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record.project}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Form</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record.form}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Collector</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record.enumerator}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Location</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record.location}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Received</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record.submitted}</dd>
                </div>
                <div>
                  <dt className="mb-[4px] text-[10px] text-[#97a4b3]">Device</dt>
                  <dd className="!m-0 text-[11px] font-semibold text-[#435269]">{record.device}</dd>
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
      )}
    </div>
  );
}
