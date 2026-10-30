import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProjectAnalyticsRedirect } from "./ProjectAnalyticsRedirect";
import { skipLogin } from "../auth/developmentAccess";
import {
  RequireOrganizationMember,
  RequireSuperAdmin,
} from "../auth/RouteGuards";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import { RouteContent } from "../components/layout/RouteContent";
const SurveyQuestionExplorer = lazy(() => import("../pages/organization/SurveyQuestionExplorer").then(module => ({ default: module.SurveyQuestionExplorer })));
import { LoginPage } from "../pages/auth/LoginPage";
import { FieldOperationsPage } from "../pages/organization/FieldOperationsPage";
import { KoboConnectionsPage } from "../pages/organization/KoboConnectionsPage";
import { WorkspacesPage } from "../workspace/WorkspacesPage";
import { WorkspaceDetailsPage } from "../workspace/WorkspaceDetailsPage";
import { ProjectWorkspacePage } from "../pages/organization/ProjectWorkspacePage";
import { QuickStartPage } from "../workspace/QuickStartPage";
import { WorkspaceTeamPage } from "../workspace/WorkspaceTeamPage";
import { DataTablesPage } from "../workspace/DataTablesPage";
import { WorkspaceFormsPage } from "../workspace/WorkspaceFormsPage";
const DashboardsPage = lazy(() => import("../workspace/DashboardsPage").then(module => ({ default: module.DashboardsPage })));
import {
  ProfilePage,
  AcceptInvitationPage,
  AccountHelpPage,
} from "../workspace/ProfilePage";
import { OrganizationSettingsPage } from "../workspace/OrganizationSettingsPage";
const ProjectActionsPage = lazy(() => import("../pages/organization/ProjectActionsPage").then(module => ({ default: module.ProjectActionsPage })));
const ProjectIndicatorsPage = lazy(() => import("../pages/organization/ProjectIndicatorsPage").then(module => ({ default: module.ProjectIndicatorsPage })));
import { WorkspaceReportsPage as ReportsPage } from "../workspace/WorkspaceReportsPage";
import { SubmissionsPage } from "../pages/organization/SubmissionsPage";
import {
  AuditLogPage,
  BillingPage,
  OrganizationsPage,
  PlatformSettingsPage,
  SectorsPage,
  SuperAdminDashboardPage,
  SuperAdminShell,
  SystemHealthPage,
  UsersPage,
} from "../pages/superadmin";

export function App() {
  return (
    <Routes>
      {/* Public pages have their own boundary; authenticated shells never suspend here. */}
      <Route element={<RouteContent />}>
        <Route
          path="/login"
          element={skipLogin ? <Navigate replace to="/" /> : <LoginPage />}
        />
        <Route path="/sign-in" element={<LoginPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/account-help" element={<AccountHelpPage />} />
      </Route>
      <Route
        path="/superadmin"
        element={
          <RequireSuperAdmin>
            <SuperAdminShell />
          </RequireSuperAdmin>
        }
      >
        <Route index element={<SuperAdminDashboardPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="sectors" element={<SectorsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="system" element={<SystemHealthPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="settings" element={<PlatformSettingsPage />} />
      </Route>
      <Route
        element={
          <RequireOrganizationMember>
            <WorkspaceShell />
          </RequireOrganizationMember>
        }
      >
        <Route index element={<Navigate replace to="/projects" />} />
        <Route path="projects" element={<WorkspacesPage />} />
        <Route
          path="workspaces"
          element={<Navigate replace to="/projects" />}
        />
        <Route path="projects/:projectId" element={<Navigate to="overview" replace />} />
        <Route path="projects/:projectId/details" element={<WorkspaceDetailsPage />} />
        <Route path="projects/:projectId/actions" element={<ProjectActionsPage />} />
        <Route path="projects/:projectId/overview" element={<ProjectWorkspacePage />} />
        <Route
          path="projects/:projectId/indicators"
          element={<ProjectIndicatorsPage />}
        />
        <Route path="indicators" element={<ProjectIndicatorsPage />} />
        <Route path="forms/connections" element={<KoboConnectionsPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="enumerators" element={<FieldOperationsPage />} />
        <Route path="projects/:projectId/analytics" element={<SurveyQuestionExplorer />} />
        <Route path="analytics" element={<ProjectAnalyticsRedirect />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="projects/:projectId/team" element={<WorkspaceTeamPage workspaceOnly />} />
        <Route path="team" element={<FieldOperationsPage />} />
        <Route path="settings" element={<OrganizationSettingsPage />} />
        <Route path="settings/admins" element={<WorkspaceTeamPage adminOnly />} />
        <Route path="guide" element={<QuickStartPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="forms" element={<WorkspaceFormsPage />} />
        <Route path="data-tables" element={<DataTablesPage key="data-tables" />} />
        <Route path="dashboards" element={<DashboardsPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
