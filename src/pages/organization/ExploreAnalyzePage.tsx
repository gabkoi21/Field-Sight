import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";

const trend = [
  { day: "13 Aug", received: 246, verified: 218 },
  { day: "14 Aug", received: 310, verified: 279 },
  { day: "15 Aug", received: 284, verified: 260 },
  { day: "16 Aug", received: 372, verified: 331 },
  { day: "17 Aug", received: 341, verified: 308 },
  { day: "18 Aug", received: 448, verified: 402 },
  { day: "Today", received: 516, verified: 461 },
];

const locations = [
  {
    name: "Paynesville",
    collected: 1842,
    target: 2200,
    verified: 94,
    last: "6 min ago",
  },
  {
    name: "Central Monrovia",
    collected: 1610,
    target: 1900,
    verified: 91,
    last: "14 min ago",
  },
  {
    name: "Sinkor",
    collected: 1324,
    target: 1700,
    verified: 88,
    last: "28 min ago",
  },
  {
    name: "Congo Town",
    collected: 986,
    target: 1450,
    verified: 93,
    last: "1h ago",
  },
  {
    name: "Bong County",
    collected: 742,
    target: 1350,
    verified: 84,
    last: "3h ago",
  },
];

const categories = [
  { name: "Completed", value: 72, color: "#0b51b7" },
  { name: "Partial", value: 17, color: "#6d81f5" },
  { name: "Refused", value: 7, color: "#ff9f43" },
  { name: "Other", value: 4, color: "#d8deea" },
];

const eyebrowClass = "mb-[6px] mt-0 text-[11px] font-bold uppercase leading-[1.4] tracking-[.08em] text-brand";
const panelClass = "rounded-[7px] border border-[#e4eaf2] bg-white";
const panelHeaderClass = "flex h-[74px] min-h-[51px] items-center justify-between border-b border-[#e9eef4] px-[15px]";
const panelButtonClass =
  "flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[10px] font-semibold leading-[normal] text-brand";

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="m-0 text-[13px] font-normal text-ink">{title}</h2>
      <p className="mb-0 mt-[3px] text-[9px] text-[#8b98aa]">{subtitle}</p>
    </div>
  );
}

export function ExploreAnalyzePage() {
  const [project, setProject] = useState("All projects");
  const [form, setForm] = useState("All forms");
  const [location, setLocation] = useState("All locations");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);

  useEffect(() => {
    if (!exportOpen) return;
    const frame = window.requestAnimationFrame(() => setExportVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [exportOpen]);

  function openExport() {
    setExportVisible(false);
    setExportOpen(true);
  }

  function closeExport() {
    setExportOpen(false);
    setExportVisible(false);
  }

  return (
    <div className="text-[#25324a]">
      <div className="mb-[17px] flex items-start justify-between max-[650px]:flex-col max-[650px]:gap-3">
        <div>
          <p className={eyebrowClass}>ANALYSIS WORKSPACE</p>
          <h1 className="m-0 text-[28px] font-bold leading-[1.2] tracking-[-.45px]">Explore &amp; analyze</h1>
          <p className="m-0 text-[13px] text-[#75849a]">
            Filter collected data, compare results, and export the records behind every chart.
          </p>
        </div>
        <div className="flex gap-[7px] max-[650px]:w-full">
          <button className="flex cursor-pointer items-center gap-[6px] rounded-[5px] border border-[#dce5ef] bg-white px-[11px] py-[9px] text-[11px] font-semibold leading-[normal] text-[#65758b] max-[650px]:flex-1 max-[650px]:justify-center">
            <CalendarDays size={15} />
            Last 30 days
            <ChevronDown size={14} />
          </button>
          <button
            className="flex cursor-pointer items-center gap-[6px] rounded-[5px] border border-brand bg-brand px-[11px] py-[9px] text-[11px] font-semibold leading-[normal] text-white max-[650px]:flex-1 max-[650px]:justify-center"
            onClick={openExport}
          >
            <Download size={15} />
            Export data
          </button>
        </div>
      </div>

      <section className="mb-[15px] flex items-end gap-2.5 rounded-[7px] border border-[#e5ebf2] bg-white px-[14px] py-3 max-[1050px]:flex-wrap">
        <div className="flex items-center gap-[5px] self-center text-[11px] font-bold text-[#536278]">
          <Filter size={15} />
          <span>View filters</span>
        </div>
        <label className="flex min-w-[165px] flex-col gap-1 text-[9px] font-bold text-[#8491a3] max-[650px]:min-w-[145px] max-[650px]:flex-1">
          Project
          <select
            className="rounded border border-[#dce5ef] bg-white px-2 py-[7px] text-[10px] leading-[normal] text-[#526176]"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          >
            <option>All projects</option>
            <option>Community Health Assessment</option>
            <option>Maternal Health Survey</option>
            <option>Water Access Mapping</option>
          </select>
        </label>
        <label className="flex min-w-[165px] flex-col gap-1 text-[9px] font-bold text-[#8491a3] max-[650px]:min-w-[145px] max-[650px]:flex-1">
          Form
          <select
            className="rounded border border-[#dce5ef] bg-white px-2 py-[7px] text-[10px] leading-[normal] text-[#526176]"
            value={form}
            onChange={(event) => setForm(event.target.value)}
          >
            <option>All forms</option>
            <option>CHA Baseline v3</option>
            <option>MHS Field Survey</option>
            <option>Water Point Census</option>
          </select>
        </label>
        <label className="flex min-w-[165px] flex-col gap-1 text-[9px] font-bold text-[#8491a3] max-[650px]:min-w-[145px] max-[650px]:flex-1">
          Location
          <select
            className="rounded border border-[#dce5ef] bg-white px-2 py-[7px] text-[10px] leading-[normal] text-[#526176]"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            <option>All locations</option>
            <option>Paynesville</option>
            <option>Central Monrovia</option>
            <option>Bong County</option>
          </select>
        </label>
        <button
          className="ml-auto flex cursor-pointer items-center gap-1 border-0 bg-transparent p-[7px] text-[10px] font-semibold leading-[normal] text-brand max-[1050px]:ml-0"
          onClick={() => {
            setProject("All projects");
            setForm("All forms");
            setLocation("All locations");
          }}
        >
          <RefreshCw size={13} />
          Reset
        </button>
      </section>

      <section className="mb-[15px] grid grid-cols-4 gap-[13px] max-[1050px]:grid-cols-2 max-[650px]:grid-cols-1">
        <article className="rounded-[7px] border border-[#e5ebf2] bg-white px-[15px] py-[14px]">
          <small className="text-[9px] font-bold text-[#667791]">RECORDS IN VIEW</small>
          <strong className="mt-[5px] block text-[20px] font-bold text-ink">8,648</strong>
          <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">From 4 active projects</p>
        </article>
        <article className="rounded-[7px] border border-[#e5ebf2] bg-white px-[15px] py-[14px]">
          <small className="text-[9px] font-bold text-[#667791]">COMPLETION RATE</small>
          <strong className="mt-[5px] block text-[20px] font-bold text-ink">72.4%</strong>
          <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">
            <b className="text-[#22a779]">+4.8%</b> vs previous period
          </p>
        </article>
        <article className="rounded-[7px] border border-[#e5ebf2] bg-white px-[15px] py-[14px]">
          <small className="text-[9px] font-bold text-[#667791]">VERIFIED RECORDS</small>
          <strong className="mt-[5px] block text-[20px] font-bold text-ink">7,412</strong>
          <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">85.7% ready for reporting</p>
        </article>
        <article className="rounded-[7px] border border-[#e5ebf2] bg-white px-[15px] py-[14px]">
          <small className="text-[9px] font-bold text-[#667791]">MEDIAN DURATION</small>
          <strong className="mt-[5px] block text-[20px] font-bold text-ink">14m 22s</strong>
          <p className="mb-0 mt-[3px] text-[9px] text-[#8996a8]">Within expected range</p>
        </article>
      </section>

      <section className="mb-[15px] grid grid-cols-[minmax(0,1.8fr)_minmax(280px,.8fr)] gap-[15px] max-[1050px]:grid-cols-1">
        <article className={panelClass}>
          <header className={panelHeaderClass}>
            <PanelHeading title="Submission trend" subtitle="Received and verified records over time" />
            <div className="flex gap-3 text-[9px] text-[#7b899d]">
              <span className="flex items-center gap-1">
                <i className="size-[7px] rounded-full bg-brand" />
                Received
              </span>
              <span className="flex items-center gap-1">
                <i className="size-[7px] rounded-full bg-[#6d81f5]" />
                Verified
              </span>
            </div>
          </header>
          <div className="h-[245px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="exploreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#0b51b7" stopOpacity=".2" />
                    <stop offset="1" stopColor="#0b51b7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf1f5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#8190a4" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#95a1b1" }} />
                <Tooltip />
                <Area dataKey="received" stroke="#0b51b7" strokeWidth={2.4} fill="url(#exploreFill)" />
                <Area dataKey="verified" stroke="#6d81f5" strokeWidth={2} fill="none" strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={panelClass}>
          <header className={panelHeaderClass}>
            <PanelHeading title="Response outcomes" subtitle="Current records in this view" />
            <button className={panelButtonClass}>
              <SlidersHorizontal size={15} />
            </button>
          </header>
          <div className="grid grid-cols-[170px_1fr] items-center px-3 py-[17px] max-[650px]:grid-cols-[150px_1fr]">
            <div className="relative h-[170px] max-[650px]:h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categories.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <span className="absolute inset-0 grid text-center pointer-events-none place-content-center">
                <strong className="block text-[18px] font-bold text-ink">8,648</strong>
                <small className="block text-[9px] text-[#8a98aa]">records</small>
              </span>
            </div>
            <ul className="p-0 m-0 list-none">
              {categories.map((item) => (
                <li className="flex justify-between py-[7px] text-[10px] text-[#758499]" key={item.name}>
                  <span className="flex items-center gap-[5px]">
                    <i className="size-[7px] rounded-full" style={{ background: item.color }} />
                    {item.name}
                  </span>
                  <strong className="font-bold text-[#48586e]">{item.value}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>
      <section className="mb-[15px] grid grid-cols-[minmax(0,1.55fr)_minmax(290px,.75fr)] gap-[15px] max-[1050px]:grid-cols-1">
        <article className={panelClass}>
          <header className={panelHeaderClass}>
            <PanelHeading title="Records by location" subtitle="Collected volume compared across coverage areas" />
            <button className={panelButtonClass}>
              Top 5
              <ChevronDown size={13} />
            </button>
          </header>
          <div className="h-[230px] px-3 py-[15px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locations} layout="vertical" margin={{ top: 5, right: 18, left: 28, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#edf1f5" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#8c99aa" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={102}
                  tick={{ fontSize: 10, fill: "#526176" }}
                />
                <Tooltip />
                <Bar dataKey="target" fill="#e7ecf4" radius={[0, 3, 3, 0]} barSize={11} />
                <Bar dataKey="collected" fill="#0b51b7" radius={[0, 3, 3, 0]} barSize={11} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={panelClass}>
          <header className={panelHeaderClass}>
            <PanelHeading title="Analysis notes" subtitle="Signals from the current view" />
          </header>
          <div className="mx-[15px] flex gap-[9px] border-b border-[#edf1f5] py-[13px]">
            <span className="grid size-[30px] flex-none place-items-center rounded-md bg-[#e9f8f1] text-[#22a779]">
              <CheckCircle2 size={16} />
            </span>
            <p className="m-0">
              <strong className="block text-[10px] font-bold text-[#4b5a70]">Collection pace is improving</strong>
              <small className="mt-[3px] block text-[9px] leading-[1.4] text-[#8795a8]">
                Daily submissions are 12% higher than the previous period.
              </small>
            </p>
          </div>
          <div className="mx-[15px] flex gap-[9px] border-b border-[#edf1f5] py-[13px]">
            <span className="grid size-[30px] flex-none place-items-center rounded-md bg-[#fff3e5] text-[#d9841c]">
              <MapPin size={16} />
            </span>
            <p className="m-0">
              <strong className="block text-[10px] font-bold text-[#4b5a70]">Bong County is below target</strong>
              <small className="mt-[3px] block text-[9px] leading-[1.4] text-[#8795a8]">
                Only 55% of the planned sample has been collected.
              </small>
            </p>
          </div>
          <div className="mx-[15px] flex gap-[9px] border-0 py-[13px]">
            <span className="grid size-[30px] flex-none place-items-center rounded-md bg-[#edf4fd] text-brand">
              <BarChart3 size={16} />
            </span>
            <p className="m-0">
              <strong className="block text-[10px] font-bold text-[#4b5a70]">Interview duration is stable</strong>
              <small className="mt-[3px] block text-[9px] leading-[1.4] text-[#8795a8]">
                83% of records fall inside the expected range.
              </small>
            </p>
          </div>
        </article>
      </section>
      <section className="overflow-hidden rounded-[7px] border border-[#e4eaf2] bg-white">
        <header className={panelHeaderClass}>
          <PanelHeading title="Location breakdown" subtitle="Click a location to inspect its underlying submissions." />
          <button
            className="flex cursor-pointer items-center gap-1 rounded border border-[#dce5ef] bg-transparent px-2 py-[6px] text-[10px] font-semibold leading-[normal] text-brand"
            onClick={openExport}
          >
            <FileSpreadsheet size={14} />
            Export table
          </button>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-[760px]">
            <thead>
              <tr>
                <th className="bg-[#f8fafc] px-[14px] py-2.5 text-[9px] text-[#8492a5]">Location</th>
                <th className="bg-[#f8fafc] px-[14px] py-2.5 text-[9px] text-[#8492a5]">Collected</th>
                <th className="bg-[#f8fafc] px-[14px] py-2.5 text-[9px] text-[#8492a5]">Target</th>
                <th className="bg-[#f8fafc] px-[14px] py-2.5 text-[9px] text-[#8492a5]">Completion</th>
                <th className="bg-[#f8fafc] px-[14px] py-2.5 text-[9px] text-[#8492a5]">Verified</th>
                <th className="bg-[#f8fafc] px-[14px] py-2.5 text-[9px] text-[#8492a5]">Last received</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((item) => {
                const completion = Math.round((item.collected / item.target) * 100);
                return (
                  <tr key={item.name}>
                    <td className="whitespace-nowrap border-t border-[#edf1f5] px-[14px] py-[11px] text-[10px] leading-[1.45] text-[#5d6c80]">
                      <strong className="flex items-center gap-[5px] font-bold text-[#425269]">
                        <MapPin size={13} />
                        {item.name}
                      </strong>
                    </td>
                    <td className="whitespace-nowrap border-t border-[#edf1f5] px-[14px] py-[11px] text-[10px] leading-[1.45] text-[#5d6c80]">
                      {item.collected.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap border-t border-[#edf1f5] px-[14px] py-[11px] text-[10px] leading-[1.45] text-[#5d6c80]">
                      {item.target.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap border-t border-[#edf1f5] px-[14px] py-[11px] text-[10px] leading-[1.45] text-[#5d6c80]">
                      <div className="flex items-center gap-[7px]">
                        <i className="block h-1 w-[70px] bg-[#e9edf3]">
                          <b className="block h-full bg-brand" style={{ width: `${completion}%` }} />
                        </i>
                        <strong className="text-[9px] font-bold text-[#273546]">{completion}%</strong>
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-t border-[#edf1f5] px-[14px] py-[11px] text-[10px] leading-[1.45] text-[#5d6c80]">
                      <span className="rounded-[3px] bg-[#e9f8f1] px-[6px] py-1 text-[9px] font-bold text-[#22a779]">
                        {item.verified}%
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-t border-[#edf1f5] px-[14px] py-[11px] text-[10px] leading-[1.45] text-[#5d6c80]">
                      {item.last}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {exportOpen && (
        <div
          className={`fixed inset-0 z-[25] bg-[#102a4330] transition-opacity duration-200 ease-out ${exportVisible ? "opacity-100" : "opacity-0"}`}
          onClick={closeExport}
        >
          <form
            className={`absolute inset-y-0 right-0 flex w-[min(450px,100%)] flex-col bg-white shadow-[-16px_0_35px_#102a4324] transition-[opacity,transform] duration-[280ms] ease-snappy ${exportVisible ? "translate-x-0 opacity-100" : "translate-x-[35px] opacity-0"}`}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              closeExport();
            }}
          >
            <header className="flex h-[74px] items-start justify-between border-b border-[#e8eef4] bg-white px-[21px] py-5">
              <div>
                <p className={eyebrowClass}>DATA EXPORT</p>
                <h2 className="mb-[5px] mt-1 text-[21px] font-normal text-ink">Export current view</h2>
                <p className="m-0 text-[10px] text-[#8391a5]">Your filters will be applied to the exported records.</p>
              </div>
              <button className="border-0 bg-transparent p-0 text-[#8492a4]" type="button" onClick={closeExport}>
                <X size={19} />
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-[15px] overflow-auto px-[21px] py-5">
              <div className="rounded-md bg-[#edf4fd] p-[13px]">
                <strong className="block text-[14px] font-bold text-brand">8,648 records</strong>
                <span className="mt-[3px] block text-[9px] text-[#70809a]">
                  {project}
                  {" · "}
                  {form}
                  {" · "}
                  {location}
                </span>
              </div>

              <label className="flex flex-col gap-[5px] text-[10px] font-bold text-[#536278]">
                File format
                <select className="rounded-[5px] border border-[#dce5ef] bg-white p-[9px] text-[11px] font-normal leading-[normal] text-[#506076]">
                  <option>Excel workbook (.xlsx)</option>
                  <option>CSV file (.csv)</option>
                  <option>SPSS (.sav)</option>
                </select>
              </label>

              <label className="flex flex-col gap-[5px] text-[10px] font-bold text-[#536278]">
                Fields
                <select className="rounded-[5px] border border-[#dce5ef] bg-white p-[9px] text-[11px] font-normal leading-[normal] text-[#506076]">
                  <option>All form fields</option>
                  <option>Visible table columns</option>
                  <option>Saved field selection</option>
                </select>
              </label>

              <label className="flex items-start gap-2 rounded-md border border-[#e4eaf1] p-[11px]">
                <input className="mt-0.5 accent-brand" type="checkbox" defaultChecked />
                <span className="block">
                  <strong className="block text-[10px] font-bold text-[#4c5b70]">Only include verified records</strong>
                  <small className="mt-[3px] block text-[9px] text-[#8c99aa]">
                    Exclude records that still require review.
                  </small>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-md border border-[#e4eaf1] p-[11px]">
                <input className="mt-0.5 accent-brand" type="checkbox" />
                <span className="block">
                  <strong className="block text-[10px] font-bold text-[#4c5b70]">Include media links</strong>
                  <small className="mt-[3px] block text-[9px] text-[#8c99aa]">
                    Add attachment URLs as separate columns.
                  </small>
                </span>
              </label>
            </div>

            <footer className="flex justify-end gap-[7px] border-t border-[#e8eef4] bg-white px-[21px] py-[14px]">
              <button
                className="flex items-center gap-[5px] rounded-[5px] border border-[#dce5ef] bg-white px-2.5 py-2 text-[10px] font-semibold leading-[normal] text-[#5d6c80]"
                type="button"
                onClick={closeExport}
              >
                Cancel
              </button>
              <button
                className="flex items-center gap-[5px] rounded-[5px] border border-brand bg-brand px-2.5 py-2 text-[10px] font-semibold leading-[normal] text-white"
                type="submit"
              >
                <Download size={14} />
                Prepare export
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
