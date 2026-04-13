import { Navigate } from 'react-router-dom';
import { hasValidStoredAuth } from '../features/auth/authStorage';

export default function ProtectedRoute({ children }) {
  const auth = hasValidStoredAuth();

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}