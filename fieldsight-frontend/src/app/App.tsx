import { Navigate, Route, Routes } from "react-router-dom";
import {
  RequireOrganizationMember,
  RequireSuperAdmin,
} from "../auth/RouteGuards";
import { AppShell } from "../components/layout/AppShell";
import { ExploreAnalyzePage } from "../pages/organization/ExploreAnalyzePage";
import { LoginPage } from "../pages/auth/LoginPage";
import { OrganizationDashboardPage } from "../pages/dashboard/OrganizationDashboardPage";
import { FieldOperationsPage } from "../pages/organization/FieldOperationsPage";
import { KoboConnectionsPage } from "../pages/organization/KoboConnectionsPage";
import { ProjectsPage } from "../pages/organization/ProjectsPage";
import { ProjectWorkspacePage } from "../pages/organization/ProjectWorkspacePage";
import { QualityCenterPage } from "../pages/organization/QualityCenterPage";
import { ReportsPage } from "../pages/organization/ReportsPage";
import { SettingsPage } from "../pages/organization/SettingsPage";
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
import { TeamPage } from "../pages/organization/TeamPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
            <AppShell />
          </RequireOrganizationMember>
        }
      >
        <Route index element={<OrganizationDashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectWorkspacePage />} />
        <Route path="forms/connections" element={<KoboConnectionsPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="enumerators" element={<FieldOperationsPage />} />
        <Route path="quality" element={<QualityCenterPage />} />
        <Route path="analytics" element={<ExploreAnalyzePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

