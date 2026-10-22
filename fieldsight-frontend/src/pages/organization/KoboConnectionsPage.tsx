import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, FileText, Plus, ShieldCheck, X } from "lucide-react";
import { Button, PageHeader, Ring } from "../../components/ui";
import { apiClient, ApiError } from "../../services/apiClient";

export function KoboConnectionsPage() {
  const queryClient = useQueryClient();
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [serverUrl, setServerUrl] = useState("https://kf.kobotoolbox.org");
  const [apiToken, setApiToken] = useState("");
  const [formError, setFormError] = useState("");

  const connectionsQuery = useQuery({
    queryKey: ["kobo-connections"],
    queryFn: apiClient.koboConnections,
  });
  const createMutation = useMutation({
    mutationFn: apiClient.createKoboConnection,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["kobo-connections"] });
    },
  });
  function openConnectionForm() {
    setFormError("");
    setShowConnectionForm(true);
  }

  function closeConnectionForm() {
    if (!createMutation.isPending) {
      setApiToken("");
      setFormError("");
      setShowConnectionForm(false);
    }
  }

  async function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    try {
      await createMutation.mutateAsync({
        name: connectionName.trim(),
        server_url: serverUrl.trim(),
        api_token: apiToken,
      });
      setConnectionName("");
      setApiToken("");
      closeConnectionForm();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to verify the Kobo connection.");
    }
  }

  const connections = connectionsQuery.data ?? [];
  const loadError =
    connectionsQuery.error instanceof ApiError
      ? connectionsQuery.error.message
      : connectionsQuery.error
        ? "Unable to load Kobo connections."
        : "";

  return (
    <>
      <PageHeader
        eyebrow="Forms & sources"
        title="Kobo connections"
        description="Connect a Kobo account, then select one form for this FieldSight organization."
      >
        <Button onClick={openConnectionForm}>
          <Plus size={16} /> Connect Kobo
        </Button>
      </PageHeader>

      <section className="mb-5 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <article className="rounded-lg border border-[#dbe8f8] bg-[#f7fbff] p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-[#e5f0ff] text-brand">
              <ShieldCheck size={19} />
            </span>
            <div>
              <h2 className="m-0 text-sm font-semibold text-[#29384b]">How it works</h2>
              <p className="mb-0 mt-1 text-xs leading-5 text-[#62748a]">
                Connect Kobo, choose one form, then use that form for your FieldSight work.
              </p>
            </div>
          </div>
        </article>
        <article className="rounded-lg border border-[#e7e9ed] bg-white p-5">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-[.08em] text-[#8391a5]">Security</p>
          <p className="mb-0 mt-2 text-xs leading-5 text-[#62748a]">
            Tokens are encrypted on the backend and are never displayed after saving.
          </p>
        </article>
      </section>

      {loadError && <p className="mb-4 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{loadError}</p>}

      <section className="rounded-lg border border-[#e7e9ed] bg-white">
        <div className="border-b border-[#edf0f2] px-5 py-4">
          <h2 className="m-0 text-sm font-semibold text-[#29384b]">Connected accounts</h2>
          <p className="mb-0 mt-1 text-xs text-[#758092]">Choose one Kobo form from a verified account.</p>
        </div>
        {connectionsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs text-[#758092]">
            <Ring className="size-4 text-brand" aria-hidden="true" /> Loading Kobo connections…
          </div>
        ) : connections.length ? (
          connections.map((connection) => (
            <div className="flex flex-wrap items-center gap-3 border-b border-[#edf0f2] p-5 last:border-b-0" key={connection.id}>
              <span className="grid size-9 place-items-center rounded-lg bg-[#e9f8ef] text-[#21834c]">
                <CheckCircle2 size={19} />
              </span>
              <div>
                <strong className="block text-sm text-[#334254]">{connection.name}</strong>
                <small className="text-xs text-[#758092]">
                  {connection.server_url}
                  {connection.verified_at ? " · verified " + new Date(connection.verified_at).toLocaleDateString() : ""}
                </small>
                {connection.selected_form_name && (
                  <small className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand">
                    <FileText size={12} /> Active form: {connection.selected_form_name}
                  </small>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-full bg-[#e9f8ef] px-2.5 py-1 text-[12px] font-semibold text-[#21834c]">
                  {connection.is_verified ? "Verified" : "Not verified"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 text-center">
            <p className="m-0 text-sm font-semibold text-[#445367]">No Kobo account connected</p>
            <p className="mb-4 mt-1 text-xs text-[#758092]">Connect an account before selecting a Kobo form.</p>
            <Button onClick={openConnectionForm}><Plus size={15} /> Connect Kobo</Button>
          </div>
        )}
      </section>

      {showConnectionForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#102a4340] p-4" onClick={closeConnectionForm}>
          <form className="w-full max-w-[520px] overflow-hidden rounded-lg bg-white shadow-[0_20px_55px_rgba(16,42,67,.24)]" onClick={(event) => event.stopPropagation()} onSubmit={saveConnection}>
            <header className="flex items-start justify-between border-b border-[#e8edf4] px-6 py-5">
              <div>
                <p className="m-0 text-[12px] font-semibold uppercase tracking-[.08em] text-brand">KoboToolbox</p>
                <h2 className="mb-0 mt-1 text-lg text-[#303e67]">Connect Kobo account</h2>
              </div>
              <button className="border-0 bg-transparent text-[#8290a2]" type="button" onClick={closeConnectionForm} aria-label="Close">
                <X size={19} />
              </button>
            </header>
            <div className="grid gap-4 p-6">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                Connection name
                <input className="rounded-md border border-[#dfe4e8] px-3 py-2.5 text-sm outline-none focus:border-brand" value={connectionName} onChange={(event) => setConnectionName(event.target.value)} placeholder="Community Health Kobo" required />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                Kobo server URL
                <input className="rounded-md border border-[#dfe4e8] px-3 py-2.5 text-sm outline-none focus:border-brand" type="url" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} required />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#526177]">
                Kobo API token
                <input className="rounded-md border border-[#dfe4e8] px-3 py-2.5 text-sm outline-none focus:border-brand" type="password" value={apiToken} onChange={(event) => setApiToken(event.target.value)} placeholder="Paste your Kobo API token" autoComplete="off" required />
              </label>
              <a className="inline-flex items-center gap-1 text-xs font-semibold text-brand" href="https://support.kobotoolbox.org/api.html" target="_blank" rel="noreferrer">
                Where do I find my token? <ExternalLink size={13} />
              </a>
              {formError && <p className="m-0 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">{formError}</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#e8edf4] bg-[#fbfcfd] px-6 py-3">
              <Button type="button" variant="secondary" onClick={closeConnectionForm}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Ring className="size-4" aria-hidden="true" />}
                {createMutation.isPending ? "Verifying…" : "Verify and connect"}
              </Button>
            </footer>
          </form>
        </div>
      )}

    </>
  );
}
