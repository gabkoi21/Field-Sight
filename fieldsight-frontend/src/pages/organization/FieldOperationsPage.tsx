import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, Plus, Search, ShieldCheck, Trash2, UserCheck, Users, UserX, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { AdminStatus, AdminTableFooter, adminInputClass } from "../../components/superadmin/AdminUi";
import { Button } from "../../components/ui";
import { Card } from "../../components/ui/Card";
import { LoadingState } from "../../components/ui/LoadingState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/Table";
import { apiClient, ApiError, type ApiEnumerator, type EnumeratorUpdateInput } from "../../services/apiClient";

export function FieldOperationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOrganizationAdmin = Boolean(user?.memberships.some((membership) => membership.role === "organization_admin"));
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [exportPeriod, setExportPeriod] = useState<"daily" | "weekly" | "biweekly" | "monthly">("daily");
  const [showCreate, setShowCreate] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [assignedProjectId, setAssignedProjectId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmergencyContactName, setEditEmergencyContactName] = useState("");
  const [editEmergencyContactPhone, setEditEmergencyContactPhone] = useState("");
  const [actionError, setActionError] = useState("");
  const manageFieldClass = `${adminInputClass} min-h-[36px] border-[#edf1f5] bg-[#f5f7fa] px-2.5 text-[12px] text-[#526177]`;
  const enumeratorsQuery = useQuery({
    queryKey: ["organization-enumerators"],
    queryFn: apiClient.enumerators,
    enabled: isOrganizationAdmin,
  });
  const organizationId = user?.memberships.find(
    (membership) => membership.role === "organization_admin",
  )?.organization_id;
  const projectsQuery = useQuery({
    queryKey: ["organization-projects", organizationId],
    queryFn: () => apiClient.organizationProjects(organizationId!),
    enabled: Boolean(organizationId),
  });
  const assignmentsQuery = useQuery({
    queryKey: ["organization-assignments", organizationId],
    queryFn: () => apiClient.organizationAssignments(organizationId!),
    enabled: Boolean(organizationId),
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
      project_id: string;
      phone_number?: string;
      gender?: string;
      date_of_birth?: string;
      address?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
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
    mutationFn: (membershipId: string) => apiClient.deactivateEnumerator(membershipId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization-enumerators"],
      }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ membershipId, input }: { membershipId: string; input: EnumeratorUpdateInput }) =>
      apiClient.updateEnumerator(membershipId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-enumerators"] });
      await queryClient.invalidateQueries({ queryKey: ["organization-enumerator", selectedMembershipId] });
    },
  });
  const enumerators = enumeratorsQuery.data ?? [];
  const projects = useMemo(
    () => [...(projectsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [projectsQuery.data],
  );
  const assignedMembershipIds = useMemo(() => {
    if (!projectId) return null;
    return new Set(
      (assignmentsQuery.data ?? [])
        .filter((assignment) => assignment.project_id === projectId && assignment.is_enabled)
        .map((assignment) => assignment.membership_id),
    );
  }, [assignmentsQuery.data, projectId]);
  const projectNamesByMembershipId = useMemo(() => {
    const projectsById = new Map(projects.map((project) => [project.id, project.name]));
    const namesByMembershipId = new Map<string, string[]>();

    (assignmentsQuery.data ?? []).forEach((assignment) => {
      if (!assignment.is_enabled) return;
      const projectName = projectsById.get(assignment.project_id);
      if (!projectName) return;
      const names = namesByMembershipId.get(assignment.membership_id) ?? [];
      if (!names.includes(projectName)) names.push(projectName);
      namesByMembershipId.set(assignment.membership_id, names);
    });

    return namesByMembershipId;
  }, [assignmentsQuery.data, projects]);
  const filteredEnumerators = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return enumerators.filter((enumerator) => {
      const identities = [enumerator.full_name, enumerator.username, enumerator.email]
        .filter(Boolean)
        .map((value) => value!.trim().toLowerCase());
      const matchesSearch = identities.join(" ").includes(normalized);
      const matchesProject = !assignedMembershipIds || assignedMembershipIds.has(enumerator.membership_id);
      return matchesSearch && matchesProject;
    });
  }, [assignedMembershipIds, enumerators, query]);
  const exportEnumerators = useMemo(() => {
    const days = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }[exportPeriod];
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    return filteredEnumerators.filter((enumerator) => new Date(enumerator.created_at).getTime() >= cutoff.getTime());
  }, [filteredEnumerators, exportPeriod]);
  const exportCsv = () => {
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = exportEnumerators.map((enumerator) => [
      enumerator.full_name ?? "",
      enumerator.email,
      enumerator.username ?? "",
      enumerator.employee_id ?? "",
      enumerator.phone_number ?? "",
      enumerator.address ?? "",
      enumerator.gender ?? "",
      enumerator.is_active ? "Active" : "Suspended",
      new Date(enumerator.created_at).toLocaleDateString(),
    ]);
    const csv = [
      ["Full name", "Email", "Username", "Employee ID", "Phone", "Address", "Gender", "Status", "Created"],
      ...rows,
    ]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `field-enumerators-${exportPeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const activeCount = enumerators.filter((enumerator) => enumerator.is_active).length;
  const loadError =
    enumeratorsQuery.error instanceof ApiError
      ? enumeratorsQuery.error.message
      : enumeratorsQuery.error
        ? "Unable to load enumerators."
        : "";

  const selectedEnumerator =
    enumeratorQuery.data ?? enumerators.find((enumerator) => enumerator.membership_id === selectedMembershipId);

  useEffect(() => {
    if (!selectedEnumerator) return;
    setEditIsActive(selectedEnumerator.is_active);
    setEditPhoneNumber(selectedEnumerator.phone_number ?? "");
    setEditGender(selectedEnumerator.gender ?? "");
    setEditDateOfBirth(selectedEnumerator.date_of_birth ?? "");
    setEditAddress(selectedEnumerator.address ?? "");
    setEditEmergencyContactName(selectedEnumerator.emergency_contact_name ?? "");
    setEditEmergencyContactPhone(selectedEnumerator.emergency_contact_phone ?? "");
  }, [selectedEnumerator]);
  async function createEnumerator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOrganizationAdmin || createMutation.isPending) return;
    setFormError("");
    if (fullName.trim().length < 2 || username.trim().length < 3) {
      setFormError("Enter a full name of at least 2 characters and a username of at least 3 characters.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        full_name: fullName.trim(),
        email: email.trim(),
        username: username.trim(),
        project_id: assignedProjectId,
        phone_number: phoneNumber.trim() || undefined,
        gender: gender.trim() || undefined,
        date_of_birth: dateOfBirth || undefined,
        address: address.trim() || undefined,
        emergency_contact_name: emergencyContactName.trim() || undefined,
        emergency_contact_phone: emergencyContactPhone.trim() || undefined,
      });
      setQuery("");
      setProjectId("");
      setFullName("");
      setEmail("");
      setUsername("");
      setAssignedProjectId("");
      setPhoneNumber("");
      setGender("");
      setDateOfBirth("");
      setAddress("");
      setEmergencyContactName("");
      setEmergencyContactPhone("");
      setShowCreate(false);
    } catch (requestError) {
      setFormError(requestError instanceof ApiError ? requestError.message : "Unable to create the enumerator.");
    }
  }

  async function deactivateEnumerator(membershipId: string, label: string) {
    if (!isOrganizationAdmin || !window.confirm(`Deactivate ${label}?`)) return;
    setActionError("");
    try {
      await deleteMutation.mutateAsync(membershipId);
      if (selectedMembershipId === membershipId) setSelectedMembershipId(null);
    } catch (requestError) {
      setActionError(requestError instanceof ApiError ? requestError.message : "Unable to deactivate the enumerator.");
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
    if (!selectedMembershipId || updateMutation.isPending) return;
    setActionError("");
    try {
      await updateMutation.mutateAsync({
        membershipId: selectedMembershipId,
        input: {
          is_active: editIsActive,
          phone_number: editPhoneNumber.trim() || null,
          gender: editGender.trim() || null,
          date_of_birth: editDateOfBirth || null,
          address: editAddress.trim() || null,
          emergency_contact_name: editEmergencyContactName.trim() || null,
          emergency_contact_phone: editEmergencyContactPhone.trim() || null,
          notes: selectedEnumerator?.notes ?? null,
        },
      });
      setSelectedMembershipId(null);
    } catch (requestError) {
      setActionError(requestError instanceof ApiError ? requestError.message : "Unable to update the enumerator.");
    }
  }
  if (!isOrganizationAdmin) {
    return (
      <div className="rounded-[7px] border border-[#f0d8b8] bg-[#fffbf4] p-5 text-sm text-[#80664d]">
        Only an Organization Admin can manage enumerators. Your account has no Organization Admin membership.
      </div>
    );
  }

  if (createMutation.isPending || updateMutation.isPending) {
    return <LoadingState label="Refreshing enumerators…" />;
  }

  return (
    <>
      <div className="mb-[19px] flex items-start justify-between gap-3 max-[700px]:flex-col">
        <div>
          <p className="!m-0 !mb-[6px] text-[10px] font-bold uppercase leading-[1.4] tracking-[.08em] text-[#0b51b7]">
            ORGANIZATION ACCESS
          </p>
          <h1 className="!m-0 !font-sans !text-[2rem] !font-bold !leading-[1.15] !tracking-[-.05em]">Enumerators</h1>
          <p className="!m-0 text-[0.8125rem] text-[#75849a]">
            Create and manage enumerator accounts for your organization.
          </p>
        </div>
        <Button onClick={() => { setFormError(""); setShowCreate(true); }}>
          <Plus size={15} /> Create enumerator
        </Button>
      </div>
      {loadError && <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{loadError}</p>}
      {actionError && <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{actionError}</p>}{" "}
      <section className="mb-[18px] grid grid-cols-3 gap-[14px] max-[800px]:grid-cols-1">
        <Card className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-none border border-[#e5e9ed] p-[17px]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
            <Users size={19} />
          </span>
          <span className="text-[11px] font-medium text-[#6f7d8a]">All enumerators</span>
          <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">
            {enumerators.length.toLocaleString()}
          </strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Organization membership accounts</small>
        </Card>
        <Card className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-none border border-[#e5e9ed] p-[17px]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]">
            <UserCheck size={19} />
          </span>
          <span className="text-[11px] font-medium text-[#6f7d8a]">Active</span>
          <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">{activeCount.toLocaleString()}</strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Can access assigned field work</small>
        </Card>
        <Card className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-none border border-[#e5e9ed] p-[17px]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#fff3e5] text-[#d88935]">
            <UserX size={19} />
          </span>
          <span className="text-[11px] font-medium text-[#6f7d8a]">Inactive</span>
          <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">
            {(enumerators.length - activeCount).toLocaleString()}
          </strong>
          <small className="col-start-2 mt-[6px] text-[10px] text-[#88939d]">Access has been disabled</small>
        </Card>
      </section>
      <div className="mt-[16px] grid grid-cols-[minmax(280px,1fr)_minmax(210px,260px)_minmax(130px,160px)_minmax(130px,auto)] items-center gap-[10px] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <label className="flex w-full items-center gap-[8px] rounded-[6px] border border-[#dce5ef] bg-white px-[11px] text-[#8492a4]">
          <Search size={15} />
          <input
            className="w-full border-0 bg-transparent py-[8px] font-sans text-[12px] font-normal leading-normal text-[#4e5e74] outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, username, or email…"
          />
        </label>
        <select
          className="min-h-[36px] w-full rounded-[6px] border border-[#dce5ef] bg-white px-[11px] font-sans text-[11px] text-[#69798e]"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          className="min-h-[36px] w-full rounded-[6px] border border-[#dce5ef] bg-white px-[11px] font-sans text-[11px] text-[#69798e]"
          value={exportPeriod}
          onChange={(event) => setExportPeriod(event.target.value as typeof exportPeriod)}
          aria-label="Enumerator CSV export period"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!exportEnumerators.length}
          className="flex min-h-[36px] cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[#dce5ef] bg-white px-[16px] py-[9px] font-sans text-[12px] font-semibold leading-normal text-[#155da6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} />
          Export data
        </button>
      </div>
      <Card className="mt-[16px]">
        <div className="overflow-x-auto">
          <Table className="min-w-[1040px] border-separate border-spacing-0 text-left">
            <TableHeader>
              <TableRow>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Full name
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Project
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Phone
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Address
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Gender
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Role
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Status
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6f86]">
                  Created
                </TableHead>
                <TableHead className="border-b border-[#dfe6ee] bg-[#f3f6fb] px-4 py-3 text-left" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {enumeratorsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="px-4 py-6 text-center text-[12px] text-[#8190a4]">
                    Loading enumerators…
                  </TableCell>
                </TableRow>
              )}
              {filteredEnumerators.map((enumerator) => (
                <TableRow
                  key={enumerator.membership_id}
                  className="border-b border-[#edf1f5] bg-white transition-colors hover:bg-[#f7faff]"
                >
                  <TableCell className="px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    <div>
                      <strong className="block text-[12.5px] font-semibold text-[#1f2937]">
                        {enumerator.full_name ?? enumerator.username ?? "Unnamed enumerator"}
                      </strong>
                      <small className="mt-[2px] block text-[10.5px] font-normal text-[#8a99ad]">
                        {enumerator.email} · @{enumerator.username ?? "not set"}
                      </small>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px] px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    <span className="block truncate" title={projectNamesByMembershipId.get(enumerator.membership_id)?.join(", ") ?? ""}>
                      {projectNamesByMembershipId.get(enumerator.membership_id)?.join(", ") ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    {enumerator.phone_number ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[190px] truncate px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    {enumerator.address ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    {enumerator.gender ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-[#8793a2]" /> Enumerator
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    <AdminStatus value={enumerator.is_active ? "Active" : "Suspended"} />
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177] tabular-nums">
                    {new Date(enumerator.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle text-[12.5px] leading-[1.4] text-[#536177]">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded border border-[#dfe4e8] bg-white text-[#66788a] transition-colors hover:border-[#c7d5e8] hover:text-[#475569]"
                        onClick={() => openEnumerator(enumerator)}
                        aria-label={"Manage " + (enumerator.full_name ?? enumerator.username ?? enumerator.email)}
                        title="Manage enumerator"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!enumeratorsQuery.isLoading && filteredEnumerators.length === 0 && (
            <p className="m-0 p-10 text-center text-xs text-[#8793a2]">No enumerators match your search.</p>
          )}
        </div>
        <div className="px-[14px] pb-[11px]">
          <AdminTableFooter shown={filteredEnumerators.length} total={enumerators.length} />
        </div>
      </Card>
      {selectedMembershipId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.48)] p-4 backdrop-blur-[1px]" onClick={closeEnumerator}>
          <form
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-[14px] border border-[#dfe4e8] bg-white shadow-[0_24px_70px_rgba(16,42,67,.28)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={updateEnumerator}
            role="dialog" aria-modal="true" aria-labelledby="manage-enumerator-title"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[#e8edf4] px-6 py-5">
              <div>
                <h2 id="manage-enumerator-title" className="m-0 text-lg font-semibold tracking-tight text-[#253342]">Manage enumerator</h2>
                <p className="mb-0 mt-1 text-xs text-[#75849a]">Update profile details and account access.</p>
              </div>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-[6px] border border-[#e1e7ee] bg-white p-0 text-[#8290a2] hover:bg-[#f6f8fb]"
                onClick={closeEnumerator}
                aria-label="Close enumerator card"
              >
                <X size={18} />
              </button>
            </header>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-5 gap-y-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              {enumeratorQuery.isLoading && (
                <p className="m-0 text-xs text-[#7b8794] sm:col-span-2">Loading enumerator…</p>
              )}
              {enumeratorQuery.error && (
                <p className="m-0 text-xs text-[#b42318] sm:col-span-2">
                  {enumeratorQuery.error instanceof ApiError
                    ? enumeratorQuery.error.message
                    : "Unable to load the enumerator."}
                </p>
              )}
              {selectedEnumerator && (
                <>
                  <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[#527093] sm:col-span-2">Account details</h3>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Full name
                    <input
                      className={manageFieldClass + " cursor-default text-[#7b8794]"}
                      value={selectedEnumerator.full_name ?? ""}
                      readOnly
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Email
                    <input
                      className={manageFieldClass + " cursor-default text-[#7b8794]"}
                      value={selectedEnumerator.email}
                      readOnly
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Username
                    <input
                      className={manageFieldClass + " cursor-default text-[#7b8794]"}
                      value={selectedEnumerator.username ?? ""}
                      readOnly
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Role
                    <input
                      className={manageFieldClass + " cursor-default text-[#7b8794]"}
                      value="Enumerator"
                      readOnly
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177] sm:col-span-2">
                    Status
                    <select
                      className={manageFieldClass}
                      value={editIsActive ? "active" : "inactive"}
                      onChange={(event) => setEditIsActive(event.target.value === "active")}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <h3 className="mt-1 border-t border-[#e8edf4] pt-4 m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[#527093] sm:col-span-2">Personal details</h3>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Phone number
                    <input
                      type="tel"
                      className={manageFieldClass}
                      value={editPhoneNumber}
                      onChange={(event) => setEditPhoneNumber(event.target.value)}
                      maxLength={32}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Gender
                    <select
                      className={manageFieldClass}
                      value={editGender.toLowerCase()}
                      onChange={(event) => setEditGender(event.target.value)}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Date of birth
                    <input
                      type="date"
                      className={manageFieldClass}
                      value={editDateOfBirth}
                      onChange={(event) => setEditDateOfBirth(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Address
                    <input
                      className={manageFieldClass}
                      value={editAddress}
                      onChange={(event) => setEditAddress(event.target.value)}
                      maxLength={300}
                    />
                  </label>
                  <h3 className="mt-1 border-t border-[#e8edf4] pt-4 m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[#527093] sm:col-span-2">Emergency contact</h3>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Emergency contact name
                    <input
                      className={manageFieldClass}
                      value={editEmergencyContactName}
                      onChange={(event) => setEditEmergencyContactName(event.target.value)}
                      maxLength={200}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                    Emergency contact phone
                    <input
                      type="tel"
                      className={manageFieldClass}
                      value={editEmergencyContactPhone}
                      onChange={(event) => setEditEmergencyContactPhone(event.target.value)}
                      maxLength={32}
                    />
                  </label>
                </>
              )}
              {actionError && <p className="m-0 text-xs text-[#b42318] sm:col-span-2">{actionError}</p>}
            </div>
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e8edf4] bg-[#fbfcfd] px-6 py-4">
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
                <Button type="button" variant="secondary" onClick={closeEnumerator}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!selectedEnumerator || updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </footer>
          </form>
        </div>
      )}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.48)] p-4 backdrop-blur-[1px]"
          onClick={() => { if (!createMutation.isPending) setShowCreate(false); }}
        >
          <form
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-[8px] border border-[#dfe4e8] bg-white shadow-[0_24px_70px_rgba(16,42,67,.28)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={createEnumerator}
            aria-busy={createMutation.isPending}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[#e8edf4] px-5 py-4">
              <div>
                <h2 className="m-0 text-[17px] font-semibold text-[#253342]">Create enumerator</h2>
                <p className="mb-0 mt-1 text-[11px] text-[#8391a5]">
                  Add an enumerator profile and link it to their Kobo username.
                </p>
              </div>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-[6px] border border-[#e1e7ee] bg-white p-0 text-[#8290a2] hover:bg-[#f6f8fb]"
                onClick={() => { if (!createMutation.isPending) setShowCreate(false); }}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </header>
            <fieldset disabled={createMutation.isPending} className="m-0 min-w-0 border-0 grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto px-5 py-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
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
                Kobo username
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
                Assigned project
                <select
                  className={adminInputClass}
                  value={assignedProjectId}
                  onChange={(event) => setAssignedProjectId(event.target.value)}
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Phone number
                <input
                  type="tel"
                  className={adminInputClass}
                  maxLength={32} value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Gender
                <select className={adminInputClass} value={gender} onChange={(event) => setGender(event.target.value)}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Date of birth
                <input
                  type="date"
                  className={adminInputClass}
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Address
                <input
                  className={adminInputClass}
                  maxLength={300} value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Emergency contact name
                <input
                  className={adminInputClass}
                  maxLength={200} value={emergencyContactName}
                  onChange={(event) => setEmergencyContactName(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#526177]">
                Emergency contact phone
                <input
                  type="tel"
                  className={adminInputClass}
                  maxLength={32} value={emergencyContactPhone}
                  onChange={(event) => setEmergencyContactPhone(event.target.value)}
                />
              </label>
              {formError && <p role="alert" className="m-0 text-[11px] text-[#b42318] sm:col-span-2">{formError}</p>}
            </fieldset>
            <footer className="flex shrink-0 justify-end gap-2 border-t border-[#e8edf4] bg-[#fbfcfd] px-5 py-3">
              <Button type="button" variant="secondary" disabled={createMutation.isPending} onClick={() => { if (!createMutation.isPending) setShowCreate(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                <Plus size={15} /> {createMutation.isPending ? "Creating…" : "Create enumerator"}
              </Button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
