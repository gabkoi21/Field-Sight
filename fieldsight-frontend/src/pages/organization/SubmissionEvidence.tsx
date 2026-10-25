import type { SurveyField } from "../../services/apiClient";

export function displayEvidence(value: unknown): string {
  if (value === undefined) return "Missing field";
  if (value === null) return "No value (null)";
  if (value === "") return "Empty response";
  if (Array.isArray(value) && !value.length) return "Empty array";
  if (typeof value === "object" && !Object.keys(value).length) return "Empty object";
  return typeof value === "object" ? JSON.stringify(value, (_, item) => item === undefined ? "Missing field" : item, 2) : String(value);
}

// Prefer an exact Kobo path, then descend groups and repeat instances.
export function flaggedValue(answers: unknown, field: string): unknown {
  const parts = field.replace(/\[(\d+)\]/g, "/$1").split(/[/.]/).filter(Boolean);
  function read(value: unknown, path: string[]): unknown {
    if (!path.length) return value;
    if (!value || typeof value !== "object") return undefined;
    const object = value as Record<string, unknown>;
    const joined = path.join("/");
    if (Object.hasOwn(object, joined)) return object[joined];
    if (Object.hasOwn(object, path.join("."))) return object[path.join(".")];
    if (Array.isArray(value) && !/^\d+$/.test(path[0])) {
      return value.map(item => read(item, path));
    }
    if (Object.hasOwn(object, path[0])) return read(object[path[0]], path.slice(1));
    // Kobo repeat objects sometimes retain the complete group prefix in their keys.
    if (Object.hasOwn(object, field)) return object[field];
    return undefined;
  }
  return read(answers, parts);
}

export function SubmissionEvidence({ answers, field, fields = [], loading, error }: {
  answers?: Record<string, unknown>; field?: string | null; fields?: SurveyField[];
  loading: boolean; error: boolean;
}) {
  if (loading) return <p role="status" className="mt-4 text-xs">Loading submission evidence…</p>;
  if (error) return <p role="alert" className="mt-4 text-xs text-[#b42318]">Unable to load submission evidence. Reload before making a decision.</p>;
  const labels = new Map(fields.map(item => [item.source_field, item.label]));
  function title(path: string) {
    const label = labels.get(path) ?? labels.get(path.replace(/\/\d+(?=\/|$)/g, ""));
    return <>{label && <strong className="block">{label}</strong>}<code className="break-all text-[11px] text-[#718096]">{path}</code></>;
  }
  function answer(value: unknown, path: string): React.ReactNode {
    if (value && typeof value === "object" && Object.keys(value).length) return <details className="min-w-0 border-l border-[#dfe6ee] pl-3" key={path}>
      <summary className="cursor-pointer py-2 focus-visible:outline focus-visible:outline-2">{title(path)} <span className="text-[#718096]">({Array.isArray(value) ? `${value.length} items` : "group"})</span></summary>
      <div className="grid min-w-0 gap-2">{Object.entries(value).map(([key, item]) => answer(item, `${path}/${key}`))}</div>
    </details>;
    const long = typeof value === "string" && value.length > 500;
    return <div key={path} className="min-w-0 py-2"><div>{title(path)}</div><div tabIndex={long ? 0 : undefined} aria-label={long ? `Answer ${path}` : undefined} className="max-h-64 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{displayEvidence(value)}</div></div>;
  }
  return <section className="mt-4 min-w-0 text-xs">
    {field && <div className="min-w-0 rounded bg-[#fff7e9] p-3" aria-label="Flagged answer"><h4 className="font-bold">Flagged answer</h4>{title(field)}<pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-sans [overflow-wrap:anywhere]">{displayEvidence(flaggedValue(answers, field))}</pre></div>}
    <details className="mt-3 min-w-0 rounded border border-[#e8edf4] p-3"><summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2">All submission answers ({Object.keys(answers ?? {}).length} fields)</summary>
      <div className="grid min-w-0 gap-2">{Object.entries(answers ?? {}).map(([key, value]) => answer(value, key))}{!Object.keys(answers ?? {}).length && <p>No submission answers available.</p>}</div>
    </details>
  </section>;
}
