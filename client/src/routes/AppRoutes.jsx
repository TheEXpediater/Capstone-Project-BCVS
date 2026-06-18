import { Routes, Route } from 'react-router-dom';
import AppShell from '../components/layouts/AppShell';
import LoginPage from '../features/auth/pages/LoginPage';
import CredentialDraftsPage from '../features/credentials/pages/CredentialDraftsPage';
import SystemSettingsPage from '../features/settings/pages/SystemSettingsPage';
import UserManagementPage from '../features/users/pages/UserManagementPage';
import ContractManagerPage from '../features/contracts/pages/ContractManagerPage';
import CurriculumManagerPage from '../features/curriculum/pages/CurriculumManagerPage';
import LinkAccountsPage from '../features/students/pages/LinkAccountsPage';
import StudentImportManagerPage from '../features/students/pages/StudentImportManagerPage';
import VerifierPortalPage from '../features/verification/pages/VerifierPortalPage';
import Dashboard from '../pages/Dashboard';
import NotFound from '../pages/NotFound';
import Unauthorized from '../pages/Unauthorized';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

function ShellPage({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/verify" element={<VerifierPortalPage />} />
      <Route path="/verify/:sessionId" element={<VerifierPortalPage />} />
      <Route path="/verification-portal/verify" element={<VerifierPortalPage />} />
      <Route path="/verification-portal/verify/:sessionId" element={<VerifierPortalPage />} />

      <Route path="/" element={<ShellPage><Dashboard /></ShellPage>} />

      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['admin', 'super_admin', 'developer']}>
              <AppShell>
                <StudentImportManagerPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/link-accounts"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['admin', 'super_admin', 'developer']}>
              <AppShell>
                <LinkAccountsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/credentials"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['admin', 'super_admin', 'developer', 'cashier']}>
              <AppShell>
                <CredentialDraftsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/curricula"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['admin', 'super_admin', 'developer']}>
              <AppShell>
                <CurriculumManagerPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['developer']}>
              <AppShell>
                <UserManagementPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/contracts"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['developer', 'super_admin']}>
              <AppShell>
                <ContractManagerPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/system-settings"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['developer', 'super_admin']}>
              <AppShell>
                <SystemSettingsPage />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}


