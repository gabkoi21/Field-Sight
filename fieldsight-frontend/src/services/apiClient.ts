export type Role = "super_admin" | "organization_admin" | "enumerator";

export interface Membership {
  organization_id: string;
  role: Exclude<Role, "super_admin">;
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

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  owner_email: string;
  owner_username: string;
  owner_password: string;
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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: unknown = {},
  ) {
    super(message);
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8001/api/v1").replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "fieldsight_access_token";

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);

function saveAccessToken(token: string | null, remember = false) {
  accessToken = token;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  if (token) (remember ? localStorage : sessionStorage).setItem(ACCESS_TOKEN_KEY, token);
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null) as {
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
  const fallbackMessage = typeof body?.detail === "string" ? body.detail : undefined;
  return new ApiError(
    response.status,
    validationMessage || body?.message || fallbackMessage || "The request could not be completed.",
    body?.details ?? body?.detail,
  );
}

async function refreshAccessToken(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!response.ok) {
    saveAccessToken(null);
    return false;
  }
  const body = await response.json() as { access_token: string };
  const remembered = localStorage.getItem(ACCESS_TOKEN_KEY) !== null;
  saveAccessToken(body.access_token, remembered);
  return true;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && !path.startsWith("/auth/login") && await refreshAccessToken()) {
    return request<T>(path, init, false);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  async login(login: string, password: string, remember: boolean) {
    const result = await request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }, false);
    saveAccessToken(result.access_token, remember);
  },
  async logout() {
    try { await request<void>("/auth/logout", { method: "POST" }, false); } finally { saveAccessToken(null); }
  },
  me: () => request<CurrentUser>("/auth/me"),
  organizations: () => request<ApiOrganization[]>("/organizations"),
  sectors: () => request<Sector[]>("/sectors"),
  createOrganization: (input: CreateOrganizationInput) => request<{ organization_id: string }>("/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  }),
  updateOrganization: (organizationId: string, input: UpdateOrganizationInput) => request<unknown>(`/organizations/${organizationId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }),
};

