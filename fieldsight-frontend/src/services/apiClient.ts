export type Role = "super_admin" | "organization_admin" | "enumerator";

export interface SurveyField {
  source_field: string;
  label: string;
  type:
    | "select_one"
    | "select_multiple"
    | "number"
    | "date"
    | "text"
    | "geopoint"
    | "repeat";
  choices: Array<{ value: string; label: string }>;
  source: "kobo" | "mapping" | "inferred";
  supported: boolean;
}
export interface SurveyCatalogue {
  project_id: string;
  form_id: string | null;
  form_name: string | null;
  form_version: string | null;
  fields: SurveyField[];
  forms: string[];
  locations: string[];
  enumerators: string[];
  schema_updated_at: string | null;
  warning: string | null;
}
export interface AnalysisQuery {
  project_id: string;
  form_id: string | null;
  source_field: string;
  measure: "auto" | "count" | "sum" | "average" | "min" | "max";
  group_by: string | null;
  time_grain: "day" | "month" | "year";
  filters: {
    date_from: string | null;
    date_to: string | null;
    location: string | null;
    enumerator: string | null;
    review_status: "ready" | "needs_review" | "invalid" | "all";
    categories: string[];
  };
}
export interface AnalysisResult {
  project_id: string;
  form_id: string | null;
  field: SurveyField;
  measure: string;
  total_records: number;
  eligible_records: number;
  answered_records: number;
  missing_records: number;
  invalid_answers: number;
  denominator: number;
  value: number | null;
  series: Array<{
    name: string;
    group: string | null;
    value: number | null;
    count: number;
    percent: number | null;
  }>;
  filters: AnalysisQuery["filters"];
  group_by: string | null;
  note: string;
  generated_at: string;
}
export interface SavedAnalysis {
  id: string;
  title: string;
  query: AnalysisQuery;
  chart: "bar" | "line" | "donut" | "pie" | "table";
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: "organization_admin" | "enumerator";
  is_active: boolean;
}
export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: WorkspaceMember["role"];
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
}
export interface WorkspaceProfile {
  email: string;
  full_name: string | null;
  landing_page: string;
}
export interface WorkspaceTable {
  id: string;
  title: string;
  source: string;
  records: number;
}
export interface WorkspaceTableRows {
  fields: SurveyField[];
  total: number;
  offset: number;
  rows: Array<{
    id: string;
    review_status: string;
    submitted_at: string | null;
    answers: Record<string, unknown>;
  }>;
}
export interface CollectedResultInput {
  numerator?: number | null;
  denominator?: number | null;
  result_date: string;
  value: number | null;
  narrative: string | null;
  location: string | null;
  notes: string | null;
}
export interface CollectedResult extends CollectedResultInput {
  id: string;
  created_at: string;
}
export interface DashboardWidget {
  id: string;
  title: string;
  kind: "indicator" | "analysis" | "text";
  source_id: string | null;
  text: string;
  width: 1 | 2;
  height?: number;
}
export interface WorkspaceDashboardInput {
  title: string;
  description: string;
  project_id: string;
  widgets: DashboardWidget[];
  date_from?: string | null;
  date_to?: string | null;
  version?: number;
}
export interface WorkspaceDashboard extends WorkspaceDashboardInput {
  id: string;
  created_at: string;
}
function dashboardPayload(input: WorkspaceDashboardInput): WorkspaceDashboardInput {
  return { title: input.title, description: input.description, project_id: input.project_id,
    widgets: input.widgets, date_from: input.date_from ?? null, date_to: input.date_to ?? null,
    version: input.version };
}

export interface Membership {
  organization_id: string;
  organization_name?: string;
  role: Exclude<Role, "super_admin">;
}

export interface UserOrganizationAccess {
  organization_id: string;
  organization_name: string;
  role: Exclude<Role, "super_admin">;
  is_active: boolean;
}

export interface ApiUserDirectoryItem {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  is_active: boolean;
  platform_role: Role | null;
  created_at: string;
  memberships: UserOrganizationAccess[];
}

export interface CurrentUser {
  id: string;
  email: string;
  username: string | null;
  platform_role: Role | null;
  memberships: Membership[];
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  country: string | null;
  timezone: string;
  owner_email: string | null;
  sector_ids: string[];
  user_count?: number;
  project_count?: number;
}

export interface Sector {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface ApiStatus {
  status: string;
  service: string;
  environment: string;
  api_version: string;
}

export interface ReadinessStatus {
  status: string;
  database: string;
}

export interface SectorCreateInput {
  code: string;
  name: string;
}

export interface SectorUpdateInput {
  name?: string;
  is_active?: boolean;
}

export interface EnumeratorCreateInput {
  full_name: string;
  email: string;
  username: string;
  project_id?: string;
  phone_number?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
}

export interface EnumeratorUpdateInput {
  is_active: boolean;
  phone_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
}

export interface ApiEnumerator {
  user_id: string;
  membership_id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  phone_number: string | null;
  employee_id: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  role: "enumerator";
  is_active: boolean;
  created_at: string;
}

export interface ApiFieldAssignment {
  id: string;
  membership_id: string;
  project_id: string;
  is_enabled: boolean;
}

export interface OrganizationSector {
  id: string;
  sector_id: string;
  is_active: boolean;
}

export interface CreateProjectInput {
  name: string;
  organization_sector_id: string;
  description?: string;
  target_sample_size?: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  priority?: string;
  tags?: string[];
}
export interface WorkspaceDetails {
  code: string;
  stage: string;
  countries: string[];
  topics: string[];
  group: string;
  cost_unit: string;
  funding: string;
  health_status: "" | "red" | "amber" | "green";
}
export interface ApiProject {
  organization_sector_id?: string;
  created_at?: string;
  updated_at?: string;
  country?: string | null;
  workspace_details?: Partial<WorkspaceDetails>;
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  target_sample_size: number | null;
  kobo_connection_id: string | null;
  kobo_form_id: string | null;
  kobo_form_name: string | null;
}
export interface KoboConnection {
  id: string;
  name: string;
  server_url: string;
  is_verified: boolean;
  verified_at: string | null;
  selected_form_id: string | null;
  selected_form_name: string | null;
  created_at: string;
}

export interface KoboConnectionInput {
  name: string;
  server_url: string;
  api_token: string;
}

export interface KoboForm {
  id: string;
  name: string;
  version: string | null;
}
export interface CreateOrganizationInput {
  name: string;
  slug: string;
  owner_email: string;
  owner_username?: string;
  owner_password: string;
  owner_role: "organization_admin";
  sector_ids: string[];
  country?: string;
  timezone: string;
}

export interface UpdateOrganizationInput {
  name: string;
  slug: string;
  sector_ids: string[];
  country: string | null;
  timezone: string;
}

export interface ApiSubmission {
  id: string;
  external_id: string;
  project_id: string;
  project_name: string;
  form_name: string | null;
  submitted_at: string | null;
  enumerator: string | null;
  location: string | null;
  review_status: string;
  raw_answers: Record<string, unknown>;
  evidence_fingerprint?: string;
  validation_status?: string | null;
  review_required?: boolean;
}

export interface ApiAnalyticsOverview {
  total_submissions: number;
  ready_records: number;
  ready_this_week: number;
  needs_review: number;
  invalid_records: number;
  blocked_records: number;
  submission_change_percent: number | null;
  active_projects: number;
  last_synced_at: string | null;
  available_locations: string[];
  trend: { day: string; submissions: number; approved: number }[];
  projects: { id: string; name: string; actual: number; target: number }[];
  collection_health: {
    healthy_sources: number;
    delayed_sources: number;
    connected_sources: number;
    ready_records: number;
  };
  activity: {
    id: string;
    name: string;
    detail: string;
    location: string | null;
    occurred_at: string;
  }[];
  alerts: {
    kind: "review" | "invalid" | "sync";
    title: string;
    text: string;
    path: string;
  }[];
}

export interface ApiDashboardOverview extends ApiAnalyticsOverview {
  pending_sync_count: number | null;
  sync_status: {
    pending_count: number | null;
    healthy_sources: number;
    delayed_sources: number;
    connected_sources: number;
    sources: ApiPendingKoboSync["sources"];
  };
}
export interface ApiSyncResult {
  sync_run_id: string | null;
  status: string;
  received: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface ApiSyncRun {
  failed: number;
  attempt: number;
  trigger: string;
  id: string;
  project_id: string;
  status: string;
  received: number;
  created: number;
  updated: number;
  skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ApiPendingKoboSync {
  pending_count: number;
  sources: Array<{
    project_id: string;
    project_name: string;
    form_name: string;
    pending_count: number;
    status: "available" | "unavailable";
  }>;
  checked_at: string;
}
export interface FieldMapping {
  id: string;
  project_id: string;
  source_field: string;
  display_name: string;
  meaning: string | null;
  data_type:
    | "text"
    | "number"
    | "date"
    | "boolean"
    | "single_select"
    | "multiple_select"
    | "gps"
    | "location";
  is_required: boolean;
  is_location: boolean;
}

export interface FieldMappingOverview {
  mappings: FieldMapping[];
  source_fields: string[];
}

export interface ProjectTarget {
  id: string;
  project_id: string;
  name: string;
  target_value: number;
  unit: string;
  direction: "at_least" | "at_most";
  field_mapping_id: string | null;
  due_date: string | null;
}

export interface ProjectIntelligence {
  overall_progress: number;
  project_status: "On Track" | "Needs Attention";
  pulse: {
    name: string;
    status: "On track" | "Needs attention";
    detail: string;
  }[];
  indicators: {
    mapping_id: string;
    name: string;
    value: number;
    summary: string;
  }[];
  targets: {
    id: string;
    name: string;
    target: number;
    actual: number;
    unit: string;
    progress: number;
    remaining: number;
    status: string;
  }[];
}

export type IndicatorUnit =
  | "number"
  | "percentage"
  | "rate"
  | "ratio"
  | "currency"
  | "days"
  | "text";
export type IndicatorDirection = "increase" | "decrease";
export type IndicatorStatus =
  | "on_track"
  | "needs_attention"
  | "not_started"
  | "in_progress";
export type IndicatorFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";
export type IndicatorCalculation =
  | "count_records"
  | "count_matching"
  | "percentage_matching"
  | "sum"
  | "average";

export interface IndicatorMapping {
  id: string;
  indicator_id: string;
  source_field: string;
  source_form_id: string | null;
  calculation: IndicatorCalculation;
  match_value: string | null;
}

export interface IndicatorMappingInput {
  change_reason?: string;
  confirm_change?: boolean;
  expected_version?: number;
  preview_token?: string;
  source_field: string;
  source_form_id?: string | null;
  calculation: IndicatorCalculation;
  match_value: string | null;
}

export interface IndicatorField {
  source_field: string;
  label: string;
  type: SurveyField["type"];
  choices: SurveyField["choices"];
  form_id: string | null;
  supported: boolean;
}

export interface IndicatorResultPoint {
  period: string;
  value: number | null;
  eligible_records: number;
  mapped_records: number;
  numerator: number | null;
  denominator: number;
  missing_records: number;
  invalid_answers: number;
  target_value: number | null;
  target_achieved: boolean | null;
}

export interface IndicatorLocationResult {
  location: string;
  value: number | null;
  eligible_records: number;
  mapped_records: number;
  numerator: number | null;
  denominator: number;
}

export interface Indicator {
  definition_version?: number;
  legacy_definition?: boolean;
  setup_complete?: boolean;
  definition_warnings?: string[];
  manual_mean_confirmed?: boolean;
  manual_aggregation?: "legacy" | "unweighted_mean" | "pooled" | "sum" | "latest";
  manual_rate_multiplier?: number;
  result_source: "table" | "manual" | "unconfigured";
  qualitative_value: string | null;
  manual_result_count: number;
  id: string;
  project_id: string;
  name: string;
  code: string;
  description: string | null;
  unit: IndicatorUnit;
  direction: IndicatorDirection;
  baseline_value: number | null;
  target_value: number | null;
  target_date: string | null;
  reporting_frequency: IndicatorFrequency;
  status: IndicatorStatus;
  is_active: boolean;
  framework_node_id: string | null;
  mapping: IndicatorMapping | null;
  current_value: number | null;
  eligible_records: number;
  mapped_records: number;
  numerator: number | null;
  denominator: number;
  missing_records: number;
  invalid_answers: number;
  quality_excluded_records: number;
  undated_records: number;
  target_achieved: boolean | null;
  progress_percent: number | null;
  schedule_status:
    | "achieved"
    | "not_due"
    | "overdue"
    | "no_deadline"
    | "no_target"
    | "no_data";
  mapping_health:
    | "unmapped"
    | "healthy"
    | "field_missing"
    | "form_missing"
    | "unsupported"
    | "type_mismatch";
  calculation_note: string;
  source_form_id: string | null;
  date_from: string | null;
  date_to: string | null;
  history: IndicatorResultPoint[];
  location_breakdown: IndicatorLocationResult[];
  created_at: string;
  updated_at: string;
}

export type IndicatorInput = Pick<
  Indicator,
  | "name"
  | "code"
  | "description"
  | "unit"
  | "direction"
  | "baseline_value"
  | "target_value"
  | "target_date"
  | "reporting_frequency"
  | "manual_mean_confirmed"
  | "manual_aggregation"
  | "manual_rate_multiplier"
  | "framework_node_id"
> & { is_active?: boolean };
export interface FrameworkNode {
  id: string;
  project_id: string;
  title: string;
  node_type: "goal" | "objective" | "outcome" | "output" | "activity";
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}
export type FrameworkNodeInput = Pick<
  FrameworkNode,
  "title" | "node_type" | "parent_id" | "sort_order"
>;
export type IndicatorUpdateInput = Partial<IndicatorInput> & {
  is_active?: boolean;
  change_reason?: string;
  confirm_change?: boolean;
  expected_version?: number;
  preview_token?: string;
};
export type IndicatorCreateInput = IndicatorInput & {
  mapping?: IndicatorMappingInput | null;
};
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: unknown = {},
  ) {
    super(message);
  }
}

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "/api"
).replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "fieldsight_access_token";
const SESSION_EXPIRED_EVENT = "fieldsight-session-expired";
const REFRESH_LEEWAY_MS = 60_000;

let accessToken =
  localStorage.getItem(ACCESS_TOKEN_KEY) ??
  sessionStorage.getItem(ACCESS_TOKEN_KEY);
let refreshTimer: ReturnType<typeof window.setTimeout> | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let sessionGeneration = localStorage.getItem("fieldsight_logout_generation") ?? "";
let suspended = false;
let retryNotBefore = 0;
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("fieldsight-session") : null;
function sessionState(state: "checking" | "unavailable" | "authenticated" | "signed_out" | "forbidden") {
  suspended = state === "unavailable" || state === "checking" || state === "forbidden";
  window.dispatchEvent(new CustomEvent("fieldsight-session-state", { detail: state }));
}
function expireSession(broadcast = true) {
  sessionGeneration = crypto.randomUUID();
  localStorage.setItem("fieldsight_logout_generation", sessionGeneration);
  localStorage.setItem("fieldsight_signed_out", "true");
  saveAccessToken(null);
  sessionState("signed_out");
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  if (broadcast) channel?.postMessage({ type: "logout", generation: sessionGeneration });
}
channel?.addEventListener("message", ({ data }) => {
  if (data.type === "logout") {
    sessionGeneration = data.generation;
    saveAccessToken(null);
    sessionState("signed_out");
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  } else if (data.type === "renewed" && data.generation === sessionGeneration) {
    saveAccessToken(data.token, data.remember);
    sessionState("authenticated");
    window.dispatchEvent(new Event("fieldsight-session-renewed"));
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === "fieldsight_logout_generation" && event.newValue !== sessionGeneration) {
    sessionGeneration = event.newValue ?? "";
    saveAccessToken(null);
    sessionState("signed_out");
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
});
function expiresSoon(token: string | null, leeway = REFRESH_LEEWAY_MS) {
  try {
    const payload = token!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).exp * 1000 <= Date.now() + leeway;
  } catch { return true; }
}
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try { return await fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal }); }
  finally { window.clearTimeout(timer); }
}
async function withSessionLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new ApiError(503, "Session coordination requires a browser with Web Locks support.");
  return navigator.locks.request("fieldsight-session-refresh", { signal: AbortSignal.timeout(60_000) }, operation);
}
async function finishPendingLogout() {
  if (!localStorage.getItem("fieldsight_logout_pending")) return;
  const response = await timedFetch(API_BASE_URL + "/auth/logout", { method: "POST", credentials: "include" });
  if (!response.ok) throw await parseError(response);
  localStorage.removeItem("fieldsight_logout_pending");
}
function scheduleAccessTokenRefresh(token: string) {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  try {
    const encoded = token.split(".")[1];
    const padded = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const { exp } = JSON.parse(window.atob(padded)) as { exp?: number };
    if (!exp) return;
    const delay = Math.max(0, exp * 1000 - Date.now() - REFRESH_LEEWAY_MS);
    refreshTimer = window.setTimeout(() => { void refreshAccessToken().catch(() => undefined); }, delay);
  } catch {
    // The normal 401 retry remains available if a token cannot be decoded.
  }
}

function saveAccessToken(token: string | null, remember = false) {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = null;
  accessToken = token;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  if (token)
    (remember ? localStorage : sessionStorage).setItem(ACCESS_TOKEN_KEY, token);
  if (token) scheduleAccessTokenRefresh(token);
}

async function parseError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
    detail?: string | Array<{ loc?: Array<string | number>; msg?: string }>;
    details?: Array<{ loc?: Array<string | number>; msg?: string }> | unknown;
  } | null;
  const validationDetails = Array.isArray(body?.details)
    ? body.details
    : Array.isArray(body?.detail)
      ? body.detail
      : [];
  const validationMessage = validationDetails
    .map((item: { loc?: Array<string | number>; msg?: string }) => {
      const field = item.loc?.filter((part) => part !== "body").join(".");
      return item.msg ? `${field ? `${field}: ` : ""}${item.msg}` : "";
    })
    .filter(Boolean)
    .join(" ");
  const fallbackMessage =
    typeof body?.detail === "string" ? body.detail : undefined;
  return new ApiError(
    response.status,
    validationMessage ||
      body?.message ||
      fallbackMessage ||
      "The request failed with status " + response.status + ".",
    body?.details ?? body?.detail,
  );
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const generation = sessionGeneration;
  if (localStorage.getItem("fieldsight_signed_out")) return false;
  const previous = accessToken;
  refreshInFlight = withSessionLock(async () => {
    if (generation !== sessionGeneration || generation !== (localStorage.getItem("fieldsight_logout_generation") ?? "")) return false;
    // A remembered token may have changed while this tab waited for the browser lock.
    const shared = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (localStorage.getItem("fieldsight_signed_out")) return false;
    if (shared && shared !== accessToken) saveAccessToken(shared, true);
    if (accessToken !== previous && !expiresSoon(accessToken)) { sessionState("authenticated"); return true; }
    retryNotBefore = Math.max(retryNotBefore, Number(localStorage.getItem("fieldsight_auth_retry_at")) || 0);
    if (Date.now() < retryNotBefore) throw new ApiError(503, "Session service is reconnecting. Please retry shortly.");
    sessionState("checking");
    for (let attempt = 0; attempt < 4; attempt++) {
      let response: Response | undefined;
      try {
        response = await timedFetch(API_BASE_URL + "/auth/refresh", { method: "POST", credentials: "include" });
        if (generation !== sessionGeneration || generation !== (localStorage.getItem("fieldsight_logout_generation") ?? "")) return false;
        if (response.ok) {
          const body = await response.json() as { access_token: string; remember: boolean };
          if (generation !== sessionGeneration || generation !== (localStorage.getItem("fieldsight_logout_generation") ?? "")) return false;
          retryNotBefore = 0;
          localStorage.removeItem("fieldsight_auth_retry_at");
          saveAccessToken(body.access_token, body.remember);
          channel?.postMessage({ type: "renewed", token: body.access_token, remember: body.remember, generation });
          sessionState("authenticated");
          return true;
        }
        if (response.status === 401) { expireSession(); return false; }
        if (response.status === 403) { sessionState("forbidden"); throw await parseError(response); }
        if (![409, 429].includes(response.status) && response.status < 500) throw await parseError(response);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (generation !== sessionGeneration || generation !== (localStorage.getItem("fieldsight_logout_generation") ?? "")) return false;
      }
      sessionState("unavailable");
      const header = response?.headers.get("Retry-After");
      const retryAfter = header ? (/^\d+$/.test(header) ? Number(header) * 1000 : Math.max(0, Date.parse(header) - Date.now())) : 0;
      const delay = Math.max(500 * 2 ** attempt + Math.random() * 500, retryAfter || 0);
      retryNotBefore = Date.now() + delay;
      localStorage.setItem("fieldsight_auth_retry_at", String(retryNotBefore));
      if (attempt === 3 || delay > 30_000) break;
      await new Promise(resolve => window.setTimeout(resolve, delay));
      if (generation !== sessionGeneration || generation !== (localStorage.getItem("fieldsight_logout_generation") ?? "")) return false;
    }
    retryNotBefore = Math.max(retryNotBefore, Date.now() + 30_000);
    localStorage.setItem("fieldsight_auth_retry_at", String(retryNotBefore));
    throw new ApiError(503, "Unable to reconnect to your session. Retry when the service is available.");
  }).catch(error => {
    if (generation === sessionGeneration && !(error instanceof ApiError && error.status === 403)) sessionState("unavailable");
    throw error;
  }).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

// Sleeping tabs recheck expiry when they resume. Failures are caught and surfaced as state.
function resumeSession() {
  if (localStorage.getItem("fieldsight_logout_pending")) {
    void withSessionLock(finishPendingLogout).catch(() => undefined);
    return;
  }
  if (accessToken && (suspended || expiresSoon(accessToken))) void refreshAccessToken().catch(() => undefined);
}
window.addEventListener("online", resumeSession);
window.addEventListener("focus", resumeSession);
document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeSession(); });

if (accessToken) scheduleAccessTokenRefresh(accessToken);
async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const requestGeneration = sessionGeneration;
  const publicRoute = ["/auth/login", "/auth/logout", "/auth/accept-invitation", "/health/live", "/health/ready", "/status"].includes(path);
  if (suspended && !["GET", "HEAD"].includes(init.method ?? "GET") && !publicRoute) {
    throw new ApiError(503, "Session unresolved. Reconnect before submitting this action.");
  }
  if (!publicRoute && (suspended || expiresSoon(accessToken))) {
    if (!await refreshAccessToken()) throw new ApiError(401, "Sign in is required.");
  }
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await timedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (
    response.status === 401 &&
    retry &&
    !publicRoute &&
    (await refreshAccessToken())
  ) {
    if (["GET", "HEAD"].includes(init.method ?? "GET")) return request<T>(path, init, false);
    throw new ApiError(409, "Session renewed. Review the action and submit it again.");
  }
  if (requestGeneration !== sessionGeneration) throw new ApiError(401, "Session changed.");
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("Content-Type") ?? "";
  const result = contentType.includes("application/pdf") ? await response.arrayBuffer()
    : contentType.includes("text/csv") ? await response.text() : await response.json();
  if (requestGeneration !== sessionGeneration) throw new ApiError(401, "Session changed.");
  return result as T;
}

export interface ProjectAction {
  id: string; organization_id: string; project_id: string; title: string; description: string;
  priority: "low" | "medium" | "high"; status: "open" | "in_progress" | "resolved" | "closed";
  assigned_user_id: string | null; created_by_id: string; due_date: string | null;
  submission_id: string | null; indicator_id: string | null; resolution_summary: string | null;
  version: number; created_at: string; updated_at: string; resolved_at: string | null; closed_at: string | null; overdue: boolean;
}
export interface ActionDetail extends ProjectAction {
  history_total: number;
  history: Array<{ id: string; actor_id: string; occurred_at: string; event_type: string; note: string | null; previous_values: Record<string, unknown>; new_values: Record<string, unknown> }>;
}
export interface ActionPage { items: ProjectAction[]; total: number; offset: number; limit: number; summary: { unresolved: number; overdue: number; high_priority: number } }
export type ActionInput = Pick<ProjectAction, "title" | "description" | "priority" | "assigned_user_id" | "due_date" | "submission_id" | "indicator_id">;
export interface SubmissionDetail extends ApiSubmission {
  review_token: string; history_total: number;
  history: Array<{ id: string; actor_id: string | null; source: string; occurred_at: string; previous_status: string | null; status: string | null; note: string | null; evidence_fingerprint: string | null }>;
  findings: Array<{ id: string; detail: string; field: string | null }>;
}
export interface MonthlyOrganizationActivity {
  year: number;
  available_years: number[];
  months: { month: number; organization_id: string | null; organization_name: string | null; submissions: number; tied_organizations: number }[];
}

export const apiClient = {
  monthlyOrganizationActivity: (year: number) => request<MonthlyOrganizationActivity>(`/administration/activity/monthly?year=${year}`),
  setOrganizationStatus: (id: string, is_active: boolean) => request<{ is_active: boolean }>(`/administration/organizations/${id}/status`, { method: "PATCH", body: JSON.stringify({ is_active }) }),
  platformOverview: () => request<{ total_organizations: number; total_platform_users: number; active_organizations: number; total_projects: number }>("/administration/overview"),
  platformEvents: (params: URLSearchParams) => request<{ total: number; items: { id: string; actor: string; action: string; target: string; organization: string; occurred_at: string }[] }>(`/administration/events?${params}`),
  projectActions: (project: string, params = new URLSearchParams()) => request<ActionPage>(`/projects/${project}/actions?${params}`),
  actionDetail: (project: string, action: string, offset = 0) => request<ActionDetail>(`/projects/${project}/actions/${action}?history_offset=${offset}`),
  createAction: (project: string, body: ActionInput) => request<ProjectAction>(`/projects/${project}/actions`, { method: "POST", body: JSON.stringify(body) }),
  updateAction: (project: string, id: string, body: Partial<ActionInput> & { expected_version: number; status?: ProjectAction["status"]; resolution_summary?: string; note?: string }) => request<ProjectAction>(`/projects/${project}/actions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  submissionDetail: (id: string, offset = 0) => request<SubmissionDetail>(`/submissions/${id}?history_offset=${offset}`),
  reviewSubmission: (id: string, body: { status: string; note: string; evidence_fingerprint: string; expected_review_token: string }) => request(`/submissions/${id}/review-status`, { method: "PATCH", body: JSON.stringify(body) }),
  organizationSettings: (org: string) =>
    request<{
      country: string | null;
      timezone: string;
      default_language: string;
      retention_days: number;
      export_reason_required: boolean;
    }>(`/organizations/${org}/settings`),
  saveOrganizationSettings: (
    org: string,
    input: {
      country: string | null;
      timezone: string;
      default_language: string;
    },
  ) =>
    request(`/organizations/${org}/settings`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  updateProject: (
    org: string,
    id: string,
    input: Partial<CreateProjectInput> & {
      workspace_details?: WorkspaceDetails;
    },
  ) =>
    request<ApiProject>(`/organizations/${org}/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  workspaceTeam: (org: string) =>
    request<WorkspaceMember[]>(`/organizations/${org}/team`),
  updateWorkspaceMember: (
    org: string,
    id: string,
    input: { role: WorkspaceMember["role"]; is_active: boolean },
  ) =>
    request(`/organizations/${org}/team/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  invitations: (org: string) =>
    request<WorkspaceInvitation[]>(`/organizations/${org}/invitations`),
  inviteMember: (
    org: string,
    input: { email: string; role: WorkspaceMember["role"] },
  ) =>
    request<WorkspaceInvitation & { token: string }>(
      `/organizations/${org}/invitations`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  revokeInvitation: (org: string, id: string) =>
    request<void>(`/organizations/${org}/invitations/${id}`, {
      method: "DELETE",
    }),
  acceptInvitation: (input: {
    token: string;
    full_name: string;
    password: string;
  }) =>
    request<{ email: string; role: WorkspaceMember["role"] }>(
      "/auth/accept-invitation",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  profile: () => request<WorkspaceProfile>("/auth/profile"),
  saveProfile: (input: WorkspaceProfile) =>
    request<WorkspaceProfile>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        full_name: input.full_name,
        landing_page: input.landing_page,
      }),
    }),
  changePassword: (current_password: string, new_password: string) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  projectTeam: (project: string) =>
    request<(WorkspaceMember & { assignment_id: string })[]>(
      `/projects/${project}/team`,
    ),
  addProjectMember: (project: string, membership_id: string) =>
    request(`/projects/${project}/team`, {
      method: "POST",
      body: JSON.stringify({ membership_id }),
    }),
  removeProjectMember: (project: string, id: string) =>
    request<void>(`/projects/${project}/team/${id}`, { method: "DELETE" }),
  tables: (project: string) =>
    request<WorkspaceTable[]>(`/projects/${project}/tables`),
  tableRows: (project: string, form: string, offset = 0) =>
    request<WorkspaceTableRows>(
      `/projects/${project}/tables/${encodeURIComponent(form)}?offset=${offset}`,
    ),
  importTable: (
    project: string,
    input: {
      title: string;
      csv_text: string;
      date_column: string | null;
      location_column: string | null;
    },
  ) =>
    request<{ form_id: string; imported: number }>(
      `/projects/${project}/tables/import`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  collectedResults: (id: string) =>
    request<CollectedResult[]>(`/indicators/${id}/collected-results`),
  addCollectedResult: (id: string, input: CollectedResultInput) =>
    request<CollectedResult>(`/indicators/${id}/collected-results`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteCollectedResult: (id: string, result: string) =>
    request<void>(`/indicators/${id}/collected-results/${result}`, {
      method: "DELETE",
    }),
  adminEvents: (org: string) => request<{ id: string; action: string; actor_id: string; resource_id: string; occurred_at: string }[]>(`/organizations/${org}/admin-events`),
  dashboards: () => request<WorkspaceDashboard[]>("/dashboards"),
  dashboard: (id: string) => request<WorkspaceDashboard>(`/dashboards/${id}`),
  dashboardWidgetResult: (id: string, widget: string, from = "", through = "") => {
    const params = new URLSearchParams({ use_saved_filters: "false", use_visualization_dates: "false" });
    if (from) params.set("date_from", from);
    if (through) params.set("date_to", through);
    return request<
      { kind: "indicator"; indicator: Indicator } |
      { kind: "analysis"; analysis: AnalysisResult; chart: SavedAnalysis["chart"] }
    >(`/dashboards/${id}/widgets/${widget}/results?${params}`);
  },
  dashboardPdf: (id: string, from = "", through = "") => {
    const params = new URLSearchParams({use_saved_filters: "false", use_visualization_dates: "false"});
    if (from) params.set("date_from", from);
    if (through) params.set("date_to", through);
    return request<ArrayBuffer>(`/dashboards/${id}/export.pdf?${params}`);
  },
  createDashboard: (input: WorkspaceDashboardInput) =>
    request<WorkspaceDashboard>("/dashboards", {
      method: "POST", body: JSON.stringify(dashboardPayload(input)),
    }),
  saveDashboard: (id: string, input: WorkspaceDashboardInput) =>
    request<WorkspaceDashboard>(`/dashboards/${id}`, {
      method: "PUT", body: JSON.stringify(dashboardPayload(input)),
    }),
  deleteDashboard: (id: string) =>
    request<void>(`/dashboards/${id}`, { method: "DELETE" }),
  surveyFields: (
    projectId: string,
    formId?: string | null,
    refresh = false,
  ) => {
    const params = new URLSearchParams();
    if (formId) params.set("form_id", formId);
    if (refresh) params.set("refresh_schema", "true");
    return request<SurveyCatalogue>(
      `/projects/${projectId}/survey-fields?${params}`,
    );
  },
  queryAnalysis: (query: AnalysisQuery) =>
    request<AnalysisResult>("/analysis/query", {
      method: "POST",
      body: JSON.stringify(query),
    }),
  exportAnalysis: (query: AnalysisQuery) =>
    request<string>("/analysis/export", {
      method: "POST",
      body: JSON.stringify(query),
    }),
  savedAnalyses: (projectId: string) =>
    request<SavedAnalysis[]>(
      `/analysis/saved?project_id=${encodeURIComponent(projectId)}`,
    ),
  saveAnalysis: (input: Pick<SavedAnalysis, "title" | "query" | "chart">) =>
    request<SavedAnalysis>("/analysis/saved", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteSavedAnalysis: (id: string) =>
    request<void>(`/analysis/saved/${id}`, { method: "DELETE" }),
  hasStoredAccessToken: () => Boolean(accessToken),
  async login(login: string, password: string, remember: boolean) {
    expireSession();
    const loginGeneration = sessionGeneration;
    const result = await withSessionLock(async () => {
      await finishPendingLogout();
      return request<{ access_token: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ login, password, remember }),
      },
      false,
    );
    });
    if (loginGeneration !== sessionGeneration) throw new ApiError(401, "Session changed.");
    localStorage.removeItem("fieldsight_signed_out");
    retryNotBefore = 0;
    localStorage.removeItem("fieldsight_auth_retry_at");
    saveAccessToken(result.access_token, remember);
    sessionState("authenticated");
    channel?.postMessage({ type: "renewed", token: result.access_token, remember, generation: sessionGeneration });
  },
  restore: async () => {
    if (localStorage.getItem("fieldsight_signed_out")) {
      if (localStorage.getItem("fieldsight_logout_pending")) void withSessionLock(finishPendingLogout).catch(() => undefined);
      return null;
    }
    if (suspended || !accessToken || expiresSoon(accessToken)) {
      if (!await refreshAccessToken()) return null;
    }
    return request<CurrentUser>("/auth/me");
  },
  async logout() {
    // Invalidate responses immediately; serialize server logout after any pending rotation.
    expireSession();
    localStorage.setItem("fieldsight_logout_pending", "true");
    await withSessionLock(finishPendingLogout);
  },
  me: () => request<CurrentUser>("/auth/me"),
  users: () => request<ApiUserDirectoryItem[]>("/users"),
  organizations: () => request<ApiOrganization[]>("/organizations"),
  adminSectors: () => request<Sector[]>("/administration/sectors"),
  sectors: () => request<Sector[]>("/sectors"),
  organizationSectors: (organizationId: string) =>
    request<OrganizationSector[]>(`/organizations/${organizationId}/sectors`),
  createProject: (organizationId: string, input: CreateProjectInput) =>
    request<ApiProject>(`/organizations/${organizationId}/projects`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  organizationProjects: (organizationId: string) =>
    request<ApiProject[]>(`/organizations/${organizationId}/projects`),
  getProject: (organizationId: string, projectId: string) =>
    request<ApiProject>(
      `/organizations/${organizationId}/projects/${projectId}`,
    ),
  deleteProject: (organizationId: string, projectId: string) =>
    request<void>(`/organizations/${organizationId}/projects/${projectId}`, {
      method: "DELETE",
    }),
  assignProjectKoboForm: (
    projectId: string,
    connectionId: string,
    formId: string,
  ) =>
    request<KoboConnection>(`/kobo/connections/projects/${projectId}/form`, {
      method: "PUT",
      body: JSON.stringify({ connection_id: connectionId, form_id: formId }),
    }),
  createOrganization: (input: CreateOrganizationInput) =>
    request<{ organization_id: string }>("/organizations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateOrganization: (
    organizationId: string,
    input: UpdateOrganizationInput,
  ) =>
    request<unknown>(`/organizations/${organizationId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteOrganization: (organizationId: string) =>
    request<void>(`/organizations/${organizationId}`, {
      method: "DELETE",
    }),
  createSector: (input: SectorCreateInput) =>
    request<Sector>("/sectors", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSector: (sectorId: string, input: SectorUpdateInput) =>
    request<Sector>(`/sectors/${sectorId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteSector: (sectorId: string) =>
    request<void>(`/sectors/${sectorId}`, {
      method: "DELETE",
    }),
  live: () => request<{ status: string }>("/health/live"),
  ready: () => request<ReadinessStatus>("/health/ready"),
  status: () => request<ApiStatus>("/status"),
  koboConnections: () => request<KoboConnection[]>("/kobo/connections"),
  deleteKoboConnection: (id: string) => request<void>(`/kobo/connections/${id}`, { method: "DELETE" }),
  createKoboConnection: (input: KoboConnectionInput) =>
    request<KoboConnection>("/kobo/connections", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  koboForms: (connectionId: string) =>
    request<KoboForm[]>(`/kobo/connections/${connectionId}/forms`),
  selectKoboForm: (connectionId: string, form: KoboForm) =>
    request<KoboConnection>(`/kobo/connections/${connectionId}/selected-form`, {
      method: "PUT",
      body: JSON.stringify({ form_id: form.id, form_name: form.name }),
    }),
  projectReportPdf: (id: string, from: string, through: string) => {
    const params = new URLSearchParams();
    if (from) params.set("date_from", from); if (through) params.set("date_to", through);
    return request<ArrayBuffer>(`/projects/${id}/report.pdf?${params}`);
  },
  exportSubmissionsCsv: (params: URLSearchParams) => request<string>(`/submissions/export.csv?${params}`),
  submissionPage: (params: URLSearchParams) => request<{ items: ApiSubmission[]; total: number; counts: Record<string, number> }>(`/submissions/page?${params}`),
  submissions: () => request<ApiSubmission[]>("/submissions"),
  analyticsOverview: (
    filters: { projectId?: string; location?: string; period?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("project_id", filters.projectId);
    if (filters.location) params.set("location", filters.location);
    if (filters.period) params.set("period", filters.period);
    const query = params.toString();
    return request<ApiAnalyticsOverview>(
      `/analytics/overview${query ? `?${query}` : ""}`,
    );
  },
  dashboardOverview: (
    filters: { projectId?: string; location?: string; period?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("project_id", filters.projectId);
    if (filters.location) params.set("location", filters.location);
    if (filters.period) params.set("period", filters.period);
    const query = params.toString();
    return request<ApiDashboardOverview>(
      `/dashboard/overview${query ? `?${query}` : ""}`,
    );
  },
  syncProjectKoboForm: (projectId: string) =>
    request<ApiSyncResult>(`/projects/${projectId}/sync`, { method: "POST" }),
  syncSettings: (id: string) => request<{mode: "manual" | "scheduled"; interval_minutes: number; interval_seconds?: number; last_successful_sync: string | null; pending: boolean; queued_at?: string | null; attempts?: number; next_attempt_at?: string | null; worker_last_seen_at?: string | null; worker_available?: boolean | null; worker_heartbeat_at?: string | null; execution_state?: "running" | "unconfirmed" | null; execution_started_at?: string | null; latest_status?: string | null; latest_error?: string | null; received?: number; created?: number; updated?: number}>(`/projects/${id}/sync-settings`),
  updateSyncSettings: (id: string, mode: "manual" | "scheduled", interval_seconds: number) =>
    request(`/projects/${id}/sync-settings`, { method: "PUT", body: JSON.stringify({ mode, interval_seconds }) }),
  queueSync: (id: string) => request(`/projects/${id}/sync-jobs`, { method: "POST" }),
  syncRuns: () => request<ApiSyncRun[]>("/sync-runs"),
  pendingKoboSync: () => request<ApiPendingKoboSync>("/sync/pending"),
  fieldMappings: (projectId: string) =>
    request<FieldMappingOverview>(`/projects/${projectId}/field-mappings`),
  replaceFieldMappings: (
    projectId: string,
    mappings: Omit<FieldMapping, "id" | "project_id">[],
  ) =>
    request<FieldMapping[]>(`/projects/${projectId}/field-mappings`, {
      method: "PUT",
      body: JSON.stringify(mappings),
    }),
  projectTargets: (projectId: string) =>
    request<ProjectTarget[]>(`/projects/${projectId}/targets`),
  createProjectTarget: (
    projectId: string,
    target: Omit<ProjectTarget, "id" | "project_id">,
  ) =>
    request<ProjectTarget>(`/projects/${projectId}/targets`, {
      method: "POST",
      body: JSON.stringify(target),
    }),
  deleteProjectTarget: (projectId: string, targetId: string) =>
    request<void>(`/projects/${projectId}/targets/${targetId}`, {
      method: "DELETE",
    }),
  projectIntelligence: (projectId: string) =>
    request<ProjectIntelligence>(`/projects/${projectId}/intelligence`),
  indicators: (projectId: string, dateFrom = "", dateTo = "") => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return request<Indicator[]>(`/projects/${projectId}/indicators?${params}`);
  },
  resultsFramework: (projectId: string) =>
    request<FrameworkNode[]>(`/projects/${projectId}/results-framework`),
  createFrameworkNode: (projectId: string, input: FrameworkNodeInput) =>
    request<FrameworkNode>(`/projects/${projectId}/results-framework`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateFrameworkNode: (
    projectId: string,
    id: string,
    input: FrameworkNodeInput,
  ) =>
    request<FrameworkNode>(`/projects/${projectId}/results-framework/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteFrameworkNode: (projectId: string, id: string) =>
    request<void>(`/projects/${projectId}/results-framework/${id}`, {
      method: "DELETE",
    }),
  saveIndicatorPeriodTargets: (
    id: string,
    targets: Array<{ period: string; target_value: number }>,
    controls?: {confirm_change: boolean; change_reason: string; expected_version: number; preview_token: string},
  ) =>
    request<Array<{ period: string; target_value: number }>>(
      `/indicators/${id}/period-targets${controls ? `?confirm_change=true&change_reason=${encodeURIComponent(controls.change_reason)}&expected_version=${controls.expected_version}&preview_token=${encodeURIComponent(controls.preview_token)}` : ""}`,
      { method: "PUT", body: JSON.stringify(targets) },
    ),
  indicatorPeriodTargets: (id: string) =>
    request<Array<{ period: string; target_value: number }>>(
      `/indicators/${id}/period-targets`,
    ),
  indicatorPolicy: () => request<{ linked: Record<IndicatorUnit, string[]>; manual: Record<IndicatorUnit, string[]> }>("/indicator-calculation-policy"),
  indicatorTargetsPreview: (id: string, input: Array<{period: string; target_value: number}>) => request<{ preview_token: string; expected_version: number; affected_periods: string[]; before: Indicator; after: Indicator; notice: string }>(`/indicators/${id}/period-targets-preview`, { method: "POST", body: JSON.stringify(input) }),
  indicatorMappingPreview: (id: string, input: IndicatorMappingInput) => request<{ preview_token: string; expected_version: number; affected_periods: string[]; before: Indicator; after: Indicator; notice: string }>(`/indicators/${id}/mapping-preview`, { method: "POST", body: JSON.stringify(input) }),
  indicatorPreview: (id: string, input: IndicatorUpdateInput) => request<{ preview_token: string; expected_version: number; affected_periods: string[]; before: Indicator; after: Indicator; notice: string }>(`/indicators/${id}/definition-preview`, { method: "POST", body: JSON.stringify(input) }),
  indicatorEvidence: (id: string, offset = 0, from = "", to = "") => request<{ source: string; method: string; definition_version: number; total: number; contributing_count?: number; superseded_count?: number; actual?: number | null; numerator?: number | null; denominator?: number; items: Array<Record<string, unknown>>; notice: string }>(`/indicators/${id}/evidence?offset=${offset}&limit=25${from ? `&date_from=${from}` : ""}${to ? `&date_to=${to}` : ""}`),
  indicatorVersions: (id: string) => request<Array<{ version: number; reason: string; occurred_at: string; effective_scope: string }>>(`/indicators/${id}/versions`),
  createIndicator: (projectId: string, input: IndicatorCreateInput) =>
    request<Indicator>(`/projects/${projectId}/indicators`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateIndicator: (indicatorId: string, input: IndicatorUpdateInput) =>
    request<Indicator>(`/indicators/${indicatorId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteIndicator: (indicatorId: string) =>
    request<void>(`/indicators/${indicatorId}`, { method: "DELETE" }),
  indicatorFields: (projectId: string, formId?: string | null) =>
    request<IndicatorField[]>(
      `/projects/${projectId}/indicator-fields${formId ? `?form_id=${encodeURIComponent(formId)}` : ""}`,
    ),
  saveIndicatorMapping: (indicatorId: string, input: IndicatorMappingInput) =>
    request<IndicatorMapping>(`/indicators/${indicatorId}/mapping`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  indicatorMappingDeletePreview: (id: string) => request<{preview_token: string; expected_version: number; affected_periods: string[]; before: Indicator; after: Indicator; notice: string}>(`/indicators/${id}/mapping-delete-preview`, {method: "POST"}),
  deleteIndicatorMapping: (indicatorId: string, controls?: {confirm_change: boolean; change_reason: string; expected_version: number; preview_token: string}) =>
    request<void>(`/indicators/${indicatorId}/mapping${controls ? `?confirm_change=true&change_reason=${encodeURIComponent(controls.change_reason)}&expected_version=${controls.expected_version}&preview_token=${encodeURIComponent(controls.preview_token)}` : ""}`, { method: "DELETE" }),
  enumerators: () => request<ApiEnumerator[]>("/enumerators"),
  enumerator: (membershipId: string) =>
    request<ApiEnumerator>(`/enumerators/${membershipId}`),
  updateEnumerator: (membershipId: string, input: EnumeratorUpdateInput) =>
    request<ApiEnumerator>(`/enumerators/${membershipId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  createEnumerator: (input: EnumeratorCreateInput) =>
    request<ApiEnumerator>("/enumerators", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  organizationAssignments: (organizationId: string) =>
    request<ApiFieldAssignment[]>(
      `/organizations/${organizationId}/assignments`,
    ),
  deactivateEnumerator: (membershipId: string) =>
    request<void>(`/enumerators/${membershipId}`, {
      method: "DELETE",
    }),
};
