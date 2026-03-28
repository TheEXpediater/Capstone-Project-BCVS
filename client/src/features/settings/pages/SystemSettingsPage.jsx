import { useEffect, useState } from 'react';
import {
  getSettingsDashboard,
  updateAdminPermissions,
  updateBusinessSettings,
  updateSystemLocks,
} from '../settingsAPI';

const ROLE_OPTIONS = ['admin', 'super_admin', 'developer', 'cashier'];

const EMPTY_SETTINGS = {
  anchoring: {
    enabled: true,
    intervalDays: 7,
    autoAnchor: false,
  },
  qrDelivery: {
    allowEmail: true,
    allowedRoles: ['admin', 'super_admin'],
  },
  blockchain: {
    selectedContractId: '',
    selectedContractName: '',
    walletAddress: '',
    networkLabel: 'Local Chain',
    walletBalance: '0.0000',
  },
  locks: {
    anchorLocked: false,
    qrEmailLocked: false,
    contractLocked: false,
  },
};

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [admins, setAdmins] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [access, setAccess] = useState({
    canEditBusinessSettings: false,
    canEditSystemLocks: false,
    canEditPermissions: false,
    canViewBlockchain: false,
  });
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingLocks, setSavingLocks] = useState(false);
  const [savingUserId, setSavingUserId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await getSettingsDashboard();
      setSettings(data.settings || EMPTY_SETTINGS);
      setAdmins(data.admins || []);
      setWallet(data.wallet || null);
      setAccess(data.access || {});
      setFeedback({ type: '', text: '' });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to load settings dashboard.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function updateNested(section, field, value) {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }

  function toggleAllowedRole(role) {
    setSettings((prev) => {
      const exists = prev.qrDelivery.allowedRoles.includes(role);
      return {
        ...prev,
        qrDelivery: {
          ...prev.qrDelivery,
          allowedRoles: exists
            ? prev.qrDelivery.allowedRoles.filter((item) => item !== role)
            : [...prev.qrDelivery.allowedRoles, role],
        },
      };
    });
  }

  async function handleSaveBusiness() {
    try {
      setSavingBusiness(true);
      const updated = await updateBusinessSettings({
        anchoring: settings.anchoring,
        qrDelivery: settings.qrDelivery,
        blockchain: settings.blockchain,
      });
      setSettings((prev) => ({ ...prev, ...updated }));
      setFeedback({ type: 'success', text: 'Business settings saved.' });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to save business settings.' });
    } finally {
      setSavingBusiness(false);
    }
  }

  async function handleSaveLocks() {
    try {
      setSavingLocks(true);
      const updated = await updateSystemLocks({ locks: settings.locks });
      setSettings((prev) => ({ ...prev, locks: updated.locks }));
      setFeedback({ type: 'success', text: 'System locks saved.' });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to save system locks.' });
    } finally {
      setSavingLocks(false);
    }
  }

  function togglePermission(userId, key) {
    setAdmins((prev) =>
      prev.map((admin) =>
        admin._id === userId
          ? {
              ...admin,
              permissions: {
                ...admin.permissions,
                [key]: !admin.permissions[key],
              },
            }
          : admin
      )
    );
  }

  async function handleSaveAdmin(admin) {
    try {
      setSavingUserId(admin._id);
      const updated = await updateAdminPermissions(admin._id, admin.permissions);
      setAdmins((prev) => prev.map((item) => (item._id === admin._id ? { ...item, ...updated } : item)));
      setFeedback({ type: 'success', text: `Permissions updated for ${admin.fullName}.` });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to save admin permissions.' });
    } finally {
      setSavingUserId('');
    }
  }

  if (loading) {
    return <div className="card border-0 shadow-sm"><div className="card-body p-4">Loading settings...</div></div>;
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="h3 mb-1">System Settings</h1>
        <p className="text-muted mb-0">Super admin controls business defaults. MIS controls technical locks and permission overrides.</p>
      </div>

      {feedback.text ? <div className={`alert alert-${feedback.type}`}>{feedback.text}</div> : null}

      <div className="row g-4">
        <div className="col-xl-7">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Business Defaults</h2>

              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={settings.anchoring.enabled}
                  disabled={!access.canEditBusinessSettings}
                  onChange={(event) => updateNested('anchoring', 'enabled', event.target.checked)}
                />
                <label className="form-check-label">Enable VC anchoring</label>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Anchor every how many days?</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    className="form-control"
                    value={settings.anchoring.intervalDays}
                    disabled={!access.canEditBusinessSettings}
                    onChange={(event) => updateNested('anchoring', 'intervalDays', Number(event.target.value || 1))}
                  />
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={settings.anchoring.autoAnchor}
                      disabled={!access.canEditBusinessSettings}
                      onChange={(event) => updateNested('anchoring', 'autoAnchor', event.target.checked)}
                    />
                    <label className="form-check-label">Auto-anchor when interval is reached</label>
                  </div>
                </div>
              </div>

              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={settings.qrDelivery.allowEmail}
                  disabled={!access.canEditBusinessSettings}
                  onChange={(event) => updateNested('qrDelivery', 'allowEmail', event.target.checked)}
                />
                <label className="form-check-label">Allow QR delivery by email</label>
              </div>

              <div className="row g-2 mb-3">
                {ROLE_OPTIONS.map((role) => (
                  <div className="col-md-6" key={role}>
                    <label className="border rounded p-3 w-100 d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.qrDelivery.allowedRoles.includes(role)}
                        disabled={!access.canEditBusinessSettings}
                        onChange={() => toggleAllowedRole(role)}
                      />
                      <span className="text-capitalize">{role.replace('_', ' ')}</span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Selected contract ID</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.selectedContractId || ''}
                    disabled={!access.canEditBusinessSettings}
                    onChange={(event) => updateNested('blockchain', 'selectedContractId', event.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Selected contract name</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.selectedContractName || ''}
                    disabled={!access.canEditBusinessSettings}
                    onChange={(event) => updateNested('blockchain', 'selectedContractName', event.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Wallet address</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.walletAddress || ''}
                    disabled={!access.canEditBusinessSettings}
                    onChange={(event) => updateNested('blockchain', 'walletAddress', event.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Network label</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.networkLabel || ''}
                    disabled={!access.canEditBusinessSettings}
                    onChange={(event) => updateNested('blockchain', 'networkLabel', event.target.value)}
                  />
                </div>
              </div>

              {access.canEditBusinessSettings ? (
                <div className="mt-4 d-flex justify-content-end">
                  <button className="btn btn-primary" onClick={handleSaveBusiness} disabled={savingBusiness}>
                    {savingBusiness ? 'Saving...' : 'Save Business Settings'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h2 className="h5 mb-1">MIS Technical Locks</h2>
                  <p className="text-muted mb-0">These switches let MIS temporarily block anchoring, QR email, or contract actions system-wide.</p>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-check form-switch border rounded p-3 w-100">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={settings.locks.anchorLocked}
                      disabled={!access.canEditSystemLocks}
                      onChange={(event) => updateNested('locks', 'anchorLocked', event.target.checked)}
                    />
                    <span className="form-check-label ms-2">Lock Anchoring</span>
                  </label>
                </div>
                <div className="col-md-4">
                  <label className="form-check form-switch border rounded p-3 w-100">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={settings.locks.qrEmailLocked}
                      disabled={!access.canEditSystemLocks}
                      onChange={(event) => updateNested('locks', 'qrEmailLocked', event.target.checked)}
                    />
                    <span className="form-check-label ms-2">Lock QR Email</span>
                  </label>
                </div>
                <div className="col-md-4">
                  <label className="form-check form-switch border rounded p-3 w-100">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={settings.locks.contractLocked}
                      disabled={!access.canEditSystemLocks}
                      onChange={(event) => updateNested('locks', 'contractLocked', event.target.checked)}
                    />
                    <span className="form-check-label ms-2">Lock Contracts</span>
                  </label>
                </div>
              </div>

              {access.canEditSystemLocks ? (
                <div className="mt-4 d-flex justify-content-end">
                  <button className="btn btn-dark" onClick={handleSaveLocks} disabled={savingLocks}>
                    {savingLocks ? 'Saving...' : 'Save Technical Locks'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-xl-5">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Developer / MIS View</h2>
              {access.canViewBlockchain ? (
                <div className="d-flex flex-column gap-3">
                  <div>
                    <small className="text-muted d-block">Current Contract</small>
                    <div className="fw-semibold">{wallet?.selectedContractName || 'Not selected yet'}</div>
                    <div className="text-muted small">{wallet?.selectedContractId || 'No contract id yet'}</div>
                  </div>
                  <div>
                    <small className="text-muted d-block">Wallet Address</small>
                    <div className="fw-semibold text-break">{wallet?.walletAddress || 'No wallet configured'}</div>
                  </div>
                  <div>
                    <small className="text-muted d-block">Wallet Balance</small>
                    <div className="fw-semibold">{wallet?.walletBalance || '0.0000'} ETH</div>
                  </div>
                  <div>
                    <small className="text-muted d-block">Network</small>
                    <div className="fw-semibold">{wallet?.networkLabel || 'Local Chain'}</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted mb-0">You do not have access to blockchain visibility.</p>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 mb-1">Permission Overrides</h2>
              <p className="text-muted mb-3">MIS can override per-user permissions on top of the role defaults saved in code.</p>

              {!access.canEditPermissions ? (
                <div className="alert alert-light border">Only the MIS developer can edit permission overrides.</div>
              ) : null}

              <div className="d-flex flex-column gap-3">
                {admins.map((admin) => (
                  <div className="border rounded-3 p-3" key={admin._id}>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <div className="fw-semibold">{admin.fullName}</div>
                        <div className="text-muted small">{admin.email}</div>
                      </div>
                      <span className="badge text-bg-secondary text-uppercase">{admin.role}</span>
                    </div>

                    <div className="row g-2">
                      {Object.entries(admin.permissions).map(([key, value]) => (
                        <div className="col-md-6" key={key}>
                          <label className="form-check form-switch border rounded p-2 w-100 h-100">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={Boolean(value)}
                              disabled={!access.canEditPermissions}
                              onChange={() => togglePermission(admin._id, key)}
                            />
                            <span className="form-check-label small ms-2">{key}</span>
                          </label>
                        </div>
                      ))}
                    </div>

                    {access.canEditPermissions ? (
                      <div className="mt-3 d-flex justify-content-end">
                        <button className="btn btn-outline-primary btn-sm" disabled={savingUserId === admin._id} onClick={() => handleSaveAdmin(admin)}>
                          {savingUserId === admin._id ? 'Saving...' : 'Save Permissions'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
