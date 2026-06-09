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
  FaUserGraduate,
  FaFileSignature,
} from 'react-icons/fa';
import { signOut } from '../../features/auth/authSlice';
import {
  getTodaysAnchorQueueSummary,
  processTodaysAnchorQueue,
} from '../../features/credentials/credentialsAPI';
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
  const [logoutQueue, setLogoutQueue] = useState(null);
  const [logoutQueueResult, setLogoutQueueResult] = useState(null);
  const [logoutError, setLogoutError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);

  async function performLogout() {
    await dispatch(signOut());
    navigate('/login', { replace: true });
  }

  async function handleLogout() {
    if (['admin', 'super_admin', 'developer'].includes(user?.role)) {
      const summary = await getTodaysAnchorQueueSummary().catch(() => null);

      if (summary?.pendingCount > 0) {
        setLogoutQueue(summary);
        return;
      }
    }

    await performLogout();
  }

  async function processQueueBeforeLogout() {
    try {
      setLogoutBusy(true);
      setLogoutError('');
      const result = await processTodaysAnchorQueue();
      setLogoutQueue(null);
      setLogoutQueueResult(result);
    } catch (error) {
      setLogoutError(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to process the anchor queue.'
      );
    } finally {
      setLogoutBusy(false);
    }
  }

  const isDeveloper = user?.role === 'developer';
  const canSeeSettings = isDeveloper;
  const canSeeContracts = isDeveloper;
  const canSeeCurriculum = ['admin', 'super_admin', 'developer'].includes(user?.role);
  const canSeeStudents = ['admin', 'super_admin', 'developer'].includes(user?.role);
  const canSeeCredentialDrafts = ['admin', 'super_admin', 'cashier'].includes(user?.role);

  const links = useMemo(() => {
    const items = [{ to: '/', label: 'Dashboard', icon: <FaHome /> }];

    if (canSeeStudents) {
      items.push({
        to: '/students',
        label: 'Student Records',
        icon: <FaUserGraduate />,
      });
      items.push({
        to: '/link-accounts',
        label: 'Link Accounts',
        icon: <FaUsers />,
      });
    }

    if (canSeeCredentialDrafts) {
      items.push({
        to: '/credentials',
        label: 'VC',
        icon: <FaFileSignature />,
      });
    }

    if (canSeeCurriculum) {
      items.push({
        to: '/curricula',
        label: 'Curriculum Manager',
        icon: <FaBook />,
      });
    }

    if (isDeveloper || user?.role === 'super_admin') {
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
  }, [
    user?.role,
    isDeveloper,
    canSeeStudents,
    canSeeCredentialDrafts,
    canSeeCurriculum,
    canSeeContracts,
    canSeeSettings,
  ]);

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

      {logoutQueue ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <div>
                    <h2 className="h5 mb-1">Anchor queue pending</h2>
                    <p className="text-muted mb-0 small">
                      You have credentials queued for anchoring today.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setLogoutQueue(null)}
                    disabled={logoutBusy}
                    aria-label="Close"
                  />
                </div>
                <div className="modal-body">
                  {logoutError ? (
                    <div className="alert alert-danger">{logoutError}</div>
                  ) : null}
                  <div className="alert alert-light border mb-0">
                    {logoutQueue.pendingCount} credential(s) are due today or earlier. Do you want
                    to process them before logging out?
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setLogoutQueue(null)}
                    disabled={logoutBusy}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={performLogout}
                    disabled={logoutBusy}
                  >
                    Log out anyway
                  </button>
                  <button
                    className="btn btn-warning"
                    onClick={processQueueBeforeLogout}
                    disabled={logoutBusy}
                  >
                    {logoutBusy ? 'Processing...' : 'Process Queue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}

      {logoutQueueResult ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h2 className="h5 mb-0">Anchor queue result</h2>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-4">
                      <div className="border rounded-3 p-3 text-center">
                        <div className="small text-muted">Processed</div>
                        <div className="h4 mb-0">{logoutQueueResult.processedCount || 0}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="border rounded-3 p-3 text-center">
                        <div className="small text-muted">Failed</div>
                        <div className="h4 mb-0">{logoutQueueResult.failedCount || 0}</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="border rounded-3 p-3 text-center">
                        <div className="small text-muted">Skipped</div>
                        <div className="h4 mb-0">{logoutQueueResult.skippedCount || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setLogoutQueueResult(null)}
                  >
                    Stay
                  </button>
                  <button className="btn btn-danger" onClick={performLogout}>
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
    </div>
  );
}
