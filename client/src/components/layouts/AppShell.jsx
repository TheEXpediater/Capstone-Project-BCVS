import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FaBars,
  FaChevronLeft,
  FaChevronRight,
  FaHome,
  FaUsers,
  FaFileContract,
  FaCog,
  FaUserCircle,
  FaSearch,
  FaSignOutAlt,
  FaBook,
} from 'react-icons/fa';
import { signOut } from '../../features/auth/authSlice';
import './app-shell.css';

function SidebarLink({ to, icon, children, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `app-sidebar-link ${isActive ? 'active' : ''}`
      }
      title={collapsed ? children : ''}
    >
      <span className="app-sidebar-icon">{icon}</span>
      {!collapsed && <span>{children}</span>}
    </NavLink>
  );
}

function Header({ user, onLogout, onToggleSidebar }) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          className="app-mobile-toggle d-lg-none"
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <FaBars />
        </button>

        <form className="app-search" onSubmit={(e) => e.preventDefault()}>
          <FaSearch className="app-search-icon" />
          <input type="text" placeholder="Search" />
        </form>
      </div>

      <div className="app-header-right">
        <div className="app-user-pill">
          <FaUserCircle className="app-user-avatar" />
          <div className="app-user-meta">
            <strong>{user?.fullName || user?.username || 'Unknown user'}</strong>
            <span>{user?.role || 'unknown'}</span>
          </div>
        </div>

        <button className="btn btn-outline-danger btn-sm" onClick={onLogout}>
          <FaSignOutAlt className="me-2" />
          Logout
        </button>
      </div>
    </header>
  );
}

export default function AppShell({ children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await dispatch(signOut());
    navigate('/login', { replace: true });
  }

  const isDeveloper = user?.role === 'developer';
  const canSeeSettings = ['developer', 'super_admin'].includes(user?.role);
  const canSeeContracts = ['developer', 'super_admin'].includes(user?.role);
  const canSeeCurriculum = ['admin', 'super_admin', 'developer'].includes(user?.role);

  const links = useMemo(() => {
    const items = [{ to: '/', label: 'Dashboard', icon: <FaHome /> }];

    if (canSeeCurriculum) {
      items.push({
        to: '/curricula',
        label: 'Curriculum Manager',
        icon: <FaBook />,
      });
    }

    if (isDeveloper) {
      items.push({ to: '/users', label: 'Manage Users', icon: <FaUsers /> });
    }

    if (canSeeContracts) {
      items.push({
        to: '/contracts',
        label: 'Contract Manager',
        icon: <FaFileContract />,
      });
    }

    if (canSeeSettings) {
      items.push({
        to: '/system-settings',
        label: 'System Settings',
        icon: <FaCog />,
      });
    }

    return items;
  }, [isDeveloper, canSeeCurriculum, canSeeContracts, canSeeSettings]);

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div
          className="app-sidebar-backdrop d-lg-none"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${
          mobileOpen ? 'mobile-open' : ''
        }`}
      >
        <button
          className="app-sidebar-toggle d-none d-lg-inline-flex"
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
        </button>

        <div className="app-sidebar-brand">
          <h4>{collapsed ? 'BCVS' : 'BCVS Admin'}</h4>
          {!collapsed && <p>Credential platform</p>}
        </div>

        <nav className="app-sidebar-nav">
          {links.map((link) => (
            <SidebarLink
              key={link.to}
              to={link.to}
              icon={link.icon}
              collapsed={collapsed}
            >
              {link.label}
            </SidebarLink>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <FaUserCircle className="app-footer-avatar" />
            {!collapsed && (
              <div>
                <div className="fw-semibold">
                  {user?.fullName || user?.username || 'Unknown user'}
                </div>
                <div className="app-role-text">{user?.role || 'unknown'}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={() => setMobileOpen((prev) => !prev)}
        />

        <div className="app-page-content">{children}</div>
      </main>
    </div>
  );
}