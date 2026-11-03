import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { skipLogin } from "../auth/developmentAccess";
import {
  RequireOrganizationMember,
  RequireSuperAdmin,
} from "../auth/RouteGuards";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import { RouteContent } from "../components/layout/RouteContent";
const SurveyQuestionExplorer = lazy(() => import("../pages/organization/SurveyQuestionExplorer").then(module => ({ default: module.SurveyQuestionExplorer })));
import { LoginPage } from "../pages/auth/LoginPage";
const FieldOperationsPage = lazy(() => import("../pages/organization/FieldOperationsPage").then(module => ({ default: module.FieldOperationsPage })));
const KoboConnectionsPage = lazy(() => import("../pages/organization/KoboConnectionsPage").then(module => ({ default: module.KoboConnectionsPage })));
const WorkspacesPage = lazy(() => import("../workspace/WorkspacesPage").then(module => ({ default: module.WorkspacesPage })));
const WorkspaceDetailsPage = lazy(() => import("../workspace/WorkspaceDetailsPage").then(module => ({ default: module.WorkspaceDetailsPage })));
const ProjectWorkspacePage = lazy(() => import("../pages/organization/ProjectWorkspacePage").then(module => ({ default: module.ProjectWorkspacePage })));
const QuickStartPage = lazy(() => import("../workspace/QuickStartPage").then(module => ({ default: module.QuickStartPage })));
const WorkspaceTeamPage = lazy(() => import("../workspace/WorkspaceTeamPage").then(module => ({ default: module.WorkspaceTeamPage })));
const DataTablesPage = lazy(() => import("../workspace/DataTablesPage").then(module => ({ default: module.DataTablesPage })));
const WorkspaceFormsPage = lazy(() => import("../workspace/WorkspaceFormsPage").then(module => ({ default: module.WorkspaceFormsPage })));
const OrganizationDashboardPage = lazy(() => import("../pages/dashboard/OrganizationDashboardPage").then(module => ({ default: module.OrganizationDashboardPage })));
const DashboardsPage = lazy(() => import("../workspace/DashboardsPage").then(module => ({ default: module.DashboardsPage })));
const ProfilePage = lazy(() => import("../workspace/ProfilePage").then(module => ({ default: module.ProfilePage })));
const AcceptInvitationPage = lazy(() => import("../workspace/ProfilePage").then(module => ({ default: module.AcceptInvitationPage })));
const AccountHelpPage = lazy(() => import("../workspace/ProfilePage").then(module => ({ default: module.AccountHelpPage })));
const OrganizationSettingsPage = lazy(() => import("../workspace/OrganizationSettingsPage").then(module => ({ default: module.OrganizationSettingsPage })));
const ProjectActionsPage = lazy(() => import("../pages/organization/ProjectActionsPage").then(module => ({ default: module.ProjectActionsPage })));
const ProjectIndicatorsPage = lazy(() => import("../pages/organization/ProjectIndicatorsPage").then(module => ({ default: module.ProjectIndicatorsPage })));
const ReportsPage = lazy(() => import("../workspace/WorkspaceReportsPage").then(module => ({ default: module.WorkspaceReportsPage })));
const SubmissionsPage = lazy(() => import("../pages/organization/SubmissionsPage").then(module => ({ default: module.SubmissionsPage })));
import { SuperAdminShell } from "../components/superadmin/SuperAdminShell";
const AuditLogPage = lazy(() => import("../pages/superadmin/AuditLogPage").then(module => ({ default: module.AuditLogPage })));
const BillingPage = lazy(() => import("../pages/superadmin/BillingPage").then(module => ({ default: module.BillingPage })));
const OrganizationsPage = lazy(() => import("../pages/superadmin/OrganizationsPage").then(module => ({ default: module.OrganizationsPage })));
const PlatformSettingsPage = lazy(() => import("../pages/superadmin/PlatformSettingsPage").then(module => ({ default: module.PlatformSettingsPage })));
const SectorsPage = lazy(() => import("../pages/superadmin/SectorsPage").then(module => ({ default: module.SectorsPage })));
const SuperAdminDashboardPage = lazy(() => import("../pages/dashboard/SuperAdminDashboardPage").then(module => ({ default: module.SuperAdminDashboardPage })));
const SystemHealthPage = lazy(() => import("../pages/superadmin/SystemHealthPage").then(module => ({ default: module.SystemHealthPage })));
const UsersPage = lazy(() => import("../pages/superadmin/UsersPage").then(module => ({ default: module.UsersPage })));

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
        <Route index element={<Navigate replace to="/dashboard" />} />
        <Route path="dashboard" element={<OrganizationDashboardPage />} />
        <Route path="projects" element={<WorkspacesPage />} />
        <Route
          path="workspaces"
          element={<Navigate replace to="/projects" />}
        />
        <Route path="projects/:projectId" element={<Navigate to="overview" replace />} />
        <Route path="projects/:projectId/details" element={<WorkspaceDetailsPage />} />
        <Route path="projects/:projectId/actions" element={<ProjectActionsPage />} />
        <Route path="projects/:projectId/overview" element={<ProjectWorkspacePage />} />
        <Route path="overview" element={<ProjectWorkspacePage />} />
        <Route path="details" element={<WorkspaceDetailsPage />} />
        <Route path="actions" element={<ProjectActionsPage />} />
        <Route path="project-team" element={<WorkspaceTeamPage workspaceOnly />} />
        <Route
          path="projects/:projectId/indicators"
          element={<ProjectIndicatorsPage />}
        />
        <Route path="indicators" element={<ProjectIndicatorsPage />} />
        <Route path="forms/connections" element={<KoboConnectionsPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="enumerators" element={<FieldOperationsPage />} />
        <Route path="projects/:projectId/analytics" element={<SurveyQuestionExplorer />} />
        <Route path="analytics" element={<SurveyQuestionExplorer />} />
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
        <Route path="projects/:projectId/dashboards" element={<DashboardsPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
