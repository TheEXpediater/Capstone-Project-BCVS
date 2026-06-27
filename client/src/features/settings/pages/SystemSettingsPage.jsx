import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { FaCog, FaEdit, FaEye, FaEyeSlash, FaTrash } from 'react-icons/fa';
import FloatingActionMenu from '../../../components/FloatingActionMenu';
import {
  activateBlockchainAccount,
  activateIssuerKey,
  createBlockchainAccount,
  createIssuerKey,
  deleteBlockchainAccount,
  deleteIssuerKey,
  fetchNetworkInfo,
  fetchNetworkQrConfig,
  getSettingsDashboard,
  listBlockchainAccountCredentials,
  rotateIssuerKey,
  updateActiveContract,
  updateAdminPermissions,
  updateBlockchainAccount,
  updateBusinessSettings,
  updateEmailSettings,
  updateIssuerKey,
  updateNetworkSettings,
  updateSystemLocks,
} from '../settingsAPI';
import AuditLogsPage from '../../audit/pages/AuditLogsPage';
import { checkAnchorReadiness } from '../../contracts/contractsAPI';

const TABS = [
  'Connection',
  'Action Logs',
  'Advanced',
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
  network: {
    manualApiBaseUrl: '',
    manualWebBaseUrl: '',
    domainApiBaseUrl: '',
    domainWebBaseUrl: '',
    preferredMode: 'domain',
    discoveryEnabled: false,
    preferredServerIp: '',
    apiPort: 5000,
    webPort: 5173,
    qrPairingEnabled: true,
  },
  emailOtp: {
    enabled: false,
    provider: 'resend',
    apiKeyConfigured: false,
    secretConfigured: false,
  },
};

const EMPTY_WALLET = {
  ok: false,
  activeAccount: null,
  blockchainAccounts: [],
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
  canViewNetworkSettings: false,
  canManageNetworkSettings: false,
  canViewBlockchain: false,
  canViewIssuerKeys: false,
  canManageIssuerKeys: false,
  canManageActiveContract: false,
  canManageBlockchainAccounts: false,
  canViewEmailSettings: false,
  canManageEmailSettings: false,
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

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeApiBaseUrl(value) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return '';
  return /\/api$/i.test(cleaned) ? cleaned : `${cleaned}/api`;
}

function healthUrlFor(apiBaseUrl) {
  return normalizeApiBaseUrl(apiBaseUrl).replace(/\/api\/?$/i, '/api/health');
}

function copyToClipboard(value, setFeedback) {
  const text = String(value || '').trim();
  if (!text) return;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => setFeedback({ type: 'success', text: 'Copied to clipboard.' }))
      .catch(() => setFeedback({ type: 'warning', text: 'Copy failed. Select and copy the URL manually.' }));
    return;
  }

  setFeedback({ type: 'warning', text: 'Clipboard is unavailable. Select and copy the URL manually.' });
}

function contractRecordKey(contract) {
  return String(contract?.address || contract?._id || contract?.selectedContractAddress || contract?.selectedContractId || '').trim();
}

function contractName(contract) {
  return contract?.contractName || contract?.selectedContractName || 'MerkleAnchor';
}

function isMerkleAnchorContract(contract) {
  const type = String(contract?.contractType || contract?.selectedContractType || '').toLowerCase();
  const name = String(contractName(contract)).toLowerCase();
  return type === 'merkle_anchor' || name.includes('merkle');
}

function isSameContract(contract, value) {
  const target = String(value || '').trim().toLowerCase();
  if (!target) return false;

  return [
    contract?._id,
    contract?.address,
    contract?.selectedContractId,
    contract?.selectedContractAddress,
  ]
    .filter(Boolean)
    .some((item) => String(item).trim().toLowerCase() === target);
}

function isContractReady(contract) {
  return Boolean(contractRecordKey(contract) && isMerkleAnchorContract(contract));
}

function contractStatusBadge(contract) {
  return isContractReady(contract) ? 'text-bg-success' : 'text-bg-secondary';
}

function contractStatusLabel(contract) {
  return isContractReady(contract) ? 'Ready' : 'Not Ready';
}

function explorerBase(url) {
  return String(url || '')
    .replace(/\/tx\/[^/]+$/i, '')
    .replace(/\/address\/[^/]+$/i, '');
}

function contractAddressUrl(contract) {
  const base = explorerBase(contract?.explorerUrl || contract?.selectedContractExplorerUrl);
  const address = contract?.address || contract?.selectedContractAddress;
  return base && address ? `${base}/address/${encodeURIComponent(address)}` : '';
}

function ModalShell({ title, body, children, footer, onClose, size = '', scrollable = false }) {
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-dialog-centered ${scrollable ? 'modal-dialog-scrollable' : ''} ${size}`}>
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

function BlockchainAccountEmptyState({ onAddAccount, disabled = false }) {
  return (
    <div className="border rounded-3 bg-light p-4 text-center">
      <h3 className="h5 mb-2">No Blockchain Accounts</h3>
      <p className="text-muted mb-3">
        No blockchain account has been configured yet.
        <br />
        Add your first blockchain wallet to start anchoring credentials.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onAddAccount}
        disabled={disabled}
      >
        + Add Account
      </button>
    </div>
  );
}

function AddBlockchainAccountModal({
  open,
  busy,
  form,
  onFormChange,
  onSave,
  onCancel,
}) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  if (!open) return null;

  const canSave = form.name.trim() && form.privateKey.trim();

  return (
    <ModalShell
      title="Add Blockchain Account"
      body="Wallet addresses are generated from the private key. Private keys are encrypted on save."
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={busy || !canSave}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="form-label fw-semibold">Account Name</label>
          <input
            className="form-control"
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            disabled={busy}
            autoFocus
          />
        </div>
        <div>
          <label className="form-label fw-semibold">Private Key</label>
          <div className="input-group">
            <input
              type={showPrivateKey ? 'text' : 'password'}
              className="form-control"
              value={form.privateKey}
              onChange={(event) => onFormChange({ ...form, privateKey: event.target.value })}
              placeholder="Enter the private key of your blockchain wallet."
              disabled={busy}
              autoComplete="off"
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowPrivateKey((value) => !value)}
              disabled={busy}
              aria-label={showPrivateKey ? 'Hide private key' : 'Show private key'}
            >
              {showPrivateKey ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function ReadinessModal({ check, onClose }) {
  if (!check) return null;

  const result = check.result || null;
  const contract = check.contract || {};
  const errors = Array.isArray(result?.errors) ? result.errors : [];
  const checks = [
    ['Contract Exists', Boolean(result?.contractExists)],
    ['Anchor Method Available', Boolean(result?.canAnchor)],
    ['RPC Connected', Boolean(result?.rpcConnected)],
    ['Wallet Loaded', Boolean(result?.walletLoaded)],
    ['Wallet Balance Available', Boolean(result?.walletBalance)],
    ['Anchor Simulation Passed', Boolean(result?.anchorSimulation)],
  ];

  return (
    <ModalShell
      title="Anchor Readiness Check"
      body="Read-only health check for the selected anchor contract."
      onClose={onClose}
      footer={
        <button className="btn btn-outline-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div className="border rounded-3 p-3 bg-light">
          <div className="small text-muted">Contract</div>
          <div className="fw-semibold text-break">{contractName(contract)}</div>
          <div className="small text-muted text-break">{contract.address || contractRecordKey(contract)}</div>
        </div>

        {check.error ? (
          <div className="alert alert-danger mb-0">{check.error}</div>
        ) : (
          <>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className={`badge ${result?.ready ? 'text-bg-success' : 'text-bg-danger'}`}>
                {result?.ready ? 'READY FOR ANCHORING' : 'NOT READY'}
              </span>
              <span className="small text-muted">
                Wallet balance: {result?.walletBalance ?? '0.0'} POL
              </span>
            </div>

            <ul className="list-group list-group-flush">
              {checks.map(([label, ok]) => (
                <li
                  key={label}
                  className="list-group-item d-flex justify-content-between align-items-center px-0"
                >
                  <span>{label}</span>
                  <span className={`badge ${ok ? 'text-bg-success' : 'text-bg-danger'}`}>
                    {ok ? '✓' : '✗'}
                  </span>
                </li>
              ))}
            </ul>

            {errors.length ? (
              <div className="alert alert-danger mb-0">
                {errors.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </ModalShell>
  );
}

function AccountActionMenu({ account, isOpen, onToggle, onClose, onEdit, onActivate, onDelete, busy }) {
  return (
    <FloatingActionMenu
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
      buttonContent={<FaCog />}
      ariaLabel={`Open actions for ${account.name || account.address || 'blockchain account'}`}
      menuWidth={210}
    >
      <div className="list-group list-group-flush">
        <button
          type="button"
          className="list-group-item list-group-item-action"
          onClick={() => {
            onClose();
            onEdit(account);
          }}
          disabled={busy}
        >
          <FaEdit className="me-2" />
          Edit Name
        </button>
        <button
          type="button"
          className="list-group-item list-group-item-action"
          onClick={() => {
            onClose();
            onActivate(account);
          }}
          disabled={busy || account.isActive}
        >
          Set Active
        </button>
        <button
          type="button"
          className="list-group-item list-group-item-action text-danger"
          onClick={() => {
            onClose();
            onDelete(account);
          }}
          disabled={busy || account.isActive}
        >
          <FaTrash className="me-2" />
          Delete
        </button>
      </div>
    </FloatingActionMenu>
  );
}

function BlockchainAccountsModal({
  open,
  busy,
  accounts,
  selectedAccountId,
  onSelectAccount,
  activeTab,
  onTabChange,
  onOpenAddAccount,
  openMenuId,
  onMenuToggle,
  onMenuClose,
  onEditAccount,
  onActivateAccount,
  onDeleteAccount,
  credentials,
  credentialsLoading,
  credentialsError,
  onClose,
}) {
  if (!open) return null;

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId || account._id === selectedAccountId) ||
    accounts.find((account) => account.isActive) ||
    accounts[0] ||
    null;
  const hasAccounts = accounts.length > 0;

  const tabs = ['Accounts', 'Anchored Credentials'];

  return (
    <ModalShell
      title="Manage Blockchain Accounts"
      body="Private keys are encrypted on save and are never shown again."
      onClose={busy ? () => {} : onClose}
      size="modal-xl"
      scrollable
      footer={
        <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
          Close
        </button>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div className="d-flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => onTabChange(tab)}
              disabled={tab === 'Anchored Credentials' && !hasAccounts}
            >
              {tab}
            </button>
          ))}
        </div>

        {!hasAccounts ? (
          <BlockchainAccountEmptyState onAddAccount={onOpenAddAccount} disabled={busy} />
        ) : activeTab === 'Accounts' ? (
          <>
            <div className="d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onOpenAddAccount}
                disabled={busy}
              >
                + Add Account
              </button>
            </div>

            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ minWidth: 180 }}>Name</th>
                    <th style={{ minWidth: 360 }}>Wallet Address</th>
                    <th style={{ minWidth: 120 }}>Status</th>
                    <th style={{ width: 110 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const id = account.id || account._id;
                    const isSelected = selectedAccount?.id === id || selectedAccount?._id === id;

                    return (
                      <tr
                        key={id || account.address}
                        className={isSelected ? 'table-active' : ''}
                        onClick={() => onSelectAccount(id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="fw-semibold">{account.name || 'Unnamed Account'}</td>
                        <td className="text-break small">{account.address}</td>
                        <td>
                          <span className={`badge ${account.isActive ? 'text-bg-success' : 'text-bg-secondary'}`}>
                            {account.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <AccountActionMenu
                            account={account}
                            isOpen={openMenuId === id}
                            onToggle={() => onMenuToggle(id)}
                            onClose={onMenuClose}
                            onEdit={onEditAccount}
                            onActivate={onActivateAccount}
                            onDelete={onDeleteAccount}
                            busy={busy}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="d-flex flex-column gap-3">
            <div className="border rounded-3 p-3 bg-light">
              <div className="small text-muted">Selected Account</div>
              <div className="fw-semibold">{selectedAccount?.name || 'No account selected'}</div>
              <div className="small text-break">{selectedAccount?.address || 'Select an account from the Accounts tab.'}</div>
            </div>

            {credentialsError ? <div className="alert alert-danger mb-0">{credentialsError}</div> : null}

            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ minWidth: 180 }}>Credential ID</th>
                    <th style={{ minWidth: 180 }}>Student</th>
                    <th style={{ minWidth: 120 }}>VC Type</th>
                    <th style={{ minWidth: 260 }}>Transaction Hash</th>
                    <th style={{ minWidth: 170 }}>Anchor Date</th>
                    <th style={{ minWidth: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {credentialsLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        Loading anchored credentials...
                      </td>
                    </tr>
                  ) : credentials.length ? (
                    credentials.map((credential) => (
                      <tr key={credential.id || credential.credentialId}>
                        <td className="small text-break">{credential.credentialId}</td>
                        <td>{credential.student || 'Not available'}</td>
                        <td>{credential.vcType || 'VC'}</td>
                        <td className="small text-break">{credential.transactionHash || 'Not available'}</td>
                        <td>{formatDate(credential.anchorDate)}</td>
                        <td>
                          <span className="badge text-bg-success">{credential.status || 'anchored'}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No anchored credentials found for this account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
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
  const [activeTab, setActiveTab] = useState('Connection');
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
  const [savingUserId, setSavingUserId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [confirmAction, setConfirmAction] = useState(null);
  const [textAction, setTextAction] = useState(null);
  const [readinessCheck, setReadinessCheck] = useState(null);
  const [checkingContractId, setCheckingContractId] = useState('');
  const [networkInfo, setNetworkInfo] = useState(null);
  const [networkQrConfig, setNetworkQrConfig] = useState(null);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [networkTest, setNetworkTest] = useState({ status: 'idle', message: '' });
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [emailSecret, setEmailSecret] = useState('');
  const [accountsModalOpen, setAccountsModalOpen] = useState(false);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [accountsModalTab, setAccountsModalTab] = useState('Accounts');
  const [selectedBlockchainAccountId, setSelectedBlockchainAccountId] = useState('');
  const [accountMenuId, setAccountMenuId] = useState('');
  const [accountForm, setAccountForm] = useState({
    name: '',
    privateKey: '',
  });
  const [anchoredCredentials, setAnchoredCredentials] = useState([]);
  const [anchoredCredentialsLoading, setAnchoredCredentialsLoading] = useState(false);
  const [anchoredCredentialsError, setAnchoredCredentialsError] = useState('');
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    activate: true,
    rotationReason: '',
  });
  const [rotateForm, setRotateForm] = useState({
    name: '',
    rotationReason: '',
  });

  const selectableContracts = useMemo(
    () =>
      (availableContracts || [])
        .filter((item) => isMerkleAnchorContract(item) && contractRecordKey(item))
        .sort((a, b) => {
          const activeKeys = [
            settings.blockchain?.selectedContractId,
            settings.blockchain?.selectedContractAddress,
            wallet?.activeContract?._id,
            wallet?.activeContract?.address,
          ].filter(Boolean);

          const aActive = activeKeys.some((key) => isSameContract(a, key));
          const bActive = activeKeys.some((key) => isSameContract(b, key));

          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;
          return 0;
        }),
    [
      availableContracts,
      settings.blockchain?.selectedContractAddress,
      settings.blockchain?.selectedContractId,
      wallet?.activeContract?._id,
      wallet?.activeContract?.address,
    ]
  );
  const selectedContractOption = useMemo(
    () => selectableContracts.find((item) => isSameContract(item, selectedContractId)),
    [selectableContracts, selectedContractId]
  );
  const blockchainAccounts = useMemo(
    () => wallet?.blockchainAccounts || [],
    [wallet?.blockchainAccounts]
  );
  const activeBlockchainAccount = useMemo(
    () => wallet?.activeAccount || blockchainAccounts.find((account) => account.isActive) || null,
    [blockchainAccounts, wallet?.activeAccount]
  );
  const activeContract = useMemo(() => {
    const activeKeys = [
      settings.blockchain?.selectedContractId,
      settings.blockchain?.selectedContractAddress,
      wallet?.activeContract?._id,
      wallet?.activeContract?.address,
    ].filter(Boolean);

    return (
      selectableContracts.find((item) => activeKeys.some((key) => isSameContract(item, key))) ||
      wallet?.activeContract ||
      (settings.blockchain?.selectedContractAddress || settings.blockchain?.selectedContractId
        ? settings.blockchain
        : null)
    );
  }, [
    selectableContracts,
    settings.blockchain,
    wallet?.activeContract,
  ]);
  const effectiveNetwork = useMemo(() => {
    const saved = settings.network || {};
    const envInfo = networkInfo?.environment || {};
    const network = networkInfo?.network || {};

    return {
      ...EMPTY_SETTINGS.network,
      ...saved,
      domainApiBaseUrl: saved.domainApiBaseUrl || envInfo.domainApiBaseUrl || '',
      domainWebBaseUrl: saved.domainWebBaseUrl || envInfo.domainWebBaseUrl || '',
      preferredMode: saved.preferredMode || envInfo.preferredMode || 'domain',
      discoveryEnabled:
        typeof saved.discoveryEnabled === 'boolean'
          ? saved.discoveryEnabled
          : Boolean(networkInfo?.discovery?.enabled),
      apiPort: saved.apiPort || network.port || 5000,
      webPort: saved.webPort || network.webPort || 5173,
    };
  }, [settings.network, networkInfo]);
  const selectedLanApiUrl =
    effectiveNetwork.manualApiBaseUrl ||
    networkInfo?.network?.suggestedLanApiUrls?.[0] ||
    networkInfo?.environment?.lanApiBaseUrls?.[0] ||
    '';
  const selectedLanWebUrl =
    effectiveNetwork.manualWebBaseUrl ||
    networkInfo?.network?.suggestedLanWebUrls?.[0] ||
    networkInfo?.environment?.lanWebBaseUrls?.[0] ||
    '';
  const selectedApiForTest =
    effectiveNetwork.preferredMode === 'domain' && effectiveNetwork.domainApiBaseUrl
      ? effectiveNetwork.domainApiBaseUrl
      : selectedLanApiUrl;
  const qrPayload = useMemo(
    () => {
      const serverPayload = networkQrConfig || null;
      if (serverPayload?.type === 'BCVS_SERVER_CONFIG') {
        return {
          type: 'BCVS_SERVER_CONFIG',
          system: 'BCVS',
          preferred: serverPayload.preferred || 'lan',
          lanApiBaseUrl: serverPayload.lanApiBaseUrl || '',
          lanWebBaseUrl: serverPayload.lanWebBaseUrl || '',
          domainApiBaseUrl: serverPayload.domainApiBaseUrl || '',
          domainWebBaseUrl: serverPayload.domainWebBaseUrl || '',
          healthUrl: serverPayload.healthUrl || '',
        };
      }

      return {
        type: 'BCVS_SERVER_CONFIG',
        system: 'BCVS',
        preferred: effectiveNetwork.preferredMode || 'domain',
        lanApiBaseUrl: selectedLanApiUrl,
        lanWebBaseUrl: selectedLanWebUrl,
        domainApiBaseUrl: effectiveNetwork.domainApiBaseUrl || '',
        domainWebBaseUrl: effectiveNetwork.domainWebBaseUrl || '',
        healthUrl: healthUrlFor(selectedApiForTest || selectedLanApiUrl),
      };
    },
    [
      effectiveNetwork.domainApiBaseUrl,
      effectiveNetwork.domainWebBaseUrl,
      effectiveNetwork.preferredMode,
      networkQrConfig,
      selectedApiForTest,
      selectedLanApiUrl,
      selectedLanWebUrl,
    ]
  );

  async function loadDashboard() {
    try {
      setLoading(true);
      const [data, network, networkQr] = await Promise.all([
        getSettingsDashboard(),
        fetchNetworkInfo().catch(() => null),
        fetchNetworkQrConfig().catch(() => null),
      ]);
      setSettings({ ...EMPTY_SETTINGS, ...(data.settings || {}) });
      setAdmins(data.admins || []);
      setIssuerKeys(data.issuerKeys || []);
      setActiveIssuerKey(data.activeIssuerKey || null);
      setWallet(data.wallet || EMPTY_WALLET);
      setAvailableContracts(data.availableContracts || []);
      setAccess(data.access || EMPTY_ACCESS);
      setNetworkInfo(network);
      setNetworkQrConfig(networkQr);
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

  useEffect(() => {
    if (!accountsModalOpen || selectedBlockchainAccountId) return;

    const account = activeBlockchainAccount || blockchainAccounts[0] || null;
    if (account) {
      setSelectedBlockchainAccountId(account.id || account._id || '');
    }
  }, [accountsModalOpen, activeBlockchainAccount, blockchainAccounts, selectedBlockchainAccountId]);

  useEffect(() => {
    if (!accountsModalOpen || accountsModalTab !== 'Anchored Credentials' || !selectedBlockchainAccountId) {
      return undefined;
    }

    let active = true;

    async function loadAnchoredCredentials() {
      try {
        setAnchoredCredentialsLoading(true);
        setAnchoredCredentialsError('');
        const data = await listBlockchainAccountCredentials(selectedBlockchainAccountId);
        if (active) setAnchoredCredentials(data.credentials || []);
      } catch (error) {
        if (active) {
          setAnchoredCredentials([]);
          setAnchoredCredentialsError(actionError(error, 'Failed to load anchored credentials.'));
        }
      } finally {
        if (active) setAnchoredCredentialsLoading(false);
      }
    }

    loadAnchoredCredentials();

    return () => {
      active = false;
    };
  }, [accountsModalOpen, accountsModalTab, selectedBlockchainAccountId]);

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(JSON.stringify(qrPayload), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [qrPayload]);

  function closeActionModals() {
    setConfirmAction(null);
    setTextAction(null);
  }

  function actionError(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
  }

  function openAddBlockchainAccountModal() {
    setAccountForm({ name: '', privateKey: '' });
    setAddAccountModalOpen(true);
  }

  function closeAddBlockchainAccountModal() {
    setAddAccountModalOpen(false);
    setAccountForm({ name: '', privateKey: '' });
  }

  function openBlockchainAccountsModal() {
    setAccountsModalTab('Accounts');
    setAccountsModalOpen(true);
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

  function confirmSaveNetwork() {
    setConfirmAction({
      title: 'Save network settings?',
      body: 'Mobile devices will use these LAN/domain preferences for pairing and runtime server selection.',
      confirmLabel: 'Save Network Settings',
      run: async () => {
        const updated = await updateNetworkSettings({ network: effectiveNetwork });
        setSettings((prev) => ({
          ...prev,
          network: {
            ...(prev.network || {}),
            ...updated,
          },
        }));
        const [network, networkQr] = await Promise.all([
          fetchNetworkInfo().catch(() => null),
          fetchNetworkQrConfig().catch(() => null),
        ]);
        setNetworkInfo(network);
        setNetworkQrConfig(networkQr);
        setFeedback({ type: 'success', text: 'Network settings saved.' });
      },
    });
  }

  function confirmSaveEmail() {
    setConfirmAction({
      title: 'Save email OTP settings?',
      body: settings.emailOtp?.enabled
        ? 'Email OTP will require configured provider details. Secret values are encrypted and never returned.'
        : 'Registration will use the MIS-controlled OTP disabled flow for capstone testing.',
      confirmLabel: 'Save Email Settings',
      run: async () => {
        const updated = await updateEmailSettings({
          emailOtp: {
            ...settings.emailOtp,
            apiKey: emailSecret,
          },
        });
        setSettings((prev) => ({
          ...prev,
          emailOtp: {
            ...(prev.emailOtp || {}),
            ...updated,
          },
        }));
        setEmailSecret('');
        setFeedback({ type: 'success', text: 'Email OTP settings saved.' });
      },
    });
  }

  async function testSelectedApiUrl(apiBaseUrl = selectedApiForTest) {
    const target = normalizeApiBaseUrl(apiBaseUrl);

    if (!target) {
      setNetworkTest({ status: 'danger', message: 'Select or enter an API URL first.' });
      return;
    }

    try {
      setNetworkBusy(true);
      setNetworkTest({ status: 'idle', message: 'Testing connection...' });
      const response = await fetch(healthUrlFor(target), { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok || payload?.system !== 'BCVS' || payload?.service !== 'bcvs-api') {
        throw new Error('The server responded, but it is not a BCVS API health endpoint.');
      }

      setNetworkTest({
        status: 'success',
        message: `Connected to ${target}.`,
      });
    } catch (error) {
      setNetworkTest({
        status: 'danger',
        message: error.message || 'Connection test failed.',
      });
    } finally {
      setNetworkBusy(false);
    }
  }

  function confirmSaveContract(contract = selectedContractOption) {
    const contractId = contractRecordKey(contract) || selectedContractId;

    if (!contractId) {
      setFeedback({ type: 'danger', text: 'Select a contract before saving.' });
      return;
    }

    setConfirmAction({
      title: 'Change active contract?',
      body: 'New anchoring operations will use the selected deployed contract.',
      details: `${contractName(contract)} - ${contractId}`,
      confirmLabel: 'Save Active Contract',
      run: async () => {
        const updated = await updateActiveContract({ contractId });
        await loadDashboard();
        setFeedback({
          type: updated.warning ? 'warning' : 'success',
          text: updated.warning || 'Active contract updated.',
        });
      },
    });
  }

  async function handleAddBlockchainAccount() {
    try {
      setBusy(true);
      const created = await createBlockchainAccount(accountForm);
      setAccountForm({ name: '', privateKey: '' });
      setAddAccountModalOpen(false);
      setSelectedBlockchainAccountId(created.id || created._id || '');
      setFeedback({ type: 'success', text: 'Blockchain account added.' });
      await loadDashboard();
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to add blockchain account.') });
    } finally {
      setBusy(false);
    }
  }

  function editBlockchainAccount(account) {
    setTextAction({
      title: 'Edit blockchain account name',
      body: 'Private keys cannot be edited. Create a new account when a new key is required.',
      label: 'Account Name',
      initialValue: account.name || '',
      required: true,
      confirmLabel: 'Save',
      run: async (name) => {
        await updateBlockchainAccount(account.id || account._id, { name });
        setFeedback({ type: 'success', text: 'Blockchain account name updated.' });
        await loadDashboard();
      },
    });
  }

  function confirmActivateBlockchainAccount(account) {
    setSelectedBlockchainAccountId(account.id || account._id || '');
    setConfirmAction({
      title: 'Change Active Blockchain Account',
      body: 'Future blockchain transactions will use the selected account. Existing anchored credentials will remain unchanged.',
      details: `${account.name || 'Blockchain Account'} - ${account.address}`,
      confirmLabel: 'Confirm',
      run: async () => {
        await activateBlockchainAccount(account.id || account._id);
        setFeedback({ type: 'success', text: 'Active blockchain account updated.' });
        await loadDashboard();
      },
    });
  }

  function confirmDeleteBlockchainAccount(account) {
    setConfirmAction({
      title: 'Delete blockchain account?',
      body: 'Only unused inactive accounts can be deleted.',
      details: `${account.name || 'Blockchain Account'} - ${account.address}`,
      confirmLabel: 'Delete',
      variant: 'danger',
      run: async () => {
        await deleteBlockchainAccount(account.id || account._id);
        setFeedback({ type: 'success', text: 'Blockchain account deleted.' });
        setSelectedBlockchainAccountId('');
        await loadDashboard();
      },
    });
  }

  async function handleCheckReadiness(contract) {
    const contractId = contractRecordKey(contract);

    if (!contractId) {
      setReadinessCheck({
        contract,
        result: null,
        error: 'A contract address or id is required before running the readiness check.',
      });
      return;
    }

    try {
      setCheckingContractId(contractId);
      const result = await checkAnchorReadiness(contractId);
      setReadinessCheck({ contract, result, error: '' });
    } catch (error) {
      setReadinessCheck({
        contract,
        result: null,
        error: actionError(error, 'Failed to check anchor readiness.'),
      });
    } finally {
      setCheckingContractId('');
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

  function renderEmailSettings() {
    const emailOtp = {
      ...EMPTY_SETTINGS.emailOtp,
      ...(settings.emailOtp || {}),
    };
    const canEdit = access.canManageEmailSettings;

    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Email Provider</h2>
              <p className="text-muted mb-0">
                Configure delivered OTP email for mobile registration and password resets.
              </p>
            </div>
            <span className={`badge ${emailOtp.enabled ? 'text-bg-success' : 'text-bg-secondary'}`}>
              {emailOtp.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="alert alert-light border">
            {emailOtp.enabled
              ? 'Resend is enabled for OTP delivery. The API key is encrypted and never returned.'
              : 'OTP email delivery is disabled. Mobile registration will use the MIS-disabled flow.'}
          </div>

          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Provider</label>
              <select
                className="form-select"
                value={emailOtp.provider || 'resend'}
                disabled={!canEdit}
                onChange={(event) => updateNested('emailOtp', 'provider', event.target.value)}
              >
                <option value="resend">Resend</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">Status</label>
              <select
                className="form-select"
                value={emailOtp.enabled ? 'enabled' : 'disabled'}
                disabled={!canEdit}
                onChange={(event) => updateNested('emailOtp', 'enabled', event.target.value === 'enabled')}
              >
                <option value="disabled">Disabled</option>
                <option value="enabled">Enabled</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">API Key</label>
              <input
                className="form-control"
                value={emailSecret}
                disabled={!canEdit}
                type="password"
                placeholder={emailOtp.apiKeyConfigured || emailOtp.secretConfigured ? 'Configured' : 'Resend API key'}
                onChange={(event) => setEmailSecret(event.target.value)}
              />
              <div className="form-text">Leave blank to keep the current encrypted API key.</div>
            </div>
          </div>

          {canEdit ? (
            <div className="mt-4 d-flex justify-content-end">
              <button className="btn btn-primary" onClick={confirmSaveEmail}>
                Save Email Settings
              </button>
            </div>
          ) : (
            <div className="alert alert-light border mt-4 mb-0">
              Email OTP settings are read only for your role.
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

  function renderUrlList(items = []) {
    const urls = (items || []).filter(Boolean);

    if (!urls.length) {
      return <div className="text-muted small">No LAN address detected yet.</div>;
    }

    return (
      <div className="d-flex flex-column gap-2">
        {urls.map((url) => (
          <div
            className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded-3 p-2 bg-light"
            key={url}
          >
            <span className="small text-break">{url}</span>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => copyToClipboard(url, setFeedback)}
            >
              Copy
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderConnection() {
    const canEdit = access.canManageNetworkSettings;
    const domainApi = effectiveNetwork.domainApiBaseUrl || 'https://api.psau-credentials.cfd/api';
    const domainWeb = effectiveNetwork.domainWebBaseUrl || 'https://psau-credentials.cfd';

    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1">Connection</h2>
              <p className="text-muted mb-0">
                Keep the public verifier on the root domain and backend requests on the API subdomain.
              </p>
            </div>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadDashboard} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="small text-muted">Web / Verification Domain</div>
                <div className="fw-semibold text-break">{domainWeb}</div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="small text-muted">Backend API Domain</div>
                <div className="fw-semibold text-break">{domainApi}</div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-5">
              <label className="form-label fw-semibold">Web / Verification Domain</label>
              <input
                className="form-control"
                value={effectiveNetwork.domainWebBaseUrl}
                disabled={!canEdit}
                placeholder="https://psau-credentials.cfd"
                onChange={(event) => updateNested('network', 'domainWebBaseUrl', event.target.value)}
              />
            </div>
            <div className="col-lg-5">
              <label className="form-label fw-semibold">Backend API Domain</label>
              <input
                className="form-control"
                value={effectiveNetwork.domainApiBaseUrl}
                disabled={!canEdit}
                placeholder="https://api.psau-credentials.cfd/api"
                onChange={(event) => updateNested('network', 'domainApiBaseUrl', event.target.value)}
              />
            </div>
            <div className="col-lg-2">
              <label className="form-label fw-semibold">Mode</label>
              <select
                className="form-select"
                value={effectiveNetwork.preferredMode}
                disabled={!canEdit}
                onChange={(event) => updateNested('network', 'preferredMode', event.target.value)}
              >
                <option value="domain">Domain</option>
                <option value="lan">LAN fallback</option>
              </select>
            </div>
          </div>

          <div className="border rounded-3 p-3 mt-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <div className="fw-semibold">API health check</div>
                <div className="small text-muted text-break">
                  {domainApi ? healthUrlFor(domainApi) : 'Configure the backend API domain first.'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => testSelectedApiUrl(domainApi)}
                disabled={networkBusy || !domainApi}
              >
                {networkBusy ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {networkTest.message ? (
              <div className={`alert alert-${networkTest.status} py-2 mt-3 mb-0`}>
                {networkTest.message}
              </div>
            ) : null}
          </div>

          {canEdit ? (
            <div className="mt-4 d-flex justify-content-end">
              <button className="btn btn-primary" onClick={confirmSaveNetwork}>
                Save Connection Settings
              </button>
            </div>
          ) : (
            <div className="alert alert-light border mt-4 mb-0">
              Connection settings are read only for your role.
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderNetworkMobile() {
    const canEdit = access.canManageNetworkSettings;
    const lanApiUrls =
      networkInfo?.network?.suggestedLanApiUrls || networkInfo?.environment?.lanApiBaseUrls || [];
    const lanWebUrls =
      networkInfo?.network?.suggestedLanWebUrls || networkInfo?.environment?.lanWebBaseUrls || [];
    const ipv4 = networkInfo?.network?.ipv4 || [];

    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1">Advanced Network Fallback</h2>
              <p className="text-muted mb-0">
                Debug QR pairing, LAN, manual, and discovery settings for MIS-controlled fallback use.
              </p>
            </div>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadDashboard} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="alert alert-warning">
            The normal student app starts with the public API domain. LAN, QR pairing, manual setup, and discovery
            tools are fallback controls for MIS testing and outage handling.
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="small text-muted">Server hostname</div>
                <div className="fw-semibold text-break">{networkInfo?.network?.hostname || 'Not available'}</div>
              </div>
            </div>
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="small text-muted">IPv4 candidates</div>
                <div className="fw-semibold text-break">
                  {ipv4.length ? ipv4.join(', ') : 'No LAN IPv4 detected'}
                </div>
              </div>
            </div>
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="small text-muted">Preferred mode</div>
                <div className="fw-semibold text-uppercase">{effectiveNetwork.preferredMode}</div>
              </div>
            </div>
            <div className="col-md-6 col-xl-3">
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="small text-muted">Discovery status</div>
                <div className="fw-semibold">
                  {effectiveNetwork.discoveryEnabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-7">
              <div className="d-flex flex-column gap-3">
                <div>
                  <h3 className="h6">Suggested LAN API URLs</h3>
                  {renderUrlList(lanApiUrls)}
                </div>
                <div>
                  <h3 className="h6">Suggested LAN Web URLs</h3>
                  {renderUrlList(lanWebUrls)}
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Backend API Domain</label>
                    <input
                      className="form-control"
                      value={effectiveNetwork.domainApiBaseUrl}
                      disabled={!canEdit}
                      placeholder="https://api.psau-credentials.cfd/api"
                      onChange={(event) => updateNested('network', 'domainApiBaseUrl', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Web / Verification Domain</label>
                    <input
                      className="form-control"
                      value={effectiveNetwork.domainWebBaseUrl}
                      disabled={!canEdit}
                      placeholder="https://psau-credentials.cfd"
                      onChange={(event) => updateNested('network', 'domainWebBaseUrl', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Manual mobile API URL</label>
                    <input
                      className="form-control"
                      value={effectiveNetwork.manualApiBaseUrl}
                      disabled={!canEdit}
                      placeholder={lanApiUrls[0] || 'http://SERVER_IP:5000/api'}
                      onChange={(event) => updateNested('network', 'manualApiBaseUrl', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Manual web URL</label>
                    <input
                      className="form-control"
                      value={effectiveNetwork.manualWebBaseUrl}
                      disabled={!canEdit}
                      placeholder={lanWebUrls[0] || 'http://SERVER_IP:5173'}
                      onChange={(event) => updateNested('network', 'manualWebBaseUrl', event.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Preferred deployment mode</label>
                    <select
                      className="form-select"
                      value={effectiveNetwork.preferredMode}
                      disabled={!canEdit}
                      onChange={(event) => updateNested('network', 'preferredMode', event.target.value)}
                    >
                      <option value="domain">Domain</option>
                      <option value="lan">LAN fallback</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">API port</label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      className="form-control"
                      value={effectiveNetwork.apiPort}
                      disabled={!canEdit}
                      onChange={(event) => updateNested('network', 'apiPort', Number(event.target.value || 5000))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Web port</label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      className="form-control"
                      value={effectiveNetwork.webPort}
                      disabled={!canEdit}
                      onChange={(event) => updateNested('network', 'webPort', Number(event.target.value || 5173))}
                    />
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-3">
                  <label className="form-check form-switch d-flex align-items-center gap-2">
                    <Toggle
                      checked={effectiveNetwork.discoveryEnabled}
                      disabled={!canEdit}
                      onChange={(value) => updateNested('network', 'discoveryEnabled', value)}
                    />
                    <span className="fw-semibold">Discovery enabled</span>
                  </label>
                  <label className="form-check form-switch d-flex align-items-center gap-2">
                    <Toggle
                      checked={effectiveNetwork.qrPairingEnabled}
                      disabled={!canEdit}
                      onChange={(value) => updateNested('network', 'qrPairingEnabled', value)}
                    />
                    <span className="fw-semibold">QR pairing enabled</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="border rounded-3 p-3 h-100">
                <h3 className="h6 mb-3">Mobile pairing QR</h3>
                <div className="d-flex flex-column align-items-center gap-3">
                  <div className="alert alert-light border py-2 w-100 mb-0">
                    QR pairing status:{' '}
                    {networkQrConfig?.generatedAt
                      ? `Ready - generated ${formatDate(networkQrConfig.generatedAt)}`
                      : 'Using local fallback payload'}
                  </div>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="BCVS mobile server setup QR" width="220" height="220" />
                  ) : (
                    <div className="border rounded-3 p-4 text-muted">QR unavailable</div>
                  )}
                  <div className="w-100">
                    <div className="small text-muted">Selected API</div>
                    <div className="fw-semibold text-break">{selectedApiForTest || 'Not configured'}</div>
                  </div>
                  <div className="d-flex flex-wrap gap-2 w-100">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => copyToClipboard(selectedApiForTest, setFeedback)}
                      disabled={!selectedApiForTest}
                    >
                      Copy API URL
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => copyToClipboard(selectedLanWebUrl, setFeedback)}
                      disabled={!selectedLanWebUrl}
                    >
                      Copy Web URL
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => testSelectedApiUrl()}
                      disabled={networkBusy || !selectedApiForTest}
                    >
                      {networkBusy ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                  {networkTest.message ? (
                    <div className={`alert alert-${networkTest.status} py-2 w-100 mb-0`}>
                      {networkTest.message}
                    </div>
                  ) : (
                    <div className="alert alert-light border py-2 w-100 mb-0">
                      Health endpoint: {selectedApiForTest ? healthUrlFor(selectedApiForTest) : 'Not configured'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {canEdit ? (
            <div className="mt-4 d-flex justify-content-end">
              <button className="btn btn-primary" onClick={confirmSaveNetwork}>
                Save Network Settings
              </button>
            </div>
          ) : (
            <div className="alert alert-light border mt-4 mb-0">
              Network settings are read only for your role.
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderBlockchain() {
    const hasActiveAccount = Boolean(activeBlockchainAccount?.address);
    const hasBlockchainAccounts = blockchainAccounts.length > 0;
    const statusLabel = hasActiveAccount ? (wallet?.ok ? 'Active' : 'Needs attention') : 'Not configured';
    const statusClass = hasActiveAccount ? (wallet?.ok ? 'text-bg-success' : 'text-bg-warning') : 'text-bg-secondary';

    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1">Blockchain Account</h2>
              <p className="text-muted mb-0">
                Future blockchain transactions use the active account selected here.
              </p>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={loadDashboard} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              {!hasBlockchainAccounts ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={openAddBlockchainAccountModal}
                  disabled={!access.canManageBlockchainAccounts || busy}
                >
                  + Add Account
                </button>
              ) : null}
              <button
                className={`btn btn-sm ${hasBlockchainAccounts ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={openBlockchainAccountsModal}
                disabled={!access.canManageBlockchainAccounts}
              >
                Manage Accounts
              </button>
            </div>
          </div>

          {!hasBlockchainAccounts ? (
            <>
              <BlockchainAccountEmptyState
                onAddAccount={openAddBlockchainAccountModal}
                disabled={!access.canManageBlockchainAccounts || busy}
              />
              {!access.canManageBlockchainAccounts ? (
                <div className="alert alert-light border mt-3 mb-0">
                  Blockchain accounts are read only for your role.
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="row g-3 mb-4">
                <div className="col-md-6 col-xl-4">
                  <div className="border rounded-3 p-3 h-100 bg-light">
                    <div className="small text-muted">Active Account</div>
                    <div className="fw-semibold">{activeBlockchainAccount?.name || 'Not configured'}</div>
                  </div>
                </div>
                <div className="col-md-6 col-xl-5">
                  <div className="border rounded-3 p-3 h-100 bg-light">
                    <div className="small text-muted">Account Address</div>
                    <div className="fw-semibold small text-break">
                      {activeBlockchainAccount?.address || 'Not configured'}
                    </div>
                  </div>
                </div>
                <div className="col-md-6 col-xl-3">
                  <div className="border rounded-3 p-3 h-100 bg-light">
                    <div className="small text-muted">Status</div>
                    <span className={`badge ${statusClass}`}>{statusLabel}</span>
                  </div>
                </div>
              </div>

              {true ? (
                <>
                  {!wallet?.ok && wallet?.error ? (
                    <div className="alert alert-warning mb-0">{wallet.error}</div>
                  ) : null}

                  {!access.canManageBlockchainAccounts ? (
                    <div className="alert alert-light border mb-0">
                      Blockchain accounts are read only for your role.
                    </div>
                  ) : null}
                </>
              ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ minWidth: 360 }}>Contract Address</th>
                    <th style={{ minWidth: 120 }}>Status</th>
                    <th style={{ minWidth: 120 }}>Active</th>
                    <th style={{ minWidth: 220 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectableContracts.map((contract) => {
                    const key = contractRecordKey(contract);
                    const isActive = [
                      activeContract?._id,
                      activeContract?.address,
                      activeContract?.selectedContractId,
                      activeContract?.selectedContractAddress,
                      settings.blockchain?.selectedContractId,
                      settings.blockchain?.selectedContractAddress,
                    ]
                      .filter(Boolean)
                      .some((value) => isSameContract(contract, value));

                    return (
                      <tr key={key} className={isActive ? 'table-success' : ''}>
                        <td>
                          <div className="fw-semibold text-break">
                            {contractAddressUrl(contract) ? (
                              <a href={contractAddressUrl(contract)} target="_blank" rel="noreferrer">
                                {contract.address}
                              </a>
                            ) : (
                              contract.address || key
                            )}
                          </div>
                          <div className="small text-muted">{contractName(contract)}</div>
                        </td>
                        <td>
                          <span className={`badge ${contractStatusBadge(contract)}`}>
                            {contractStatusLabel(contract)}
                          </span>
                        </td>
                        <td>
                          {isActive ? (
                            <span className="badge text-bg-success">Active</span>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                          <button
                            className="btn btn-outline-success btn-sm"
                            type="button"
                            onClick={() => handleCheckReadiness(contract)}
                            disabled={checkingContractId === key}
                          >
                            {checkingContractId === key ? 'Checking...' : 'Check'}
                          </button>
                          <button
                            className="btn btn-success btn-sm"
                            type="button"
                            onClick={() => confirmSaveContract(contract)}
                            disabled={isActive || !access.canManageActiveContract}
                          >
                            {isActive ? 'Active' : 'Set Active'}
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  function renderAdvanced() {
    const panels = [
      { key: 'permissions', title: 'Permissions', visible: true, render: renderPermissions },
      {
        key: 'email',
        title: 'Email / OTP',
        visible: access.canViewEmailSettings,
        render: renderEmailSettings,
      },
      {
        key: 'issuer-keys',
        title: 'Issuer Key Vault',
        visible: access.canViewIssuerKeys,
        render: renderIssuerKeys,
      },
      { key: 'business', title: 'Business Rules', visible: true, render: renderBusinessRules },
      { key: 'locks', title: 'MIS Technical Locks', visible: true, render: renderLocks },
      {
        key: 'network',
        title: 'Network Fallback',
        visible: access.canViewNetworkSettings,
        render: renderNetworkMobile,
      },
      {
        key: 'blockchain',
        title: 'Blockchain / Contract',
        visible: access.canViewBlockchain,
        render: renderBlockchain,
      },
    ].filter((panel) => panel.visible);

    return (
      <div className="d-flex flex-column gap-3">
        {panels.map((panel, index) => (
          <details className="border rounded-3 bg-white shadow-sm" key={panel.key} open={index === 0}>
            <summary className="fw-semibold p-3">{panel.title}</summary>
            <div className="p-3 border-top">{panel.render()}</div>
          </details>
        ))}
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === 'Action Logs') return <AuditLogsPage embedded />;
    if (activeTab === 'Advanced') return renderAdvanced();
    return renderConnection();
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
        {feedback.text ? (
          <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
        ) : null}

        <div className="d-flex flex-wrap gap-2">
          {TABS.filter((tab) => {
            if (tab === 'Connection') return access.canViewNetworkSettings;
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

      <ReadinessModal
        check={readinessCheck}
        onClose={() => setReadinessCheck(null)}
      />
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
      <BlockchainAccountsModal
        open={accountsModalOpen}
        busy={busy}
        accounts={blockchainAccounts}
        selectedAccountId={selectedBlockchainAccountId}
        onSelectAccount={setSelectedBlockchainAccountId}
        activeTab={accountsModalTab}
        onTabChange={setAccountsModalTab}
        onOpenAddAccount={openAddBlockchainAccountModal}
        openMenuId={accountMenuId}
        onMenuToggle={(id) => setAccountMenuId((current) => (current === id ? '' : id))}
        onMenuClose={() => setAccountMenuId('')}
        onEditAccount={editBlockchainAccount}
        onActivateAccount={confirmActivateBlockchainAccount}
        onDeleteAccount={confirmDeleteBlockchainAccount}
        credentials={anchoredCredentials}
        credentialsLoading={anchoredCredentialsLoading}
        credentialsError={anchoredCredentialsError}
        onClose={() => setAccountsModalOpen(false)}
      />
      <AddBlockchainAccountModal
        open={addAccountModalOpen}
        busy={busy}
        form={accountForm}
        onFormChange={setAccountForm}
        onSave={handleAddBlockchainAccount}
        onCancel={closeAddBlockchainAccountModal}
      />
    </>
  );
}

