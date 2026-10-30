import { AdminDialog } from "../../components/superadmin/AdminDialog";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, PageHeader } from "../../components/ui";
import {
  AdminPanel,
  AdminStatus,
  AdminTableFooter,
  AdminTable,
  AdminTableToolbar,
  AdminSortHeader,
  useAdminTableSort,
  adminInputClass,
} from "../../components/superadmin/AdminUi";
import { apiClient, ApiError } from "../../services/apiClient";

export function SectorsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const tableSorting = useAdminTableSort(() => setPage(1));
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [status, setStatus] = useState("All");
  const [error, setError] = useState("");
  const sectorsQuery = useQuery({
    queryKey: ["platform-sectors"],
    queryFn: apiClient.adminSectors,
  });
  const createMutation = useMutation({
    mutationFn: apiClient.createSector,
    onSuccess: () => { setSuccess("Sector catalog updated."); void queryClient.invalidateQueries({ queryKey: ["platform-sectors"] }); void queryClient.invalidateQueries({ queryKey: ["sectors"] }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient.updateSector(id, { name }),
    onSuccess: () => { setSuccess("Sector catalog updated."); void queryClient.invalidateQueries({ queryKey: ["platform-sectors"] }); void queryClient.invalidateQueries({ queryKey: ["sectors"] }); },
  });
  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteSector,
    onSuccess: () => { setSuccess("Sector catalog updated."); void queryClient.invalidateQueries({ queryKey: ["platform-sectors"] }); void queryClient.invalidateQueries({ queryKey: ["sectors"] }); },
  });
  const sectors = (sectorsQuery.data ?? []).filter((sector) =>
    (status === "All" || (sector.is_active ? "Active" : "Inactive") === status) && `${sector.name} ${sector.code}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const currentPage = Math.min(page, Math.max(1, Math.ceil(sectors.length / 10)));
  const sortedSectors = tableSorting.sortRows(sectors, (row, key) => key === "status" ? (row.is_active ? "Active" : "Inactive") : key === "code" ? row.code : row.name);
  const visibleSectors = sortedSectors.slice((currentPage - 1) * 10, currentPage * 10);

  async function createSector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSuccess("");
    try {
      await createMutation.mutateAsync({
        code: code.trim().toLowerCase(),
        name: name.trim(),
      });
      setCode("");
      setName("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to create the sector.",
      );
    }
  }

  async function saveSector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setError("");
    try { await updateMutation.mutateAsync({ id: editing.id, name: editing.name.trim() }); setEditing(null); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Unable to update sector."); }
  }

  async function deactivateSector(id: string, sectorName: string) {
    if (!window.confirm(`Deactivate ${sectorName}?`)) return;
    setError(""); setSuccess("");
    try {
      await deleteMutation.mutateAsync(id);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to deactivate the sector.",
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform configuration"
        title="Sector catalog"
        description="Manage the active sectors available to organizations and projects."
      />
      {success && <p role="status" className="py-3 text-[var(--fs-success)]">{success}</p>}
      {sectorsQuery.error && <Button variant="secondary" onClick={() => void sectorsQuery.refetch()}>Retry sectors</Button>}
      {(error || sectorsQuery.error) && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-[var(--fs-danger)]">
          {error || "Unable to load sectors from the API."}
        </p>
      )}
      <AdminPanel
        title="Create sector"
        description="Add a sector to the platform catalog"
      >
        <form
          className="grid grid-cols-[180px_1fr_auto] gap-3 p-4 max-[680px]:grid-cols-1"
          onSubmit={createSector}
        >
          <label htmlFor="sector-code" className="space-y-2 text-sm font-medium">Sector code<input
            className={adminInputClass}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/[^a-z0-9_]/g, ""))
            }
            id="sector-code" aria-label="Sector code" pattern="[a-z][a-z0-9_]{1,63}" placeholder="sector_code"
            minLength={2}
            maxLength={64}
            required
          /></label>
          <label htmlFor="sector-name" className="space-y-2 text-sm font-medium">Sector name<input
            className={adminInputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            id="sector-name" aria-label="Sector name" placeholder="Sector name"
            minLength={2}
            maxLength={120}
            required
          /></label>
          <Button className="self-end" type="submit" disabled={createMutation.isPending}>
            <Plus size={15} />{" "}
            {createMutation.isPending ? "Creating…" : "Create sector"}
          </Button>
        </form>
      </AdminPanel>
      <section aria-label="Sector directory" className="sa-table-section mt-[18px]">
        <AdminTableToolbar label="sectors" search={query} onSearch={value => { setQuery(value); setPage(1); }}>
          <label>Status<select aria-label="Sector status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option>All</option><option>Active</option><option>Inactive</option></select></label>
        </AdminTableToolbar>
        <AdminTable label="Sector catalog">
          <table className="fs-data-table min-w-[620px]">
            <thead>
              <tr>
                <AdminSortHeader column="name" sorting={tableSorting}>Name</AdminSortHeader>
                <AdminSortHeader column="code" sorting={tableSorting}>Code</AdminSortHeader>
                <AdminSortHeader column="status" sorting={tableSorting}>Status</AdminSortHeader>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sectorsQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="text-center">
                    Loading sectors…
                  </td>
                </tr>
              )}
              {visibleSectors.map((sector) => (
                <tr key={sector.id}>
                  <td>
                    <strong>{sector.name}</strong>
                  </td>
                  <td>
                    <code>{sector.code}</code>
                  </td>
                  <td>
                    <AdminStatus value={sector.is_active ? "Active" : "Inactive"} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded border-0 bg-[#f4f7fb] text-[#657182]"
                        onClick={() => setEditing({ id: sector.id, name: sector.name })}
                        aria-label={`Rename ${sector.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded border-0 bg-[#fff1f2] text-[#c2414b]"
                        disabled={!sector.is_active || deleteMutation.isPending} onClick={() => deactivateSector(sector.id, sector.name)}
                        aria-label={`Deactivate ${sector.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sectorsQuery.isLoading && sectors.length === 0 && (
            <p className="m-0 p-10 text-center text-xs text-[#8793a2]">
              No sectors match your search.
            </p>
          )}
        </AdminTable>
        <AdminTableFooter
          shown={visibleSectors.length}
          total={sectors.length} page={currentPage} onPageChange={setPage}
        />
      </section>
      {editing && <AdminDialog label="Edit sector" onClose={() => setEditing(null)}><form onSubmit={saveSector}><h2 className="text-xl font-semibold">Edit sector</h2><label>Sector name<input autoFocus required minLength={2} maxLength={120} className={adminInputClass} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>{error && <p role="alert">{error}</p>}<div className="mt-4 flex gap-3"><Button type="submit" disabled={updateMutation.isPending}>Save sector</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button></div></form></AdminDialog>}
    </>
  );
}
