import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { apiClient, type WorkspaceMember } from "../services/apiClient";
import { Button, LoadingState } from "../components/ui";
import { Dialog } from "../pages/organization/IndicatorForms";
import { useWorkspace } from "./WorkspaceContext";
import { Field, Notice, Page, Panel, WorkspaceTabs, fieldClass } from "./WorkspaceUI";

export function WorkspaceTeamPage({ workspaceOnly = false }: { workspaceOnly?: boolean }) {
  const { organizationId, projectId, project } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const scope = workspaceOnly || params.get("scope") === "workspace";
  const cache = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMember["role"]>("enumerator");
  const [member, setMember] = useState("");
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
    mutationFn: () => apiClient.inviteMember(organizationId, { email, role }),
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
  const assign = useMutation({
    mutationFn: () => apiClient.addProjectMember(projectId, member),
    onSuccess: async () => {
      setMember("");
      await refresh();
    },
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
    assign.error,
    revoke.error,
    remove.error,
  ].filter(Boolean);
  return (
    <Page
      title={workspaceOnly ? `${project?.name ?? "Project"} — Team` : "Team & invitations"}
      description={workspaceOnly ? "Manage the people assigned to this project." : "Manage organization access and assign colleagues to a project."}
      actions={
        <Button
          onClick={() => {
            setInviting(true);
            setLink("");
            invite.reset();
          }}
        >
          <Plus size={15} />
          Invite member
        </Button>
      }
    >
      {workspaceOnly && <WorkspaceTabs />}
      <Panel>
        {!workspaceOnly && <div className="flex gap-5 border-b border-[#e4ebed] px-5">
          {[
            [false, "Organization team"],
            [true, "Project team"],
          ].map(([value, label]) => (
            <button
              key={String(label)}
              className={`border-0 border-b-2 bg-transparent py-3 text-xs ${scope === value ? "border-[#168596] font-semibold text-[#168596]" : "border-transparent text-[#73868d]"}`}
              onClick={() => setParams(value ? { scope: "workspace" } : {})}
            >
              {label}
            </button>
          ))}
        </div>}
        <div className="flex items-start gap-3 p-4 text-xs leading-6 text-[#73868d]">
          <ShieldCheck className="shrink-0 text-[#168596]" size={18} />
          {scope
            ? `Project: ${project?.name ?? "Select a project"}. Organization administrators already have access. Field members use collection assignments; administrative analytics remain administrator-only.`
            : "Organization administrators manage every project in this portal. Field members collect through KoboToolbox and do not sign in to the FieldSight portal."}
        </div>
      </Panel>
      {errors.map((error, i) => (
        <Notice error key={i}>
          {error?.message}
        </Notice>
      ))}
      {team.isLoading ? (
        <LoadingState />
      ) : scope ? (
        <>
          {projectId && (
            <Panel className="p-5">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  assign.mutate();
                }}
              >
                <div className="min-w-[240px] flex-1">
                  <Field label="Add existing team member">
                    <select
                      className={fieldClass}
                      value={member}
                      onChange={(e) => setMember(e.target.value)}
                      required
                    >
                      <option value="">Choose an active field member</option>
                      {team.data
                        ?.filter(
                          (m) =>
                            m.role === "enumerator" &&
                            m.is_active &&
                            !assignments.data?.some((a) => a.id === m.id),
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name ?? m.email}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <Button type="submit" disabled={!member || assign.isPending}>
                  Add to project
                </Button>
              </form>
            </Panel>
          )}
          <Panel>
            <TeamTable
              members={assignments.data ?? []}
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
              <Empty message="No field members assigned. Invite a colleague, then add their accepted account here." />
            )}
          </Panel>
        </>
      ) : (
        <>
          <Panel>
            <TeamTable
              members={team.data ?? []}
              action={(item) => (
                <div className="flex items-center gap-3">
                  <select
                    aria-label={`Role for ${item.email}`}
                    value={item.role}
                    className="rounded border border-[#e1e7eb] bg-white px-2 py-1 text-xs"
                    disabled={update.isPending}
                    onChange={(e) =>
                      update.mutate({
                        id: item.id,
                        role: e.target.value as WorkspaceMember["role"],
                        is_active: item.is_active,
                      })
                    }
                  >
                    <option value="organization_admin">
                      Organization administrator
                    </option>
                    <option value="enumerator">Field team member</option>
                  </select>
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
            {invitations.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafb] text-[10px] uppercase text-[#87969d]">
                    <tr>
                      {["Email", "Role", "Status", "Expires", ""].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.data.map((item) => (
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
              <Field label="Organization role">
                <select
                  className={fieldClass}
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as WorkspaceMember["role"])
                  }
                >
                  <option value="enumerator">Field team member</option>
                  <option value="organization_admin">
                    Organization administrator
                  </option>
                </select>
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[660px] text-left text-xs">
        <thead className="bg-[#f8fafb] text-[10px] uppercase tracking-wide text-[#87969d]">
          <tr>
            {["Member", "Email", "Status", "Access"].map((h) => (
              <th key={h} className="px-5 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((item) => (
            <tr key={item.id} className="border-t border-[#edf0f2]">
              <td className="px-5 py-4 font-medium">
                {item.full_name ?? "Team member"}
              </td>
              <td className="px-5">{item.email}</td>
              <td className="px-5">
                <span
                  className={`rounded px-2 py-1 text-[10px] ${item.is_active ? "bg-[#eaf7ef] text-[#388567]" : "bg-[#f5edef] text-[#ac6671]"}`}
                >
                  {item.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-5">{action(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
