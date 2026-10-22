import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  apiClient,
  type ApiProject,
  type WorkspaceDetails,
} from "../services/apiClient";
import { useWorkspace } from "./WorkspaceContext";
import {
  Notice,
  Page,
  Panel,
  WorkspaceGate,
  WorkspaceTabs,
} from "./WorkspaceUI";

const input =
  "h-9 w-full min-w-0 rounded border border-[#e3e5eb] bg-white px-3 text-xs text-[#49515c] outline-none focus:border-[#0b51b7] focus:ring-1 focus:ring-[#0b51b7]/15";
function metadata(project: ApiProject): WorkspaceDetails {
  const data = project.workspace_details ?? {};
  return {
    code: data.code ?? project.id.slice(0, 8).toUpperCase(),
    stage: data.stage ?? "",
    countries: data.countries ?? (project.country ? [project.country] : []),
    topics: data.topics ?? [],
    group: data.group ?? "",
    cost_unit: data.cost_unit ?? "",
    funding: data.funding ?? "",
    health_status: data.health_status ?? "",
  };
}
export function WorkspaceDetailsPage() {
  const { project, projectId, organizationId } = useWorkspace();
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [details, setDetails] = useState<WorkspaceDetails>({
    code: "",
    stage: "",
    countries: [],
    topics: [],
    group: "",
    cost_unit: "",
    funding: "",
    health_status: "",
  });
  const [message, setMessage] = useState("");
  function reset() {
    if (!project) return;
    setName(project.name);
    setDescription(project.description);
    setStart(project.start_date ?? "");
    setEnd(project.end_date ?? "");
    setDetails(metadata(project));
  }
  useEffect(() => {
    reset();
    setMessage("");
  }, [projectId, project?.updated_at]);
  const save = useMutation({
    mutationFn: () =>
      apiClient.updateProject(organizationId, projectId, {
        name: name.trim(),
        description,
        start_date: start || null,
        end_date: end || null,
        workspace_details: details,
      }),
    onSuccess: async (data) => {
      cache.setQueryData<ApiProject[]>(
        ["organization-projects", organizationId],
        (current) =>
          current?.map((item) => (item.id === data.id ? data : item)),
      );
      await cache.invalidateQueries({
        queryKey: ["organization-projects", organizationId],
      });
      setMessage("Project details saved.");
    },
  });
  function update<K extends keyof WorkspaceDetails>(
    key: K,
    value: WorkspaceDetails[K],
  ) {
    setDetails((current) => ({ ...current, [key]: value }));
    setMessage("");
  }
  const changed =
    project &&
    JSON.stringify({ name, description, start, end, details }) !==
      JSON.stringify({
        name: project.name,
        description: project.description,
        start: project.start_date ?? "",
        end: project.end_date ?? "",
        details: metadata(project),
      });
  return (
    <Page
      title={project?.name ?? "Project details"}
      description="Manage the details of this project."
    >
      <WorkspaceGate>
        <WorkspaceTabs />
        {message && <Notice>{message}</Notice>}
        {save.error && <Notice error>{save.error.message}</Notice>}
        <Panel>
          <header className="border-b border-[#e6e8ed] px-5 py-4">
            <h2 className="m-0 text-sm font-semibold text-[#353d47]">
              Details
            </h2>
          </header>
          <form
            className="p-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <fieldset
              disabled={save.isPending}
              className="m-0 grid min-w-0 grid-cols-2 gap-x-7 gap-y-5 border-0 p-0 max-md:grid-cols-1"
            >
              <DetailField label="Name *">
                <input
                  aria-label="Name"
                  className={input}
                  required
                  minLength={2}
                  maxLength={200}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setMessage("");
                  }}
                />
              </DetailField>
              <DetailField label="Stage">
                <select
                  aria-label="Stage"
                  className={input}
                  value={details.stage}
                  onChange={(event) => update("stage", event.target.value)}
                >
                  <option value="">Choose</option>
                  {Array.from(
                    new Set([
                      details.stage,
                      "Design",
                      "Planning",
                      "Implementation",
                      "Monitoring",
                      "Evaluation",
                      "Closure",
                    ]),
                  )
                    .filter(Boolean)
                    .map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                </select>
              </DetailField>
              <DetailField label="Start date">
                <DateField
                  value={start}
                  onChange={setStart}
                  label="Start date"
                />
              </DetailField>
              <DetailField label="End date">
                <DateField
                  value={end}
                  onChange={setEnd}
                  min={start}
                  label="End date"
                />
              </DetailField>
              <DetailField label="Project ID code">
                <input
                  aria-label="Project ID code"
                  className={input}
                  maxLength={80}
                  value={details.code}
                  onChange={(event) => update("code", event.target.value)}
                />
              </DetailField>
              <DetailField label="Countries">
                <Tags
                  label="Countries"
                  values={details.countries}
                  onChange={(values) => update("countries", values)}
                />
              </DetailField>
              <DetailField label="Sectors">
                <Tags
                  label="Sectors"
                  values={details.topics}
                  onChange={(values) => update("topics", values)}
                />
              </DetailField>
              <DetailField label="Status">
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-3 size-2.5 rounded-full"
                    style={{
                      backgroundColor: {
                        red: "#e34e4e",
                        amber: "#e9b34b",
                        green: "#48ad83",
                        "": "#c2c6cf",
                      }[details.health_status],
                    }}
                  />
                  <select
                    aria-label="Status"
                    className={input + " pl-8"}
                    value={details.health_status}
                    onChange={(event) =>
                      update(
                        "health_status",
                        event.target.value as WorkspaceDetails["health_status"],
                      )
                    }
                  >
                    <option value="">Not set</option>
                    <option value="red">Red</option>
                    <option value="amber">Amber</option>
                    <option value="green">Green</option>
                  </select>
                </div>
              </DetailField>
              <div className="col-span-2 max-md:col-span-1">
                <DetailField label="Description">
                  <textarea
                    aria-label="Description"
                    rows={4}
                    className={input + " h-auto py-3"}
                    maxLength={10000}
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setMessage("");
                    }}
                  />
                </DetailField>
              </div>
            </fieldset>
            <div className="mt-6 flex justify-end gap-3 border-t border-[#e6e8ed] pt-4">
              <button
                type="button"
                disabled={save.isPending || !changed}
                onClick={() => {
                  reset();
                  setMessage("");
                  save.reset();
                }}
                className="rounded border border-[#b8ccea] bg-white px-5 py-2 text-xs text-[#0b51b7] hover:bg-[#edf4ff] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={save.isPending || !changed || name.trim().length < 2}
                className="rounded border-0 bg-[#0b51b7] px-5 py-2 text-xs font-medium text-white hover:bg-[#084394] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Panel>
      </WorkspaceGate>
    </Page>
  );
}
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <div className="text-[12px] font-medium uppercase tracking-wide text-[#92949f]">
        {label}
      </div>
      {children}
    </div>
  );
}
function DateField({
  value,
  onChange,
  min,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  label: string;
}) {
  return (
    <div className="relative">
      <input
        aria-label={label}
        type="date"
        className={input + " pr-9"}
        value={value}
        min={min || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange("")}
          className="absolute right-8 top-2.5 border-0 bg-white p-0 text-[#a4a7af]"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
function Tags({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const added = draft
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (added.length) {
      onChange([...new Set([...values, ...added])].slice(0, 30));
      setDraft("");
    }
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded border border-[#e3e5eb] bg-white px-2 py-1">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-full border border-[#e0e1e7] bg-[#f7f7f9] px-2 py-0.5 text-[12px] text-[#626977]"
        >
          <button
            aria-label={`Remove ${value} from ${label.toLowerCase()}`}
            type="button"
            className="border-0 bg-transparent p-0 text-[#a4a7af]"
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            <X size={10} />
          </button>
          {value}
        </span>
      ))}
      <input
        aria-label={label}
        value={draft}
        maxLength={100}
        placeholder={values.length ? "" : "Type and press Enter"}
        className="min-w-[120px] flex-1 border-0 bg-transparent p-0.5 text-xs outline-none"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
}
