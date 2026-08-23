import { useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink, Flag, RefreshCw, Users } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { NavLink, useParams } from "react-router-dom";
import { Badge, Button, Card, LoadingState } from "../../components/ui";
import { api } from "../../services/mockApi";

const trend = [
  { d: "Aug 12", n: 260 },
  { d: "Aug 13", n: 310 },
  { d: "Aug 14", n: 286 },
  { d: "Aug 15", n: 375 },
  { d: "Aug 16", n: 344 },
  { d: "Aug 17", n: 447 },
  { d: "Today", n: 520 },
];
const tabs = ["Dashboard", "Submissions", "Data quality", "Analytics", "Enumerators", "Reports", "Settings"];

const statusBorders = [
  "border-r max-[900px]:border-b max-[600px]:border-x-0 max-[600px]:border-t-0 max-[600px]:!border-b",
  "border-r max-[900px]:border-b max-[900px]:border-r-0 max-[600px]:border-x-0 max-[600px]:border-t-0 max-[600px]:!border-b",
  "border-r max-[600px]:border-x-0 max-[600px]:border-t-0 max-[600px]:!border-b",
  "border-0 max-[600px]:!border-b",
];

export function ProjectWorkspacePage() {
  const { projectId } = useParams();
  const { data = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: api.projects,
  });
  const project = data[Math.max(0, Number(projectId || 1) - 1)] || data[0];
  if (!project) return <LoadingState />;
  return (
    <>
      <div className="mb-5 flex items-end justify-between max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-[14px]">
        <div>
          <NavLink className="mb-[15px] block text-[11px] text-[#6e7b8a] no-underline" to="/projects">
            ← All projects
          </NavLink>
          <div className="flex items-center gap-3">
            <span className="grid size-[42px] place-items-center rounded-[7px] bg-[#edf5ff] text-[#4c7ccd]">
              <Building2 size={18} />
            </span>
            <div>
              <h1 className="m-0 text-[28px] font-bold leading-[1.2] tracking-[-.45px]">{project.name}</h1>
              <p className="mt-[5px] text-[11px] text-[#758092]">
                {project.sector} · <Badge value={project.status} />
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="leading-[normal]" variant="secondary">
            <ExternalLink size={15} />
            Open in Kobo
          </Button>
          <Button className="leading-[normal]">
            <RefreshCw size={15} />
            Sync data
          </Button>
        </div>
      </div>
      <nav className="mb-[18px] flex gap-1 overflow-auto border-b border-[#e2e5e9]">
        {tabs.map((tab, index) => (
          <button
            className={`whitespace-nowrap border-x-0 border-t-0 bg-transparent px-[13px] py-2.5 text-[13px] font-semibold leading-[normal] ${index === 0 ? "border-b-2 border-brand text-brand" : "border-b-2 border-transparent text-[#6e7b8a]"}`}
            key={tab}
          >
            {tab}
          </button>
        ))}
      </nav>
      <section className="mb-[18px] grid grid-cols-4 rounded-lg border border-[#e7e9ed] bg-white max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
        {[
          [project.form, "Connected"],
          [project.sync, `${project.submissions.toLocaleString()} records`],
          [`${project.progress}%`, "of 2,560 target"],
          ["89.4%", "76 need review"],
        ].map((item, index) => (
          <div className={`border-[#edf0f2] p-[18px] ${statusBorders[index]}`} key={index}>
            <small className="block text-[10px] font-semibold uppercase tracking-[.06em] text-[#8792a0]">
              {["KOBO FORM", "LAST SYNC", "COLLECTION PROGRESS", "DATA QUALITY"][index]}
            </small>
            <strong className="mb-1 mt-[7px] block text-[15px] font-bold leading-[normal]">{item[0]}</strong>
            <span className="text-[12px] leading-[1.5] text-[#748191]">
              {index === 0 && <i className="mr-1 inline-block size-1.5 rounded-full bg-brand" />}
              {item[1]}
            </span>
          </div>
        ))}
      </section>
      <section className="mt-[18px] grid grid-cols-[1.55fr_1fr] gap-[17px] max-[900px]:grid-cols-1">
        <Card title="Collection progress" subtitle="Daily verified submissions">
          <div className="h-[223px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#8a97a6" }} />
                <Tooltip />
                <Area dataKey="n" stroke="#14a695" strokeWidth={3} fill="#14a69522" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Attention required" subtitle="Priority actions for this project">
          <Attention
            action="Review"
            icon={Flag}
            tone="red"
            title="24 high-risk records"
            detail="Suspicious duration and GPS checks"
          />
          <Attention
            action="View"
            icon={Users}
            tone="orange"
            title="3 enumerators below target"
            detail="Less than 8 submissions today"
          />
          <Attention
            action="Inspect"
            icon={RefreshCw}
            tone="blue"
            title="Form update available"
            detail="Kobo version changed 2 hours ago"
          />
        </Card>
      </section>
    </>
  );
}

function Attention({
  icon: Icon,
  tone,
  title,
  detail,
  action,
}: {
  icon: typeof Flag;
  tone: "red" | "orange" | "blue";
  title: string;
  detail: string;
  action: string;
}) {
  const tones = {
    red: "bg-[#fdebed] text-[#d45158]",
    orange: "bg-[#fff4e6] text-[#e48532]",
    blue: "bg-[#eaf2ff] text-[#4c7ccd]",
  };
  return (
    <div className="flex items-center gap-2.5 border-b border-[#edf0f2] py-3">
      <span className={`grid size-[31px] place-items-center rounded-[7px] ${tones[tone]}`}>
        <Icon size={16} />
      </span>
      <div className="flex-1">
        <strong className="block text-[13px]">{title}</strong>
        <small className="mt-[3px] block text-xs leading-[1.4] text-[#758092]">{detail}</small>
      </div>
      <button className="border-0 bg-transparent text-[11px] font-bold leading-[normal] text-brand">{action}</button>
    </div>
  );
}
