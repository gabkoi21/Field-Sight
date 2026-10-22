import { Navigate, Route, Routes } from "react-router-dom";
import { skipLogin } from "../auth/developmentAccess";
import {
  RequireOrganizationMember,
  RequireSuperAdmin,
} from "../auth/RouteGuards";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import { SurveyQuestionExplorer } from "../pages/organization/SurveyQuestionExplorer";
import { LoginPage } from "../pages/auth/LoginPage";
import { OrganizationDashboardPage } from "../pages/dashboard/OrganizationDashboardPage";
import { FieldOperationsPage } from "../pages/organization/FieldOperationsPage";
import { KoboConnectionsPage } from "../pages/organization/KoboConnectionsPage";
import { WorkspacesPage } from "../workspace/WorkspacesPage";
import { WorkspaceDetailsPage } from "../workspace/WorkspaceDetailsPage";
import { QuickStartPage } from "../workspace/QuickStartPage";
import { WorkspaceTeamPage } from "../workspace/WorkspaceTeamPage";
import { DataTablesPage } from "../workspace/DataTablesPage";
import { WorkspaceFormsPage } from "../workspace/WorkspaceFormsPage";
import { DashboardsPage } from "../workspace/DashboardsPage";
import {
  ProfilePage,
  AcceptInvitationPage,
  AccountHelpPage,
} from "../workspace/ProfilePage";
import { OrganizationSettingsPage } from "../workspace/OrganizationSettingsPage";
import { ProjectIndicatorsPage } from "../pages/organization/ProjectIndicatorsPage";
import { QualityCenterPage } from "../pages/organization/QualityCenterPage";
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
      <Route
        path="/login"
        element={skipLogin ? <Navigate replace to="/" /> : <LoginPage />}
      />
      <Route path="/sign-in" element={<LoginPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      <Route path="/account-help" element={<AccountHelpPage />} />
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
        <Route index element={<OrganizationDashboardPage />} />
        <Route path="projects" element={<WorkspacesPage />} />
        <Route
          path="workspaces"
          element={<Navigate replace to="/projects" />}
        />
        <Route path="projects/:projectId" element={<WorkspaceDetailsPage />} />
        <Route
          path="projects/:projectId/indicators"
          element={<ProjectIndicatorsPage />}
        />
        <Route path="indicators" element={<ProjectIndicatorsPage />} />
        <Route path="forms/connections" element={<KoboConnectionsPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="enumerators" element={<FieldOperationsPage />} />
        <Route path="quality" element={<QualityCenterPage />} />
        <Route path="analytics" element={<SurveyQuestionExplorer />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="projects/:projectId/team" element={<WorkspaceTeamPage workspaceOnly />} />
        <Route path="team" element={<WorkspaceTeamPage />} />
        <Route path="settings" element={<OrganizationSettingsPage />} />
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
