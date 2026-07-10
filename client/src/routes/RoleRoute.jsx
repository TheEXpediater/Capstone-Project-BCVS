import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

function SessionLoading() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      Loading session...
    </div>
  );
}

export default function RoleRoute({ allowedRoles = [], children }) {
  const { token, user, isLoading, hydrationComplete } = useSelector((state) => state.auth);

  if (isLoading && !hydrationComplete) {
    return <SessionLoading />;
  }

  if (hydrationComplete && !token) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role;

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
