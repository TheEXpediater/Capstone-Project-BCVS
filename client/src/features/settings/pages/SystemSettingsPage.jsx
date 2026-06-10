import { useEffect, useMemo, useState } from 'react';
import {
  activateIssuerKey,
  createIssuerKey,
  deleteIssuerKey,
  getContractCapabilities,
  getSettingsDashboard,
  rotateIssuerKey,
  updateActiveContract,
  updateAdminPermissions,
  updateBusinessSettings,
  updateIssuerKey,
  updateSystemLocks,
} from '../settingsAPI';

const TABS = [
  'Permissions',
  'Issuer Key Vault',
  'Business Rules',
  'MIS Technical Locks',
  'Blockchain / Contract',
];

const PERMISSION_COLUMNS = [
  ['canConfirmPayments', 'Confirm Payments'],
  ['canManageVC', 'Manage VC'],
  ['canSignVC', 'Sign VC'],
  ['canGenerateClaimQr', 'Generate Claim QR'],
  ['canAnchorVC', 'Anchor VC'],
  ['canManageUsers', 'Manage Users'],
  ['canManageSettings', 'Manage Settings'],
];

const EMPTY_SETTINGS = {
  anchoring: {
    enabled: true,
    intervalDays: 7,
    autoAnchor: false,
  },
  qrDelivery: {
    allowEmail: true,
    claimQrExpiryMinutes: 15,
    allowRegeneration: true,
    allowedRoles: ['admin', 'super_admin'],
  },
  blockchain: {
    selectedContractId: '',
    selectedContractName: '',
    selectedContractType: '',
    selectedContractAddress: '',
    selectedContractChainId: null,
    selectedContractNetwork: '',
    selectedContractExplorerUrl: '',
    selectedContractCapabilities: {
      canAnchorMerkleRoot: false,
      canVerifyMerkleRoot: false,
      anchorFunctionName: '',
      verifyFunctionName: '',
      rootAnchoredEventName: '',
    },
    walletAddress: '',
    networkLabel: 'Unavailable',
    walletBalance: '0.0000',
  },
  locks: {
    anchorLocked: false,
    qrEmailLocked: false,
    qrGenerationLocked: false,
    contractLocked: false,
    issuerKeyRotationLocked: false,
    paymentConfirmationLocked: false,
  },
};

const EMPTY_WALLET = {
  ok: false,
  walletAddress: '',
  networkLabel: 'Unavailable',
  walletBalance: '0.0000',
  gasToken: 'POL',
  chainId: null,
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
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function shortText(value, start = 18, end = 8) {
  const text = String(value || '').trim();
  if (!text) return 'Not available';
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function capabilitySupported(capabilities) {
  return Boolean(capabilities?.canAnchorMerkleRoot && capabilities?.canVerifyMerkleRoot);
}

function capabilityBadge(capabilities) {
  return capabilitySupported(capabilities) ? 'text-bg-success' : 'text-bg-warning';
}

function capabilityLabel(capabilities) {
  return capabilitySupported(capabilities)
    ? 'Merkle Anchoring Supported'
    : 'Merkle Anchoring Not Supported';
}

function contractTypeLabel(value) {
  return value === 'merkle_anchor' ? 'MerkleAnchor' : 'MerkleAnchor';
}

function explorerBase(url) {
  return String(url || '').replace(/\/tx\/[^/]+$/i, '');
}

function contractAddressUrl(contract) {
  const base = explorerBase(contract?.explorerUrl || contract?.selectedContractExplorerUrl);
  const address = contract?.address || contract?.selectedContractAddress;
  return base && address ? `${base}/address/${encodeURIComponent(address)}` : '';
}

function ModalShell({ title, body, children, footer, onClose }) {
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">{title}</h2>
                {body ? <p className="text-muted mb-0 small">{body}</p> : null}
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer">{footer}</div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose} />
    </>
  );
}

function ConfirmModal({ action, busy, onCancel, onConfirm }) {
  if (!action) return null;

  return (
    <ModalShell
      title={action.title}
      body={action.body}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn btn-${action.variant || 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working...' : action.confirmLabel || 'Confirm'}
          </button>
        </>
      }
    >
      {action.details ? <div className="alert alert-light border mb-0">{action.details}</div> : null}
    </ModalShell>
  );
}

function TextModal({ action, busy, onCancel, onConfirm }) {
  const [value, setValue] = useState(action?.initialValue || '');

  if (!action) return null;

  const valid = !action.required || value.trim().length > 0;

  return (
    <ModalShell
      title={action.title}
      body={action.body}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn btn-${action.variant || 'primary'}`}
            onClick={() => onConfirm(value.trim())}
            disabled={busy || !valid}
          >
            {busy ? 'Working...' : action.confirmLabel || 'Save'}
          </button>
        </>
      }
    >
      <label className="form-label fw-semibold">{action.label || 'Value'}</label>
      <input
        className="form-control"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={action.placeholder || ''}
        disabled={busy}
      />
    </ModalShell>
  );
}

function Toggle({ checked, disabled, onChange }) {
  return (
    <input
      className="form-check-input"
      type="checkbox"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState('Permissions');
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [admins, setAdmins] = useState([]);
  const [issuerKeys, setIssuerKeys] = useState([]);
  const [activeIssuerKey, setActiveIssuerKey] = useState(null);
  const [wallet, setWallet] = useState(EMPTY_WALLET);
  const [availableContracts, setAvailableContracts] = useState([]);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [access, setAccess] = useState(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkingCapability, setCheckingCapability] = useState(false);
  const [savingUserId, setSavingUserId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [confirmAction, setConfirmAction] = useState(null);
  const [textAction, setTextAction] = useState(null);
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    activate: true,
    rotationReason: '',
  });
  const [rotateForm, setRotateForm] = useState({
    name: '',
    rotationReason: '',
  });

  const selectedContractOption = useMemo(
    () =>
      availableContracts.find(
        (item) => item._id === selectedContractId || item.address === selectedContractId
      ),
    [availableContracts, selectedContractId]
  );
  const activeContract = useMemo(() => {
    const selectedId = settings.blockchain?.selectedContractId || '';
    return (
      availableContracts.find(
        (item) => item._id === selectedId || item.address === selectedId
      ) || wallet?.activeContract || null
    );
  }, [availableContracts, settings.blockchain?.selectedContractId, wallet?.activeContract]);
  const activeCapabilities =
    activeContract?.capabilities ||
    settings.blockchain?.selectedContractCapabilities ||
    EMPTY_SETTINGS.blockchain.selectedContractCapabilities;

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await getSettingsDashboard();
      setSettings({ ...EMPTY_SETTINGS, ...(data.settings || {}) });
      setAdmins(data.admins || []);
      setIssuerKeys(data.issuerKeys || []);
      setActiveIssuerKey(data.activeIssuerKey || null);
      setWallet(data.wallet || EMPTY_WALLET);
      setAvailableContracts(data.availableContracts || []);
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

  function closeActionModals() {
    setConfirmAction(null);
    setTextAction(null);
  }

  function actionError(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
  }

  async function runConfirmedAction() {
    if (!confirmAction?.run) return;

    try {
      setBusy(true);
      await confirmAction.run();
      closeActionModals();
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Action failed.') });
    } finally {
      setBusy(false);
    }
  }

  async function runTextAction(value) {
    if (!textAction?.run) return;

    try {
      setBusy(true);
      await textAction.run(value);
      closeActionModals();
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Action failed.') });
    } finally {
      setBusy(false);
    }
  }

  function updateNested(section, field, value) {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [field]: value,
      },
    }));
  }

  function togglePermission(userId, key) {
    setAdmins((prev) =>
      prev.map((admin) =>
        admin._id === userId
          ? {
              ...admin,
              permissions: {
                ...(admin.permissions || {}),
                [key]: !admin.permissions?.[key],
              },
            }
          : admin
      )
    );
  }

  async function saveAdmin(admin) {
    try {
      setSavingUserId(admin._id);
      const updated = await updateAdminPermissions(admin._id, admin.permissions);
      setAdmins((prev) =>
        prev.map((item) => (item._id === admin._id ? { ...item, ...updated } : item))
      );
      setFeedback({ type: 'success', text: `Permissions updated for ${admin.fullName}.` });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: actionError(error, 'Failed to save permissions.'),
      });
    } finally {
      setSavingUserId('');
    }
  }

  function confirmSaveBusiness() {
    setConfirmAction({
      title: 'Save business rules?',
      body: 'These settings affect credential QR expiry, regeneration, and anchoring behavior.',
      confirmLabel: 'Save Rules',
      run: async () => {
        const updated = await updateBusinessSettings({
          anchoring: settings.anchoring,
          qrDelivery: settings.qrDelivery,
        });
        setSettings((prev) => ({ ...prev, ...updated }));
        setFeedback({ type: 'success', text: 'Business rules saved.' });
      },
    });
  }

  function confirmSaveLocks() {
    setConfirmAction({
      title: 'Save MIS technical locks?',
      body: 'These locks can block production credential operations.',
      confirmLabel: 'Save Locks',
      variant: 'dark',
      run: async () => {
        const updated = await updateSystemLocks({ locks: settings.locks });
        setSettings((prev) => ({ ...prev, locks: updated.locks }));
        setFeedback({ type: 'success', text: 'Technical locks saved.' });
      },
    });
  }

  function confirmSaveContract() {
    setConfirmAction({
      title: 'Change active contract?',
      body: 'New anchoring operations will use the selected deployed contract.',
      details: selectedContractOption
        ? `${selectedContractOption.contractName || 'MerkleAnchor'} - ${selectedContractOption.address}`
        : selectedContractId,
      confirmLabel: 'Save Contract',
      run: async () => {
        const updated = await updateActiveContract({ contractId: selectedContractId });
        await loadDashboard();
        setFeedback({
          type: updated.warning ? 'warning' : 'success',
          text: updated.warning || 'Active contract updated.',
        });
      },
    });
  }

  async function checkSelectedCapability() {
    if (!selectedContractId) return;

    try {
      setCheckingCapability(true);
      const data = await getContractCapabilities(selectedContractId);
      const contract = data.contract || {};
      const capabilities = data.capabilities || contract.capabilities || {};

      setAvailableContracts((prev) =>
        prev.map((item) =>
          item.address === contract.address || item._id === contract._id
            ? { ...item, ...contract, capabilities }
            : item
        )
      );
      setFeedback({
        type: capabilitySupported(capabilities) ? 'success' : 'warning',
        text: capabilityLabel(capabilities),
      });
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to check capability.') });
    } finally {
      setCheckingCapability(false);
    }
  }

  function confirmCreateKey() {
    setConfirmAction({
      title: 'Create issuer key?',
      body: 'A new encrypted issuer signing key will be created on the server.',
      details: newKeyForm.name || 'New issuer key',
      confirmLabel: 'Create Key',
      run: async () => {
        await createIssuerKey(newKeyForm);
        setNewKeyForm({ name: '', activate: true, rotationReason: '' });
        setFeedback({ type: 'success', text: 'Issuer key created.' });
        await loadDashboard();
      },
    });
  }

  function confirmRotateKey() {
    setConfirmAction({
      title: 'Rotate issuer key?',
      body: 'This creates and activates a new encrypted issuer key. Existing signed credentials keep their proof.',
      details: rotateForm.rotationReason || 'Key rotation',
      confirmLabel: 'Rotate Key',
      variant: 'warning',
      run: async () => {
        await rotateIssuerKey(rotateForm);
        setRotateForm({ name: '', rotationReason: '' });
        setFeedback({ type: 'success', text: 'Issuer key rotated.' });
        await loadDashboard();
      },
    });
  }

  function editIssuerKey(key) {
    setTextAction({
      title: 'Edit issuer key label',
      body: 'Private key material is never exposed or changed here.',
      label: 'Label',
      initialValue: key.name || '',
      required: true,
      confirmLabel: 'Save Label',
      run: async (name) => {
        await updateIssuerKey(key._id, { name });
        setFeedback({ type: 'success', text: 'Issuer key label updated.' });
        await loadDashboard();
      },
    });
  }

  function confirmActivateKey(key) {
    setConfirmAction({
      title: 'Activate issuer key?',
      body: 'Future VC signing will use this issuer key.',
      details: key.name,
      confirmLabel: 'Activate',
      run: async () => {
        await activateIssuerKey(key._id);
        setFeedback({ type: 'success', text: 'Issuer key activated.' });
        await loadDashboard();
      },
    });
  }

  function confirmRetireKey(key) {
    setConfirmAction({
      title: 'Retire issuer key?',
      body: 'This deactivates the key. Keys used by issued credentials should be retained for verification.',
      details: key.name,
      confirmLabel: 'Retire',
      variant: 'danger',
      run: async () => {
        await deleteIssuerKey(key._id);
        setFeedback({ type: 'success', text: 'Issuer key retired.' });
        await loadDashboard();
      },
    });
  }

  function renderPermissions() {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Permissions</h2>
              <p className="text-muted mb-0">
                One account per row. Backend permissions still enforce restricted operations.
              </p>
            </div>
          </div>

          {!access.canEditPermissions ? (
            <div className="alert alert-light border">
              Permission overrides are read only for your role.
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Active</th>
                  {PERMISSION_COLUMNS.map(([, label]) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin._id}>
                    <td style={{ minWidth: 220 }}>
                      <div className="fw-semibold">{admin.fullName || admin.username}</div>
                      <div className="small text-muted">{admin.email}</div>
                    </td>
                    <td>
                      <span className="badge text-bg-secondary text-uppercase">{admin.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${admin.isActive ? 'text-bg-success' : 'text-bg-danger'}`}>
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {PERMISSION_COLUMNS.map(([key]) => (
                      <td key={key} className="text-center">
                        <Toggle
                          checked={admin.permissions?.[key]}
                          disabled={!access.canEditPermissions}
                          onChange={() => togglePermission(admin._id, key)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => saveAdmin(admin)}
                        disabled={!access.canEditPermissions || savingUserId === admin._id}
                      >
                        {savingUserId === admin._id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderIssuerKeys() {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Issuer Key Vault</h2>
              <p className="text-muted mb-0">Private key material is encrypted on the server and never shown here.</p>
            </div>
          </div>

          <div className="border rounded-3 p-3 bg-light mb-4">
            <div className="small text-muted">Active issuer key</div>
            {activeIssuerKey ? (
              <>
                <div className="fw-semibold fs-5">{activeIssuerKey.name}</div>
                <div className="small text-break">{activeIssuerKey.kid}</div>
                <div className="small mt-2">Activated: {formatDate(activeIssuerKey.activatedAt)}</div>
              </>
            ) : (
              <div className="text-muted">No active issuer key yet.</div>
            )}
          </div>

          {access.canManageIssuerKeys ? (
            <div className="row g-3 mb-4">
              <div className="col-lg-6">
                <div className="border rounded-3 p-3 h-100">
                  <h3 className="h6">Create Key</h3>
                  <input
                    className="form-control mb-2"
                    value={newKeyForm.name}
                    onChange={(event) => setNewKeyForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Registrar Issuer Key v1"
                  />
                  <input
                    className="form-control mb-2"
                    value={newKeyForm.rotationReason}
                    onChange={(event) =>
                      setNewKeyForm((prev) => ({ ...prev, rotationReason: event.target.value }))
                    }
                    placeholder="Provisioning reason"
                  />
                  <label className="d-flex align-items-center gap-2 mb-3 small">
                    <input
                      type="checkbox"
                      checked={newKeyForm.activate}
                      onChange={(event) => setNewKeyForm((prev) => ({ ...prev, activate: event.target.checked }))}
                    />
                    Make active immediately
                  </label>
                  <button className="btn btn-primary" onClick={confirmCreateKey}>
                    Create Issuer Key
                  </button>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="border rounded-3 p-3 h-100">
                  <h3 className="h6">Rotate New Key</h3>
                  <input
                    className="form-control mb-2"
                    value={rotateForm.name}
                    onChange={(event) => setRotateForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Registrar Issuer Key v2"
                  />
                  <input
                    className="form-control mb-3"
                    value={rotateForm.rotationReason}
                    onChange={(event) =>
                      setRotateForm((prev) => ({ ...prev, rotationReason: event.target.value }))
                    }
                    placeholder="Rotation reason"
                  />
                  <button className="btn btn-warning" onClick={confirmRotateKey}>
                    Rotate New Key
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Key ID</th>
                  <th>Label</th>
                  <th>Public Key</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Rotated At</th>
                  <th>Retired At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issuerKeys.map((key) => (
                  <tr key={key._id}>
                    <td className="small text-break">{shortText(key.kid || key._id)}</td>
                    <td className="fw-semibold">{key.name}</td>
                    <td className="small text-break">{shortText(key.publicKeyPem, 26, 10)}</td>
                    <td>
                      <span className={`badge ${key.isActive ? 'text-bg-success' : 'text-bg-secondary'}`}>
                        {key.isActive ? 'Active' : key.status}
                      </span>
                    </td>
                    <td>{formatDate(key.createdAt)}</td>
                    <td>{formatDate(key.activatedAt)}</td>
                    <td>{formatDate(key.retiredAt)}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => editIssuerKey(key)}
                          disabled={!access.canManageIssuerKeys}
                        >
                          Edit
                        </button>
                        {!key.isActive && key.status !== 'retired' ? (
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => confirmActivateKey(key)}
                            disabled={!access.canManageIssuerKeys}
                          >
                            Activate
                          </button>
                        ) : null}
                        {!key.isActive && key.status !== 'retired' ? (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => confirmRetireKey(key)}
                            disabled={!access.canManageIssuerKeys}
                          >
                            Retire
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderBusinessRules() {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5 mb-1">Business Rules</h2>
          <p className="text-muted">Business-level credential lifecycle defaults.</p>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Anchoring enabled</label>
              <div className="form-check form-switch">
                <Toggle
                  checked={settings.anchoring?.enabled}
                  disabled={!access.canEditBusinessSettings}
                  onChange={(value) => updateNested('anchoring', 'enabled', value)}
                />
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Auto anchor enabled</label>
              <div className="form-check form-switch">
                <Toggle
                  checked={settings.anchoring?.autoAnchor}
                  disabled={!access.canEditBusinessSettings}
                  onChange={(value) => updateNested('anchoring', 'autoAnchor', value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">Anchor interval days</label>
              <input
                type="number"
                min="1"
                max="365"
                className="form-control"
                value={settings.anchoring?.intervalDays || 7}
                disabled={!access.canEditBusinessSettings}
                onChange={(event) => updateNested('anchoring', 'intervalDays', Number(event.target.value || 7))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">Claim QR expiry minutes</label>
              <input
                type="number"
                min="1"
                max="1440"
                className="form-control"
                value={settings.qrDelivery?.claimQrExpiryMinutes || 15}
                disabled={!access.canEditBusinessSettings}
                onChange={(event) =>
                  updateNested('qrDelivery', 'claimQrExpiryMinutes', Number(event.target.value || 15))
                }
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">QR regeneration allowed</label>
              <div className="form-check form-switch">
                <Toggle
                  checked={settings.qrDelivery?.allowRegeneration}
                  disabled={!access.canEditBusinessSettings}
                  onChange={(value) => updateNested('qrDelivery', 'allowRegeneration', value)}
                />
              </div>
            </div>
          </div>

          {access.canEditBusinessSettings ? (
            <div className="mt-4 d-flex justify-content-end">
              <button className="btn btn-primary" onClick={confirmSaveBusiness}>
                Save Business Rules
              </button>
            </div>
          ) : (
            <div className="alert alert-light border mt-4 mb-0">
              Business rules are read only for your role.
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderLocks() {
    const lockRows = [
      ['anchorLocked', 'Anchor locked'],
      ['qrGenerationLocked', 'QR generation locked'],
      ['contractLocked', 'Contract locked'],
      ['issuerKeyRotationLocked', 'Issuer key rotation locked'],
      ['paymentConfirmationLocked', 'Payment confirmation locked'],
    ];

    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5 mb-1">MIS Technical Locks</h2>
          <p className="text-muted">
            Only MIS/developer can change technical locks. Other roles see a read-only display.
          </p>

          <div className="row g-3">
            {lockRows.map(([key, label]) => (
              <div className="col-md-6 col-xl-4" key={key}>
                <div className="border rounded-3 p-3 h-100">
                  <div className="d-flex align-items-center justify-content-between gap-3">
                    <div className="fw-semibold">{label}</div>
                    <div className="form-check form-switch mb-0">
                      <Toggle
                        checked={settings.locks?.[key]}
                        disabled={!access.canEditSystemLocks}
                        onChange={(value) => updateNested('locks', key, value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {access.canEditSystemLocks ? (
            <div className="mt-4 d-flex justify-content-end">
              <button className="btn btn-dark" onClick={confirmSaveLocks}>
                Save Technical Locks
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderBlockchain() {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5 mb-1">Blockchain / Contract</h2>
          <p className="text-muted">Contract deployment controls remain protected by backend roles.</p>

          {!wallet?.ok ? (
            <div className="alert alert-warning">
              Contract health is unavailable.
              {wallet?.error ? <div className="small mt-2">{wallet.error}</div> : null}
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted">Wallet</div>
                <div className="fw-semibold small text-break">{wallet?.walletAddress || 'Not configured'}</div>
              </div>
            </div>
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted">Network</div>
                <div className="fw-semibold">{wallet?.networkLabel || 'Unavailable'}</div>
              </div>
            </div>
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted">Chain ID</div>
                <div className="fw-semibold">{wallet?.chainId ?? 'Not available'}</div>
              </div>
            </div>
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100">
                <div className="small text-muted">Balance</div>
                <div className="fw-semibold">
                  {wallet?.walletBalance || '0.0000'} {wallet?.gasToken || 'POL'}
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-3 p-3 bg-light mb-4">
            <div className="small text-muted">Active contract</div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <div className="fw-semibold">
                {settings.blockchain?.selectedContractName || activeContract?.contractName || 'Not selected'}
              </div>
              <span className={`badge ${capabilityBadge(activeCapabilities)}`}>
                {capabilityLabel(activeCapabilities)}
              </span>
            </div>
            <div className="small text-muted">Type</div>
            <div className="small mb-2">{contractTypeLabel(settings.blockchain?.selectedContractType || activeContract?.contractType)}</div>
            <div className="small text-muted">Address</div>
            <div className="small text-break mb-2">
              {contractAddressUrl(activeContract || settings.blockchain) ? (
                <a href={contractAddressUrl(activeContract || settings.blockchain)} target="_blank" rel="noreferrer">
                  {settings.blockchain?.selectedContractAddress || activeContract?.address || settings.blockchain?.selectedContractId}
                </a>
              ) : (
                settings.blockchain?.selectedContractAddress ||
                activeContract?.address ||
                settings.blockchain?.selectedContractId ||
                'No active contract'
              )}
            </div>
            <div className="row g-2">
              <div className="col-md-4">
                <div className="small text-muted">Chain ID</div>
                <div className="fw-semibold">{settings.blockchain?.selectedContractChainId ?? activeContract?.chainId ?? 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Network</div>
                <div className="fw-semibold">{settings.blockchain?.selectedContractNetwork || activeContract?.network || 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Verify Function</div>
                <div className="fw-semibold">{activeCapabilities?.verifyFunctionName || 'Not available'}</div>
              </div>
            </div>
            {!capabilitySupported(activeCapabilities) ? (
              <div className="alert alert-warning mt-3 mb-0">
                Active contract does not support Merkle root anchoring. Credentials can prepare local proofs, but blockchain verification will not pass until a compatible MerkleAnchor contract is deployed and selected.
              </div>
            ) : null}
          </div>

          <div className="row g-3 align-items-end">
            <div className="col-md-9">
              <label className="form-label fw-semibold">Selected contract</label>
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
                    <option key={item._id || item.address} value={item.address || item._id}>
                      {(item.contractName || 'MerkleAnchor')} - {item.address}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-md-3 d-grid gap-2">
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={checkSelectedCapability}
                disabled={!selectedContractId || checkingCapability}
              >
                {checkingCapability ? 'Checking...' : 'Check Capability'}
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmSaveContract}
                disabled={!selectedContractId || !access.canManageActiveContract}
              >
                Save Active Contract
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === 'Issuer Key Vault') return renderIssuerKeys();
    if (activeTab === 'Business Rules') return renderBusinessRules();
    if (activeTab === 'MIS Technical Locks') return renderLocks();
    if (activeTab === 'Blockchain / Contract') return renderBlockchain();
    return renderPermissions();
  }

  if (loading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">Loading settings...</div>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div>
          <h1 className="h3 mb-1">System Settings</h1>
          <p className="text-muted mb-0">
            Production controls for permissions, issuer keys, business rules, locks, and contract selection.
          </p>
        </div>

        {feedback.text ? (
          <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
        ) : null}

        <div className="d-flex flex-wrap gap-2">
          {TABS.filter((tab) => {
            if (tab === 'Issuer Key Vault') return access.canViewIssuerKeys;
            if (tab === 'Blockchain / Contract') return access.canViewBlockchain;
            return true;
          }).map((tab) => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {renderActiveTab()}
      </div>

      <ConfirmModal
        action={confirmAction}
        busy={busy}
        onCancel={closeActionModals}
        onConfirm={runConfirmedAction}
      />
      <TextModal
        action={textAction}
        busy={busy}
        onCancel={closeActionModals}
        onConfirm={runTextAction}
      />
    </>
  );
}
