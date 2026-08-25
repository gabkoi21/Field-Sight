import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  MoreVertical,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button, PageHeader, Ring } from "../../components/ui";
import {
  AdminMetric,
  AdminPanel,
  AdminStatus,
  AdminTableFooter,
  adminInputClass,
} from "../../components/superadmin/AdminUi";
import { type OrganizationStatus } from "./data";
import {
  apiClient,
  ApiError,
  type UpdateOrganizationInput,
} from "../../services/apiClient";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  initials: string;
  ownerEmail: string;
  country: string;
  timezone: string;
  sectorIds: string[];
  sectors: string;
  status: OrganizationStatus;
  created: string;
}

export function OrganizationsPage() {
  const [showNavigationLoader, setShowNavigationLoader] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const {
    data: apiOrganizations = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["platform-organizations"],
    queryFn: apiClient.organizations,
  });
  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors"],
    queryFn: apiClient.sectors,
  });
  const sectorNames = useMemo(
    () => new Map(sectors.map((sector) => [sector.id, sector.name])),
    [sectors],
  );
  const organizations = useMemo<OrganizationRow[]>(
    () =>
      apiOrganizations.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        initials: item.name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase(),
        ownerEmail: item.owner_email ?? "—",
        country: item.country ?? "—",
        timezone: item.timezone,
        sectorIds: item.sector_ids,
        sectors:
          item.sector_ids
            .map((sectorId) => sectorNames.get(sectorId) ?? sectorId)
            .join(", ") || "—",
        status: (item.is_active ? "Active" : "Suspended") as OrganizationStatus,
        created: new Date(item.created_at).toLocaleDateString(),
      })),
    [apiOrganizations, sectorNames],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | OrganizationStatus>("All");
  const [showCreate, setShowCreate] = useState(
    searchParams.get("create") === "1",
  );
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(
    searchParams.get("create") === "1",
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [formError, setFormError] = useState("");
  const [editingOrganization, setEditingOrganization] =
    useState<OrganizationRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [editSectorIds, setEditSectorIds] = useState<string[]>([]);
  const [editError, setEditError] = useState("");
  const createMutation = useMutation({
    mutationFn: apiClient.createOrganization,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["platform-organizations"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      organizationId,
      input,
    }: {
      organizationId: string;
      input: UpdateOrganizationInput;
    }) => apiClient.updateOrganization(organizationId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["platform-organizations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteOrganization,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["platform-organizations"] }),
  });
  const activeOrganizationCount = apiOrganizations.filter((organization) => organization.is_active).length;
  const suspendedOrganizationCount = apiOrganizations.length - activeOrganizationCount;
  const activeSectorCount = sectors.filter((sector) => sector.is_active).length;
  const filteredOrganizations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return organizations.filter(
      (organization) =>
        (status === "All" || organization.status === status) &&
        (!normalizedQuery ||
          `${organization.name} ${organization.ownerEmail} ${organization.country} ${organization.timezone} ${organization.sectors}`
            .toLowerCase()
            .includes(normalizedQuery)),
    );
  }, [organizations, query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowNavigationLoader(false), 350);
    return () => window.clearTimeout(timeout);
  }, []);
  function openCreate() {
    setDrawerClosing(false);
    setDrawerVisible(false);
    setShowCreate(true);
    window.requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeCreate() {
    setDrawerClosing(true);
    setDrawerVisible(false);
    setSearchParams({}, { replace: true });
    window.setTimeout(() => setShowCreate(false), 220);
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const organizationName = name.trim();
    if (!organizationName || !slug.trim() || !owner.trim() || !ownerPassword)
      return;
    setFormError("");
    try {
      await createMutation.mutateAsync({
        name: organizationName,
        slug: slug.trim(),
        owner_email: owner.trim(),
        owner_password: ownerPassword,
        owner_role: "organization_admin",
        sector_ids: sectorId ? [sectorId] : [],
        country: country.trim() || undefined,
        timezone: timezone.trim(),
      });
      setName("");
      setSlug("");
      setOwner("");
      setOwnerPassword("");
      setSectorId("");
      setCountry("");
      setTimezone("UTC");
      closeCreate();
    } catch (requestError) {
      setFormError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to create the organization.",
      );
    }
  }

  async function deactivateOrganization() {
    if (
      !editingOrganization ||
      !window.confirm(`Deactivate ${editingOrganization.name}?`)
    )
      return;
    setEditError("");
    try {
      await deleteMutation.mutateAsync(editingOrganization.id);
      setEditingOrganization(null);
    } catch (requestError) {
      setEditError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to deactivate the organization.",
      );
    }
  }

  function openEdit(organization: OrganizationRow) {
    setEditingOrganization(organization);
    setEditName(organization.name);
    setEditSlug(organization.slug);
    setEditCountry(organization.country === "—" ? "" : organization.country);
    setEditTimezone(organization.timezone);
    setEditSectorIds(organization.sectorIds);
    setEditError("");
  }

  function closeEdit() {
    if (!updateMutation.isPending) setEditingOrganization(null);
  }

  async function updateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOrganization) return;
    setEditError("");
    try {
      await updateMutation.mutateAsync({
        organizationId: editingOrganization.id,
        input: {
          name: editName.trim(),
          slug: editSlug.trim(),
          country: editCountry.trim() || null,
          timezone: editTimezone.trim(),
          sector_ids: editSectorIds,
        },
      });
      setEditingOrganization(null);
    } catch (requestError) {
      setEditError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to update the organization.",
      );
    }
  }
  return (
    <>
      {showNavigationLoader && (
        <div className="fixed bottom-0 left-[258px] right-0 top-[74px] z-40 grid place-items-center bg-white/70 backdrop-blur-[1px] max-[1440px]:left-[232px] max-[1050px]:left-0 max-[1050px]:top-16 max-[560px]:top-[58px]" role="status">
          <span className="inline-flex items-center gap-3 rounded-lg border border-[#e5e9ed] bg-white px-5 py-4 text-sm text-[#526274] shadow-lg">
            <Ring className="size-5 text-brand" aria-hidden="true" />
            Loading organizations…
          </span>
        </div>
      )}
      <PageHeader
        eyebrow="Tenant administration"
        title="Organizations"
        description="Create and manage every organization using the FieldSight platform."
      >
        <Button onClick={openCreate}>
          <Plus size={15} /> New organization
        </Button>
      </PageHeader>

      {loadError && (
        <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
          Unable to load organizations from the API.
        </p>
      )}
      <section className="mb-[18px] grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
        <AdminMetric
          label="All organizations"
          value={String(organizations.length)}
          detail="Registered platform tenants"
          icon={Building2}
        />
        <AdminMetric
          label="Active organizations"
          value={String(activeOrganizationCount)}
          detail={`${organizations.length ? Math.round((activeOrganizationCount / organizations.length) * 100) : 0}% of all organizations`}
          icon={CheckCircle2}
          tone="green"
        />
        <AdminMetric
          label="Suspended"
          value={String(suspendedOrganizationCount)}
          detail="Organizations with access paused"
          icon={CircleOff}
          tone="orange"
        />
        <AdminMetric
          label="Active sectors"
          value={String(activeSectorCount)}
          detail="Available for organization setup"
          icon={Tags}
          tone="violet"
        />
      </section>

      <AdminPanel
        title="Platform organizations"
        description="Owners, location settings, sectors, and tenant access"
      >
        <div className="flex gap-2 border-b border-line p-4 max-[680px]:flex-col">
          <label className="flex min-h-[38px] flex-1 items-center gap-2 rounded-[7px] border border-[#dfe4e8] bg-white px-3 text-[#8793a2]">
            <Search size={15} />
            <input
              className="w-full border-0 bg-transparent text-xs text-[#324158] outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, owner, country, or sector..."
            />
          </label>
          <label className="relative flex min-h-[38px] min-w-[150px] items-center rounded-[7px] border border-[#dfe4e8] bg-white px-3">
            <select
              className="w-full appearance-none border-0 bg-transparent pr-5 text-xs text-[#455467] outline-none"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "All" | OrganizationStatus)
              }
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Trial">Trial</option>
              <option value="Suspended">Suspended</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 text-[#8793a2]"
              size={14}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px]">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Owner email</th>
                <th>Country</th>
                <th>Time zone</th>
                <th>Sectors</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <span className="inline-flex items-center gap-2 text-xs text-[#758092]">
                      <Ring className="size-4 text-brand" aria-hidden="true" />
                      Loading organizations…
                    </span>
                  </td>
                </tr>
              )}
              {filteredOrganizations.map((organization) => (
                <tr key={organization.id} className="hover:bg-[#fbfcfe]">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 place-items-center rounded-[7px] bg-[#e9f1ff] text-[10px] font-bold text-brand">
                        {organization.initials}
                      </span>
                      <strong>{organization.name}</strong>
                    </div>
                  </td>
                  <td>{organization.ownerEmail}</td>
                  <td>{organization.country}</td>
                  <td>{organization.timezone}</td>
                  <td className="max-w-[220px]">{organization.sectors}</td>
                  <td>
                    <AdminStatus value={organization.status} />
                  </td>
                  <td>{organization.created}</td>
                  <td>
                    <button
                      type="button"
                      title="Edit organization"
                      aria-label={`Edit ${organization.name}`}
                      className="grid size-7 place-items-center rounded-[6px] border-0 bg-[#f7f9fc] text-[#8190a4] hover:bg-[#eef3fa] hover:text-[#43546b]"
                      onClick={() => openEdit(organization)}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrganizations.length === 0 && (
            <p className="m-0 p-10 text-center text-xs text-[#8793a2]">
              No organizations match your filters.
            </p>
          )}
        </div>
        <AdminTableFooter
          shown={filteredOrganizations.length}
          total={organizations.length}
        />
      </AdminPanel>

      {showCreate && (
        <div
          className={`fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.48)] p-4 backdrop-blur-[1px] transition-opacity ${drawerClosing ? "duration-[180ms] ease-in" : "duration-[220ms] ease-out"} ${drawerVisible ? "opacity-100" : "opacity-0"}`}
          onClick={closeCreate}
        >
          <form
            className={`relative flex max-h-[calc(100vh-32px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[8px] border border-[#dfe4e8] bg-white shadow-[0_24px_70px_rgba(16,42,67,.28)] transition-[opacity,transform] ${drawerClosing ? "translate-y-2 scale-[.985] opacity-0 duration-[180ms] ease-in" : `${drawerVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[.985] opacity-0"} duration-[240ms] ease-out`}`}
            onClick={(event) => event.stopPropagation()}
            onSubmit={createOrganization}
          >
            <header className="flex items-center justify-between border-b border-[#e8edf4] bg-white px-5 py-4">
              <div>
                <h2 className="m-0 text-[17px] font-semibold text-[#253342]">
                  Add organization
                </h2>
                <p className="mb-0 mt-1 text-[11px] text-[#8391a5]">
                  Create the organization and its administrator account.
                </p>
              </div>
              <button
                className="grid size-8 place-items-center rounded-[6px] border border-[#e1e7ee] bg-white p-0 text-[#8290a2] hover:bg-[#f6f8fb]"
                type="button"
                onClick={closeCreate}
                aria-label="Close form"
              >
                <X size={17} />
              </button>
            </header>
            <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Organization name
                <input
                  autoFocus
                  className={`${adminInputClass} placeholder:text-[#a0acba]`}
                  value={name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setSlug((currentSlug) =>
                      !currentSlug ||
                      currentSlug ===
                        name
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "")
                        ? nextName
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "")
                        : currentSlug,
                    );
                    setName(nextName);
                  }}
                  placeholder="e.g. Community Health Initiative"
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Slug
                <input
                  className={`${adminInputClass} placeholder:text-[#a0acba]`}
                  value={slug}
                  onChange={(event) =>
                    setSlug(event.target.value.toLowerCase())
                  }
                  placeholder="community-health-initiative"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  title="Use lowercase letters, numbers, and single hyphens only."
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Organization owner email
                <input
                  type="email"
                  className={`${adminInputClass} placeholder:text-[#a0acba]`}
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  placeholder="owner@organization.org"
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Owner role
                <input
                  className={`${adminInputClass} cursor-not-allowed text-[#68778a]`}
                  value="Organization Admin"
                  readOnly
                />
                <small className="text-[10px] font-normal text-[#8997a9]">
                  Organization Admin is an organization membership role, not a
                  platform role.
                </small>
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Temporary owner password
                <input
                  type="password"
                  className={`${adminInputClass} placeholder:text-[#a0acba]`}
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  maxLength={1024}
                  autoComplete="new-password"
                  required
                />
                <small className="text-[10px] font-normal text-[#8997a9]">
                  The organization administrator uses this password for their
                  first login.
                </small>
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Primary sector
                <select
                  className={adminInputClass}
                  value={sectorId}
                  onChange={(event) => setSectorId(event.target.value)}
                >
                  <option value="">No sector selected</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Country
                <input
                  className={`${adminInputClass} placeholder:text-[#a0acba]`}
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder="e.g. Liberia"
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Time zone
                <input
                  className={`${adminInputClass} placeholder:text-[#a0acba]`}
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="e.g. Africa/Monrovia"
                  required
                />
              </label>
              <div className="rounded-[6px] border border-[#e2e9f0] bg-[#f9fbfd] p-[11px] text-[10px] leading-[1.5] text-[#8997a9] sm:col-span-2">
                This creates the organization and its organization administrator
                account together. No invitation is sent.
              </div>
              {formError && (
                <p className="!m-0 text-[11px] text-[#b42318] sm:col-span-2">
                  {formError}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#e8edf4] bg-[#fbfcfd] px-5 py-3">
              <button
                className="cursor-pointer rounded-[5px] border border-[#dce5ef] bg-white px-[11px] py-[9px] font-sans text-[11px] font-semibold leading-normal text-[#5b6a7e]"
                type="button"
                onClick={closeCreate}
              >
                Cancel
              </button>
              <button
                className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] py-[9px] font-sans text-[11px] font-semibold leading-normal text-white"
                type="submit"
                disabled={createMutation.isPending}
              >
                <Plus size={15} />
                {createMutation.isPending ? "Creating…" : "Create organization"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {editingOrganization && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#102a4340] p-4"
          onClick={closeEdit}
        >
          <form
            className="flex max-h-[calc(100vh-32px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[6px] border border-[#dfe4e8] bg-white shadow-[0_12px_32px_rgba(16,42,67,.16)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={updateOrganization}
          >
            <header className="flex items-center justify-between border-b border-[#e8edf4] px-5 py-4">
              <h2 className="m-0 text-[16px] font-semibold text-[#253342]">
                Update organization
              </h2>
              <button
                type="button"
                className="border-0 bg-transparent p-0 text-[#8290a2]"
                onClick={closeEdit}
                aria-label="Close update card"
              >
                <X size={19} />
              </button>
            </header>
            <div className="grid flex-1 gap-3 p-5 overflow-y-auto sm:grid-cols-2">
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177] sm:col-span-2">
                Organization name
                <input
                  className={adminInputClass}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177] sm:col-span-2">
                Slug
                <input
                  className={adminInputClass}
                  value={editSlug}
                  onChange={(event) =>
                    setEditSlug(event.target.value.toLowerCase())
                  }
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177] sm:col-span-2">
                Owner email
                <input
                  className={adminInputClass + " bg-[#f5f7fa] text-[#7b8794]"}
                  value={editingOrganization.ownerEmail}
                  readOnly
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Country
                <input
                  className={adminInputClass}
                  value={editCountry}
                  onChange={(event) => setEditCountry(event.target.value)}
                  maxLength={100}
                  placeholder="e.g. Liberia"
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">
                Time zone
                <input
                  className={adminInputClass}
                  value={editTimezone}
                  onChange={(event) => setEditTimezone(event.target.value)}
                  maxLength={64}
                  placeholder="e.g. Africa/Monrovia"
                  required
                />
              </label>
              <fieldset className="m-0 rounded-[5px] border border-[#dfe4e8] px-3 pb-3 pt-2 sm:col-span-2">
                <legend className="px-1 text-[11px] font-bold text-[#526177]">
                  Sectors
                </legend>
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {sectors.map((sector) => (
                    <label
                      key={sector.id}
                      className="flex items-center gap-2 text-[11px] font-medium text-[#526177]"
                    >
                      <input
                        type="checkbox"
                        checked={editSectorIds.includes(sector.id)}
                        onChange={() =>
                          setEditSectorIds((current) =>
                            current.includes(sector.id)
                              ? current.filter((id) => id !== sector.id)
                              : [...current, sector.id],
                          )
                        }
                      />
                      {sector.name}
                    </label>
                  ))}
                  {sectors.length === 0 && (
                    <span className="text-[10px] text-[#8997a9]">
                      No active sectors are available.
                    </span>
                  )}
                </div>
              </fieldset>
              {editError && (
                <p className="m-0 text-[11px] text-[#b42318] sm:col-span-2">
                  {editError}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#e8edf4] bg-[#fbfcfd] px-5 py-3">
              <button
                type="button"
                className="mr-auto inline-flex items-center gap-1.5 rounded-[5px] border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-[11px] font-semibold text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={deactivateOrganization}
                disabled={deleteMutation.isPending || updateMutation.isPending}
              >
                <Trash2 size={14} />{" "}
                {deleteMutation.isPending
                  ? "Deactivating…"
                  : "Deactivate organization"}
              </button>
              <button
                type="button"
                className="rounded-[5px] border border-[#dce5ef] bg-white px-3 py-2 text-[11px] font-semibold text-[#5b6a7e]"
                onClick={closeEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-[5px] border border-brand bg-brand px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-60"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
