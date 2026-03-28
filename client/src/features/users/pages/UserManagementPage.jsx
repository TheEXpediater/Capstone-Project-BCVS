import { useEffect, useState } from 'react';
import { createWebUser, listWebUsers } from '../usersAPI';

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

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await listWebUsers();
      setUsers(data);
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      const created = await createWebUser({
        ...form,
        email: form.email.trim().toLowerCase(),
      });
      setUsers((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setFeedback({ type: 'success', text: 'Web user created successfully.' });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to create user.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="h3 mb-1">Manage Web Users</h1>
        <p className="text-muted mb-0">MIS creates super admin, developer, admin, and cashier accounts from here.</p>
      </div>

      {feedback.text ? <div className={`alert alert-${feedback.type}`}>{feedback.text}</div> : null}

      <div className="row g-4">
        <div className="col-xl-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Create Account</h2>
              <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                <div>
                  <label className="form-label">Username</label>
                  <input className="form-control" name="username" value={form.username} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Full name</label>
                  <input className="form-control" name="fullName" value={form.fullName} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" name="email" value={form.email} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" name="password" value={form.password} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                    <option value="super_admin">Super Admin</option>
                    <option value="developer">Developer / MIS</option>
                    <option value="admin">Admin</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Contact number</label>
                  <input className="form-control" name="contactNo" value={form.contactNo} onChange={handleChange} />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <input className="form-control" name="address" value={form.address} onChange={handleChange} />
                </div>
                <div>
                  <label className="form-label">Profile picture URL</label>
                  <input className="form-control" name="profilePicture" value={form.profilePicture} onChange={handleChange} />
                </div>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Existing Web Users</h2>
              {loading ? (
                <p className="text-muted mb-0">Loading users...</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td>
                            <div className="fw-semibold">{user.fullName}</div>
                            <div className="text-muted small">{user.username}</div>
                          </td>
                          <td>{user.email}</td>
                          <td><span className="badge text-bg-secondary text-uppercase">{user.role}</span></td>
                          <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
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
