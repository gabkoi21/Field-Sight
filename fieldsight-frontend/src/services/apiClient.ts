export type Role = "super_admin" | "organization_admin" | "enumerator";

export interface Membership {
  organization_id: string;
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
  password: string;
  phone_number?: string;
  employee_id?: string;
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
  employee_id: string | null;
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
}
export interface ApiProject {
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
}

export interface ApiSyncRun {
  id: string;
  project_id: string;
  status: string;
  received: number;
  created: number;
  updated: number;
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
  data_type: "text" | "number" | "date" | "boolean" | "single_select" | "multiple_select" | "gps" | "location";
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
  pulse: { name: string; status: "On track" | "Needs attention"; detail: string }[];
  indicators: { mapping_id: string; name: string; value: number; summary: string }[];
  targets: { id: string; name: string; target: number; actual: number; unit: string; progress: number; remaining: number; status: string }[];
}
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
  return response.json() as Promise<T>;
}

export const apiClient = {
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
    request<ApiProject>(`/organizations/${organizationId}/projects/${projectId}`),
  deleteProject: (organizationId: string, projectId: string) =>
    request<void>(`/organizations/${organizationId}/projects/${projectId}`, {
      method: "DELETE",
    }),
  assignProjectKoboForm: (projectId: string, connectionId: string, formId: string) =>
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
  analyticsOverview: (filters: { projectId?: string; location?: string; period?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("project_id", filters.projectId);
    if (filters.location) params.set("location", filters.location);
    if (filters.period) params.set("period", filters.period);
    const query = params.toString();
    return request<ApiAnalyticsOverview>(`/analytics/overview${query ? `?${query}` : ""}`);
  },
  dashboardOverview: (filters: { projectId?: string; location?: string; period?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("project_id", filters.projectId);
    if (filters.location) params.set("location", filters.location);
    if (filters.period) params.set("period", filters.period);
    const query = params.toString();
    return request<ApiDashboardOverview>(`/dashboard/overview${query ? `?${query}` : ""}`);
  },
  qualityIssues: (projectId?: string) =>
    request<ApiQualityIssue[]>(`/quality/issues${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`),
  runQualityValidation: (projectId?: string) =>
    request<ApiQualityResult>(`/quality/run${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`, { method: "POST" }),
  updateSubmissionReviewStatus: (submissionId: string, status: "ready" | "needs_review" | "invalid") =>
    request<{ id: string; review_status: string }>(`/submissions/${submissionId}/review-status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),  syncProjectKoboForm: (projectId: string) => request<ApiSyncResult>(`/projects/${projectId}/sync`, { method: "POST" }),
  syncRuns: () => request<ApiSyncRun[]>("/sync-runs"),
  pendingKoboSync: () => request<ApiPendingKoboSync>("/sync/pending"),
  fieldMappings: (projectId: string) => request<FieldMappingOverview>(`/projects/${projectId}/field-mappings`),
  replaceFieldMappings: (projectId: string, mappings: Omit<FieldMapping, "id" | "project_id">[]) =>
    request<FieldMapping[]>(`/projects/${projectId}/field-mappings`, { method: "PUT", body: JSON.stringify(mappings) }),
  projectTargets: (projectId: string) => request<ProjectTarget[]>(`/projects/${projectId}/targets`),
  createProjectTarget: (projectId: string, target: Omit<ProjectTarget, "id" | "project_id">) =>
    request<ProjectTarget>(`/projects/${projectId}/targets`, { method: "POST", body: JSON.stringify(target) }),
  deleteProjectTarget: (projectId: string, targetId: string) =>
    request<void>(`/projects/${projectId}/targets/${targetId}`, { method: "DELETE" }),
  projectIntelligence: (projectId: string) => request<ProjectIntelligence>(`/projects/${projectId}/intelligence`),  enumerators: () => request<ApiEnumerator[]>("/enumerators"),
  enumerator: (membershipId: string) => request<ApiEnumerator>(`/enumerators/${membershipId}`),
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
  deactivateEnumerator: (membershipId: string) =>
    request<void>(`/enumerators/${membershipId}`, {
      method: "DELETE",
    }),
};


