import { useSelector } from 'react-redux';

export default function Dashboard() {
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <div>
          <h1 className="dashboard-title">BCVS Admin Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.fullName || user?.username}. You are logged in
            as <strong> {user?.role}</strong>.
          </p>
        </div>
      </div>

      <div className="row g-4 mb-1">
        <div className="col-md-4">
          <div className="content-card stat-card">
            <div className="stat-label">Role</div>
            <div className="stat-value text-capitalize">{user?.role || '--'}</div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="content-card stat-card">
            <div className="stat-label">Username</div>
            <div className="stat-value">{user?.username || '--'}</div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="content-card stat-card">
            <div className="stat-label">Full Name</div>
            <div className="stat-value">{user?.fullName || '--'}</div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <h2 className="h5 mb-0">Authenticated User Data</h2>
        </div>
        <div className="content-card-body">
          <pre className="dashboard-json">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}