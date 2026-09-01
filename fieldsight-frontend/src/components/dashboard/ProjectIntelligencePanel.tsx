import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { apiClient, ApiError, type FieldMapping } from "../../services/apiClient";

export function ProjectIntelligencePanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const mappingsQuery = useQuery({
    queryKey: ["field-mappings", projectId],
    queryFn: () => apiClient.fieldMappings(projectId),
  });
  const intelligenceQuery = useQuery({
    queryKey: ["project-intelligence", projectId],
    queryFn: () => apiClient.projectIntelligence(projectId),
  });
  const [draftMappings, setDraftMappings] = useState<
    Record<string, { display_name: string; data_type: FieldMapping["data_type"] }>
  >({});
  const saveMappings = useMutation({
    mutationFn: (mappings: typeof draftMappings) =>
      apiClient.replaceFieldMappings(
        projectId,
        Object.entries(mappings)
          .filter(([, value]) => value.display_name.trim())
          .map(([source_field, value]) => ({
            source_field,
            display_name: value.display_name.trim(),
            meaning: null,
            data_type: value.data_type,
            is_required: false,
            is_location: value.data_type === "location" || value.data_type === "gps",
          })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["field-mappings", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project-intelligence", projectId] });
    },
  });
  const intelligence = intelligenceQuery.data;
  const existing = new Map((mappingsQuery.data?.mappings ?? []).map((item) => [item.source_field, item]));
  const sourceFields = mappingsQuery.data?.source_fields ?? [];
  const error = saveMappings.error;

  return (
    <section className="grid gap-4">
      <article className="rounded-[9px] border border-[#dfe4e9] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[.09em] text-brand">Project Pulse</p>
            <h2 className="mb-0 mt-1 text-lg">What needs attention today?</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${intelligence?.project_status === "On Track" ? "bg-[#eaf2ff] text-brand" : "bg-[#fff4e5] text-[#a15c00]"}`}
          >
            {intelligence?.project_status ?? "Checking"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 max-[800px]:grid-cols-1">
          {intelligence?.pulse.map((item) => (
            <div key={item.name} className="rounded-lg border border-[#e7ebf0] p-3">
              <span className="flex items-center gap-2 text-xs font-semibold">
                {item.status === "On track" ? (
                  <CheckCircle2 size={15} className="text-brand" />
                ) : (
                  <AlertTriangle size={15} className="text-[#d88935]" />
                )}
                {item.name}
              </span>
              <p className="mb-0 mt-2 text-[11px] text-[#748298]">{item.detail}</p>
            </div>
          ))}
        </div>
        {!!intelligence?.indicators.length && (
          <div className="mt-4 grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
            {intelligence.indicators.map((item) => (
              <div key={item.mapping_id} className="rounded-lg bg-[#f5f8fd] p-3">
                <strong className="text-sm">{item.name}</strong>
                <p className="mb-0 mt-1 text-xs text-[#65758b]">{item.summary}</p>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-[9px] border border-[#dfe4e9] bg-white p-5">
        <div className="mb-4">
          <h2 className="m-0 text-sm">Field mapping</h2>
          <p className="mb-0 mt-1 text-[11px] text-[#7c899c]">Give Kobo questions a clear FieldSight meaning.</p>
        </div>
        <div className="max-h-[250px] space-y-2 overflow-y-auto">
          {sourceFields.map((source) => {
            const current = draftMappings[source] ?? {
              display_name:
                existing.get(source)?.display_name ?? source.split("/").pop()?.replaceAll("_", " ") ?? source,
              data_type: existing.get(source)?.data_type ?? "text",
            };
            return (
              <div
                key={source}
                className="grid grid-cols-[minmax(120px,.8fr)_1fr_125px] items-center gap-2 max-[560px]:grid-cols-1"
              >
                <code className="truncate text-[10px] text-[#738298]">{source}</code>
                <input
                  className="rounded-md border border-[#dce4ed] px-2 py-1.5 text-xs"
                  value={current.display_name}
                  onChange={(event) =>
                    setDraftMappings((all) => ({ ...all, [source]: { ...current, display_name: event.target.value } }))
                  }
                />
                <select
                  className="rounded-md border border-[#dce4ed] px-2 py-1.5 text-xs"
                  value={current.data_type}
                  onChange={(event) =>
                    setDraftMappings((all) => ({
                      ...all,
                      [source]: { ...current, data_type: event.target.value as FieldMapping["data_type"] },
                    }))
                  }
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes / No</option>
                  <option value="single_select">Single select</option>
                  <option value="multiple_select">Multiple select</option>
                  <option value="date">Date</option>
                  <option value="location">Location</option>
                  <option value="gps">GPS</option>
                </select>
              </div>
            );
          })}
          {!sourceFields.length && (
            <p className="rounded-md bg-[#f7f9fc] p-3 text-xs text-[#7c899c]">
              Synchronize Kobo data to discover fields.
            </p>
          )}
        </div>
        <button
          disabled={!sourceFields.length || saveMappings.isPending}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#bdd0eb] bg-white px-3 py-2 text-xs font-semibold text-brand disabled:opacity-50"
          onClick={() => {
            const completed = Object.fromEntries(
              sourceFields.map((source) => [
                source,
                draftMappings[source] ?? {
                  display_name:
                    existing.get(source)?.display_name ?? source.split("/").pop()?.replaceAll("_", " ") ?? source,
                  data_type: existing.get(source)?.data_type ?? "text",
                },
              ]),
            );
            setDraftMappings(completed);
            saveMappings.mutate(completed);
          }}
        >
          <Save size={14} /> Save mappings
        </button>
      </article>
      {error && (
        <p className="m-0 rounded-md bg-[#fff0f2] p-3 text-xs text-[#b42318]">
          {error instanceof ApiError ? error.message : "Unable to update project intelligence."}
        </p>
      )}
    </section>
  );
}
