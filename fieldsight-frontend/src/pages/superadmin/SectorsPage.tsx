import { AdminDialog } from "../../components/superadmin/AdminDialog";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button, PageHeader } from "../../components/ui";
import {
  AdminPanel,
  AdminStatus,
  AdminTableFooter,
  adminInputClass,
} from "../../components/superadmin/AdminUi";
import { apiClient, ApiError } from "../../services/apiClient";

export function SectorsPage() {
  const queryClient = useQueryClient();
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

  async function createSector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
    setError("");
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
        <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
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
          <input
            className={adminInputClass}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/[^a-z0-9_]/g, ""))
            }
            aria-label="Sector code" pattern="[a-z][a-z0-9_]{1,63}" placeholder="sector_code"
            minLength={2}
            maxLength={64}
            required
          />
          <input
            className={adminInputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Sector name" placeholder="Sector name"
            minLength={2}
            maxLength={120}
            required
          />
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus size={15} />{" "}
            {createMutation.isPending ? "Creating…" : "Create sector"}
          </Button>
        </form>
      </AdminPanel>
      <AdminPanel
        title="Sector catalog"
        description="Catalog used during organization and project setup"
        className="mt-[18px]"
      >
        <div className="border-b border-line p-4">
          <label className="flex min-h-[38px] max-w-[420px] items-center gap-2 rounded-[7px] border border-[#dfe4e8] bg-white px-3 text-[#8793a2]">
            <Search size={15} />
            <input
              className="w-full border-0 bg-transparent text-xs text-[#324158] outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sectors…"
            />
          </label>
        </div>
        <label className="block p-4">Status <select value={status} onChange={e => setStatus(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label>
        <div className="overflow-x-auto">
          <table className="min-w-[620px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th />
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
              {sectors.map((sector) => (
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
        </div>
        <AdminTableFooter
          shown={sectors.length}
          total={(sectorsQuery.data ?? []).length}
        />
      </AdminPanel>
      {editing && <AdminDialog label="Edit sector" onClose={() => setEditing(null)}><form onSubmit={saveSector}><h2 className="text-xl font-semibold">Edit sector</h2><label>Sector name<input autoFocus required minLength={2} maxLength={120} className={adminInputClass} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>{error && <p role="alert">{error}</p>}<div className="mt-4 flex gap-3"><Button type="submit" disabled={updateMutation.isPending}>Save sector</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button></div></form></AdminDialog>}
    </>
  );
}
