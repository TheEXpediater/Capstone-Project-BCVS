import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from '../../features/auth/authSlice';

const linkBase = {
  display: 'block',
  padding: '10px 14px',
  borderRadius: '10px',
  color: '#cbd5e1',
  textDecoration: 'none',
  fontWeight: 500,
};

function SidebarLink({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...linkBase,
        background: isActive ? '#1e293b' : 'transparent',
        color: '#f8fafc',
      })}
    >
      {children}
    </NavLink>
  );
}

export default function AppShell({ children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  async function handleLogout() {
    await dispatch(signOut());
    navigate('/login', { replace: true });
  }

  const isDeveloper = user?.role === 'developer';
  const canSeeSettings = ['developer', 'super_admin'].includes(user?.role);

  return (
    <div className="d-flex min-vh-100 bg-body-tertiary">
      <aside
        style={{
          width: 280,
          background: '#0f172a',
          color: '#f8fafc',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>BCVS Admin</div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Credential platform</div>
        </div>

        <nav className="d-flex flex-column gap-2">
          <SidebarLink to="/">Dashboard</SidebarLink>
          {isDeveloper ? <SidebarLink to="/users">Manage Users</SidebarLink> : null}
          {canSeeSettings ? <SidebarLink to="/system-settings">System Settings</SidebarLink> : null}
        </nav>

        <div className="mt-auto border-top pt-3" style={{ borderColor: '#1e293b' }}>
          <div className="mb-2" style={{ fontSize: 14, color: '#94a3b8' }}>Signed in as</div>
          <div style={{ fontWeight: 600 }}>{user?.fullName || 'User'}</div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>{user?.role || 'unknown'}</div>
          <button className="btn btn-outline-light btn-sm mt-3" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-grow-1 p-4">
        {children}
      </main>
    </div>
  );
}
