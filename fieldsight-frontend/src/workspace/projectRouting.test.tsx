// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { useProjectQueryId, useProjectRouteId, useProjectSearchParams, useSelectProjectFilter, ProjectLink } from "./projectRouting";
import { apiClient, type ApiProject } from "../services/apiClient";

const authScope = vi.hoisted(() => ({ user: "first-user", organization: "org" }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ loading: false,
  user: { id: authScope.user, memberships: [{ organization_id: authScope.organization, role: "organization_admin" }] } }) }));
vi.mock("../services/apiClient", () => ({ apiClient: { organizationProjects: vi.fn() } }));
const id = "ed4e9980-efa3-478c-8107-90acadb81375";
const other = "cfd47360-9a19-4f85-9b91-8c969d64e55d";
const projects = [{ id, name: "School Feeding", slug: "school-feeding" },
  { id: other, name: "Health", slug: "health" }] as ApiProject[];
afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); authScope.user = "first-user"; authScope.organization = "org"; });

function Probe() {
  const location = useLocation();
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useProjectSearchParams();
  const selectFilter = useSelectProjectFilter();
  return <>
    <output data-testid="url">{location.pathname}{location.search}{location.hash}</output>
    <output data-testid="selected">{workspace.projectId}</output>
    <output data-testid="route-id">{useProjectRouteId()}</output>
    <output data-testid="query-id">{useProjectQueryId()}</output>
    <button onClick={() => workspace.selectProject(other)}>Switch project</button>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => { const next = new URLSearchParams(params); next.set("search", "water"); setParams(next); }}>Search</button>
    <button onClick={() => selectFilter("")}>All projects</button>
    <ProjectLink to={`/projects/${other}/details`}>Health details</ProjectLink>
  </>;
}
function show(path: string) {
  vi.mocked(apiClient.organizationProjects).mockResolvedValue(projects);
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={[path]}>
    <WorkspaceProvider><Routes><Route path="*" element={<Probe />} /></Routes></WorkspaceProvider>
  </MemoryRouter></QueryClientProvider>);
}
it("opens a readable deep link with the internal UUID and preserves filters", async () => {
  show("/projects/school-feeding/analytics?form=abc#chart");
  await waitFor(() => expect(screen.getByTestId("selected").textContent).toBe(id));
  expect(screen.getByTestId("route-id").textContent).toBe(id);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/analytics?form=abc#chart"));
});
it("redirects UUID bookmarks without losing the page, filters, or fragment", async () => {
  show(`/projects/${id}/actions?new=1#details`);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/actions?new=1#details"));
  expect(screen.getByTestId("route-id").textContent).toBe(id);
});
it("keeps project switching scoped and drops stale pagination", async () => {
  show("/projects/school-feeding/analytics?page=3&form=abc");
  await waitFor(() => expect(screen.getByTestId("selected").textContent).toBe(id));
  fireEvent.click(screen.getByText("Switch project"));
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/analytics?form=abc"));
  expect(screen.getByTestId("route-id").textContent).toBe(other);
});
it("resolves readable query scopes and upgrades UUID query bookmarks", async () => {
  show(`/submissions?project_id=${id}&review_status=ready`);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/submissions?review_status=ready"));
  expect(screen.getByTestId("query-id").textContent).toBe(id);
});
it("never falls back to a different project for an unknown URL", async () => {
  show("/projects/not-a-project/overview");
  await waitFor(() => expect(apiClient.organizationProjects).toHaveBeenCalled());
  expect(screen.getByTestId("selected").textContent).toBe("");
  expect(screen.getByTestId("route-id").textContent).toBe("");
});

it("restores the selected project after refreshing a clean overview URL", async () => {
  const page = show(`/projects/${other}/overview`);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/overview"));
  page.unmount();
  show("/overview");
  await waitFor(() => expect(screen.getByTestId("route-id").textContent).toBe(other));
  expect(screen.getByTestId("url").textContent).toBe("/overview");
});
it("keeps project context in browser history when the address stays clean", async () => {
  show(`/projects/${id}/overview`);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/overview"));
  fireEvent.click(screen.getByText("Switch project"));
  await waitFor(() => expect(screen.getByTestId("route-id").textContent).toBe(other));
  fireEvent.click(screen.getByText("Back"));
  await waitFor(() => expect(screen.getByTestId("route-id").textContent).toBe(id));
  expect(screen.getByTestId("url").textContent).toBe("/overview");
});
it("renders clean links that select the right project", async () => {
  show(`/projects/${id}/overview`);
  await waitFor(() => expect(screen.getByText("Health details").getAttribute("href")).toBe("/details"));
  fireEvent.click(screen.getByText("Health details"));
  await waitFor(() => expect(screen.getByTestId("route-id").textContent).toBe(other));
  expect(screen.getByTestId("url").textContent).toBe("/details");
});
it("keeps hidden submission scope through filtering and supports All projects", async () => {
  show(`/submissions?project_id=${id}`);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/submissions"));
  expect(screen.getByTestId("query-id").textContent).toBe(id);
  fireEvent.click(screen.getByText("Search"));
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/submissions?search=water"));
  expect(screen.getByTestId("query-id").textContent).toBe(id);
  fireEvent.click(screen.getByText("All projects"));
  await waitFor(() => expect(screen.getByTestId("query-id").textContent).toBe("") );
  expect(screen.getByTestId("url").textContent).toBe("/submissions?search=water");
});

it("does not reuse another user's selected project", async () => {
  const page = show(`/projects/${other}/overview`);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/overview"));
  page.unmount();
  authScope.user = "second-user";
  show("/overview");
  await waitFor(() => expect(screen.getByTestId("route-id").textContent).toBe(id));
});
it("does not reuse a different organization's selection", async () => {
  const page = show(`/projects/${other}/overview`);
  await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("/overview"));
  page.unmount();
  authScope.organization = "another-org";
  show("/overview");
  await waitFor(() => expect(screen.getByTestId("route-id").textContent).toBe(id));
});
