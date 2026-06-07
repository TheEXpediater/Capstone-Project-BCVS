import { useEffect, useMemo, useState } from 'react';
import { FaCopy, FaSyncAlt } from 'react-icons/fa';
import { createWebUser, listUsers } from '../usersAPI';

const EMPTY_FORM = {
  username: '',
  fullName: '',
  email: '',
  password: '',
  role: 'admin',
  contactNo: '',
  address: '',
  profilePicture: '',
};

const EMPTY_FILTERS = {
  accountType: 'all',
  role: 'all',
  status: 'all',
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
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatBadgeClass(kind, value) {
  if (kind === 'status') {
    if (value === 'active') return 'text-bg-success';
    if (value === 'inactive') return 'text-bg-secondary';
    return 'text-bg-warning';
  }

  if (kind === 'accountType') {
    return value === 'mobile' ? 'text-bg-info' : 'text-bg-dark';
  }

  return 'text-bg-secondary';
}

function normalizeUserFromCreate(user) {
  if (!user) return null;

  return {
    id: String(user._id || user.id || ''),
    fullName: user.fullName || user.username || '',
    email: user.email || '',
    accountType: user.kind || 'web',
    role: user.role || 'admin',
    status: user.isActive ? 'active' : 'inactive',
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyingId, setCopyingId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await listUsers(filters);
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [filters.accountType, filters.role, filters.status]);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      const created = await createWebUser({
        ...form,
        email: form.email.trim().toLowerCase(),
      });
      const normalized = normalizeUserFromCreate(created);
      setUsers((prev) => (normalized ? [normalized, ...prev] : prev));
      setForm(EMPTY_FORM);
      setFeedback({ type: 'success', text: 'Web user created successfully.' });
      await loadUsers();
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to create user.' });
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

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="h3 mb-1">User Management</h1>
        <p className="text-muted mb-0">
          Unified view of mobile users and web admin users.
        </p>
      </div>

      {feedback.text ? <div className={`alert alert-${feedback.type}`}>{feedback.text}</div> : null}

      <div className="row g-4">
        <div className="col-xl-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Create Web User</h2>
              <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                <div>
                  <label className="form-label">Username</label>
                  <input className="form-control" name="username" value={form.username} onChange={handleFormChange} required />
                </div>
                <div>
                  <label className="form-label">Full name</label>
                  <input className="form-control" name="fullName" value={form.fullName} onChange={handleFormChange} required />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" name="email" value={form.email} onChange={handleFormChange} required />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" name="password" value={form.password} onChange={handleFormChange} required />
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <select className="form-select" name="role" value={form.role} onChange={handleFormChange}>
                    <option value="super_admin">Super Admin</option>
                    <option value="developer">Developer / MIS</option>
                    <option value="admin">Admin</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Contact number</label>
                  <input className="form-control" name="contactNo" value={form.contactNo} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <input className="form-control" name="address" value={form.address} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="form-label">Profile picture URL</label>
                  <input className="form-control" name="profilePicture" value={form.profilePicture} onChange={handleFormChange} />
                </div>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Unified Users</h2>
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
                  <select className="form-select" name="accountType" value={filters.accountType} onChange={handleFilterChange}>
                    <option value="all">All Users</option>
                    <option value="mobile">Mobile Users</option>
                    <option value="web">Web Users</option>
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
                  <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
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
                      <tr>
                        <th>User ID</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Account Type</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Created Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center text-muted py-4">
                            No users found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => {
                          const userId = user.id || user._id;
                          const accountType = user.accountType || 'web';
                          const role = user.role || 'admin';
                          const status = user.status || 'active';

                          return (
                            <tr key={userId}>
                              <td className="text-muted small">{userId}</td>
                              <td>{user.fullName || '—'}</td>
                              <td>{user.email || '—'}</td>
                              <td>
                                <span className={`badge ${formatBadgeClass('accountType', accountType)} text-uppercase`}>
                                  {ACCOUNT_TYPE_LABELS[accountType] || accountType}
                                </span>
                              </td>
                              <td>{ROLE_LABELS[role] || role}</td>
                              <td>
                                <span className={`badge ${formatBadgeClass('status', status)} text-uppercase`}>
                                  {STATUS_LABELS[status] || status}
                                </span>
                              </td>
                              <td>{formatDate(user.createdAt)}</td>
                              <td>
                                <div className="d-flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => copyToClipboard(userId, 'User ID')}
                                  >
                                    <FaCopy className="me-2" />
                                    {copyingId === String(userId) ? 'Copied' : 'Copy ID'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => copyToClipboard(user.email || '', 'Email')}
                                  >
                                    <FaCopy className="me-2" />
                                    Copy Email
                                  </button>
                                </div>
                              </td>
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
        </div>
      </div>
    </div>
  );
}
