import { useMemo, useState } from 'react';
import { FaCheckCircle, FaKey, FaTimesCircle } from 'react-icons/fa';

const initialForm = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function passwordChecks(password) {
  return [
    { key: 'length', label: 'At least 8 characters', ok: password.length >= 8 },
    { key: 'lower', label: 'One lowercase letter', ok: /[a-z]/.test(password) },
    { key: 'upper', label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { key: 'number', label: 'One number', ok: /[0-9]/.test(password) },
  ];
}

export default function PasswordResetModal({ open, busy = false, error = '', success = '', onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);
  const checks = useMemo(() => passwordChecks(form.newPassword), [form.newPassword]);
  const strengthOk = checks.every((item) => item.ok);
  const passwordsMatch = form.newPassword && form.newPassword === form.confirmPassword;
  const passwordChanged = form.oldPassword && form.oldPassword !== form.newPassword;
  const canSubmit = form.oldPassword && strengthOk && passwordsMatch && passwordChanged && !busy;

  if (!open) return null;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit?.(form);
  }

  function handleClose() {
    setForm(initialForm);
    onClose?.();
  }

  return (
    <>
      <div className="modal d-block enterprise-modal" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content border-0 shadow" onSubmit={handleSubmit}>
            <div className="modal-header">
              <div className="d-flex align-items-center gap-3">
                <div className="modal-icon">
                  <FaKey />
                </div>
                <div>
                  <h2 className="h5 mb-1">Reset Password</h2>
                  <p className="text-muted small mb-0">Update the password for your signed-in account.</p>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={handleClose} disabled={busy} aria-label="Close" />
            </div>
            <div className="modal-body">
              {error ? <div className="alert alert-danger">{error}</div> : null}
              {success ? <div className="alert alert-success">{success}</div> : null}

              <div className="mb-3">
                <label className="form-label" htmlFor="oldPassword">Old Password</label>
                <input
                  id="oldPassword"
                  name="oldPassword"
                  className="form-control"
                  type="password"
                  value={form.oldPassword}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  className="form-control"
                  type="password"
                  value={form.newPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="password-rules mb-3">
                {checks.map((item) => (
                  <div className={item.ok ? 'ok' : ''} key={item.key}>
                    {item.ok ? <FaCheckCircle /> : <FaTimesCircle />}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="mb-0">
                <label className="form-label" htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  className="form-control"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                {form.confirmPassword && !passwordsMatch ? (
                  <div className="form-text text-danger">Confirm password must match the new password.</div>
                ) : null}
                {form.newPassword && !passwordChanged ? (
                  <div className="form-text text-danger">New password must be different from the old password.</div>
                ) : null}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" type="button" onClick={handleClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                {busy ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
