import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type WorkspaceProfile } from "../../services/apiClient";
import { Button } from "../ui";
import { adminInputClass } from "./AdminUi";

export function AdminProfile({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["administrator-profile"], queryFn: apiClient.profile });
  const [name, setName] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (input: WorkspaceProfile) => apiClient.saveProfile(input),
    onSuccess: (data) => { client.setQueryData(["administrator-profile"], data); setName(null); },
  });
  return <form onSubmit={event => {
    event.preventDefault();
    if (profile.data) save.mutate({ ...profile.data, full_name: (name ?? profile.data.full_name ?? "").trim() || null });
  }} className="space-y-5">
    <div><h2 className="text-xl font-semibold">Administrator profile</h2><p className="mt-1 text-sm text-[var(--fs-muted)]">Update the name associated with your account.</p></div>
    {profile.isLoading && <p role="status">Loading profile…</p>}
    {profile.error && <div role="alert">Unable to load your profile. <Button variant="secondary" onClick={() => void profile.refetch()}>Retry profile</Button></div>}
    {profile.data && <><div><span className="text-sm font-medium">Email</span><p className="break-words text-sm text-[var(--fs-muted)]">{profile.data.email}</p></div>
      <label className="block text-sm font-medium">Full name<input className={`${adminInputClass} mt-2`} autoComplete="name" maxLength={200} value={name ?? profile.data.full_name ?? ""} disabled={save.isPending} onChange={event => { setName(event.target.value); save.reset(); }} /></label>
      <p className="text-sm text-[var(--fs-muted)]">Role: Super administrator</p></>}
    {save.error && <p role="alert" className="text-sm text-[var(--fs-danger)]">Unable to save your profile. Your changes have been retained for retry.</p>}
    {save.isSuccess && <p role="status" className="text-sm text-[var(--fs-success)]">Profile saved.</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose}>Close profile</Button><Button type="submit" disabled={!profile.data || profile.isError || save.isPending || name === null}>{save.isPending ? "Saving…" : "Save profile"}</Button></div>
  </form>;
}
