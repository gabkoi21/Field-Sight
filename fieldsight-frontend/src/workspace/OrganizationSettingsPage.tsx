import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Save } from "lucide-react";
import { Button, LoadingState } from "../components/ui";
import { apiClient } from "../services/apiClient";
import { useWorkspace } from "./WorkspaceContext";
import { Field, Notice, Page, Panel, fieldClass } from "./WorkspaceUI";

export function OrganizationSettingsPage() {
  const { organizationId } = useWorkspace();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["organization-settings", organizationId],
    queryFn: () => apiClient.organizationSettings(organizationId),
    enabled: Boolean(organizationId),
  });
  const events = useQuery({ queryKey: ["admin-events", organizationId], queryFn: () => apiClient.adminEvents(organizationId), enabled: Boolean(organizationId) });
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [language, setLanguage] = useState("en");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (query.data) {
      setCountry(query.data.country ?? "");
      setTimezone(query.data.timezone);
      setLanguage(query.data.default_language);
    }
  }, [query.data]);
  const save = useMutation({
    mutationFn: () =>
      apiClient.saveOrganizationSettings(organizationId, {
        country: country || null,
        timezone,
        default_language: language,
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["organization-settings"] });
      setSaved(true);
    },
  });
  return (
    <Page
      breadcrumb="FieldSight / Organization"
      title="Organization settings"
      description="Manage shared project defaults and organization access."
    >
      {[query.error, save.error].filter(Boolean).map((e, i) => (
        <Notice error key={i}>
          {e?.message}
        </Notice>
      ))}
      {saved && <Notice>Organization defaults saved.</Notice>}
      <Panel className="p-5">
        <h2 className="text-sm font-semibold">Recent administrative events</h2>
        <p className="text-xs">Recorded project lifecycle, submission review, and provider-deletion events. Earlier events are not backfilled.</p>
        {events.isPending ? <p role="status">Loading history…</p> : events.error ? <Notice error>{events.error.message}</Notice> : events.data?.length ? <ul className="text-xs">{events.data.map(event => <li key={event.id}>{new Date(event.occurred_at).toLocaleString()} · {event.action} · Resource {event.resource_id} · Administrator {event.actor_id}</li>)}</ul> : <p className="text-xs">No administrative events recorded.</p>}
      </Panel>
      {query.isFetching && query.data && <LoadingState variant="inline" label="Updating settings…" />}
      {query.error && <Button variant="secondary" onClick={() => void query.refetch()}>Retry settings</Button>}
      {query.isLoading ? (
        <LoadingState variant="panel" label="Loading organization settings…" />
      ) : query.error && !query.data ? null : (
        <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
          <Panel className="p-6">
            <h2 className="mb-5 mt-0 text-base font-semibold">
              General defaults
            </h2>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <Field label="Country">
                <input
                  maxLength={100}
                  className={fieldClass}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </Field>
              <Field label="Timezone">
                <select
                  className={fieldClass}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {Array.from(
                    new Set([
                      timezone,
                      "UTC",
                      "Africa/Monrovia",
                      "Africa/Accra",
                      "Africa/Nairobi",
                      "Europe/London",
                      "America/New_York",
                    ]),
                  ).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Default language">
                <select
                  className={fieldClass}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </select>
              </Field>
              <p className="m-0 text-xs leading-5 text-[var(--fs-muted)]">
                These are stored organization defaults. Analytical date filters
                currently use UTC; the interface is in English.
              </p>
              <Button type="submit" disabled={save.isPending}>
                <Save size={14} />
                Save settings
              </Button>
            </form>
          </Panel>
          <div className="grid gap-5">
            <Panel className="p-6">
              <h2 className="mt-0 text-base font-semibold">
                Access & account security
              </h2>
              <p className="text-sm leading-6 text-[var(--fs-muted)]">
                Manage active members and invitations from the team screen.
                Personal profile, password and landing-page settings are in your
                user menu.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--fs-primary)]">
                <Link to="/settings/admins">Manage administrators →</Link>
                <Link to="/profile">Profile & security →</Link>
              </div>
            </Panel>
            <Panel className="p-6">
              <h2 className="mt-0 text-base font-semibold">Data sources</h2>
              <p className="text-sm leading-6 text-[var(--fs-muted)]">
                Use a verified Kobo connection for live synchronization, or
                import local CSV files into data tables.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--fs-primary)]">
                <Link to="/forms/connections">Kobo connections →</Link>
                <Link to="/data-tables">Data tables →</Link>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </Page>
  );
}
