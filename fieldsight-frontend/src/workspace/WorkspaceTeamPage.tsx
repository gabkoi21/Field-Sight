import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Copy, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { apiClient, type WorkspaceMember } from "../services/apiClient";
import { Button, LoadingState } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { useWorkspace } from "./WorkspaceContext";
import { Field, Notice, Page, Panel, WorkspaceTabs, fieldClass } from "./WorkspaceUI";

export function WorkspaceTeamPage({ workspaceOnly = false, adminOnly = false }: { workspaceOnly?: boolean; adminOnly?: boolean }) {
  const { organizationId, projectId, project } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const scope = !adminOnly && params.get("scope") === "workspace";
  const memberRole = adminOnly ? "organization_admin" : "enumerator";
  const cache = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<(WorkspaceMember & { assignment_id: string }) | null>(null);
  const team = useQuery({
    queryKey: ["workspace-team", organizationId],
    queryFn: () => apiClient.workspaceTeam(organizationId),
    enabled: Boolean(organizationId),
  });
  const invitations = useQuery({
    queryKey: ["invitations", organizationId],
    queryFn: () => apiClient.invitations(organizationId),
    enabled: Boolean(organizationId),
  });
  const assignments = useQuery({
    queryKey: ["project-team", projectId],
    queryFn: () => apiClient.projectTeam(projectId),
    enabled: Boolean(projectId),
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["workspace-team"] }),
      cache.invalidateQueries({ queryKey: ["invitations"] }),
      cache.invalidateQueries({ queryKey: ["project-team"] }),
    ]);
  }
  const invite = useMutation({
    mutationFn: () => apiClient.inviteMember(organizationId, { email, role: memberRole }),
    onSuccess: async (result) => {
      setLink(
        `${window.location.origin}/accept-invitation?token=${encodeURIComponent(result.token)}`,
      );
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      role,
      is_active,
    }: {
      id: string;
      role: WorkspaceMember["role"];
      is_active: boolean;
    }) =>
      apiClient.updateWorkspaceMember(organizationId, id, { role, is_active }),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiClient.revokeInvitation(organizationId, id),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.removeProjectMember(projectId, id),
    onSuccess: async () => {
      setRemoving(null);
      await refresh();
    },
  });
  const errors = [
    team.error,
    invitations.error,
    assignments.error,
    invite.error,
    update.error,
    revoke.error,
    remove.error,
  ].filter(Boolean);
  return (
    <Page
      breadcrumb={workspaceOnly ? project?.name ?? "Select a project" : "FieldSight / Project"}
      title={adminOnly ? "Administrator accounts" : "Team & invitations"}
      description={adminOnly ? "Manage organization administrators and their invitations." : "Manage field members and project team assignments."}
      actions={
        <div className="flex flex-wrap items-center gap-3">
        {!adminOnly && <Link className="text-sm text-[#0b51b7]" to={`/enumerators?project_id=${projectId}`}>Manage enumerators →</Link>}
        <Button
          onClick={() => {
            setInviting(true);
            setLink("");
            invite.reset();
          }}
        >
          <Plus size={15} />
          {adminOnly ? "Invite administrator" : "Invite enumerator"}
        </Button>
        </div>
      }
    >
      <Notice>FieldSight administrators manage organization access. Kobo enumerators collect in Kobo; invitations here create FieldSight access only, never a Kobo account. Revoking an invitation blocks acceptance. Removing a project assignment removes project access; disabling membership removes organization access.</Notice>
      {workspaceOnly && <WorkspaceTabs />}
      {adminOnly && <Link to="/settings" className="text-sm text-[#0b51b7]">← Back to organization settings</Link>}
      {!adminOnly && <Panel>
        <div aria-label="Team views" className="flex flex-wrap items-center gap-2 border-b border-[#e1e7eb] px-4 pt-2">
          {[
            [false, "Field team"],
            [true, "Project team"],
          ].map(([value, label]) => (
            <button
              key={String(label)}
              aria-pressed={scope === value}
              className={`min-h-11 border-0 border-b-2 bg-transparent px-4 py-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#0b51b7] ${scope === value ? "border-[#0b51b7] font-semibold text-[#0b51b7]" : "border-transparent text-[#607882] hover:bg-[#f5f9ff] hover:text-[#0b51b7]"}`}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (value) next.set("scope", "workspace");
                else next.delete("scope");
                setParams(next);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {!scope && <div className="flex items-start gap-3 p-4 text-xs leading-6 text-[#73868d]">
          <ShieldCheck className="shrink-0 text-[#168596]" size={18} />
          Field team lists your organization’s enumerators. Project team shows the members assigned to this project.
        </div>}
      </Panel>}
      {errors.map((error, i) => (
        <Notice error key={i}>
          {error?.message}
        </Notice>
      ))}
      {team.isLoading || (scope && assignments.isLoading) ? (
        <LoadingState />
      ) : scope ? (
        <>
          <Panel>
            <TeamTable
              key={`project-${projectId}`}
              members={(assignments.data ?? []).filter((item) => item.role === "enumerator")}
              action={(item) => (
                <button
                  aria-label={`Remove ${item.email} from project`}
                  onClick={() => {
                    const row = assignments.data?.find((a) => a.id === item.id);
                    if (row) {
                      remove.reset();
                      setRemoving(row);
                    }
                  }}
                  className="border-0 bg-transparent text-[#bb6370]"
                  disabled={remove.isPending}
                >
                  <Trash2 size={15} />
                </button>
              )}
            />
            {!assignments.data?.length && (
              <Empty message="No field members are assigned to this project yet." />
            )}
          </Panel>
        </>
      ) : (
        <>
          <Panel>
            <TeamTable
              key={`organization-${organizationId}`}
              members={(team.data ?? []).filter((item) => item.role === memberRole)}
              action={(item) => (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#607882]">{adminOnly ? "Administrator" : "Enumerator"}</span>

                  <button
                    disabled={update.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `${item.is_active ? "Deactivate" : "Reactivate"} access for ${item.email}?`,
                        )
                      )
                        update.mutate({
                          id: item.id,
                          role: item.role,
                          is_active: !item.is_active,
                        });
                    }}
                    className="border-0 bg-transparent text-xs text-[#168596]"
                  >
                    {item.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              )}
            />
          </Panel>
          <Panel>
            <h2 className="m-0 border-b border-[#e4ebed] px-5 py-4 text-sm font-semibold">
              Invitations
            </h2>
            {invitations.data?.some((item) => item.role === memberRole) ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafb] text-[12px] uppercase text-[#87969d]">
                    <tr>
                      {["Email", "Role", "Status", "Expires", ""].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.data.filter((item) => item.role === memberRole).map((item) => (
                      <tr key={item.id} className="border-t border-[#edf0f2]">
                        <td className="px-5 py-4">{item.email}</td>
                        <td>
                          {item.role === "organization_admin"
                            ? "Administrator"
                            : "Field member"}
                        </td>
                        <td className="capitalize">{item.status}</td>
                        <td>
                          {new Date(item.expires_at).toLocaleDateString()}
                        </td>
                        <td>
                          {item.status === "pending" && (
                            <button
                              onClick={() => revoke.mutate(item.id)}
                              className="border-0 bg-transparent text-xs text-[#ba6170]"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty message="No invitations yet. Create a setup link for your first colleague." />
            )}
          </Panel>
        </>
      )}
      {removing && (
        <Dialog
          title="Remove team member?"
          compact
          description={`Remove ${removing.full_name ?? removing.email} from ${project?.name ?? "this project"}? Their organization account will remain active.`}
          error={remove.error?.message}
          onClose={() => { if (!remove.isPending) setRemoving(null); }}
        >
          <div className="flex justify-end gap-3">
            <Button disabled={remove.isPending} onClick={() => setRemoving(null)}>Cancel</Button>
            <Button disabled={remove.isPending} onClick={() => remove.mutate(removing.assignment_id)}>
              {remove.isPending ? "Removing…" : "Remove member"}
            </Button>
          </div>
        </Dialog>
      )}
      {inviting && (
        <Dialog
          title="Invite a team member"
          description="Create a one-time account setup link. Valid for seven days."
          error={invite.error?.message}
          onClose={() => setInviting(false)}
        >
          {link ? (
            <div className="space-y-4">
              <Notice>
                Invitation created. Copy this link and share it with {email}.
                Email was not sent.
              </Notice>
              <Field label="Account setup link">
                <input
                  readOnly
                  className={fieldClass}
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
              </Field>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Copied" : "Copy invitation link"}
              </Button>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <Field label="Email address">
                <input
                  type="email"
                  required
                  className={fieldClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Role">
                <input className={fieldClass} readOnly value={adminOnly ? "Organization administrator" : "Enumerator"} />
              </Field>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Creating…" : "Create invitation"}
              </Button>
            </form>
          )}
        </Dialog>
      )}
    </Page>
  );
}
function TeamTable({
  members,
  action,
}: {
  members: WorkspaceMember[];
  action: (item: WorkspaceMember) => React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visibleMembers = members.slice(start, start + pageSize);
  return (
    <>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse whitespace-nowrap text-left text-sm">
        <thead className="bg-[#f8fafb] text-[12px] uppercase tracking-[.04em] text-[#73828b]">
          <tr>
            {["Member", "Email", "Status", "Access"].map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleMembers.map((item) => (
            <tr key={item.id} className="border-t border-[#edf0f2] hover:bg-[#fafcfc]">
              <td className="px-4 py-3 font-medium">
                {item.full_name ?? "Team member"}
              </td>
              <td className="px-4 py-3">{item.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-1 text-[12px] ${item.is_active ? "bg-[#eaf7ef] text-[#388567]" : "bg-[#f5edef] text-[#ac6671]"}`}
                >
                  {item.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3">{action(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e7eb] px-5 py-3 text-xs text-[#73828b]">
      <span aria-live="polite">{members.length ? start + 1 : 0}–{Math.min(start + pageSize, members.length)} of {members.length} members</span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">Rows per page
          <select className="rounded border border-[#dce4e8] bg-white px-2 py-1 text-[#24434c]" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {[10,25,50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <nav aria-label="Team pagination" className="flex items-center gap-2">
          <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={13} />Previous</Button>
          <span>Page {currentPage} of {pageCount}</span>
          <Button variant="secondary" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={13} /></Button>
        </nav>
      </div>
    </footer>
    </>
  );
}
function Empty({ message }: { message: string }) {
  return (
    <div className="grid justify-items-center gap-3 p-10 text-center text-sm text-[#87969d]">
      <Users size={25} />
      {message}
    </div>
  );
}
