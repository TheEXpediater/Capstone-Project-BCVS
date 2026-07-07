import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FaBars,
  FaChevronLeft,
  FaChevronRight,
  FaHome,
  FaUsers,
  FaFileContract,
  FaCog,
  FaBook,
  FaUserGraduate,
  FaFileSignature,
  FaShieldAlt,
} from 'react-icons/fa';
import PasswordResetModal from '../PasswordResetModal';
import UserDropdown from '../UserDropdown';
import { signOut } from '../../features/auth/authSlice';
import { updateWebPassword } from '../../features/profile/profileAPI';
import {
  getTodaysAnchorQueueSummary,
  processTodaysAnchorQueue,
} from '../../features/credentials/credentialsAPI';
import { formatRole } from '../../features/profile/roleLabels';
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

const PAGE_TITLES = [
  { path: '/students', title: 'Student Records' },
  { path: '/link-accounts', title: 'Link Accounts' },
  { path: '/credentials', title: 'VC' },
  { path: '/curricula', title: 'Curriculum Manager' },
  { path: '/users', title: 'Manage Users' },
  { path: '/contracts', title: 'Contract Manager' },
  { path: '/system-settings', title: 'System Settings' },
  { path: '/profile', title: 'Profile' },
  { path: '/', title: 'Dashboard' },
];

function getPageTitle(pathname) {
  const match = PAGE_TITLES.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)
  );

  return match?.title || 'BCVS';
}

function Header({ user, pageTitle, onLogout, onResetPassword, onToggleSidebar }) {
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
      </div>

      <div className="app-header-title">
        <h1>{pageTitle}</h1>
      </div>

      <div className="app-header-right">
        <UserDropdown user={user} onLogout={onLogout} onResetPassword={onResetPassword} />
      </div>
    </header>
  );
}

export default function AppShell({ children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutQueue, setLogoutQueue] = useState(null);
  const [logoutQueueResult, setLogoutQueueResult] = useState(null);
  const [logoutError, setLogoutError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  async function performLogout() {
    await dispatch(signOut());
    navigate('/login', { replace: true });
  }

  async function continueLogoutAfterConfirmation() {
    setLogoutConfirmOpen(false);

    if (['admin', 'super_admin', 'developer'].includes(user?.role)) {
      const summary = await getTodaysAnchorQueueSummary().catch(() => null);

      if (summary?.pendingCount > 0) {
        setLogoutQueue(summary);
        return;
      }
    }

    await performLogout();
  }

  function handleLogout() {
    setLogoutConfirmOpen(true);
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

  async function handlePasswordSubmit(payload) {
    try {
      setPasswordBusy(true);
      setPasswordError('');
      setPasswordSuccess('');
      await updateWebPassword(payload);
      setPasswordSuccess('Password updated successfully.');
    } catch (error) {
      setPasswordError(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to update password.'
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  const isDeveloper = user?.role === 'developer';
  
  const canSeeSettings = user?.role === 'developer';
  const canSeeContracts = ['developer', 'super_admin'].includes(user?.role);
  const canSeeCurriculum = ['admin', 'super_admin', 'developer'].includes(user?.role);
  const canSeeStudents = ['admin', 'super_admin', 'developer'].includes(user?.role);
  const canSeeCredentialDrafts = ['admin', 'super_admin', 'developer', 'cashier'].includes(user?.role);
  const pageTitle = getPageTitle(location.pathname);

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
  }, [
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
          <div className="app-sidebar-status">
            <span className="app-sidebar-status-icon">
              <FaShieldAlt />
            </span>
            {!collapsed && (
              <div>
                <div className="fw-semibold">Secure session</div>
                <div className="app-role-text">{formatRole(user?.role)}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          user={user}
          pageTitle={pageTitle}
          onLogout={handleLogout}
          onResetPassword={() => setPasswordModalOpen(true)}
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

      {logoutConfirmOpen ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h2 className="h5 mb-0">Sign Out</h2>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setLogoutConfirmOpen(false)}
                    aria-label="Close"
                  />
                </div>
                <div className="modal-body">
                  Are you sure you want to sign out?
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setLogoutConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={continueLogoutAfterConfirmation}>
                    Sign Out
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

      <PasswordResetModal
        open={passwordModalOpen}
        busy={passwordBusy}
        error={passwordError}
        success={passwordSuccess}
        onClose={() => {
          setPasswordModalOpen(false);
          setPasswordError('');
          setPasswordSuccess('');
        }}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
}
