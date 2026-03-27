import { useDispatch, useSelector } from 'react-redux';
import { signOut } from '../features/auth/authSlice';

export default function Dashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">BCVS Admin Dashboard</h1>
          <p className="text-muted mb-0">You are logged in as {user?.fullName || user?.username} ({user?.role}).</p>
        </div>
        <button className="btn btn-outline-danger" onClick={() => dispatch(signOut())}>
          Logout
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="h5">Auth is working</h2>
          <pre className="mb-0 bg-light p-3 rounded">{JSON.stringify(user, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
