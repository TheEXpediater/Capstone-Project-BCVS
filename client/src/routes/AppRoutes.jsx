import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

import AppShell from '../components/layouts/AppShell';
import LoginPage from '../features/auth/pages/LoginPage';
import SystemSettingsPage from '../features/settings/pages/SystemSettingsPage';
import UserManagementPage from '../features/users/pages/UserManagementPage';
import ContractManagerPage from '../features/contracts/pages/ContractManagerPage';
import CurriculumManagerPage from '../features/curriculum/pages/CurriculumManagerPage';
import StudentImportManagerPage from '../features/students/pages/StudentImportManagerPage';
import Dashboard from '../pages/Dashboard';
import NotFound from '../pages/NotFound';
import Unauthorized from '../pages/Unauthorized';

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

      <Route path="/" element={<ShellPage><Dashboard /></ShellPage>} />

      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['super_admin', 'developer']}>
              <AppShell>
                <StudentImportManagerPage />
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
            <RoleRoute allowedRoles={['super_admin', 'developer']}>
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