import { Navigate } from 'react-router-dom';
import { hasValidStoredAuth } from '../features/auth/authStorage';

export default function RoleRoute({ allowedRoles = [], children }) {
  const auth = hasValidStoredAuth();

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  const role = auth?.user?.role;

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}