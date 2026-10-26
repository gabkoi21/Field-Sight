import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, MoreHorizontal, Plus, Search, ShieldCheck, Trash2, UserCheck, Users, UserX, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { WorkspaceTabs } from "../../workspace/WorkspaceUI";
import { useAuth } from "../../auth/AuthContext";
import { controlClass as adminInputClass } from "../../components/ui/controlStyles";
import { Button, PageHeader } from "../../components/ui";
import { Card } from "../../components/ui/Card";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { LoadingState } from "../../components/ui/LoadingState";
import { apiClient, ApiError, type ApiEnumerator, type EnumeratorUpdateInput } from "../../services/apiClient";

export function FieldOperationsPage({ projectEmbedded = false }: { projectEmbedded?: boolean }) {
  const workspace = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOrganizationAdmin = Boolean(user?.memberships.some((membership) => membership.role === "organization_admin"));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [projectFilter, setProjectId] = useState("");
  const projectId = projectEmbedded ? workspace.projectId : projectFilter;
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
  const manageFieldClass = `${adminInputClass} min-h-11 border-[#edf1f5] bg-[#f5f7fa] px-2.5 text-[14px] text-[#526177]`;
  const organizationId = user?.memberships.find(
    (membership) => membership.role === "organization_admin",
  )?.organization_id;
  const enumeratorsQuery = useQuery({
    queryKey: ["organization-enumerators", organizationId],
    queryFn: apiClient.enumerators,
    enabled: isOrganizationAdmin,
  });
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
      queryClient.setQueryData<ApiEnumerator[]>(["organization-enumerators", organizationId], (current = []) => [
        createdEnumerator,
        ...current.filter((enumerator) => enumerator.membership_id !== createdEnumerator.membership_id),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organization-enumerators"] }),
        queryClient.invalidateQueries({ queryKey: ["organization-assignments", organizationId] }),
      ]);
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
      if (projectId && assignment.project_id !== projectId) return;
      const projectName = projectsById.get(assignment.project_id);
      if (!projectName) return;
      const names = namesByMembershipId.get(assignment.membership_id) ?? [];
      if (!names.includes(projectName)) names.push(projectName);
      namesByMembershipId.set(assignment.membership_id, names);
    });

    return namesByMembershipId;
  }, [assignmentsQuery.data, projects, projectId]);
  const projectEnumerators = useMemo(
    () => enumerators.filter((enumerator) => !assignedMembershipIds || assignedMembershipIds.has(enumerator.membership_id)),
    [enumerators, assignedMembershipIds],
  );
  const filteredEnumerators = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projectEnumerators.filter((enumerator) => {
      const identities = [enumerator.full_name, enumerator.username, enumerator.email]
        .filter(Boolean)
        .map((value) => value!.trim().toLowerCase());
      const matchesSearch = identities.join(" ").includes(normalized);
      const matchesProject = !assignedMembershipIds || assignedMembershipIds.has(enumerator.membership_id);
      return matchesSearch && matchesProject;
    });
  }, [assignedMembershipIds, projectEnumerators, query]);
  useEffect(() => { setPage(1); }, [query, projectId, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filteredEnumerators.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * pageSize;
  const pagedEnumerators = filteredEnumerators.slice(firstIndex, firstIndex + pageSize);
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
  const activeCount = projectEnumerators.filter((enumerator) => enumerator.is_active).length;
  const loadError =
    enumeratorsQuery.error instanceof ApiError
      ? enumeratorsQuery.error.message
      : enumeratorsQuery.error
        ? "Unable to load enumerators."
        : assignmentsQuery.error ? "Unable to load project team assignments. Try refreshing the page." : "";

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
        project_id: projectEmbedded ? workspace.projectId : assignedProjectId,
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


  return (
    <>
      <Link
        to={workspace.hasSelectedProject ? `/projects/${workspace.projectId}` : "/projects"}
        className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-[#117e8f] no-underline hover:underline"
      >
        <ArrowLeft size={15} /> Back to {workspace.hasSelectedProject ? "project" : "projects"}
      </Link>
      <div className="mb-6"><PageHeader eyebrow={projectEmbedded ? `FieldSight / ${workspace.project?.name ?? "Project"}` : "FieldSight / Organization"} title="Field team" description={projectEmbedded ? "Create and manage enumerators assigned to this project." : "Create and manage enumerator accounts for your organization."}>
        <Button onClick={() => { setFormError(""); if (projectEmbedded) setAssignedProjectId(workspace.projectId); setShowCreate(true); }}>
          <Plus size={15} /> Create enumerator
        </Button>
      </PageHeader></div>
      {projectEmbedded && <div className="mb-5"><WorkspaceTabs /></div>}
      {((enumeratorsQuery.isFetching && enumeratorsQuery.data) || (assignmentsQuery.isFetching && assignmentsQuery.data)) && <LoadingState variant="inline" label="Updating field team…" />}
      {(createMutation.isPending || updateMutation.isPending) && <LoadingState variant="inline" label="Saving enumerator…" announce />}
      {loadError && <div role="alert" className="mb-4 rounded-md bg-[#fff0f2] p-3 text-sm text-[#b42318]">{loadError} <button type="button" className="min-h-11 px-3 font-semibold underline focus-visible:outline focus-visible:outline-2" onClick={() => { void enumeratorsQuery.refetch(); void assignmentsQuery.refetch(); }}>Retry field team</button></div>}
      {actionError && <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{actionError}</p>}{" "}
      {(enumeratorsQuery.isLoading || assignmentsQuery.isLoading) ? <div className="mb-5"><LoadingSkeleton layout="metrics" label="Loading field team…" announce={false} /></div> : <section className="mb-[18px] grid grid-cols-3 gap-[14px] max-[800px]:grid-cols-1">
        <Card className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-xl border border-[var(--fs-border)] p-[17px]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#edf3fc] text-[#4d7fc6]">
            <Users size={19} />
          </span>
          <span className="text-[12px] font-medium text-[#6f7d8a]">{projectId ? "Project enumerators" : "All enumerators"}</span>
          <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">
            {projectEnumerators.length.toLocaleString()}
          </strong>
          <small className="col-start-2 mt-[6px] text-[12px] text-[var(--fs-muted)]">{projectId ? "Assigned to the selected project" : "Organization membership accounts"}</small>
        </Card>
        <Card className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-xl border border-[var(--fs-border)] p-[17px]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#e8f6f4] text-[#0b51b7]">
            <UserCheck size={19} />
          </span>
          <span className="text-[12px] font-medium text-[#6f7d8a]">Active</span>
          <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">{activeCount.toLocaleString()}</strong>
          <small className="col-start-2 mt-[6px] text-[12px] text-[var(--fs-muted)]">Can access assigned field work</small>
        </Card>
        <Card className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-[12px] rounded-xl border border-[var(--fs-border)] p-[17px]">
          <span className="row-[1/3] grid size-[40px] place-items-center rounded-full bg-[#fff3e5] text-[#d88935]">
            <UserX size={19} />
          </span>
          <span className="text-[12px] font-medium text-[#6f7d8a]">Inactive</span>
          <strong className="mt-[2px] text-[23px] leading-[1.15] text-[#1d2a38]">
            {(projectEnumerators.length - activeCount).toLocaleString()}
          </strong>
          <small className="col-start-2 mt-[6px] text-[12px] text-[var(--fs-muted)]">Access has been disabled</small>
        </Card>
      </section>}
      <div className="mt-[16px] grid grid-cols-[minmax(280px,1fr)_minmax(210px,260px)_minmax(130px,160px)_minmax(130px,auto)] items-center gap-[10px] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <label className="flex min-w-0 w-full items-center gap-2 rounded-lg border border-[var(--fs-control-border)] bg-white px-3 text-[var(--fs-muted)] focus-within:ring-2 focus-within:ring-brand">
          <Search size={15} />
          <input
            className="min-h-11 w-full min-w-0 rounded-lg border-0 bg-transparent py-2 text-base sm:text-sm text-[var(--fs-text)] focus:outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search enumerators"
            placeholder="Search name, username, or email…"
          />
        </label>
        <select
          className={adminInputClass}
          aria-label={projectEmbedded ? "Current team project" : "Team project filter"}
          value={projectId}
          disabled={projectEmbedded}
          onChange={(event) => setProjectId(event.target.value)}
        >
          {!projectEmbedded && <option value="">All projects</option>}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          className={adminInputClass}
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
          className="flex min-h-11 cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[#dce5ef] bg-white px-[16px] py-[9px] font-sans text-[14px] font-semibold leading-normal text-[#155da6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} />
          Export data
        </button>
      </div>
      <section className="mt-4 overflow-hidden rounded-lg border border-[#e1e7eb] bg-white">
        <div className="overflow-x-auto">
          <table aria-busy={enumeratorsQuery.isFetching || assignmentsQuery.isFetching} className="w-full min-w-[1040px] border-collapse whitespace-nowrap text-left text-xs">
            <thead className="bg-[#f8fafb] text-[12px] uppercase text-[var(--fs-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  Full name
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Project
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Phone
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Address
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Gender
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Created
                </th>
                <th className="px-4 py-3 text-left" />
              </tr>
            </thead>
            <tbody>
              {(enumeratorsQuery.isLoading || assignmentsQuery.isLoading) && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[14px] text-[#8190a4]">
                    <LoadingSkeleton label="Loading enumerators…" columns={6} />
                  </td>
                </tr>
              )}
              {pagedEnumerators.map((enumerator) => (
                <tr
                  key={enumerator.membership_id}
                  className="border-t border-[#edf0f2] hover:bg-[#fafcfc]"
                >
                  <td className="px-4 py-3 align-middle text-xs text-[#24434c]">
                    <div>
                      <strong className="block text-xs font-medium text-[#24434c]">
                        {enumerator.full_name ?? enumerator.username ?? "Unnamed enumerator"}
                      </strong>
                      <small className="mt-1.5 block text-[12px] font-normal leading-relaxed text-[#8a99ad]">
                        {enumerator.email} · @{enumerator.username ?? "not set"}
                      </small>
                    </div>
                  </td>
                  <td className="max-w-[180px] px-4 py-3 align-middle text-xs text-[#24434c]">
                    <span className="block truncate" title={projectNamesByMembershipId.get(enumerator.membership_id)?.join(", ") ?? ""}>
                      {projectNamesByMembershipId.get(enumerator.membership_id)?.join(", ") ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-[#24434c]">
                    {enumerator.phone_number ?? "—"}
                  </td>
                  <td className="max-w-[190px] truncate px-4 py-3 align-middle text-xs text-[#24434c]">
                    {enumerator.address ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-[#24434c]">
                    {enumerator.gender ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-[#24434c]">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-[#8793a2]" /> Enumerator
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-[#24434c]">
                    <span className={`rounded px-2 py-1 text-[12px] ${enumerator.is_active ? "bg-[#ecf7f0] text-[#388567]" : "bg-[#fff7e8] text-[#a6803f]"}`}>{enumerator.is_active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-[#24434c] tabular-nums">
                    {new Date(enumerator.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-[#24434c]">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!enumeratorsQuery.isLoading && !assignmentsQuery.isLoading && !loadError && filteredEnumerators.length === 0 && (
            <p className="m-0 p-10 text-center text-xs text-[#8793a2]">{query.trim() ? "No enumerators match your search." : projectId ? "No enumerators are assigned to this project yet." : "No enumerators have been created yet."}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e7eb] px-5 py-3 text-xs text-[var(--fs-muted)]">
          <span aria-live="polite">{filteredEnumerators.length ? firstIndex + 1 : 0}–{Math.min(firstIndex + pageSize, filteredEnumerators.length)} of {filteredEnumerators.length} enumerators</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">Rows per page
              <select className="rounded border border-[#dce4e8] bg-white px-2 py-1 text-[#24434c]" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <nav aria-label="Enumerator pagination" className="flex items-center gap-2">
              <Button variant="secondary" disabled={currentPage === 1 || enumeratorsQuery.isLoading} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={13} />Previous</Button>
              <span>Page {currentPage} of {pageCount}</span>
              <Button variant="secondary" disabled={currentPage >= pageCount || enumeratorsQuery.isLoading} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={13} /></Button>
            </nav>
          </div>
        </div>
      </section>
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
                <p className="mb-0 mt-1 text-xs text-[var(--fs-muted)]">Update profile details and account access.</p>
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
                  <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-[#527093] sm:col-span-2">Account details</h3>
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
                  <h3 className="mt-1 border-t border-[#e8edf4] pt-4 m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-[#527093] sm:col-span-2">Personal details</h3>
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
                  <h3 className="mt-1 border-t border-[#e8edf4] pt-4 m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-[#527093] sm:col-span-2">Emergency contact</h3>
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
                <p className="mb-0 mt-1 text-[12px] text-[#8391a5]">
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
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
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
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Email
                <input
                  type="email"
                  className={adminInputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
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
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Assigned project
                <select
                  className={adminInputClass}
                  value={assignedProjectId}
                  disabled={projectEmbedded}
                  onChange={(event) => setAssignedProjectId(event.target.value)}
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Phone number
                <input
                  type="tel"
                  className={adminInputClass}
                  maxLength={32} value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Gender
                <select className={adminInputClass} value={gender} onChange={(event) => setGender(event.target.value)}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Date of birth
                <input
                  type="date"
                  className={adminInputClass}
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Address
                <input
                  className={adminInputClass}
                  maxLength={300} value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Emergency contact name
                <input
                  className={adminInputClass}
                  maxLength={200} value={emergencyContactName}
                  onChange={(event) => setEmergencyContactName(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-[#526177]">
                Emergency contact phone
                <input
                  type="tel"
                  className={adminInputClass}
                  maxLength={32} value={emergencyContactPhone}
                  onChange={(event) => setEmergencyContactPhone(event.target.value)}
                />
              </label>
              {formError && <p role="alert" className="m-0 text-[12px] text-[#b42318] sm:col-span-2">{formError}</p>}
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
