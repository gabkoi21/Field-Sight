import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
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
import { apiClient, ApiError, type ApiEnumerator } from "../../services/apiClient";

export function FieldOperationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOrganizationAdmin = Boolean(
    user?.memberships.some((membership) => membership.role === "organization_admin"),
  );
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [actionError, setActionError] = useState("");
  const enumeratorsQuery = useQuery({
    queryKey: ["organization-enumerators"],
    queryFn: apiClient.enumerators,
    enabled: isOrganizationAdmin,
  });
  const enumeratorQuery = useQuery({
    queryKey: ["organization-enumerator", selectedMembershipId],
    queryFn: () => apiClient.enumerator(selectedMembershipId!),
    enabled: Boolean(isOrganizationAdmin && selectedMembershipId),
  });
  const createMutation = useMutation({
    mutationFn: (input: {
      full_name: string;
      email: string;
      username: string;
      password: string;
      phone_number?: string;
      employee_id?: string;
      gender?: string;
      date_of_birth?: string;
      address?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      notes?: string;
    }) => apiClient.createEnumerator(input),
    onSuccess: async (createdEnumerator) => {
      queryClient.setQueryData<ApiEnumerator[]>(["organization-enumerators"], (current = []) => [
        createdEnumerator,
        ...current.filter((enumerator) => enumerator.membership_id !== createdEnumerator.membership_id),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["organization-enumerators"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (membershipId: string) =>
      apiClient.deactivateEnumerator(membershipId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization-enumerators"],
      }),
  });  const updateMutation = useMutation({
    mutationFn: ({ membershipId, isActive }: { membershipId: string; isActive: boolean }) =>
      apiClient.updateEnumerator(membershipId, { is_active: isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization-enumerators"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["organization-enumerator", selectedMembershipId],
      });
    },
  });
  const enumerators = enumeratorsQuery.data ?? [];
  const filteredEnumerators = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return enumerators.filter((enumerator) =>
      `${enumerator.full_name ?? ""} ${enumerator.username ?? ""} ${enumerator.email}`
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

  const selectedEnumerator =
    enumeratorQuery.data ??
    enumerators.find((enumerator) => enumerator.membership_id === selectedMembershipId);
  async function createEnumerator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOrganizationAdmin) return;
    setFormError("");
    try {
      await createMutation.mutateAsync({
        full_name: fullName.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
        phone_number: phoneNumber || undefined,
        employee_id: employeeId || undefined,
        gender: gender || undefined,
        date_of_birth: dateOfBirth || undefined,
        address: address || undefined,
        emergency_contact_name: emergencyContactName || undefined,
        emergency_contact_phone: emergencyContactPhone || undefined,
        notes: notes || undefined,
      });
      setFullName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setPhoneNumber(""); setEmployeeId(""); setGender(""); setDateOfBirth(""); setAddress("");
      setEmergencyContactName(""); setEmergencyContactPhone(""); setNotes("");
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
    if (!isOrganizationAdmin || !window.confirm(`Deactivate ${label}?`)) return;
    setActionError("");
    try {
      await deleteMutation.mutateAsync(membershipId);
      if (selectedMembershipId === membershipId) setSelectedMembershipId(null);
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to deactivate the enumerator.",
      );
    }
  }

  function openEnumerator(enumerator: ApiEnumerator) {
    setSelectedMembershipId(enumerator.membership_id);
    setEditIsActive(enumerator.is_active);
    setActionError("");
  }

  function closeEnumerator() {
    if (!updateMutation.isPending) setSelectedMembershipId(null);
  }

  async function updateEnumerator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMembershipId) return;
    setActionError("");
    try {
      await updateMutation.mutateAsync({
        membershipId: selectedMembershipId,
        isActive: editIsActive,
      });
      setSelectedMembershipId(null);
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to update the enumerator.",
      );
    }
  }
  if (!isOrganizationAdmin) {
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
      {actionError && (
        <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
          {actionError}
        </p>
      )}      <section className="mb-[18px] grid grid-cols-3 gap-[14px] max-[800px]:grid-cols-1">
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
              placeholder="Search name, username, or email…"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px]">
            <thead>
              <tr>
                <th>Full name</th>
                <th>Employee ID</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {enumeratorsQuery.isLoading && (
                <tr>
                  <td colSpan={8} className="text-center">
                    Loading enumerators…
                  </td>
                </tr>
              )}
              {filteredEnumerators.map((enumerator) => (
                <tr key={enumerator.membership_id}>
                  <td>
                    <div>
                      <strong>
                        {enumerator.full_name ?? enumerator.username ?? "Unnamed enumerator"}
                      </strong>
                      <small>{enumerator.email} · @{enumerator.username ?? "not set"}</small>
                    </div>
                  </td>
                  <td>{enumerator.employee_id ?? "—"}</td>
                  <td>{enumerator.phone_number ?? "—"}</td>
                  <td className="max-w-[190px] truncate">{enumerator.address ?? "—"}</td>
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
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded border border-[#dfe4e8] bg-white text-[#66788a]"
                        onClick={() => openEnumerator(enumerator)}
                        aria-label={"Manage " + (enumerator.full_name ?? enumerator.username ?? enumerator.email)}
                        title="Manage enumerator"
                      >
                        <MoreHorizontal size={15} />
                      </button>

                    </div>
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

      {selectedMembershipId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#102a4340] p-4" onClick={closeEnumerator}>
          <form className="w-full max-w-[480px] overflow-hidden rounded-[6px] border border-[#dfe4e8] bg-white shadow-[0_12px_32px_rgba(16,42,67,.16)]" onClick={(event) => event.stopPropagation()} onSubmit={updateEnumerator}>
            <header className="flex items-center justify-between border-b border-[#e8edf4] px-5 py-4">
              <h2 className="m-0 text-[16px] font-semibold text-[#253342]">Manage enumerator</h2>
              <button type="button" className="border-0 bg-transparent p-0 text-[#8290a2]" onClick={closeEnumerator} aria-label="Close enumerator card">
                <X size={18} />
              </button>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {enumeratorQuery.isLoading && (
                <p className="m-0 text-xs text-[#7b8794] sm:col-span-2">Loading enumerator…</p>
              )}
              {enumeratorQuery.error && (
                <p className="m-0 text-xs text-[#b42318] sm:col-span-2">
                  {enumeratorQuery.error instanceof ApiError ? enumeratorQuery.error.message : "Unable to load the enumerator."}
                </p>
              )}
              {selectedEnumerator && (
                <>
                  <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">
                    Full name
                    <input className={adminInputClass + " bg-[#f5f7fa] text-[#7b8794]"} value={selectedEnumerator.full_name ?? ""} readOnly />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">
                    Email
                    <input className={adminInputClass + " bg-[#f5f7fa] text-[#7b8794]"} value={selectedEnumerator.email} readOnly />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                    Username
                    <input className={adminInputClass + " bg-[#f5f7fa] text-[#7b8794]"} value={selectedEnumerator.username ?? ""} readOnly />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                    Role
                    <input className={adminInputClass + " bg-[#f5f7fa] text-[#7b8794]"} value="Enumerator" readOnly />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                    Status
                    <select className={adminInputClass} value={editIsActive ? "active" : "inactive"} onChange={(event) => setEditIsActive(event.target.value === "active")}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                    Created
                    <input className={adminInputClass + " bg-[#f5f7fa] text-[#7b8794]"} value={new Date(selectedEnumerator.created_at).toLocaleDateString()} readOnly />
                  </label>
                </>
              )}
              {actionError && <p className="m-0 text-xs text-[#b42318] sm:col-span-2">{actionError}</p>}
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-[#e8edf4] bg-[#fbfcfd] px-5 py-3">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[#f0c8cd] bg-white px-3 text-xs font-semibold text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedEnumerator?.is_active || deleteMutation.isPending}
                onClick={() =>
                  selectedEnumerator &&
                  deactivateEnumerator(
                    selectedEnumerator.membership_id,
                    selectedEnumerator.full_name ?? selectedEnumerator.username ?? selectedEnumerator.email,
                  )
                }
              >
                <Trash2 size={14} /> {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={closeEnumerator}>Cancel</Button>
                <Button type="submit" disabled={!selectedEnumerator || updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </footer>
          </form>
        </div>
      )}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(16,42,67,.23)] p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-[620px] flex-col overflow-hidden rounded-[8px] bg-white shadow-[0_20px_55px_rgba(16,42,67,.24)]"
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
            <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto px-6 py-6 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">
                Full name
                <input
                  className={adminInputClass}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">
                Email
                <input
                  type="email"
                  className={adminInputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">
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
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">
                Role
                <input
                  className={`${adminInputClass} cursor-not-allowed`}
                  value="Enumerator"
                  readOnly
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">
                Temporary password
                <input
                  type="password"
                  className={adminInputClass}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={1024}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">Phone number<input type="tel" className={adminInputClass} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">Employee ID<input className={adminInputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">Gender<input className={adminInputClass} value={gender} onChange={(event) => setGender(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">Date of birth<input type="date" className={adminInputClass} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">Address<input className={adminInputClass} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">Emergency contact name<input className={adminInputClass} value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">Emergency contact phone<input type="tel" className={adminInputClass} value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177] sm:col-span-2">Notes<textarea className={adminInputClass} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} /></label>              {formError && (
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