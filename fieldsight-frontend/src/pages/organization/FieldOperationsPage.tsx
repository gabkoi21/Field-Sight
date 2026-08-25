import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  AdminMetric,
  AdminPanel,
  AdminStatus,
  AdminTableFooter,
  adminInputClass,
} from "../../components/superadmin/AdminUi";
import { Button, PageHeader } from "../../components/ui";
import { apiClient, ApiError } from "../../services/apiClient";

export function FieldOperationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = user?.memberships.find(
    (membership) => membership.role === "organization_admin",
  )?.organization_id;
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const enumeratorsQuery = useQuery({
    queryKey: ["organization-enumerators", organizationId],
    queryFn: () => apiClient.enumerators(organizationId!),
    enabled: Boolean(organizationId),
  });
  const createMutation = useMutation({
    mutationFn: (input: {
      email: string;
      username: string;
      password: string;
    }) => apiClient.createEnumerator(organizationId!, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization-enumerators", organizationId],
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: (membershipId: string) =>
      apiClient.deactivateEnumerator(organizationId!, membershipId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization-enumerators", organizationId],
      }),
  });
  const enumerators = enumeratorsQuery.data ?? [];
  const filteredEnumerators = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return enumerators.filter((enumerator) =>
      `${enumerator.username ?? ""} ${enumerator.email}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [enumerators, query]);
  const activeCount = enumerators.filter(
    (enumerator) => enumerator.is_active,
  ).length;
  const loadError =
    enumeratorsQuery.error instanceof ApiError
      ? enumeratorsQuery.error.message
      : enumeratorsQuery.error
        ? "Unable to load enumerators."
        : "";

  async function createEnumerator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setFormError("");
    try {
      await createMutation.mutateAsync({
        email: email.trim(),
        username: username.trim(),
        password,
      });
      setEmail("");
      setUsername("");
      setPassword("");
      setShowCreate(false);
    } catch (requestError) {
      setFormError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to create the enumerator.",
      );
    }
  }

  async function deactivateEnumerator(membershipId: string, label: string) {
    if (!organizationId || !window.confirm(`Deactivate ${label}?`)) return;
    await deleteMutation.mutateAsync(membershipId);
  }

  if (!organizationId) {
    return (
      <div className="rounded-[7px] border border-[#f0d8b8] bg-[#fffbf4] p-5 text-sm text-[#80664d]">
        Only an Organization Admin can manage enumerators. Your account has no
        Organization Admin membership.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Organization access"
        title="Enumerators"
        description="Create and manage enumerator accounts for your organization."
      >
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Create enumerator
        </Button>
      </PageHeader>
      {loadError && (
        <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
          {loadError}
        </p>
      )}
      <section className="mb-[18px] grid grid-cols-3 gap-[14px] max-[800px]:grid-cols-1">
        <AdminMetric
          label="All enumerators"
          value={String(enumerators.length)}
          detail="Organization membership accounts"
          icon={Users}
        />
        <AdminMetric
          label="Active"
          value={String(activeCount)}
          detail="Can access assigned field work"
          icon={UserCheck}
          tone="green"
        />
        <AdminMetric
          label="Inactive"
          value={String(enumerators.length - activeCount)}
          detail="Access has been disabled"
          icon={UserX}
          tone="orange"
        />
      </section>
      <AdminPanel
        title="Enumerator directory"
        description="Accounts created by this organization administrator"
      >
        <div className="border-b border-line p-4">
          <label className="flex min-h-[38px] max-w-[440px] items-center gap-2 rounded-[7px] border border-[#dfe4e8] bg-white px-3 text-[#8793a2]">
            <Search size={15} />
            <input
              className="w-full border-0 bg-transparent text-xs text-[#324158] outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username or email…"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px]">
            <thead>
              <tr>
                <th>Enumerator</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {enumeratorsQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="text-center">
                    Loading enumerators…
                  </td>
                </tr>
              )}
              {filteredEnumerators.map((enumerator) => (
                <tr key={enumerator.membership_id}>
                  <td>
                    <div>
                      <strong>
                        {enumerator.username ?? "Unnamed enumerator"}
                      </strong>
                      <small>{enumerator.email}</small>
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-[#8793a2]" />{" "}
                      Enumerator
                    </span>
                  </td>
                  <td>
                    <AdminStatus
                      value={enumerator.is_active ? "Active" : "Suspended"}
                    />
                  </td>
                  <td>
                    {new Date(enumerator.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="grid size-7 place-items-center rounded border-0 bg-[#fff1f2] text-[#c2414b] disabled:opacity-50"
                      disabled={
                        !enumerator.is_active || deleteMutation.isPending
                      }
                      onClick={() =>
                        deactivateEnumerator(
                          enumerator.membership_id,
                          enumerator.username ?? enumerator.email,
                        )
                      }
                      aria-label={`Deactivate ${enumerator.username ?? enumerator.email}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!enumeratorsQuery.isLoading && filteredEnumerators.length === 0 && (
            <p className="m-0 p-10 text-center text-xs text-[#8793a2]">
              No enumerators match your search.
            </p>
          )}
        </div>
        <AdminTableFooter
          shown={filteredEnumerators.length}
          total={enumerators.length}
        />
      </AdminPanel>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-[rgba(16,42,67,.23)]"
          onClick={() => setShowCreate(false)}
        >
          <form
            className="absolute bottom-0 right-0 top-0 flex w-[min(470px,100%)] flex-col bg-white shadow-[-16px_0_35px_rgba(16,42,67,.18)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={createEnumerator}
          >
            <header className="flex items-start justify-between border-b border-[#e8edf4] px-[22px] py-5">
              <div>
                <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[.08em] text-brand">
                  Organization access
                </p>
                <h2 className="m-0 text-xl text-[#303e67]">
                  Create enumerator
                </h2>
                <p className="mb-0 mt-1 text-[11px] text-[#8391a5]">
                  The account receives the Enumerator membership role.
                </p>
              </div>
              <button
                type="button"
                className="border-0 bg-transparent text-[#8290a2]"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-auto px-[22px] py-5">
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Email
                <input
                  type="email"
                  className={adminInputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Username
                <input
                  className={adminInputClass}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={100}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Role
                <input
                  className={`${adminInputClass} cursor-not-allowed`}
                  value="Enumerator"
                  readOnly
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Temporary password
                <input
                  type="password"
                  className={adminInputClass}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  maxLength={1024}
                  autoComplete="new-password"
                  required
                />
              </label>
              {formError && (
                <p className="m-0 text-[11px] text-[#b42318]">{formError}</p>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#e8edf4] px-[22px] py-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                <Plus size={15} />{" "}
                {createMutation.isPending ? "Creating…" : "Create enumerator"}
              </Button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
