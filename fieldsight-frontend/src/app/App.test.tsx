// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, useParams } from "react-router-dom";
import { App } from "./App";

vi.mock("../auth/RouteGuards", () => ({
  RequireOrganizationMember: ({ children }: { children: React.ReactNode }) => children,
  RequireSuperAdmin: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../workspace/WorkspaceShell", () => ({ WorkspaceShell: () => <Outlet /> }));
vi.mock("../pages/organization/ProjectWorkspacePage", () => ({ ProjectWorkspacePage: () => <h1>Action-focused project overview</h1> }));
vi.mock("../workspace/WorkspaceDetailsPage", () => ({ WorkspaceDetailsPage: () => <h1>Existing project details</h1> }));
vi.mock("../workspace/WorkspacesPage", () => ({ WorkspacesPage: () => <h1>Projects</h1> }));
vi.mock("../pages/organization/SurveyQuestionExplorer", () => ({SurveyQuestionExplorer: () => <h1>Project analysis {useParams().projectId}</h1>}));

afterEach(cleanup);

it("registers the action-focused overview in the actual application router", () => {
  render(<MemoryRouter initialEntries={["/projects/school/overview"]}><App /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Action-focused project overview" })).toBeTruthy();
});

it("opens Overview when a project is selected", async () => {
  render(<MemoryRouter initialEntries={["/projects/school"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Action-focused project overview" })).toBeTruthy();
});

it("keeps project editing accessible through Details & activity", () => {
  render(<MemoryRouter initialEntries={["/projects/school/details"]}><App /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Existing project details" })).toBeTruthy();
});

it("redirects the removed Data Quality page to projects", async () => {
  render(<MemoryRouter initialEntries={["/quality"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Projects" })).toBeTruthy();
});

it("opens survey analysis with the project in the route", async () => {
  render(<MemoryRouter initialEntries={["/projects/wash/analytics"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", {name: "Project analysis wash"})).toBeTruthy();
});
it("redirects old explicit-project analysis links to the scoped route", async () => {
  render(<MemoryRouter initialEntries={["/analytics?project_id=wash"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", {name: "Project analysis wash"})).toBeTruthy();
});
it("requires project selection for old unscoped analysis URLs", async () => {
  render(<MemoryRouter initialEntries={["/analytics"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", {name: "Projects"})).toBeTruthy();
});
