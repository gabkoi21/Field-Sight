import {

  useEffect,

  useRef,

  useState,

  type KeyboardEvent,

  type ReactNode,

} from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Link } from "react-router-dom";

import { Plus, Trash2, X } from "lucide-react";

import { Button, LoadingState } from "../../components/ui";

import {

  apiClient,

  type FrameworkNode,

  type FrameworkNodeInput,

  type Indicator,

  type IndicatorCalculation,

  type IndicatorInput,

  type IndicatorMappingInput,

  type IndicatorUnit,

} from "../../services/apiClient";



export { controlClass as inputClass } from "../../components/ui/controlStyles";
import { controlClass as inputClass } from "../../components/ui/controlStyles";

export const levels: FrameworkNode["node_type"][] = [

  "goal",

  "objective",

  "outcome",

  "output",

  "activity",

];

export const calculations: Record<IndicatorCalculation, string> = {

  count_records: "Count ready submissions",

  count_matching: "Count matching answers",

  percentage_matching: "Percentage matching",

  sum: "Sum numeric answers",

  average: "Average numeric answers",

};

export const units: Record<IndicatorUnit, string> = {

  number: "Numeric",

  percentage: "Percentage",

  rate: "Rate",

  ratio: "Ratio",

  currency: "Currency",

  days: "Days",

  text: "Qualitative only",

};

export function FormField({

  label,

  children,

}: {

  label: string;

  children: ReactNode;

}) {

  return (

    <label className="grid min-w-0 gap-1.5 text-xs text-[var(--fs-muted)]">

      <span className="font-medium">{label}</span>

      {children}

    </label>

  );

}

export function Dialog({

  title,

  compact = false,

  presentation = false,
  headerActions,

  description,

  error,

  onClose,

  children,

}: {

  title: string;

  compact?: boolean;

  presentation?: boolean;
  headerActions?: ReactNode;

  description?: string;

  error?: string;

  onClose: () => void;

  children: ReactNode;

}) {

  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {

    if (!presentation) return;

    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => { document.body.style.overflow = previous; };

  }, [presentation]);

  useEffect(() => {

    const previous = document.activeElement;

    if (!dialog.current?.contains(previous)) {

      const first =

        dialog.current?.querySelector<HTMLElement>(

          "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",

        ) ?? dialog.current?.querySelector<HTMLElement>("button");

      first?.focus();

    }

    return () => {

      if (previous instanceof HTMLElement && previous.isConnected)

        previous.focus();

    };

  }, []);

  function key(event: KeyboardEvent<HTMLDivElement>) {

    if (event.key === "Escape") {

      event.preventDefault();

      onClose();

    }

    if (event.key !== "Tab") return;

    const items = Array.from(

      event.currentTarget.querySelectorAll<HTMLElement>(

        "input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])",

      ),

    );

    const first = items[0],

      last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {

      event.preventDefault();

      last?.focus();

    } else if (!event.shiftKey && document.activeElement === last) {

      event.preventDefault();

      first?.focus();

    }

  }

  return (

    <div

      ref={dialog}

      onKeyDown={key}

      role="dialog"

      aria-modal="true"

      aria-label={title}

      className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/35 p-4"

    >

      <section

        className={`w-full ${presentation ? "h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] max-w-[1920px] p-8 max-sm:p-4" : compact ? "max-h-[90vh] max-w-[520px] p-6" : "max-h-[90vh] max-w-[680px] p-6"} overflow-y-auto rounded-lg bg-white shadow-xl`}

      >

        <header className={`mb-5 flex items-start justify-between gap-3 border-b border-[#e7edef] pb-4 ${presentation ? "sticky -top-8 z-10 mx-auto max-w-[1800px] bg-white pt-2 max-sm:-top-4" : ""}`}>

          <div>

            <h2 className="m-0 text-lg font-semibold text-[var(--fs-text)]">

              {title}

            </h2>

            {description && (

              <p className="mb-0 mt-1 text-xs leading-5 text-[var(--fs-muted)]">

                {description}

              </p>

            )}

          </div>

          <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          <button

            type="button"

            onClick={onClose}

            aria-label="Close dialog"

            className="border-0 bg-transparent p-1 text-[var(--fs-muted)]"

          >

            <X size={18} />

          </button>
          </div>

        </header>

        {error && (

          <p

            role="alert"

            className="rounded-md bg-red-50 p-3 text-xs text-red-700"

          >

            {error}

          </p>

        )}

        {children}

      </section>

    </div>

  );

}

function Actions({

  onClose,

  saving,

  label = "Save",

  disabled = false,

}: {

  onClose: () => void;

  saving: boolean;

  label?: string;

  disabled?: boolean;

}) {

  return (

    <div className="mt-5 flex justify-end gap-2 border-t border-[#e7edef] pt-4">

      <Button variant="secondary" onClick={onClose}>

        Cancel

      </Button>

      <Button type="submit" disabled={saving || disabled}>

        {saving ? "Saving…" : label}

      </Button>

    </div>

  );

}



export function IndicatorDefinitionForm({

  indicator,

  nodes,

  error,

  saving,

  onClose,

  onSave,

}: {

  indicator: Indicator | null;

  nodes: FrameworkNode[];

  error: string;

  saving: boolean;

  onClose: () => void;

  onSave: (input: IndicatorInput) => void;

}) {



  const [form, setForm] = useState<IndicatorInput>(

    indicator

      ? {

          is_active: indicator.is_active,
          manual_mean_confirmed: indicator.manual_mean_confirmed ?? false,

          manual_aggregation: indicator.manual_aggregation ?? "legacy",

          manual_rate_multiplier: indicator.manual_rate_multiplier ?? 1,

          name: indicator.name,

          code: indicator.code,

          description: indicator.description,

          unit: indicator.unit,

          direction: indicator.direction,

          baseline_value: indicator.baseline_value,

          target_value: indicator.target_value,

          target_date: indicator.target_date,

          reporting_frequency: indicator.reporting_frequency,

          framework_node_id: indicator.framework_node_id,

        }

      : {

          is_active: false,
          manual_mean_confirmed: false,

          manual_aggregation: "legacy",

          manual_rate_multiplier: 1,

          name: "",

          code: `IND-${crypto.randomUUID().slice(0, 12)}`,

          description: null,

          unit: "number",

          direction: "increase",

          baseline_value: null,

          target_value: null,

          target_date: null,

          reporting_frequency: "monthly",

          framework_node_id: null,

        },

  );

  function update<K extends keyof IndicatorInput>(

    key: K,

    value: IndicatorInput[K],

  ) {

    setForm((current) => ({ ...current, [key]: value }));

  }

  return (
    <Dialog title={indicator ? "Edit indicator" : "Add indicator"} description="Start with the basics. Targets and additional settings are optional." error={error} onClose={onClose}>
      <form onSubmit={event => { event.preventDefault(); onSave({ ...form, name: form.name.trim(), code: form.code.trim() }); }} className="grid gap-4">
        <FormField label="Indicator name">

          <input

            autoFocus

            required

            minLength={2}

            maxLength={200}

            className={inputClass}

            value={form.name}

            onChange={(e) => update("name", e.target.value)}

          />

        </FormField>
        <FormField label="Description">

              <textarea

                rows={2}

                maxLength={1000}

                className={inputClass}

                value={form.description ?? ""}

                onChange={(e) => update("description", e.target.value || null)}

              />

            </FormField>
        <FormField label="Unit">

                <select

                  className={inputClass}

                  value={form.unit}

                  onChange={(e) => {

                    const unit = e.target.value as IndicatorUnit;

                    setForm((current) => ({

                      ...current,

                      unit,

                      ...(unit === "text"

                        ? {

                            baseline_value: null,

                            target_value: null,

                            target_date: null,

                          }

                        : {}),

                    }));

                  }}

                >

                  {Object.entries(units).map(([value, label]) => (

                    <option key={value} value={value}>

                      {label}

                    </option>

                  ))}

                </select>

              </FormField>
        <details className="rounded-lg border border-[var(--fs-border)]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Optional targets</summary>
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {form.unit !== "text" && <><FormField label="Baseline">

                <input

                  type="number"

                  step="any"

                  className={inputClass}

                  value={form.baseline_value ?? ""}

                  onChange={(e) =>

                    update(

                      "baseline_value",

                      e.target.value === "" ? null : Number(e.target.value),

                    )

                  }

                />

              </FormField><FormField label="Overall target">

                <input

                  type="number"

                  step="any"

                  className={inputClass}

                  value={form.target_value ?? ""}

                  onChange={(e) =>

                    update(

                      "target_value",

                      e.target.value === "" ? null : Number(e.target.value),

                    )

                  }

                />

              </FormField><FormField label="Target deadline">

                <input

                  type="date"

                  className={inputClass}

                  value={form.target_date ?? ""}

                  onChange={(e) =>

                    update("target_date", e.target.value || null)

                  }

                />

              </FormField><FormField label="Desired direction">

                <select

                  className={inputClass}

                  value={form.direction}

                  onChange={(e) =>

                    update(

                      "direction",

                      e.target.value as IndicatorInput["direction"],

                    )

                  }

                >

                  <option value="increase">Increase is better</option>

                  <option value="decrease">Decrease is better</option>

                </select>

              </FormField></>}
            {form.unit === "text" && <p className="text-sm text-[var(--fs-muted)]">Numeric targets do not apply to qualitative indicators.</p>}
          </div>
        </details>
        <details className="rounded-lg border border-[var(--fs-border)]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Additional settings</summary>
          <div className="grid gap-3 px-4 pb-4"><FormField label="Results framework group">

              <select

                className={inputClass}

                value={form.framework_node_id ?? ""}

                onChange={(e) =>

                  update("framework_node_id", e.target.value || null)

                }

              >

                <option value="">Ungrouped</option>

                {nodes.map((node) => (

                  <option key={node.id} value={node.id}>

                    {node.node_type}: {node.title}

                  </option>

                ))}

              </select>

            </FormField><FormField label="Reporting frequency">

                <select

                  className={inputClass}

                  value={form.reporting_frequency}

                  onChange={(e) =>

                    update(

                      "reporting_frequency",

                      e.target.value as IndicatorInput["reporting_frequency"],

                    )

                  }

                >

                  {[

                    "weekly",

                    "monthly",

                    "quarterly",

                    "semi_annual",

                    "annual",

                  ].map((value) => (

                    <option key={value} value={value}>

                      {value.replaceAll("_", " ")}

                    </option>

                  ))}

                </select>

              </FormField></div>
        </details>
        {indicator && <div className="grid gap-2">
          <FormField label="Indicator status">
            <select className={inputClass} value={form.is_active ? "active" : "draft"} onChange={event => update("is_active", event.target.value === "active")}>
              <option value="draft">Draft</option>
              <option value="active" disabled={!indicator.is_active && !indicator.mapping && (!form.manual_aggregation || form.manual_aggregation === "legacy")}>Active</option>
            </select>
          </FormField>
          {!indicator.mapping && (!form.manual_aggregation || form.manual_aggregation === "legacy") && !indicator.is_active && <p className="m-0 text-xs text-[var(--fs-muted)]">Save a survey source mapping, or choose a manual calculation method in Collected data, before activating.</p>}
        </div>}
        <Actions onClose={onClose} saving={saving} label={indicator ? "Save changes" : "Create indicator"} />
      </form>
    </Dialog>
  );
}

export function IndicatorMappingForm({

  indicator,

  projectId,

  error,

  saving,

  onClose,

  onSave,

  onRemove,

}: {

  indicator: Indicator;

  projectId: string;

  error: string;

  saving: boolean;

  onClose: () => void;

  onSave: (input: IndicatorMappingInput) => void;

  onRemove: () => void;

}) {

  const [formState, setForm] = useState<string | null>(

    indicator.mapping?.source_form_id ?? null,

  );

  const [fieldState, setField] = useState(

    indicator.mapping?.source_field ?? "",

  );

  const [operation, setOperation] = useState<IndicatorCalculation | "">(

    indicator.mapping?.calculation ?? "",

  );

  const [match, setMatch] = useState(indicator.mapping?.match_value ?? "");

  const [questionSearch, setQuestionSearch] = useState("");

  const cache = useQueryClient();

  const catalogue = useQuery({

    queryKey: ["survey-fields", projectId, formState],

    queryFn: async () => {

      const stored = await apiClient.surveyFields(projectId, formState);

      if (!stored.form_id || stored.fields.length) return stored;

      try {

        return await apiClient.surveyFields(projectId, stored.form_id, true);

      } catch (failure) {

        return { ...stored, warning: failure instanceof Error ? failure.message : "Unable to load Kobo questions. Try refreshing." };

      }

    },

  });

  const formId = formState ?? catalogue.data?.form_id ?? null;

  const fields = useQuery({

    queryKey: ["indicator-fields", projectId, formId],

    queryFn: () => apiClient.indicatorFields(projectId, formId),

    enabled: catalogue.isSuccess,

  });

  const refreshQuestions = useMutation({

    mutationFn: () => apiClient.surveyFields(projectId, formId, true),

    onSuccess: async (data) => {

      cache.setQueryData(["survey-fields", projectId, formState], data);

      await cache.invalidateQueries({ queryKey: ["indicator-fields", projectId, formId] });

    },

  });

  const policy = useQuery({ queryKey: ["indicator-policy"], queryFn: apiClient.indicatorPolicy });

  const field = fields.data?.find((item) => item.source_field === fieldState);

  const choices = field?.choices.length ? field.choices :
    catalogue.data?.fields.find(item => item.source_field === fieldState)?.choices ?? [];
  const choiceQuestion = field?.type === "select_one" || field?.type === "select_multiple";
  const visibleFields = fields.data?.filter(item => item.source_field === fieldState ||
    `${item.label} ${item.source_field} ${item.type}`.toLocaleLowerCase().includes(questionSearch.trim().toLocaleLowerCase()));

  const matching =

    operation === "count_matching" || operation === "percentage_matching";

  const valid = Boolean(

    field?.supported && (!matching || !choiceQuestion || choices.length > 0) && operation !== "" && policy.data?.linked[indicator.unit]?.includes(operation) && (!matching || (match.trim() && (!choices.length || choices.some(choice => choice.value === match)))),

  );

  return (

    <Dialog

      title="Map indicator to survey data"

      description={`${indicator.name}: Select a form, question and calculation explicitly. Only ready submissions contribute to results.`}

      error={error || catalogue.error?.message || fields.error?.message || refreshQuestions.error?.message}

      onClose={onClose}

    >

      <form

        onSubmit={(e) => {

          e.preventDefault();

          if (valid && operation !== "")

            onSave({

              source_form_id: formId,

              source_field: fieldState,

              calculation: operation,

              match_value: matching ? match : null,

            });

        }}

        className="grid gap-4"

      >

        {catalogue.isSuccess &&

          (!catalogue.data.forms.length ||

            catalogue.data.warning ||

            (fields.isSuccess && !fields.data.length)) && (

            <div

              role="status"

              className="rounded-md bg-[var(--fs-primary-soft)] p-3 text-xs leading-5 text-[var(--fs-info-text)]"

            >

              {!catalogue.data.forms.length ? (

                <>

                  Assign a Kobo form before mapping this indicator.{" "}

                  <Link

                    to={`/projects/${projectId}/details`}

                    className="text-[var(--fs-primary)] underline"

                  >

                    Open project setup

                  </Link>

                  .

                </>

              ) : (

                <>

                  {catalogue.data.warning ??

                    "No questions are available yet. Sync submissions or refresh the form's question catalogue."}{" "}

                  <Link

                    to={`/projects/${projectId}/analytics`}

                    className="text-[var(--fs-primary)] underline"

                  >

                    Open Explore & analyze

                  </Link>

                  .

                </>

              )}

            </div>

          )}

        <FormField label="Source form">

          <select

            className={inputClass}

            value={formId ?? ""}

            onChange={(e) => {

              setForm(e.target.value);
              setQuestionSearch("");

              setField("");

              setOperation("");

              setMatch("");

            }}

          >

            <option value="" disabled>

              Select a form

            </option>

            {catalogue.data?.forms.map((id) => (

              <option key={id} value={id}>

                {id === catalogue.data.form_id

                  ? catalogue.data.form_name?.trim() || id

                  : id}

              </option>

            ))}

          </select>

        </FormField>

        <div className="grid gap-2">
          <label className="sr-only" htmlFor="indicator-question-search">Search source questions</label>
          <input id="indicator-question-search" type="search" className={inputClass} value={questionSearch} onChange={event => setQuestionSearch(event.target.value)} placeholder="Search questions by name or field code" disabled={fields.isLoading || refreshQuestions.isPending} />
        <FormField label="Source question">

          <select

            required

            className={inputClass}

            value={fieldState}

            disabled={catalogue.isLoading || fields.isLoading || refreshQuestions.isPending}

            onChange={(e) => {

              setField(e.target.value);

              setOperation("");

              setMatch("");

            }}

          >

            <option value="">

              {catalogue.isLoading || fields.isLoading || refreshQuestions.isPending ? "Loading questions…" : "Select a question"}

            </option>

            {visibleFields?.map((item) => (

              <option

                key={item.source_field}

                value={item.source_field}

                disabled={!item.supported}

              >

                {item.label} · {item.type.replaceAll("_", " ")}

                {!item.supported ? " (unavailable)" : ""}

              </option>

            ))}

          </select>

        </FormField>

        {fields.isSuccess && visibleFields?.length === 0 && <p role="status" className="text-xs text-[var(--fs-muted)]">No questions match your search.</p>}
        </div>

        <button

          type="button"

          disabled={!formId || refreshQuestions.isPending || catalogue.isLoading}

          onClick={() => refreshQuestions.mutate()}

          className="justify-self-start rounded border border-[#dce5e8] bg-white px-3 py-2 text-xs text-[var(--fs-primary)] disabled:opacity-50"

        >

          {refreshQuestions.isPending ? "Refreshing questions…" : "Refresh Kobo questions"}

        </button>

        <FormField label="Calculation">

          <select

            required

            className={inputClass}

            value={operation === "" ? "" : operation}

            onChange={(e) => {

              setOperation(e.target.value as IndicatorCalculation);

              setMatch("");

            }}

          >

            <option value="" disabled>

              Select a calculation

            </option>

            {Object.entries(calculations).map(([value, label]) => (

              <option

                key={value}

                value={value}

                disabled={

                  !policy.data?.linked[indicator.unit]?.includes(value) || ((value === "sum" || value === "average") &&

                  field?.type !== "number")

                }

              >

                {label}{!policy.data?.linked[indicator.unit]?.includes(value) ? ` — cannot produce ${indicator.unit} units` : ((value === "sum" || value === "average") && field?.type !== "number") ? " — requires a numeric question" : ""}

              </option>

            ))}

          </select>

        </FormField>

        {matching && (

          <FormField label="Expected answer">

            {choices.length ? (

              <select

                required

                className={inputClass}

                value={match}

                onChange={(e) => setMatch(e.target.value)}

              >

                <option value="">Choose the answer to match</option>

                {choices.map((choice) => (

                  <option key={choice.value} value={choice.value}>

                    {choice.label}

                  </option>

                ))}

              </select>

            ) : choiceQuestion ? (
              <div className="grid gap-2"><p className="text-xs text-[var(--fs-muted)]">Answer choices are not loaded for this question. Refresh Kobo questions to select an answer from the survey.</p><input className={inputClass} value={match} readOnly placeholder="Refresh questions to load answers" /></div>
            ) : (

              <input

                required

                className={inputClass}

                value={match}

                onChange={(e) => setMatch(e.target.value)}

                placeholder="Enter the exact answer to count"

              />

            )}

          </FormField>

        )}

        {operation !== "count_matching" && (
        <div className="rounded-md bg-[var(--fs-primary-soft)] p-3 text-xs leading-5 text-[var(--fs-info-text)]">

          {operation === "count_records"

            ? "Counts every ready submission in this form, including records where this question is blank."

            : operation === "percentage_matching"

              ? "Matching answered submissions ÷ usable answered submissions × 100. Missing answers are excluded. Multi-select options match once per submission."

              : matching

                ? ""

                : "Numeric calculations ignore missing and invalid numeric answers. Select sum or average to reflect your indicator definition."}

        </div>
        )}

        {indicator.mapping && (

          <button

            type="button"

            onClick={onRemove}

            disabled={saving}

            className="justify-self-start border-0 bg-transparent text-xs text-red-700"

          >

            Remove source mapping

          </button>

        )}

        <Actions

          onClose={onClose}

          saving={saving}

          label="Save mapping"

          disabled={!valid}

        />

      </form>

    </Dialog>

  );

}



export function FrameworkForm({

  node,

  parentId,

  nodes,

  error,

  saving,

  onClose,

  onSave,

}: {

  node: FrameworkNode | null;

  parentId: string | null;

  nodes: FrameworkNode[];

  error: string;

  saving: boolean;

  onClose: () => void;

  onSave: (input: FrameworkNodeInput) => void;

}) {

  const parent = nodes.find((item) => item.id === parentId);

  const [form, setForm] = useState<FrameworkNodeInput>(

    node

      ? {

          title: node.title,

          node_type: node.node_type,

          parent_id: node.parent_id,

          sort_order: node.sort_order,

        }

      : {

          title: "",

          node_type: parent

            ? levels[Math.min(4, levels.indexOf(parent.node_type) + 1)]

            : "goal",

          parent_id: parentId,

          sort_order: 0,

        },

  );

  return (

    <Dialog

      title={node ? "Edit framework result" : "Add framework result"}

      description="Connect the project's intended changes, deliverables and activities."

      error={error}

      onClose={onClose}

    >

      <form

        className="grid gap-4"

        onSubmit={(e) => {

          e.preventDefault();

          onSave({ ...form, title: form.title.trim() });

        }}

      >

        <FormField label="Result title">

          <textarea

            autoFocus

            required

            minLength={2}

            maxLength={300}

            rows={3}

            className={inputClass}

            value={form.title}

            onChange={(e) => setForm({ ...form, title: e.target.value })}

          />

        </FormField>

        <FormField label="Result level">

          <select

            className={inputClass}

            value={form.node_type}

            onChange={(e) =>

              setForm({

                ...form,

                node_type: e.target.value as FrameworkNode["node_type"],

                parent_id: null,

              })

            }

          >

            {levels.map((level) => (

              <option key={level}>{level}</option>

            ))}

          </select>

        </FormField>

        <FormField label="Parent result">

          <select

            className={inputClass}

            value={form.parent_id ?? ""}

            onChange={(e) =>

              setForm({ ...form, parent_id: e.target.value || null })

            }

          >

            <option value="">Project framework root</option>

            {nodes

              .filter(

                (item) =>

                  item.id !== node?.id &&

                  levels.indexOf(item.node_type) <

                    levels.indexOf(form.node_type),

              )

              .map((item) => (

                <option key={item.id} value={item.id}>

                  {item.node_type}: {item.title}

                </option>

              ))}

          </select>

        </FormField>

        <FormField label="Display order">

          <input

            type="number"

            min={0}

            max={10000}

            className={inputClass}

            value={form.sort_order}

            onChange={(e) =>

              setForm({ ...form, sort_order: Number(e.target.value) })

            }

          />

        </FormField>

        <Actions onClose={onClose} saving={saving} />

      </form>

    </Dialog>

  );

}



export function PeriodTargetsForm({

  indicator,

  error,

  saving,

  onClose,

  onSave,

}: {

  indicator: Indicator;

  error: string;

  saving: boolean;

  onClose: () => void;

  onSave: (input: Array<{ period: string; target_value: number }>) => void;

}) {

  const targets = useQuery({

    queryKey: ["indicator-period-targets", indicator.id],

    queryFn: () => apiClient.indicatorPeriodTargets(indicator.id),

    refetchOnWindowFocus: false,

  });

  const [edits, setEdits] = useState<Array<{

    period: string;

    target_value: string;

  }> | null>(null);

  const rows =

    edits ??

    (targets.data ?? []).map((item) => ({

      ...item,

      target_value: String(item.target_value),

    }));

  const example = {

    weekly: "2026-W43",

    monthly: "2026-10",

    quarterly: "2026-Q4",

    semi_annual: "2026-H2",

    annual: "2026",

  }[indicator.reporting_frequency];

  return (

    <Dialog

      title="Targets by reporting period"

      description={`Reporting frequency: ${indicator.reporting_frequency.replaceAll("_", " ")}. Period format: ${example}. Targets are entered explicitly; the overall target is not divided automatically.`}

      error={error || targets.error?.message}

      onClose={onClose}

    >

      {targets.isLoading ? (

        <LoadingState variant="panel" label="Loading indicator targets…" />

      ) : (

        <form

          onSubmit={(e) => {

            e.preventDefault();

            onSave(

              rows.map((row) => ({

                period: row.period.trim(),

                target_value: Number(row.target_value),

              })),

            );

          }}

        >

          <div className="grid gap-3">

            {rows.map((row, index) => (

              <div

                key={index}

                className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"

              >

                <FormField label="Period">

                  <input

                    required

                    className={inputClass}

                    placeholder={example}

                    value={row.period}

                    onChange={(e) =>

                      setEdits(

                        rows.map((item, i) =>

                          i === index

                            ? { ...item, period: e.target.value }

                            : item,

                        ),

                      )

                    }

                  />

                </FormField>

                <FormField label="Target">

                  <input

                    required

                    type="number"

                    step="any"

                    className={inputClass}

                    value={row.target_value}

                    onChange={(e) =>

                      setEdits(

                        rows.map((item, i) =>

                          i === index

                            ? { ...item, target_value: e.target.value }

                            : item,

                        ),

                      )

                    }

                  />

                </FormField>

                <button

                  type="button"

                  aria-label={`Remove target row ${index + 1}`}

                  className="border-0 bg-transparent p-2 text-[var(--fs-muted)]"

                  onClick={() => setEdits(rows.filter((_, i) => i !== index))}

                >

                  <Trash2 size={15} />

                </button>

              </div>

            ))}

          </div>

          <button

            type="button"

            onClick={() =>

              setEdits([...rows, { period: "", target_value: "" }])

            }

            className="mt-4 inline-flex items-center gap-2 border-0 bg-transparent text-xs text-[var(--fs-primary)]"

          >

            <Plus size={14} />

            Add reporting period

          </button>

          <Actions

            onClose={onClose}

            saving={saving}

            label="Save period targets"

            disabled={targets.isError}

          />

        </form>

      )}

    </Dialog>

  );

}

