import { Plus, ShieldCheck } from "lucide-react";
import { Badge, Button, DataTable, PageHeader } from "../../components/ui";

const team = [
  ["Amara Johnson", "Data Manager", "Active", "amara@communityhealth.org"],
  ["Lena Doe", "Organization Admin", "Active", "lena@communityhealth.org"],
  ["David Nyan", "Analyst", "Invited", "david@communityhealth.org"],
  ["Mary Kamara", "Enumerator", "Active", "mary@communityhealth.org"],
];

export function TeamPage() {
  return (
    <>
      <PageHeader
        eyebrow="Organization access"
        title="Team"
        description="Manage members, roles, and permissions for Community Health Initiative."
      >
        <Button>
          <Plus size={16} />
          Invite member
        </Button>
      </PageHeader>
      <section className="mb-[18px] flex items-center gap-[13px] rounded-lg border border-[#cbdcf3] bg-[#f2f6fd] px-5 py-[17px]">
        <ShieldCheck className="text-brand" />
        <div>
          <strong className="text-[13px]">Roles protect your tenant data</strong>
          <p className="mt-1 text-xs text-[#667688]">
            Members only see projects and actions allowed by their organization role.
          </p>
        </div>
        <button className="ml-auto text-xs font-bold bg-transparent border-0 text-brand">Manage roles</button>
      </section>
      <DataTable headers={["Member", "Role", "Status", "Email", ""]}>
        {team.map((member) => (
          <tr key={member[0]}>
            <td>
              <span className="mr-[7px] inline-grid size-[27px] place-items-center rounded-full bg-[rgba(11,81,183,.08)] align-middle text-[10px] font-bold text-brand">
                {member[0]
                  .split(" ")
                  .map((name) => name[0])
                  .join("")}
              </span>
              <strong>{member[0]}</strong>
            </td>
            <td>{member[1]}</td>
            <td>
              <Badge value={member[2]} />
            </td>
            <td>{member[3]}</td>
            <td>•••</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
