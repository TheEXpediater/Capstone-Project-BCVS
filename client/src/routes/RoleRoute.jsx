import { Navigate } from 'react-router-dom';

export default function RoleRoute({ allowedRoles = [], children }) {
  const raw = localStorage.getItem('auth');

  if (!raw) {
    return <Navigate to="/login" replace />;
  }

  try {
    const parsed = JSON.parse(raw);
    const role = parsed?.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }

  return children;
}