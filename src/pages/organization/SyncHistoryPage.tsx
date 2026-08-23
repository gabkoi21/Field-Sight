import { Link2, RefreshCw } from "lucide-react";
import { Badge, Button, DataTable, PageHeader } from "../../components/ui";

const jobs = [
  [
    "Community Health Assessment",
    "KoboToolbox",
    "184",
    "Completed",
    "8 min ago",
  ],
  ["Maternal Health Survey", "KoboToolbox", "92", "Completed", "42 min ago"],
  [
    "Water Access Mapping",
    "KoboToolbox",
    "0",
    "Action required",
    "Yesterday, 17:20",
  ],
  [
    "Youth Employment Study",
    "KoboToolbox",
    "164",
    "Completed",
    "Yesterday, 15:08",
  ],
];

export function SyncHistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Data collection"
        title="Sync history"
        description="Track imports from connected KoboToolbox forms and resolve exceptions."
      >
        <Button>
          <RefreshCw size={16} />
          Sync all forms
        </Button>
      </PageHeader>
      <section className="mb-[18px] flex items-center gap-[13px] rounded-lg border border-[#cbdcf3] bg-[#f2f6fd] px-5 py-[17px]">
        <span className="grid size-[38px] place-items-center rounded-[9px] bg-[rgba(11,81,183,.08)] text-brand">
          <Link2 size={20} />
        </span>
        <div>
          <strong className="text-[13px]">
            KoboToolbox connection healthy
          </strong>
          <p className="mt-1 text-xs text-[#667688]">
            2 forms synced in the last hour. Your access token is valid.
          </p>
        </div>
        <Button className="ml-auto max-[900px]:hidden" variant="secondary">
          Manage integration
        </Button>
      </section>
      <DataTable
        headers={[
          "Project",
          "Source",
          "New records",
          "Status",
          "Completed",
          "",
        ]}
      >
        {jobs.map((job) => (
          <tr key={job[0]}>
            <td>
              <strong>{job[0]}</strong>
            </td>
            <td>{job[1]}</td>
            <td>{job[2]}</td>
            <td>
              <Badge
                value={job[3] === "Completed" ? "Valid" : "Needs attention"}
              />
            </td>
            <td>{job[4]}</td>
            <td>•••</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
