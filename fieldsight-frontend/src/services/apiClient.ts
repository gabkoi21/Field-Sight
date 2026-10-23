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
  chart: "bar" | "line" | "donut" | "table";
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
export interface ApiQualityIssue {
  id: string;
  submission_id: string;
  external_id: string;
  project_id: string;
  project_name: string;
  enumerator: string | null;
  location: string | null;
  submitted_at: string | null;
  severity: "Blocking" | "High" | "Medium" | "Low";
  rule: string;
  detail: string;
  field: string | null;
  state: string;
}

export interface ApiQualityResult {
  checked: number;
  ready: number;
  needs_review: number;
  invalid: number;
  issues: ApiQualityIssue[];
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
  | "framework_node_id"
>;
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
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "fieldsight_access_token";
const SESSION_EXPIRED_EVENT = "fieldsight-session-expired";
const REFRESH_LEEWAY_MS = 60_000;

let accessToken =
  localStorage.getItem(ACCESS_TOKEN_KEY) ??
  sessionStorage.getItem(ACCESS_TOKEN_KEY);
let refreshTimer: ReturnType<typeof window.setTimeout> | null = null;
let refreshInFlight: Promise<boolean> | null = null;

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
    refreshTimer = window.setTimeout(() => void refreshAccessToken(), delay);
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
  refreshInFlight = (async () => {
    const remembered = localStorage.getItem(ACCESS_TOKEN_KEY) !== null;
    const response = await fetch(API_BASE_URL + "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      saveAccessToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return false;
    }
    const body = (await response.json()) as { access_token: string };
    saveAccessToken(body.access_token, remembered);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

if (accessToken) scheduleAccessTokenRefresh(accessToken);
async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (
    response.status === 401 &&
    retry &&
    !path.startsWith("/auth/login") &&
    (await refreshAccessToken())
  ) {
    return request<T>(path, init, false);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  if (response.headers.get("Content-Type")?.includes("text/csv"))
    return response.text() as Promise<T>;
  return response.json() as Promise<T>;
}

export const apiClient = {
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
  dashboards: () => request<WorkspaceDashboard[]>("/dashboards"),
  dashboard: (id: string) => request<WorkspaceDashboard>(`/dashboards/${id}`),
  dashboardWidgetResult: (id: string, widget: string, from = "", through = "") => {
    const params = new URLSearchParams({ use_saved_filters: "false" });
    if (from) params.set("date_from", from);
    if (through) params.set("date_to", through);
    return request<
      { kind: "indicator"; indicator: Indicator } |
      { kind: "analysis"; analysis: AnalysisResult; chart: SavedAnalysis["chart"] }
    >(`/dashboards/${id}/widgets/${widget}/results?${params}`);
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
    const result = await request<{ access_token: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ login, password }),
      },
      false,
    );
    saveAccessToken(result.access_token, remember);
  },
  async logout() {
    try {
      await request<void>("/auth/logout", { method: "POST" }, false);
    } finally {
      saveAccessToken(null);
    }
  },
  me: () => request<CurrentUser>("/auth/me"),
  users: () => request<ApiUserDirectoryItem[]>("/users"),
  organizations: () => request<ApiOrganization[]>("/organizations"),
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
  qualityIssues: (projectId?: string) =>
    request<ApiQualityIssue[]>(
      `/quality/issues${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`,
    ),
  runQualityValidation: (projectId?: string) =>
    request<ApiQualityResult>(
      `/quality/run${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`,
      { method: "POST" },
    ),
  updateSubmissionReviewStatus: (
    submissionId: string,
    status: "ready" | "needs_review" | "invalid",
  ) =>
    request<{ id: string; review_status: string }>(
      `/submissions/${submissionId}/review-status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    ),
  syncProjectKoboForm: (projectId: string) =>
    request<ApiSyncResult>(`/projects/${projectId}/sync`, { method: "POST" }),
  syncSettings: (id: string) => request<{mode: "manual" | "scheduled"; interval_minutes: number; interval_seconds?: number; last_successful_sync: string | null; pending: boolean; queued_at?: string | null; attempts?: number; next_attempt_at?: string | null}>(`/projects/${id}/sync-settings`),
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
  ) =>
    request<Array<{ period: string; target_value: number }>>(
      `/indicators/${id}/period-targets`,
      { method: "PUT", body: JSON.stringify(targets) },
    ),
  indicatorPeriodTargets: (id: string) =>
    request<Array<{ period: string; target_value: number }>>(
      `/indicators/${id}/period-targets`,
    ),
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
  deleteIndicatorMapping: (indicatorId: string) =>
    request<void>(`/indicators/${indicatorId}/mapping`, { method: "DELETE" }),
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
