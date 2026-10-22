import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileText, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, PageHeader, Ring } from "../../components/ui";
import { apiClient, ApiError } from "../../services/apiClient";

export function FormsPage() {
  const navigate = useNavigate();
  const connectionsQuery = useQuery({
    queryKey: ["kobo-connections"],
    queryFn: apiClient.koboConnections,
  });
  const forms = (connectionsQuery.data ?? []).filter(
    (connection) => connection.selected_form_id && connection.selected_form_name,
  );

  return (
    <>
      <PageHeader
        eyebrow="Collection instruments"
        title="Forms & data sources"
        description="Each selected Kobo form becomes a FieldSight form card for your project work."
      >
        <Button onClick={() => navigate("/forms/connections")}>
          <Link2 size={16} />
          Kobo connections
        </Button>
      </PageHeader>

      {connectionsQuery.isLoading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#758092]">
          <Ring className="size-4 text-brand" aria-hidden="true" /> Loading forms…
        </div>
      ) : connectionsQuery.error ? (
        <p className="rounded-md bg-[#fff0f2] p-3 text-sm text-[#b42318]">
          {connectionsQuery.error instanceof ApiError
            ? connectionsQuery.error.message
            : "Unable to load Kobo forms."}
        </p>
      ) : forms.length ? (
        <section className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
          {forms.map((connection) => (
            <article className="rounded-lg border border-[#e7e9ed] bg-white p-5" key={connection.id}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-[#edf5ff] text-[#4c7ccd]">
                  <FileText size={20} />
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#e9f8ef] px-2.5 py-1 text-[12px] font-semibold text-[#21834c]">
                  <CheckCircle2 size={12} /> Active
                </span>
              </div>
              <h2 className="mb-1 mt-4 text-base font-semibold text-[#26364a]">
                {connection.selected_form_name}
              </h2>
              <p className="m-0 text-sm text-[#758092]">
                Kobo connection: {connection.name}
              </p>
              <p className="mb-0 mt-2 text-xs text-[#8792a0]">
                This is the selected form for your FieldSight project work.
              </p>
              <footer className="mt-5 flex justify-end">
                <Button variant="secondary" onClick={() => navigate("/forms/connections")}>
                  Change form
                </Button>
              </footer>
            </article>
          ))}
        </section>
      ) : (
        <section className="mx-auto max-w-2xl rounded-lg border border-[#e7e9ed] bg-white p-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#edf5ff] text-[#4c7ccd]">
            <FileText size={20} />
          </div>
          <h2 className="mb-2 mt-4 text-lg font-semibold text-[#26364a]">
            Your Kobo form
          </h2>
          <p className="m-0 max-w-xl text-sm leading-6 text-[#758092]">
            No form has been selected yet. Connect Kobo, then select a form to create
            its FieldSight project card here.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => navigate("/forms/connections")}>
              Select a Kobo form
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
