import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaCopy, FaSyncAlt } from 'react-icons/fa';
import { createMobileUser, createWebUser, listUsers } from '../usersAPI';

const EMPTY_FILTERS = {
  accountType: 'web',
  role: 'all',
  status: 'all',
};

const EMPTY_WEB_FORM = {
  fullName: '',
  email: '',
  password: '',
  role: 'admin',
  isActive: true,
};

const EMPTY_MOBILE_FORM = {
  fullName: '',
  email: '',
  password: '',
  studentId: '',
  isActive: true,
};

const ACCOUNT_TYPE_LABELS = {
  mobile: 'Mobile User',
  web: 'Web User',
};

const ROLE_LABELS = {
  student: 'Student',
  admin: 'Admin',
  super_admin: 'Super Admin',
  developer: 'Developer',
  cashier: 'Cashier',
};

const STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function badgeClass(kind, value) {
  if (kind === 'status') {
    if (value === 'active') return 'text-bg-success';
    if (value === 'inactive') return 'text-bg-secondary';
    return 'text-bg-warning';
  }

  if (kind === 'accountType') {
    return value === 'mobile' ? 'text-bg-info' : 'text-bg-dark';
  }

  if (kind === 'verification') {
    return value === 'verified' ? 'text-bg-success' : 'text-bg-warning';
  }

  if (kind === 'linked') {
    return value === 'linked' ? 'text-bg-success' : 'text-bg-secondary';
  }

  return 'text-bg-secondary';
}

function formatVerificationStatus(user) {
  return String(user.verificationStatus || user.verified || 'unverified').toLowerCase();
}

function formatLinkedStatus(user) {
  return String(user.linkedStatus || (user.studentId ? 'linked' : 'unlinked')).toLowerCase();
}

function AccountStatusBadge({ status }) {
  const value = status || 'active';

  return (
    <span className={`badge ${badgeClass('status', value)} text-uppercase`}>
      {STATUS_LABELS[value] || value}
    </span>
  );
}

function CopyActions({ user, copyingId, onCopy }) {
  const userId = user.id || user._id;

  return (
    <div className="d-flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => onCopy(userId, 'User ID')}
      >
        <FaCopy className="me-2" />
        {copyingId === String(userId) ? 'Copied' : 'Copy ID'}
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => onCopy(user.email || '', 'Email')}
      >
        <FaCopy className="me-2" />
        Copy Email
      </button>
    </div>
  );
}

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState('view');
  const [createTab, setCreateTab] = useState('web');
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [webForm, setWebForm] = useState(EMPTY_WEB_FORM);
  const [mobileForm, setMobileForm] = useState(EMPTY_MOBILE_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyingId, setCopyingId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listUsers(filters);
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleWebChange(event) {
    const { name, type, checked, value } = event.target;
    setWebForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleMobileChange(event) {
    const { name, type, checked, value } = event.target;
    setMobileForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleCreateWeb(event) {
    event.preventDefault();

    try {
      setSaving(true);
      await createWebUser({
        ...webForm,
        email: webForm.email.trim().toLowerCase(),
      });
      setWebForm(EMPTY_WEB_FORM);
      setFeedback({ type: 'success', text: 'Web user created successfully.' });
      setActiveTab('view');
      setFilters((prev) => ({ ...prev, accountType: 'web', role: 'all' }));
      await loadUsers();
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to create web user.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateMobile(event) {
    event.preventDefault();

    try {
      setSaving(true);
      await createMobileUser({
        ...mobileForm,
        email: mobileForm.email.trim().toLowerCase(),
      });
      setMobileForm(EMPTY_MOBILE_FORM);
      setFeedback({ type: 'success', text: 'Mobile user created successfully.' });
      setActiveTab('view');
      setFilters((prev) => ({ ...prev, accountType: 'mobile', role: 'student' }));
      await loadUsers();
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to create mobile user.' });
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard(value, label) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(String(value));
      setCopyingId(String(value));
      setFeedback({ type: 'success', text: `${label} copied to clipboard.` });
      window.setTimeout(() => setCopyingId(''), 1200);
    } catch {
      setFeedback({ type: 'danger', text: `Could not copy ${label.toLowerCase()}.` });
    }
  }

  const totalCount = useMemo(() => users.length, [users]);
  const isWebView = filters.accountType === 'web';
  const isMobileView = filters.accountType === 'mobile';

  return (
    <div className="d-flex flex-column gap-4">
      {feedback.text ? <div className={`alert alert-${feedback.type}`}>{feedback.text}</div> : null}

      <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn ${activeTab === 'view' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setActiveTab('view')}
        >
          View Users
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setActiveTab('create')}
        >
          Create Users
        </button>
      </div>

      {activeTab === 'view' ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">View Users</h2>
                <div className="text-muted small">{totalCount} users loaded</div>
              </div>

              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={loadUsers}>
                <FaSyncAlt className="me-2" />
                Refresh
              </button>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Account Type</label>
                <select
                  className="form-select"
                  name="accountType"
                  value={filters.accountType}
                  onChange={handleFilterChange}
                >
                  <option value="web">Web Users</option>
                  <option value="mobile">Mobile Users</option>
                  <option value="all">All Users</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Role</label>
                <select className="form-select" name="role" value={filters.role} onChange={handleFilterChange}>
                  <option value="all">All Roles</option>
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="developer">Developer</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="text-muted mb-0">Loading users...</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    {isWebView ? (
                      <tr>
                        <th>User ID</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Created Date</th>
                        <th>Actions</th>
                      </tr>
                    ) : isMobileView ? (
                      <tr>
                        <th>User ID</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Student ID</th>
                        <th>Verification</th>
                        <th>Linked</th>
                        <th>Status</th>
                        <th>Created Date</th>
                        <th>Actions</th>
                      </tr>
                    ) : (
                      <tr>
                        <th>User ID</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Account Type</th>
                        <th>Role</th>
                        <th>Student ID</th>
                        <th>Verification</th>
                        <th>Linked</th>
                        <th>Status</th>
                        <th>Created Date</th>
                        <th>Actions</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={isWebView ? 7 : isMobileView ? 9 : 11} className="text-center text-muted py-4">
                          No users found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => {
                        const userId = user.id || user._id;
                        const accountType = user.accountType || 'web';
                        const role = user.role || 'admin';
                        const status = user.status || 'active';
                        const verificationStatus = formatVerificationStatus(user);
                        const linkedStatus = formatLinkedStatus(user);

                        if (isWebView) {
                          return (
                            <tr key={userId}>
                              <td className="text-muted small">{userId}</td>
                              <td>{user.fullName || '-'}</td>
                              <td>{user.email || '-'}</td>
                              <td>{ROLE_LABELS[role] || role}</td>
                              <td><AccountStatusBadge status={status} /></td>
                              <td>{formatDate(user.createdAt)}</td>
                              <td><CopyActions user={user} copyingId={copyingId} onCopy={copyToClipboard} /></td>
                            </tr>
                          );
                        }

                        if (isMobileView) {
                          return (
                            <tr key={userId}>
                              <td className="text-muted small">{userId}</td>
                              <td>{user.fullName || '-'}</td>
                              <td>{user.email || '-'}</td>
                              <td>{user.studentId || 'Not linked'}</td>
                              <td>
                                <span className={`badge ${badgeClass('verification', verificationStatus)} text-uppercase`}>
                                  {verificationStatus}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${badgeClass('linked', linkedStatus)} text-uppercase`}>
                                  {linkedStatus}
                                </span>
                              </td>
                              <td><AccountStatusBadge status={status} /></td>
                              <td>{formatDate(user.createdAt)}</td>
                              <td><CopyActions user={user} copyingId={copyingId} onCopy={copyToClipboard} /></td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={userId}>
                            <td className="text-muted small">{userId}</td>
                            <td>{user.fullName || '-'}</td>
                            <td>{user.email || '-'}</td>
                            <td>
                              <span className={`badge ${badgeClass('accountType', accountType)} text-uppercase`}>
                                {ACCOUNT_TYPE_LABELS[accountType] || accountType}
                              </span>
                            </td>
                            <td>{ROLE_LABELS[role] || role}</td>
                            <td>{user.studentId || '-'}</td>
                            <td>
                              {accountType === 'mobile' ? (
                                <span className={`badge ${badgeClass('verification', verificationStatus)} text-uppercase`}>
                                  {verificationStatus}
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              {accountType === 'mobile' ? (
                                <span className={`badge ${badgeClass('linked', linkedStatus)} text-uppercase`}>
                                  {linkedStatus}
                                </span>
                              ) : '-'}
                            </td>
                            <td><AccountStatusBadge status={status} /></td>
                            <td>{formatDate(user.createdAt)}</td>
                            <td><CopyActions user={user} copyingId={copyingId} onCopy={copyToClipboard} /></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'create' ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Create Users</h2>
                <p className="text-muted mb-0">Create a web staff account or a mobile student account.</p>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${createTab === 'web' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setCreateTab('web')}
                >
                  Create Web User
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${createTab === 'mobile' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setCreateTab('mobile')}
                >
                  Create Mobile User
                </button>
              </div>
            </div>

            {createTab === 'web' ? (
              <form onSubmit={handleCreateWeb} className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" name="fullName" value={webForm.fullName} onChange={handleWebChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" name="email" value={webForm.email} onChange={handleWebChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" name="password" value={webForm.password} onChange={handleWebChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Role</label>
                  <select className="form-select" name="role" value={webForm.role} onChange={handleWebChange}>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="developer">Developer / MIS</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="isActive"
                      checked={webForm.isActive}
                      onChange={handleWebChange}
                    />
                    <span className="form-check-label">Account active</span>
                  </label>
                </div>
                <div className="col-12 d-flex justify-content-end">
                  <button className="btn btn-primary" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Web User'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateMobile} className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" name="fullName" value={mobileForm.fullName} onChange={handleMobileChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" name="email" value={mobileForm.email} onChange={handleMobileChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" name="password" value={mobileForm.password} onChange={handleMobileChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Student ID / Student No</label>
                  <input className="form-control" name="studentId" value={mobileForm.studentId} onChange={handleMobileChange} placeholder="Optional" />
                  <div className="form-text">Verification defaults to unverified. Manual Link Accounts can still link official records.</div>
                </div>
                <div className="col-12">
                  <label className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="isActive"
                      checked={mobileForm.isActive}
                      onChange={handleMobileChange}
                    />
                    <span className="form-check-label">Account active</span>
                  </label>
                </div>
                <div className="col-12 d-flex justify-content-end">
                  <button className="btn btn-primary" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Mobile User'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
