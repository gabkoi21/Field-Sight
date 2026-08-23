import { FileText, MoreHorizontal, Plus } from "lucide-react";
import { Badge, Button, PageHeader } from "../../components/ui";

const forms = [
  [
    "CHA Baseline v3",
    "Community Health Assessment",
    "Live",
    "v3.4",
    "1,842",
    "8 min ago",
  ],
  [
    "MHS Field Survey",
    "Maternal Health Survey",
    "Live",
    "v2.1",
    "3,104",
    "42 min ago",
  ],
  [
    "Water Point Census",
    "Water Access Mapping",
    "Paused",
    "v1.8",
    "986",
    "Yesterday",
  ],
  [
    "YES Follow-up",
    "Youth Employment Study",
    "Draft",
    "v0.9",
    "2,716",
    "Not deployed",
  ],
];

const tabs = [
  ["All forms", "6"],
  ["Live", "4"],
  ["Draft", "1"],
  ["Paused", "1"],
];

export function FormsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Collection instruments"
        title="Forms & data sources"
        description="Manage form lifecycle, deployment versions, and connected collection sources."
      >
        <Button>
          <Plus size={16} />
          Connect Kobo form
        </Button>
      </PageHeader>
      <div className="mb-[-1px] flex gap-1 border-b border-[#e5e8ec]">
        {tabs.map((tab, index) => (
          <button
            className={`border-x-0 border-t-0 bg-transparent px-3.5 py-2.5 text-[13px] font-semibold ${index === 0 ? "border-b-2 border-brand text-brand" : "border-b-2 border-transparent text-[#6f7c8b]"}`}
            key={tab[0]}
          >
            {tab[0]}{" "}
            <b className="ml-1 rounded-[10px] bg-[#edf0f2] px-1.5 py-0.5 text-[9px]">
              {tab[1]}
            </b>
          </button>
        ))}
      </div>
      <section className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {forms.map((form, index) => (
          <article
            className="rounded-lg border border-[#e7e9ed] bg-white p-[19px]"
            key={form[0]}
          >
            <div className="flex items-center gap-[9px]">
              <span className="grid size-[33px] place-items-center rounded-[7px] bg-[#edf5ff] text-[#4c7ccd]">
                <FileText size={17} />
              </span>
              <span className="ml-auto">
                <Badge
                  value={
                    form[2] === "Live"
                      ? "Active"
                      : form[2] === "Draft"
                        ? "Needs attention"
                        : "Flagged"
                  }
                />
              </span>
              <MoreHorizontal size={17} />
            </div>
            <h2 className="mb-1 mt-[15px] text-base font-semibold leading-[1.35]">
              {form[0]}
            </h2>
            <p className="m-0 text-[13px] leading-[1.5] text-[#758092]">
              {form[1]}
            </p>
            <dl className="my-[17px] grid grid-cols-3 border-y border-[#edf0f2] max-[600px]:grid-cols-1">
              {[
                ["Version", form[3]],
                ["Submissions", form[4]],
                ["Last sync", form[5]],
              ].map(([label, value]) => (
                <div className="py-3 pr-2 max-[600px]:py-2" key={label}>
                  <dt className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#8792a0]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-xs font-bold text-[#334254]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <footer className="flex justify-end gap-[7px]">
              <button className="rounded-md border border-[#dfe4e8] bg-white px-2.5 py-[7px] text-[11px] font-semibold text-[#536273]">
                View data
              </button>
              <button className="rounded-md border border-brand bg-brand px-2.5 py-[7px] text-[11px] font-semibold text-white hover:bg-brand-hover">
                {index === 3 ? "Continue setup" : "Manage form"}
              </button>
            </footer>
          </article>
        ))}
      </section>
    </>
  );
}
