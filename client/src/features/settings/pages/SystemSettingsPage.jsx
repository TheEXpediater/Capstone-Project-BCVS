import { useEffect, useMemo, useState } from 'react';
import {
  activateIssuerKey,
  createIssuerKey,
  deleteIssuerKey,
  getSettingsDashboard,
  rotateIssuerKey,
  updateActiveContract,
  updateAdminPermissions,
  updateBusinessSettings,
  updateIssuerKey,
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
    networkLabel: 'Unavailable',
    walletBalance: '0.0000',
  },
  locks: {
    anchorLocked: false,
    qrEmailLocked: false,
    contractLocked: false,
  },
};

const EMPTY_WALLET = {
  ok: false,
  walletAddress: '',
  networkLabel: 'Unavailable',
  walletBalance: '0.0000',
  gasToken: 'POL',
  chainId: null,
  selectedContractId: '',
  selectedContractName: '',
  error: '',
};

const EMPTY_ACCESS = {
  canEditBusinessSettings: false,
  canEditSystemLocks: false,
  canEditPermissions: false,
  canViewBlockchain: false,
  canViewIssuerKeys: false,
  canManageIssuerKeys: false,
  canManageActiveContract: false,
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function badgeClass(status) {
  if (status === 'active') return 'text-bg-success';
  if (status === 'inactive') return 'text-bg-secondary';
  if (status === 'retired') return 'text-bg-dark';
  return 'text-bg-light';
}

function ToggleCard({
  checked,
  disabled,
  onChange,
  title,
  description = '',
}) {
  return (
    <div className="border rounded-3 p-3 h-100 bg-white">
      <div className="d-flex align-items-start gap-3">
        <div className="form-check form-switch m-0 pt-1 flex-shrink-0">
          <input
            className="form-check-input m-0"
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
          />
        </div>

        <div className="flex-grow-1">
          <div className="fw-semibold">{title}</div>
          {description ? (
            <div className="text-muted small mt-1">{description}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [admins, setAdmins] = useState([]);
  const [wallet, setWallet] = useState(EMPTY_WALLET);
  const [availableContracts, setAvailableContracts] = useState([]);
  const [issuerKeys, setIssuerKeys] = useState([]);
  const [activeIssuerKey, setActiveIssuerKey] = useState(null);
  const [access, setAccess] = useState(EMPTY_ACCESS);

  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingLocks, setSavingLocks] = useState(false);
  const [savingUserId, setSavingUserId] = useState('');
  const [savingContract, setSavingContract] = useState(false);
  const [savingKeyId, setSavingKeyId] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);

  const [selectedContractId, setSelectedContractId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    activate: true,
    rotationReason: '',
  });

  const [rotateForm, setRotateForm] = useState({
    name: '',
    rotationReason: '',
  });

  const selectedContractOption = useMemo(() => {
    return availableContracts.find(
      (item) =>
        item._id === selectedContractId ||
        item.address === selectedContractId
    );
  }, [availableContracts, selectedContractId]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await getSettingsDashboard();

      setSettings(data.settings || EMPTY_SETTINGS);
      setAdmins(data.admins || []);
      setWallet(data.wallet || EMPTY_WALLET);
      setAvailableContracts(data.availableContracts || []);
      setIssuerKeys(data.issuerKeys || []);
      setActiveIssuerKey(data.activeIssuerKey || null);
      setAccess(data.access || EMPTY_ACCESS);
      setSelectedContractId(data.settings?.blockchain?.selectedContractId || '');
      setFeedback({ type: '', text: '' });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to load settings dashboard.',
      });
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

  function updateLocalKey(keyId, field, value) {
    setIssuerKeys((prev) =>
      prev.map((item) =>
        item._id === keyId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  async function handleSaveBusiness() {
    try {
      setSavingBusiness(true);
      const updated = await updateBusinessSettings({
        anchoring: settings.anchoring,
        qrDelivery: settings.qrDelivery,
      });

      setSettings((prev) => ({ ...prev, ...updated }));
      setFeedback({ type: 'success', text: 'Business settings saved.' });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to save business settings.',
      });
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
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to save system locks.',
      });
    } finally {
      setSavingLocks(false);
    }
  }

  async function handleSaveAdmin(admin) {
    try {
      setSavingUserId(admin._id);
      const updated = await updateAdminPermissions(admin._id, admin.permissions);
      setAdmins((prev) =>
        prev.map((item) => (item._id === admin._id ? { ...item, ...updated } : item))
      );
      setFeedback({
        type: 'success',
        text: `Permissions updated for ${admin.fullName}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to save admin permissions.',
      });
    } finally {
      setSavingUserId('');
    }
  }

  async function handleCreateKey() {
    try {
      setCreatingKey(true);
      await createIssuerKey(newKeyForm);
      setNewKeyForm({
        name: '',
        activate: true,
        rotationReason: '',
      });
      setFeedback({ type: 'success', text: 'Issuer key created.' });
      await loadDashboard();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to create issuer key.',
      });
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRotateKey() {
    try {
      setRotatingKey(true);
      await rotateIssuerKey(rotateForm);
      setRotateForm({
        name: '',
        rotationReason: '',
      });
      setFeedback({ type: 'success', text: 'Issuer key rotated and activated.' });
      await loadDashboard();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to rotate issuer key.',
      });
    } finally {
      setRotatingKey(false);
    }
  }

  async function handleActivateKey(keyId) {
    try {
      setSavingKeyId(keyId);
      await activateIssuerKey(keyId);
      setFeedback({ type: 'success', text: 'Issuer key activated.' });
      await loadDashboard();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to activate issuer key.',
      });
    } finally {
      setSavingKeyId('');
    }
  }

  async function handleSaveKey(key) {
    try {
      setSavingKeyId(key._id);
      await updateIssuerKey(key._id, {
        name: key.name,
        rotationReason: key.rotationReason || '',
      });
      setFeedback({ type: 'success', text: 'Issuer key updated.' });
      await loadDashboard();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to update issuer key.',
      });
    } finally {
      setSavingKeyId('');
    }
  }

  async function handleRetireKey(keyId) {
    const approved = window.confirm(
      'Retire this issuer key? Retired keys cannot be used as the active signing key.'
    );

    if (!approved) return;

    try {
      setSavingKeyId(keyId);
      await deleteIssuerKey(keyId);
      setFeedback({ type: 'success', text: 'Issuer key retired.' });
      await loadDashboard();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to retire issuer key.',
      });
    } finally {
      setSavingKeyId('');
    }
  }

  async function handleSaveActiveContract() {
    try {
      setSavingContract(true);
      await updateActiveContract({ contractId: selectedContractId });
      setFeedback({ type: 'success', text: 'Active contract updated.' });
      await loadDashboard();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to update active contract.',
      });
    } finally {
      setSavingContract(false);
    }
  }

  if (loading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="h3 mb-1">System Settings</h1>
        <p className="text-muted mb-0">
          Super admin manages business defaults. MIS manages key rotation, active
          contract switching, technical locks, and permission overrides.
        </p>
      </div>

      {feedback.text ? (
        <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
      ) : null}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">Business Defaults</h2>
              <p className="text-muted mb-0 small">
                Registrar-facing issuance defaults and delivery controls.
              </p>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <ToggleCard
                checked={settings.anchoring.enabled}
                disabled={!access.canEditBusinessSettings}
                onChange={(event) =>
                  updateNested('anchoring', 'enabled', event.target.checked)
                }
                title="Enable VC Anchoring"
                description="Allow issued credentials to be prepared for blockchain anchoring."
              />
            </div>

            <div className="col-md-6">
              <ToggleCard
                checked={settings.anchoring.autoAnchor}
                disabled={!access.canEditBusinessSettings}
                onChange={(event) =>
                  updateNested('anchoring', 'autoAnchor', event.target.checked)
                }
                title="Auto Anchor"
                description="Automatically anchor once the configured interval is reached."
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold">Anchor Interval (days)</label>
              <input
                type="number"
                min="1"
                max="365"
                className="form-control"
                value={settings.anchoring.intervalDays}
                disabled={!access.canEditBusinessSettings}
                onChange={(event) =>
                  updateNested(
                    'anchoring',
                    'intervalDays',
                    Number(event.target.value || 1)
                  )
                }
              />
            </div>

            <div className="col-md-6">
              <ToggleCard
                checked={settings.qrDelivery.allowEmail}
                disabled={!access.canEditBusinessSettings}
                onChange={(event) =>
                  updateNested('qrDelivery', 'allowEmail', event.target.checked)
                }
                title="Allow QR Delivery by Email"
                description="Permit credential QR delivery through email workflows."
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="form-label fw-semibold mb-2">Allowed Roles for QR Delivery</label>
            <div className="row g-2">
              {ROLE_OPTIONS.map((role) => (
                <div className="col-md-6 col-xl-3" key={role}>
                  <label className="border rounded-3 px-3 py-2 w-100 d-flex align-items-center gap-2 bg-white">
                    <input
                      type="checkbox"
                      checked={settings.qrDelivery.allowedRoles.includes(role)}
                      disabled={!access.canEditBusinessSettings}
                      onChange={() => toggleAllowedRole(role)}
                    />
                    <span className="small text-capitalize">
                      {role.replace('_', ' ')}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {access.canEditBusinessSettings ? (
            <div className="mt-4 d-flex justify-content-end">
              <button
                className="btn btn-primary"
                onClick={handleSaveBusiness}
                disabled={savingBusiness}
              >
                {savingBusiness ? 'Saving...' : 'Save Business Settings'}
              </button>
            </div>
          ) : (
            <div className="alert alert-light border mt-4 mb-0">
              Business defaults are read only for your role.
            </div>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">MIS Technical Locks</h2>
              <p className="text-muted mb-0 small">
                Emergency controls for platform-wide operational restrictions.
              </p>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-4">
              <ToggleCard
                checked={settings.locks.anchorLocked}
                disabled={!access.canEditSystemLocks}
                onChange={(event) =>
                  updateNested('locks', 'anchorLocked', event.target.checked)
                }
                title="Lock Anchoring"
                description="Prevent anchoring actions system-wide."
              />
            </div>

            <div className="col-md-4">
              <ToggleCard
                checked={settings.locks.qrEmailLocked}
                disabled={!access.canEditSystemLocks}
                onChange={(event) =>
                  updateNested('locks', 'qrEmailLocked', event.target.checked)
                }
                title="Lock QR Email"
                description="Disable QR delivery by email across the system."
              />
            </div>

            <div className="col-md-4">
              <ToggleCard
                checked={settings.locks.contractLocked}
                disabled={!access.canEditSystemLocks}
                onChange={(event) =>
                  updateNested('locks', 'contractLocked', event.target.checked)
                }
                title="Lock Contracts"
                description="Block contract-related actions until MIS re-enables them."
              />
            </div>
          </div>

          {access.canEditSystemLocks ? (
            <div className="mt-4 d-flex justify-content-end">
              <button
                className="btn btn-dark"
                onClick={handleSaveLocks}
                disabled={savingLocks}
              >
                {savingLocks ? 'Saving...' : 'Save Technical Locks'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">Blockchain Runtime</h2>
              <p className="text-muted mb-0 small">
                Read-only chain account state plus active contract switching.
              </p>
            </div>
          </div>

          {!wallet.ok ? (
            <div className="alert alert-warning">
              Blockchain runtime is currently unavailable.
              {wallet.error ? <div className="small mt-2">{wallet.error}</div> : null}
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted mb-1">Wallet Address</div>
                <div className="fw-semibold small text-break">
                  {wallet.walletAddress || 'Not configured'}
                </div>
              </div>
            </div>

            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted mb-1">Network</div>
                <div className="fw-semibold">{wallet.networkLabel || 'Unavailable'}</div>
              </div>
            </div>

            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted mb-1">Chain ID</div>
                <div className="fw-semibold">{wallet.chainId ?? '—'}</div>
              </div>
            </div>

            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted mb-1">Balance</div>
                <div className="fw-semibold">
                  {wallet.walletBalance || '0.0000'} {wallet.gasToken || 'POL'}
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-3 p-3 bg-light mb-4">
            <div className="small text-muted mb-1">Current Active Contract</div>
            <div className="fw-semibold">
              {settings.blockchain.selectedContractName || 'Not selected yet'}
            </div>
            <div className="small text-muted text-break">
              {settings.blockchain.selectedContractId || 'No active contract id'}
            </div>
          </div>

          <div className="row g-3 align-items-end">
            <div className="col-md-9">
              <label className="form-label fw-semibold">Choose Active Deployed Contract</label>
              <select
                className="form-select"
                value={selectedContractId}
                disabled={!access.canManageActiveContract}
                onChange={(event) => setSelectedContractId(event.target.value)}
              >
                <option value="">Select a deployed contract</option>
                {availableContracts
                  .filter((item) => item.address)
                  .map((item) => (
                    <option
                      key={item._id || item.address}
                      value={item.address || item._id}
                    >
                      {(item.contractName || 'AdminContract')} — {item.address}
                    </option>
                  ))}
              </select>
              <div className="form-text">
                MIS developer can switch which deployed contract is marked as active.
              </div>
            </div>

            <div className="col-md-3 d-grid">
              <button
                className="btn btn-primary"
                onClick={handleSaveActiveContract}
                disabled={!selectedContractId || savingContract}
              >
                {savingContract ? 'Saving...' : 'Save Active Contract'}
              </button>
            </div>
          </div>

          {selectedContractOption ? (
            <div className="border rounded-3 p-3 mt-3 bg-light">
              <div className="fw-semibold mb-1">
                {selectedContractOption.contractName || 'AdminContract'}
              </div>
              <div className="small text-break mb-2">
                {selectedContractOption.address || 'Pending'}
              </div>
              <div className="small">
                Status: <strong>{selectedContractOption.status || 'unknown'}</strong>
              </div>
              <div className="small">
                Network:{' '}
                <strong>
                  {selectedContractOption.network || selectedContractOption.chainId || '—'}
                </strong>
              </div>
              {selectedContractOption.explorerUrl ? (
                <div className="small mt-2">
                  <a
                    href={selectedContractOption.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open transaction
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">Deployed Contract List</h2>
              <p className="text-muted mb-0 small">
                Saved deployments from the contract backend.
              </p>
            </div>
          </div>

          {availableContracts.length === 0 ? (
            <div className="alert alert-light border mb-0">
              No deployed contracts found yet.
            </div>
          ) : (
            <div className="row g-3">
              {availableContracts.map((item) => {
                const isCurrent =
                  item.address === settings.blockchain.selectedContractId ||
                  item._id === settings.blockchain.selectedContractId;

                return (
                  <div className="col-md-6 col-xl-4" key={item._id || item.address}>
                    <div
                      className={`border rounded-3 p-3 h-100 ${
                        isCurrent ? 'border-primary bg-light' : ''
                      }`}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-3">
                        <div>
                          <div className="fw-semibold">
                            {item.contractName || 'AdminContract'}
                          </div>
                          <div className="small text-muted text-break">
                            {item.address || 'Pending'}
                          </div>
                          <div className="small text-muted">
                            {item.network || item.chainId || '—'}
                          </div>
                        </div>

                        <div className="text-end">
                          <span
                            className={`badge ${
                              item.status === 'success'
                                ? 'text-bg-success'
                                : item.status === 'pending'
                                ? 'text-bg-warning'
                                : 'text-bg-danger'
                            }`}
                          >
                            {item.status || 'unknown'}
                          </span>
                          {isCurrent ? (
                            <div className="small mt-2 text-primary fw-semibold">
                              Active
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {access.canViewIssuerKeys ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h2 className="h5 mb-1">Issuer Key Vault</h2>
                <p className="text-muted mb-0 small">
                  Encrypted issuer signing keys with activation and rotation history.
                </p>
              </div>
              <span className="badge text-bg-secondary">{issuerKeys.length}</span>
            </div>

            <div className="border rounded-3 p-3 mb-4 bg-light">
              <div className="small text-muted mb-1">Current Active Key</div>
              {activeIssuerKey ? (
                <>
                  <div className="fw-semibold">{activeIssuerKey.name}</div>
                  <div className="small text-muted text-break">{activeIssuerKey.kid}</div>
                  <div className="small mt-2">
                    Activated: <strong>{formatDate(activeIssuerKey.activatedAt)}</strong>
                  </div>
                </>
              ) : (
                <div className="text-muted">No active issuer key yet.</div>
              )}
            </div>

            {access.canManageIssuerKeys ? (
              <div className="row g-3 mb-4">
                <div className="col-lg-6">
                  <div className="border rounded-3 p-3 h-100">
                    <h3 className="h6 mb-3">Create Key</h3>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Key Name</label>
                      <input
                        className="form-control"
                        value={newKeyForm.name}
                        onChange={(event) =>
                          setNewKeyForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Registrar Issuer Key v1"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Reason</label>
                      <input
                        className="form-control"
                        value={newKeyForm.rotationReason}
                        onChange={(event) =>
                          setNewKeyForm((prev) => ({
                            ...prev,
                            rotationReason: event.target.value,
                          }))
                        }
                        placeholder="initial key provisioning"
                      />
                    </div>

                    <label className="border rounded-3 px-3 py-2 w-100 d-flex align-items-center gap-2 bg-white mb-3">
                      <input
                        type="checkbox"
                        checked={newKeyForm.activate}
                        onChange={(event) =>
                          setNewKeyForm((prev) => ({
                            ...prev,
                            activate: event.target.checked,
                          }))
                        }
                      />
                      <span className="small">Make this key active immediately</span>
                    </label>

                    <button
                      className="btn btn-primary w-100"
                      onClick={handleCreateKey}
                      disabled={creatingKey}
                    >
                      {creatingKey ? 'Creating...' : 'Create Issuer Key'}
                    </button>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="border rounded-3 p-3 h-100">
                    <h3 className="h6 mb-3">Rotate Active Key</h3>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">New Key Name</label>
                      <input
                        className="form-control"
                        value={rotateForm.name}
                        onChange={(event) =>
                          setRotateForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Registrar Issuer Key v2"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Rotation Reason</label>
                      <input
                        className="form-control"
                        value={rotateForm.rotationReason}
                        onChange={(event) =>
                          setRotateForm((prev) => ({
                            ...prev,
                            rotationReason: event.target.value,
                          }))
                        }
                        placeholder="scheduled quarterly rotation"
                      />
                    </div>

                    <div className="alert alert-light border small">
                      Rotation creates a new encrypted key pair and makes it the active signing key.
                    </div>

                    <button
                      className="btn btn-outline-dark w-100"
                      onClick={handleRotateKey}
                      disabled={rotatingKey}
                    >
                      {rotatingKey ? 'Rotating...' : 'Rotate Active Key'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {issuerKeys.length === 0 ? (
              <div className="alert alert-light border mb-0">
                No issuer keys found yet.
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {issuerKeys.map((key) => (
                  <div className="border rounded-3 p-3" key={key._id}>
                    <div className="row g-3 align-items-start">
                      <div className="col-lg-4">
                        <label className="form-label small text-muted">Key Name</label>
                        <input
                          className="form-control"
                          value={key.name}
                          disabled={!access.canManageIssuerKeys}
                          onChange={(event) =>
                            updateLocalKey(key._id, 'name', event.target.value)
                          }
                        />
                        <div className="small text-muted mt-2 text-break">
                          {key.kid}
                        </div>
                      </div>

                      <div className="col-lg-2">
                        <label className="form-label small text-muted">Status</label>
                        <div>
                          <span className={`badge ${badgeClass(key.status)}`}>
                            {key.status}
                          </span>
                        </div>
                        <div className="small text-muted mt-2">
                          {key.algorithm} / {key.curve}
                        </div>
                      </div>

                      <div className="col-lg-3">
                        <label className="form-label small text-muted">Timeline</label>
                        <div className="small text-muted">
                          Created: {formatDate(key.createdAt)}
                        </div>
                        <div className="small text-muted">
                          Activated: {formatDate(key.activatedAt)}
                        </div>
                      </div>

                      <div className="col-lg-3">
                        <label className="form-label small text-muted">Actions</label>
                        <div className="d-flex flex-wrap gap-2">
                          <button
                            className="btn btn-outline-success btn-sm"
                            disabled={
                              !access.canManageIssuerKeys ||
                              key.isActive ||
                              key.status === 'retired' ||
                              savingKeyId === key._id
                            }
                            onClick={() => handleActivateKey(key._id)}
                          >
                            Activate
                          </button>

                          <button
                            className="btn btn-outline-primary btn-sm"
                            disabled={!access.canManageIssuerKeys || savingKeyId === key._id}
                            onClick={() => handleSaveKey(key)}
                          >
                            Save
                          </button>

                          <button
                            className="btn btn-outline-danger btn-sm"
                            disabled={
                              !access.canManageIssuerKeys ||
                              key.isActive ||
                              key.status === 'retired' ||
                              savingKeyId === key._id
                            }
                            onClick={() => handleRetireKey(key._id)}
                          >
                            Retire
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="small text-muted mb-1">Fingerprint</div>
                      <div className="small text-break mb-3">{key.fingerprint}</div>

                      <label className="form-label small text-muted">Public Key</label>
                      <textarea
                        className="form-control font-monospace small"
                        rows="4"
                        value={key.publicKeyPem}
                        readOnly
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">Permission Overrides</h2>
              <p className="text-muted mb-0 small">
                MIS can override permission flags on top of role defaults.
              </p>
            </div>
          </div>

          {!access.canEditPermissions ? (
            <div className="alert alert-light border">
              Only the MIS developer can edit permission overrides.
            </div>
          ) : null}

          <div className="row g-3">
            {admins.map((admin) => (
              <div className="col-xl-6" key={admin._id}>
                <div className="border rounded-3 p-3 h-100">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <div className="fw-semibold">{admin.fullName}</div>
                      <div className="text-muted small">{admin.email}</div>
                    </div>
                    <span className="badge text-bg-secondary text-uppercase">
                      {admin.role}
                    </span>
                  </div>

                  <div className="row g-2">
                    {Object.entries(admin.permissions).map(([key, value]) => (
                      <div className="col-md-6" key={key}>
                        <div className="border rounded-3 px-3 py-2 h-100 bg-white">
                          <div className="d-flex align-items-start gap-2">
                            <input
                              className="mt-1 flex-shrink-0"
                              type="checkbox"
                              checked={Boolean(value)}
                              disabled={!access.canEditPermissions}
                              onChange={() => togglePermission(admin._id, key)}
                            />
                            <span className="small">{key}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {access.canEditPermissions ? (
                    <div className="mt-3 d-flex justify-content-end">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        disabled={savingUserId === admin._id}
                        onClick={() => handleSaveAdmin(admin)}
                      >
                        {savingUserId === admin._id ? 'Saving...' : 'Save Permissions'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}