import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  getSettingsDashboard,
  updateAdminPermissions,
  updateSystemSettings,
} from '../settingsAPI';

const ROLE_OPTIONS = ['admin', 'super_admin', 'developer'];

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
  },
};

export default function SystemSettingsPage() {
  const reduxUser = useSelector((state) => state.auth?.user);
  const fallbackUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (_error) {
      return null;
    }
  }, []);
  const currentUser = reduxUser || fallbackUser;

  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [admins, setAdmins] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [access, setAccess] = useState({
    canEditSettings: false,
    canEditPermissions: false,
    canViewBlockchain: false,
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
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

  function updateNestedSetting(section, field, value) {
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

  async function handleSaveSettings() {
    try {
      setSavingSettings(true);
      const updated = await updateSystemSettings(settings);
      setSettings(updated);
      setFeedback({ type: 'success', text: 'System settings saved.' });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to save settings.' });
    } finally {
      setSavingSettings(false);
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
      setFeedback({ type: 'success', text: `Permissions updated for ${admin.name}.` });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to save admin permissions.' });
    } finally {
      setSavingUserId('');
    }
  }

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">Loading system settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">System Settings</h2>
          <p className="text-muted mb-0">
            Manage anchoring defaults, QR email permissions, and technical blockchain visibility.
          </p>
        </div>
        <span className="badge text-bg-dark text-uppercase">{currentUser?.role || 'unknown'}</span>
      </div>

      {feedback.text ? (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.text}
        </div>
      ) : null}

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 className="mb-1">Anchoring Defaults</h5>
                  <p className="text-muted mb-0">Super admin controls how often credential anchoring is expected to happen.</p>
                </div>
              </div>

              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={settings.anchoring.enabled}
                  disabled={!access.canEditSettings}
                  onChange={(event) => updateNestedSetting('anchoring', 'enabled', event.target.checked)}
                />
                <label className="form-check-label">Enable VC anchoring</label>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Anchor every how many days?</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    className="form-control"
                    value={settings.anchoring.intervalDays}
                    disabled={!access.canEditSettings}
                    onChange={(event) => updateNestedSetting('anchoring', 'intervalDays', Number(event.target.value || 1))}
                  />
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <div className="form-check form-switch mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={settings.anchoring.autoAnchor}
                      disabled={!access.canEditSettings}
                      onChange={(event) => updateNestedSetting('anchoring', 'autoAnchor', event.target.checked)}
                    />
                    <label className="form-check-label">Auto-anchor when interval is reached</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <h5 className="mb-1">QR Delivery Defaults</h5>
              <p className="text-muted mb-3">
                Super admin decides if QR/mobile delivery can be sent by email and which roles are allowed to send it.
              </p>

              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={settings.qrDelivery.allowEmail}
                  disabled={!access.canEditSettings}
                  onChange={(event) => updateNestedSetting('qrDelivery', 'allowEmail', event.target.checked)}
                />
                <label className="form-check-label">Allow QR delivery by email</label>
              </div>

              <div className="row g-2">
                {ROLE_OPTIONS.map((role) => (
                  <div className="col-md-4" key={role}>
                    <label className="border rounded p-3 w-100 d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.qrDelivery.allowedRoles.includes(role)}
                        disabled={!access.canEditSettings}
                        onChange={() => toggleAllowedRole(role)}
                      />
                      <span className="text-capitalize">{role.replace('_', ' ')}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h5 className="mb-1">Blockchain Defaults</h5>
              <p className="text-muted mb-3">These values tell the system which contract and wallet are currently active.</p>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Selected contract ID</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.selectedContractId || ''}
                    disabled={!access.canEditSettings}
                    onChange={(event) => updateNestedSetting('blockchain', 'selectedContractId', event.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Selected contract name</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.selectedContractName || ''}
                    disabled={!access.canEditSettings}
                    onChange={(event) => updateNestedSetting('blockchain', 'selectedContractName', event.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Wallet address</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.walletAddress || ''}
                    disabled={!access.canEditSettings}
                    onChange={(event) => updateNestedSetting('blockchain', 'walletAddress', event.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Network label</label>
                  <input
                    className="form-control"
                    value={settings.blockchain.networkLabel || ''}
                    disabled={!access.canEditSettings}
                    onChange={(event) => updateNestedSetting('blockchain', 'networkLabel', event.target.value)}
                  />
                </div>
              </div>

              {access.canEditSettings ? (
                <div className="mt-4 d-flex justify-content-end">
                  <button type="button" className="btn btn-primary" disabled={savingSettings} onClick={handleSaveSettings}>
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <h5 className="mb-3">Developer / MIS View</h5>
              {access.canViewBlockchain ? (
                <>
                  <div className="mb-3">
                    <small className="text-muted d-block">Current Contract</small>
                    <div className="fw-semibold">{wallet?.selectedContractName || 'Not selected yet'}</div>
                    <div className="text-muted small">{wallet?.selectedContractId || 'No contract id yet'}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Wallet Address</small>
                    <div className="fw-semibold text-break">{wallet?.walletAddress || 'No wallet configured'}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Wallet Balance</small>
                    <div className="fw-semibold">{wallet?.walletBalance || '0.0000'} ETH</div>
                  </div>
                  <div>
                    <small className="text-muted d-block">Network</small>
                    <div className="fw-semibold">{wallet?.networkLabel || settings.blockchain.networkLabel}</div>
                  </div>
                </>
              ) : (
                <p className="text-muted mb-0">You do not have access to blockchain technical visibility.</p>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 className="mb-1">Admin Permissions</h5>
                  <p className="text-muted mb-0">Per-admin permissions are stored in the database as overrides on top of role defaults.</p>
                </div>
              </div>

              {!access.canEditPermissions ? (
                <div className="alert alert-light border mb-0">Only the super admin can change per-admin permissions.</div>
              ) : null}

              <div className="d-flex flex-column gap-3">
                {admins.map((admin) => (
                  <div className="border rounded-3 p-3" key={admin._id}>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <div className="fw-semibold">{admin.name}</div>
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
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          disabled={savingUserId === admin._id}
                          onClick={() => handleSaveAdmin(admin)}
                        >
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
