import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button, PageHeader, Ring } from "../../components/ui";
import { apiClient, ApiError } from "../../services/apiClient";

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [description, setDescription] = useState("");
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: apiClient.me });
  const organizationId = userQuery.data?.memberships[0]?.organization_id;
  const projectsQuery = useQuery({ queryKey: ["organization-projects", organizationId], queryFn: () => apiClient.organizationProjects(organizationId!), enabled: Boolean(organizationId) });
  const sectorsQuery = useQuery({ queryKey: ["organization-sectors", organizationId], queryFn: () => apiClient.organizationSectors(organizationId!), enabled: Boolean(organizationId) });
  const sectorNamesQuery = useQuery({ queryKey: ["sectors"], queryFn: apiClient.sectors });
  const createMutation = useMutation({
    mutationFn: () => apiClient.createProject(organizationId!, { name, organization_sector_id: sectorId, description }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["organization-projects", organizationId] }); setOpen(false); setName(""); setSectorId(""); setDescription(""); },
  });
  const projects = projectsQuery.data ?? [];

  function createProject(event: FormEvent) { event.preventDefault(); createMutation.mutate(); }

  return <><PageHeader eyebrow="Program operations" title="Projects" description="Each project can use its own Kobo form."><Button onClick={() => setOpen(true)}><Plus size={16}/>Add project</Button></PageHeader>
    {projectsQuery.isLoading ? <div className="flex justify-center gap-2 p-10 text-sm text-[#758092]"><Ring className="size-4 text-brand"/>Loading projects…</div> :
      <section className="grid gap-4 md:grid-cols-2">{projects.map(project => <article className="rounded-lg border border-[#e7e9ed] bg-white p-5" key={project.id}><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[#edf5ff] text-[#4c7ccd]"><FolderKanban size={20}/></span><div><h2 className="m-0 text-base font-semibold">{project.name}</h2><p className="mb-0 mt-1 text-xs text-[#758092]">{project.kobo_form_name ?? "No Kobo form assigned"}</p></div></div><footer className="mt-5 text-right"><NavLink to={`/projects/${project.id}`}><Button variant="secondary">Manage project</Button></NavLink></footer></article>)}</section>}
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-[#102a4340] p-4"><form className="w-full max-w-md rounded-lg bg-white p-6" onSubmit={createProject}><header className="flex justify-between"><h2 className="m-0 text-lg">Add project</h2><button type="button" className="border-0 bg-transparent" onClick={() => setOpen(false)}><X size={18}/></button></header><div className="mt-5 grid gap-4"><label className="grid gap-1 text-xs font-semibold">Project name<input className="rounded-md border p-2.5" value={name} onChange={e => setName(e.target.value)} required/></label><label className="grid gap-1 text-xs font-semibold">Sector<select className="rounded-md border p-2.5" value={sectorId} onChange={e => setSectorId(e.target.value)} required><option value="">Select sector</option>{(sectorsQuery.data ?? []).map(sector => { const sectorName = (sectorNamesQuery.data ?? []).find(item => item.id === sector.sector_id); return <option value={sector.id} key={sector.id}>{sectorName?.name ?? "Sector"}</option> })}</select></label><label className="grid gap-1 text-xs font-semibold">Description<textarea className="rounded-md border p-2.5" value={description} onChange={e => setDescription(e.target.value)}/></label>{createMutation.error && <p className="text-xs text-red-600">{createMutation.error instanceof ApiError ? createMutation.error.message : "Unable to create project."}</p>}<div className="text-right"><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create project"}</Button></div></div></form></div>}
  </>;
}
