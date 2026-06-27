import { Types } from 'mongoose';
import { generateKeyPairSync } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import {
  buildIssuerKid,
  buildPublicKeyFingerprint,
  decryptSecret,
  encryptSecret,
  encryptPrivateKey,
} from '../../shared/utils/keyVault.js';
import { getUserModel } from '../auth/user.model.js';
import { getContractModel } from '../contracts/model.js';
import {
  EMPTY_MERKLE_CAPABILITIES,
  getCapabilitiesForContract,
  getContractsDashboard,
} from '../contracts/service.js';
import { getAdminPermissionModel } from './adminPermission.model.js';
import {
  activateBlockchainAccount as activateBlockchainAccountRecord,
  createBlockchainAccount as createBlockchainAccountRecord,
  deleteBlockchainAccount as deleteBlockchainAccountRecord,
  listAnchoredCredentialsForAccount as listAnchoredCredentialsForBlockchainAccount,
  listBlockchainAccounts as listBlockchainAccountRecords,
  updateBlockchainAccount as updateBlockchainAccountRecord,
} from './blockchainAccount.service.js';
import { getIssuerKeyModel } from './issuerKey.model.js';
import { getSystemSettingModel } from './setting.model.js';

const DEFAULT_PERMISSIONS = {
  admin: {
    canIssueVC: true,
    canSendQrEmail: true,
    canApproveAnchoring: false,
    canManageSystemSettings: false,
    canManageContracts: false,
    canViewWallet: false,
    canConfirmPayments: true,
    canManageVC: true,
    canSignVC: true,
    canGenerateClaimQr: true,
    canAnchorVC: true,
    canManageUsers: false,
    canManageSettings: false,
  },
  super_admin: {
    canIssueVC: true,
    canSendQrEmail: true,
    canApproveAnchoring: true,
    canManageSystemSettings: true,
    canManageContracts: false,
    canViewWallet: true,
    canConfirmPayments: true,
    canManageVC: true,
    canSignVC: true,
    canGenerateClaimQr: true,
    canAnchorVC: true,
    canManageUsers: true,
    canManageSettings: true,
  },
  developer: {
    canIssueVC: false,
    canSendQrEmail: false,
    canApproveAnchoring: false,
    canManageSystemSettings: true,
    canManageContracts: true,
    canViewWallet: true,
    canConfirmPayments: true,
    canManageVC: true,
    canSignVC: true,
    canGenerateClaimQr: true,
    canAnchorVC: true,
    canManageUsers: true,
    canManageSettings: true,
  },
  cashier: {
    canIssueVC: false,
    canSendQrEmail: false,
    canApproveAnchoring: false,
    canManageSystemSettings: false,
    canManageContracts: false,
    canViewWallet: false,
    canConfirmPayments: true,
    canManageVC: false,
    canSignVC: false,
    canGenerateClaimQr: false,
    canAnchorVC: false,
    canManageUsers: false,
    canManageSettings: false,
  },
};

function getDefaultPermissions(role) {
  return { ...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.admin) };
}

function assertDeveloper(actor, message = 'Only the MIS developer can perform this action') {
  if (!actor || actor.role !== 'developer') {
    throw new ApiError(403, message);
  }
}

function assertSettingsViewer(actor) {
  if (!actor || !['admin', 'super_admin', 'developer'].includes(actor.role)) {
    throw new ApiError(403, 'You do not have access to settings');
  }
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function makeIssuerKeyName(name) {
  const cleaned = cleanString(name);
  if (cleaned) return cleaned;
  return `Issuer Key ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;
}

function serializeIssuerKey(key) {
  return {
    _id: key._id,
    name: key.name,
    kid: key.kid,
    fingerprint: key.fingerprint,
    algorithm: key.algorithm,
    curve: key.curve,
    publicKeyPem: key.publicKeyPem,
    status: key.status,
    isActive: key.isActive,
    rotationReason: key.rotationReason || '',
    activatedAt: key.activatedAt,
    retiredAt: key.retiredAt,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  };
}

function buildAccess(actor) {
  return {
    canViewPage: ['admin', 'super_admin', 'developer'].includes(actor.role),
    canEditBusinessSettings: actor.role === 'super_admin',
    canEditSystemLocks: actor.role === 'developer',
    canEditPermissions: actor.role === 'developer',
    canViewNetworkSettings: ['admin', 'super_admin', 'developer'].includes(actor.role),
    canManageNetworkSettings: ['super_admin', 'developer'].includes(actor.role),
    canViewBlockchain: ['super_admin', 'developer'].includes(actor.role),
    canViewIssuerKeys: ['admin', 'super_admin', 'developer'].includes(actor.role),
    canManageIssuerKeys: actor.role === 'developer',
    canManageActiveContract: actor.role === 'developer',
    canManageBlockchainAccounts: actor.role === 'developer',
    canViewEmailSettings: ['super_admin', 'developer'].includes(actor.role),
    canManageEmailSettings: ['super_admin', 'developer'].includes(actor.role),
  };
}

function cleanUrl(value) {
  return cleanString(value).replace(/\/+$/, '');
}

function normalizeApiBaseUrl(value) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return '';
  return /\/api$/i.test(cleaned) ? cleaned : `${cleaned}/api`;
}

function normalizeWebBaseUrl(value) {
  return cleanUrl(value)
    .replace(/\/api\/?$/i, '')
    .replace(/\/verification-portal\/verify\/?$/i, '')
    .replace(/\/verification-portal\/?$/i, '')
    .replace(/\/verify\/?$/i, '');
}

function hostnameFromUrl(value) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return '';

  try {
    return new URL(cleaned).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function domainApiBaseUrlFromPublicDomain(publicDomain) {
  const hostname = cleanString(publicDomain).replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!hostname) return '';
  const apiHost = hostname.toLowerCase().startsWith('api.') ? hostname : `api.${hostname}`;
  return normalizeApiBaseUrl(`https://${apiHost}`);
}

function normalizeDomainApiBaseUrl(value, domainWebBaseUrl = '') {
  const cleaned = normalizeApiBaseUrl(value);
  if (!cleaned) return '';

  const webHost = hostnameFromUrl(domainWebBaseUrl);
  if (!webHost) return cleaned;

  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.toLowerCase() === webHost && !parsed.hostname.toLowerCase().startsWith('api.')) {
      parsed.hostname = `api.${parsed.hostname}`;
    }
    return cleanUrl(parsed.toString());
  } catch {
    return cleaned;
  }
}

function positivePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function serializeNetworkSettings(network = {}) {
  const domainWebBaseUrl = normalizeWebBaseUrl(
    network.domainWebBaseUrl || env.domainWebBaseUrl || (env.publicDomain ? `https://${env.publicDomain}` : '')
  );
  const preferredMode = cleanString(network.preferredMode || env.preferredDeploymentMode, 'domain').toLowerCase();

  return {
    manualApiBaseUrl: normalizeApiBaseUrl(network.manualApiBaseUrl),
    manualWebBaseUrl: normalizeWebBaseUrl(network.manualWebBaseUrl),
    domainApiBaseUrl: normalizeDomainApiBaseUrl(
      network.domainApiBaseUrl ||
        env.domainApiBaseUrl ||
        domainApiBaseUrlFromPublicDomain(env.publicDomain),
      domainWebBaseUrl
    ),
    domainWebBaseUrl,
    preferredMode: ['lan', 'domain'].includes(preferredMode)
      ? preferredMode
      : 'domain',
    discoveryEnabled:
      typeof network.discoveryEnabled === 'boolean' ? network.discoveryEnabled : env.discovery.enabled,
    preferredServerIp: cleanString(network.preferredServerIp),
    apiPort: positivePort(network.apiPort, env.port || 5000),
    webPort: positivePort(network.webPort, env.webPort || 5173),
    qrPairingEnabled:
      typeof network.qrPairingEnabled === 'boolean' ? network.qrPairingEnabled : true,
  };
}

function serializeEmailOtpSettings(emailOtp = {}) {
  return {
    enabled: Boolean(emailOtp.enabled),
    provider: cleanString(emailOtp.provider || 'resend').toLowerCase(),
    apiKeyConfigured: Boolean(emailOtp.encryptedApiKey || emailOtp.secretCiphertext || emailOtp.secretHint),
    secretConfigured: Boolean(emailOtp.encryptedApiKey || emailOtp.secretCiphertext || emailOtp.secretHint),
    updatedAt: emailOtp.updatedAt || null,
  };
}

function isEmailProviderConfigured(emailOtp = {}) {
  if (!emailOtp.enabled) return true;

  const provider = cleanString(emailOtp.provider || 'resend').toLowerCase();
  const hasApiKey = Boolean(emailOtp.encryptedApiKey || emailOtp.secretCiphertext || emailOtp.secretHint);
  return provider === 'resend' && hasApiKey;
}

function parseEncryptedApiKey(value) {
  const raw = cleanString(value);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      ciphertext: cleanString(parsed.ciphertext),
      iv: cleanString(parsed.iv),
      authTag: cleanString(parsed.authTag),
    };
  } catch {
    return null;
  }
}

function getEncryptedApiKeyPayload(emailOtp = {}) {
  const encryptedApiKey = parseEncryptedApiKey(emailOtp.encryptedApiKey);
  if (encryptedApiKey?.ciphertext && encryptedApiKey?.iv && encryptedApiKey?.authTag) {
    return encryptedApiKey;
  }

  if (emailOtp.secretCiphertext && emailOtp.secretIv && emailOtp.secretAuthTag) {
    return {
      ciphertext: emailOtp.secretCiphertext,
      iv: emailOtp.secretIv,
      authTag: emailOtp.secretAuthTag,
    };
  }

  return null;
}

function serializeSettings(settings) {
  const plain = settings?.toObject ? settings.toObject() : { ...(settings || {}) };
  return {
    ...plain,
    network: serializeNetworkSettings(plain.network),
    emailOtp: serializeEmailOtpSettings(plain.emailOtp),
  };
}

async function ensureMainSettings() {
  const SystemSetting = getSystemSettingModel();
  let settings = await SystemSetting.findOne({ code: 'main' });

  if (!settings) {
    settings = await SystemSetting.create({ code: 'main' });
  }

  return settings;
}

async function buildWebUsersWithPermissions() {
  const User = getUserModel();
  const AdminPermission = getAdminPermissionModel();

  const users = await User.find(
    { kind: 'web', role: { $in: ['admin', 'super_admin', 'developer', 'cashier'] } },
    '_id username fullName email role kind isActive createdAt updatedAt'
  )
    .sort({ createdAt: -1 })
    .lean();

  const permissionDocs = await AdminPermission.find({
    user: { $in: users.map((item) => item._id) },
  }).lean();

  const permissionMap = new Map(permissionDocs.map((item) => [String(item.user), item]));

  return users.map((user) => ({
    _id: user._id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    permissions: {
      ...getDefaultPermissions(user.role),
      ...(permissionMap.get(String(user._id))?.permissions || {}),
    },
  }));
}

async function getSafeContractsDashboard() {
  try {
    return await getContractsDashboard();
  } catch (error) {
    return {
      health: {
        ok: false,
        walletAddress: '',
        chainId: null,
        network: 'Unavailable',
      },
      account: {
        address: '',
        chainId: null,
        network: 'Unavailable',
        balanceWei: '0',
        balanceNative: '0.0000',
        gasToken: 'POL',
      },
      contracts: [],
      activeAccount: null,
      error: error.message || 'Blockchain runtime is unavailable.',
    };
  }
}

function buildWalletResponse(settings, contractsDashboard, blockchainAccounts = {}) {
  const selectedContractId = settings.blockchain.selectedContractId || '';
  const activeContract = (contractsDashboard.contracts || []).find(
    (contract) => contract.address === selectedContractId || String(contract._id) === selectedContractId
  );
  const activeAnchorContractId =
    settings.blockchain.activeAnchorContractId ||
    settings.blockchain.activeAnchorContractAddress ||
    '';
  const activeAnchorContract = (contractsDashboard.contracts || []).find(
    (contract) =>
      contract.contractType === 'merkle_anchor' &&
      (contract.address === activeAnchorContractId ||
        String(contract._id) === activeAnchorContractId ||
        contract.address === settings.blockchain.activeAnchorContractAddress)
  );

  return {
    ok: Boolean(contractsDashboard?.health?.ok),
    activeAccount: contractsDashboard?.activeAccount || blockchainAccounts.activeAccount || null,
    blockchainAccounts: blockchainAccounts.accounts || [],
    walletAddress:
      contractsDashboard?.account?.address ||
      contractsDashboard?.activeAccount?.address ||
      blockchainAccounts.activeAccount?.address ||
      contractsDashboard?.health?.walletAddress ||
      '',
    networkLabel:
      contractsDashboard?.health?.network ||
      contractsDashboard?.account?.network ||
      'Unavailable',
    walletBalance: contractsDashboard?.account?.balanceNative || '0.0000',
    gasToken: contractsDashboard?.account?.gasToken || 'POL',
    chainId:
      contractsDashboard?.health?.chainId ??
      contractsDashboard?.account?.chainId ??
      null,
    selectedContractId,
    selectedContractName: settings.blockchain.selectedContractName || '',
    selectedContractType:
      settings.blockchain.selectedContractType || activeContract?.contractType || '',
    selectedContractAddress:
      settings.blockchain.selectedContractAddress || activeContract?.address || selectedContractId,
    selectedContractChainId:
      settings.blockchain.selectedContractChainId ?? activeContract?.chainId ?? null,
    selectedContractNetwork:
      settings.blockchain.selectedContractNetwork || activeContract?.network || '',
    selectedContractExplorerUrl:
      settings.blockchain.selectedContractExplorerUrl || activeContract?.explorerUrl || '',
    selectedContractCapabilities:
      settings.blockchain.selectedContractCapabilities ||
      activeContract?.capabilities ||
      EMPTY_MERKLE_CAPABILITIES,
    activeAnchorContractId:
      settings.blockchain.activeAnchorContractId || activeAnchorContract?._id?.toString?.() || '',
    activeAnchorContractAddress:
      settings.blockchain.activeAnchorContractAddress || activeAnchorContract?.address || '',
    activeAnchorContractName:
      settings.blockchain.activeAnchorContractName || activeAnchorContract?.contractName || '',
    activeAnchorContractChainId:
      settings.blockchain.activeAnchorContractChainId ?? activeAnchorContract?.chainId ?? null,
    activeAnchorContractNetwork:
      settings.blockchain.activeAnchorContractNetwork || activeAnchorContract?.network || '',
    activeAnchorContractExplorerUrl:
      settings.blockchain.activeAnchorContractExplorerUrl || activeAnchorContract?.explorerUrl || '',
    activeAnchorContractCapabilities:
      settings.blockchain.activeAnchorContractCapabilities ||
      activeAnchorContract?.capabilities ||
      EMPTY_MERKLE_CAPABILITIES,
    activeAnchorContract: activeAnchorContract || contractsDashboard.activeAnchorContract || null,
    activeContract: activeContract || null,
    error: contractsDashboard?.error || '',
  };
}

async function deactivateActiveIssuerKeys(actor) {
  const IssuerKey = getIssuerKeyModel();

  await IssuerKey.updateMany(
    { isActive: true },
    {
      $set: {
        isActive: false,
        status: 'inactive',
        updatedBy: actor?._id || null,
      },
    }
  );
}

function generateIssuerKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: env.issuerKeys.curve,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
  });

  return {
    privateKey,
    publicKey,
    algorithm: env.issuerKeys.algorithm,
    curve: env.issuerKeys.curve,
  };
}

async function createIssuerKeyRecord({ name, activate = false, rotationReason = '', actor }) {
  const IssuerKey = getIssuerKeyModel();

  const generated = generateIssuerKeyPair();
  const encrypted = encryptPrivateKey(generated.privateKey);
  const fingerprint = buildPublicKeyFingerprint(generated.publicKey);

  if (activate) {
    await deactivateActiveIssuerKeys(actor);
  }

  const keyDoc = await IssuerKey.create({
    name: makeIssuerKeyName(name),
    kid: buildIssuerKid(generated.publicKey),
    fingerprint,
    algorithm: generated.algorithm,
    curve: generated.curve,
    publicKeyPem: generated.publicKey,
    privateKeyCiphertext: encrypted.ciphertext,
    privateKeyIv: encrypted.iv,
    privateKeyAuthTag: encrypted.authTag,
    status: activate ? 'active' : 'inactive',
    isActive: activate,
    rotationReason: cleanString(rotationReason),
    activatedAt: activate ? new Date() : null,
    createdBy: actor?._id || null,
    updatedBy: actor?._id || null,
  });

  return serializeIssuerKey(keyDoc);
}

export async function getDashboard(actor) {
  assertSettingsViewer(actor);

  if (actor.role === 'admin') {
    const [settings, keyDocs] = await Promise.all([
      ensureMainSettings(),
      getIssuerKeyModel().find({ isActive: true, status: 'active' }).sort({ activatedAt: -1 }).lean(),
    ]);

    const issuerKeys = keyDocs.map(serializeIssuerKey);
    const activeIssuerKey = issuerKeys[0] || null;

    return {
      settings: {
        blockchain: {
          selectedContractId: settings.blockchain?.selectedContractId || '',
          selectedContractName: settings.blockchain?.selectedContractName || '',
          selectedContractType: settings.blockchain?.selectedContractType || '',
          selectedContractAddress: settings.blockchain?.selectedContractAddress || '',
          selectedContractChainId: settings.blockchain?.selectedContractChainId ?? null,
          selectedContractNetwork: settings.blockchain?.selectedContractNetwork || '',
          selectedContractExplorerUrl: settings.blockchain?.selectedContractExplorerUrl || '',
          selectedContractCapabilities:
            settings.blockchain?.selectedContractCapabilities || EMPTY_MERKLE_CAPABILITIES,
          activeAnchorContractId: settings.blockchain?.activeAnchorContractId || '',
          activeAnchorContractAddress: settings.blockchain?.activeAnchorContractAddress || '',
          activeAnchorContractName: settings.blockchain?.activeAnchorContractName || '',
          activeAnchorContractChainId: settings.blockchain?.activeAnchorContractChainId ?? null,
          activeAnchorContractNetwork: settings.blockchain?.activeAnchorContractNetwork || '',
          activeAnchorContractExplorerUrl: settings.blockchain?.activeAnchorContractExplorerUrl || '',
          activeAnchorContractCapabilities:
            settings.blockchain?.activeAnchorContractCapabilities || EMPTY_MERKLE_CAPABILITIES,
        },
        network: serializeNetworkSettings(settings.network),
      },
      admins: [],
      wallet: null,
      availableContracts: [],
      issuerKeys,
      activeIssuerKey,
      access: buildAccess(actor),
    };
  }

  const [settings, admins, keyDocs, contractsDashboard, blockchainAccounts] = await Promise.all([
    ensureMainSettings(),
    buildWebUsersWithPermissions(),
    getIssuerKeyModel().find().sort({ createdAt: -1 }).lean(),
    getSafeContractsDashboard(),
    actor.role === 'developer'
      ? listBlockchainAccountRecords(actor).catch(() => ({ accounts: [], activeAccount: null }))
      : Promise.resolve({ accounts: [], activeAccount: null }),
  ]);

  const issuerKeys = keyDocs.map(serializeIssuerKey);
  const activeIssuerKey = issuerKeys.find((item) => item.isActive) || null;

  return {
    settings: serializeSettings(settings),
    admins,
    wallet: buildWalletResponse(settings, contractsDashboard, blockchainAccounts),
    availableContracts: contractsDashboard.contracts || [],
    issuerKeys,
    activeIssuerKey,
    access: buildAccess(actor),
  };
}

export async function listIssuerKeys(actor) {
  assertSettingsViewer(actor);

  const IssuerKey = getIssuerKeyModel();
  const keyDocs = await IssuerKey.find().sort({ createdAt: -1 }).lean();

  const issuerKeys = keyDocs.map(serializeIssuerKey);
  const activeIssuerKey = issuerKeys.find((item) => item.isActive) || null;

  return {
    issuerKeys,
    activeIssuerKey,
  };
}

export async function listBlockchainAccounts(actor) {
  return listBlockchainAccountRecords(actor);
}

export async function createBlockchainAccount(payload, actor) {
  return createBlockchainAccountRecord(payload, actor);
}

export async function updateBlockchainAccount(accountId, payload, actor) {
  return updateBlockchainAccountRecord(accountId, payload, actor);
}

export async function activateBlockchainAccount(accountId, actor) {
  return activateBlockchainAccountRecord(accountId, actor);
}

export async function deleteBlockchainAccount(accountId, actor) {
  return deleteBlockchainAccountRecord(accountId, actor);
}

export async function listAnchoredCredentialsForAccount(accountId, actor) {
  return listAnchoredCredentialsForBlockchainAccount(accountId, actor);
}

export async function createIssuerKey(payload, actor) {
  assertDeveloper(actor, 'Only the MIS developer can create issuer keys');

  return createIssuerKeyRecord({
    name: payload?.name,
    activate: Boolean(payload?.activate),
    rotationReason: payload?.rotationReason,
    actor,
  });
}

export async function rotateIssuerKey(payload, actor) {
  assertDeveloper(actor, 'Only the MIS developer can rotate issuer keys');

  return createIssuerKeyRecord({
    name: payload?.name,
    activate: true,
    rotationReason: payload?.rotationReason || 'Key rotation',
    actor,
  });
}

export async function activateIssuerKey(keyId, actor) {
  assertDeveloper(actor, 'Only the MIS developer can activate issuer keys');

  const IssuerKey = getIssuerKeyModel();
  const keyDoc = await IssuerKey.findById(keyId);

  if (!keyDoc) {
    throw new ApiError(404, 'Issuer key not found');
  }

  if (keyDoc.status === 'retired') {
    throw new ApiError(409, 'Retired keys cannot be re-activated');
  }

  await deactivateActiveIssuerKeys(actor);

  keyDoc.isActive = true;
  keyDoc.status = 'active';
  keyDoc.activatedAt = new Date();
  keyDoc.updatedBy = actor._id;

  await keyDoc.save();

  return serializeIssuerKey(keyDoc);
}

export async function updateIssuerKey(keyId, payload, actor) {
  assertDeveloper(actor, 'Only the MIS developer can update issuer keys');

  const IssuerKey = getIssuerKeyModel();
  const keyDoc = await IssuerKey.findById(keyId);

  if (!keyDoc) {
    throw new ApiError(404, 'Issuer key not found');
  }

  const nextName = cleanString(payload?.name);
  const nextReason = cleanString(payload?.rotationReason);

  if (nextName) {
    keyDoc.name = nextName;
  }

  if (typeof payload?.rotationReason === 'string') {
    keyDoc.rotationReason = nextReason;
  }

  keyDoc.updatedBy = actor._id;
  await keyDoc.save();

  return serializeIssuerKey(keyDoc);
}

export async function deleteIssuerKey(keyId, actor) {
  assertDeveloper(actor, 'Only the MIS developer can retire issuer keys');

  const IssuerKey = getIssuerKeyModel();
  const keyDoc = await IssuerKey.findById(keyId);

  if (!keyDoc) {
    throw new ApiError(404, 'Issuer key not found');
  }

  if (keyDoc.isActive) {
    throw new ApiError(409, 'The active issuer key cannot be retired');
  }

  keyDoc.isActive = false;
  keyDoc.status = 'retired';
  keyDoc.retiredAt = new Date();
  keyDoc.updatedBy = actor._id;

  await keyDoc.save();

  return serializeIssuerKey(keyDoc);
}

export async function updateActiveContract(contractId, actor) {
  assertDeveloper(actor, 'Only the MIS developer can switch the active contract');

  const normalizedId = cleanString(contractId);

  if (!normalizedId) {
    throw new ApiError(400, 'Contract id or address is required');
  }

  const Contract = getContractModel();
  const contract = await Contract.findOne({
    status: 'success',
    $or: [
      { address: normalizedId },
      ...(Types.ObjectId.isValid(normalizedId) ? [{ _id: normalizedId }] : []),
    ],
  });

  if (!contract) {
    throw new ApiError(404, 'Selected contract was not found');
  }

  const settings = await ensureMainSettings();
  const capabilities = getCapabilitiesForContract(contract);

  if (contract.contractType !== 'merkle_anchor' || !capabilities?.canAnchorMerkleRoot) {
    throw new ApiError(
      409,
      'Only MerkleAnchor contracts can be selected for VC anchoring. The admin contract cannot anchor Merkle roots.'
    );
  }

  settings.blockchain.selectedContractId = contract.address || String(contract._id);
  settings.blockchain.selectedContractName = contract.contractName || 'AdminContract';
  settings.blockchain.selectedContractType = contract.contractType || 'admin';
  settings.blockchain.selectedContractAddress = contract.address || '';
  settings.blockchain.selectedContractChainId = contract.chainId ?? null;
  settings.blockchain.selectedContractNetwork = contract.network || '';
  settings.blockchain.selectedContractExplorerUrl = contract.explorerUrl || '';
  settings.blockchain.selectedContractCapabilities = capabilities;

  if (contract.contractType === 'merkle_anchor') {
    settings.blockchain.activeAnchorContractId = String(contract._id);
    settings.blockchain.activeAnchorContractAddress = contract.address || '';
    settings.blockchain.activeAnchorContractName = contract.contractName || 'MerkleAnchor';
    settings.blockchain.activeAnchorContractChainId = contract.chainId ?? null;
    settings.blockchain.activeAnchorContractNetwork = contract.network || '';
    settings.blockchain.activeAnchorContractExplorerUrl = contract.explorerUrl || '';
    settings.blockchain.activeAnchorContractCapabilities = capabilities;
  }

  settings.updatedBy = actor._id;

  contract.capabilities = capabilities;
  contract.isActive = true;

  await Contract.updateMany(
    {
      _id: { $ne: contract._id },
      ...(contract.contractType === 'merkle_anchor' ? { contractType: 'merkle_anchor' } : {}),
    },
    { $set: { isActive: false } }
  );
  await contract.save();

  await settings.save();

  return {
    selectedContractId: settings.blockchain.selectedContractId,
    selectedContractName: settings.blockchain.selectedContractName,
    selectedContractType: settings.blockchain.selectedContractType,
    selectedContractAddress: settings.blockchain.selectedContractAddress,
    selectedContractChainId: settings.blockchain.selectedContractChainId,
    selectedContractNetwork: settings.blockchain.selectedContractNetwork,
    selectedContractExplorerUrl: settings.blockchain.selectedContractExplorerUrl,
    selectedContractCapabilities: settings.blockchain.selectedContractCapabilities,
    activeAnchorContractId: settings.blockchain.activeAnchorContractId,
    activeAnchorContractAddress: settings.blockchain.activeAnchorContractAddress,
    activeAnchorContractName: settings.blockchain.activeAnchorContractName,
    activeAnchorContractChainId: settings.blockchain.activeAnchorContractChainId,
    activeAnchorContractNetwork: settings.blockchain.activeAnchorContractNetwork,
    activeAnchorContractExplorerUrl: settings.blockchain.activeAnchorContractExplorerUrl,
    activeAnchorContractCapabilities: settings.blockchain.activeAnchorContractCapabilities,
    warning: capabilities.canAnchorMerkleRoot
      ? ''
      : 'Active contract does not support Merkle root anchoring. Credentials can prepare local proofs, but blockchain verification will not pass until a compatible MerkleAnchor contract is deployed and selected.',
  };
}

export async function updateBusinessSettings(payload, actor) {
  if (actor.role !== 'super_admin') {
    throw new ApiError(403, 'Only the super admin can edit business settings');
  }

  const settings = await ensureMainSettings();

  settings.anchoring.enabled =
    payload?.anchoring?.enabled ?? settings.anchoring.enabled;
  settings.anchoring.intervalDays =
    payload?.anchoring?.intervalDays ?? settings.anchoring.intervalDays;
  settings.anchoring.autoAnchor =
    payload?.anchoring?.autoAnchor ?? settings.anchoring.autoAnchor;

  settings.qrDelivery.allowEmail =
    payload?.qrDelivery?.allowEmail ?? settings.qrDelivery.allowEmail;
  settings.qrDelivery.claimQrExpiryMinutes =
    payload?.qrDelivery?.claimQrExpiryMinutes ?? settings.qrDelivery.claimQrExpiryMinutes;
  settings.qrDelivery.allowRegeneration =
    payload?.qrDelivery?.allowRegeneration ?? settings.qrDelivery.allowRegeneration;
  settings.qrDelivery.allowedRoles =
    payload?.qrDelivery?.allowedRoles ?? settings.qrDelivery.allowedRoles;

  settings.updatedBy = actor._id;

  await settings.save();
  return settings;
}

export async function updateNetworkSettings(payload, actor) {
  if (!actor || !['developer', 'super_admin'].includes(actor.role)) {
    throw new ApiError(403, 'Only the MIS developer or super admin can edit network settings');
  }

  const settings = await ensureMainSettings();
  const next = payload?.network || payload || {};
  const mode = cleanString(next.preferredMode || settings.network.preferredMode, 'domain').toLowerCase();

  settings.network.manualApiBaseUrl =
    typeof next.manualApiBaseUrl === 'string'
      ? normalizeApiBaseUrl(next.manualApiBaseUrl)
      : settings.network.manualApiBaseUrl;
  settings.network.manualWebBaseUrl =
    typeof next.manualWebBaseUrl === 'string'
      ? normalizeWebBaseUrl(next.manualWebBaseUrl)
      : settings.network.manualWebBaseUrl;
  settings.network.domainApiBaseUrl =
    typeof next.domainApiBaseUrl === 'string'
      ? normalizeDomainApiBaseUrl(next.domainApiBaseUrl, next.domainWebBaseUrl || settings.network.domainWebBaseUrl)
      : settings.network.domainApiBaseUrl;
  settings.network.domainWebBaseUrl =
    typeof next.domainWebBaseUrl === 'string'
      ? normalizeWebBaseUrl(next.domainWebBaseUrl)
      : settings.network.domainWebBaseUrl;
  settings.network.preferredMode = ['lan', 'domain'].includes(mode) ? mode : 'domain';
  settings.network.discoveryEnabled =
    typeof next.discoveryEnabled === 'boolean'
      ? next.discoveryEnabled
      : settings.network.discoveryEnabled;
  settings.network.preferredServerIp =
    typeof next.preferredServerIp === 'string'
      ? cleanString(next.preferredServerIp)
      : settings.network.preferredServerIp;
  settings.network.apiPort = positivePort(next.apiPort, settings.network.apiPort || env.port || 5000);
  settings.network.webPort = positivePort(next.webPort, settings.network.webPort || env.webPort || 5173);
  settings.network.qrPairingEnabled =
    typeof next.qrPairingEnabled === 'boolean'
      ? next.qrPairingEnabled
      : settings.network.qrPairingEnabled;
  settings.updatedBy = actor._id;

  await settings.save();
  return serializeNetworkSettings(settings.network);
}

export async function updateEmailOtpSettings(payload, actor) {
  if (!actor || !['developer', 'super_admin'].includes(actor.role)) {
    throw new ApiError(403, 'Only MIS developer or super admin can edit email OTP settings');
  }

  const SystemSetting = getSystemSettingModel();
  let settings = await SystemSetting.findOne({ code: 'main' }).select(
    '+emailOtp.encryptedApiKey +emailOtp.secretCiphertext +emailOtp.secretIv +emailOtp.secretAuthTag'
  );

  if (!settings) {
    settings = await SystemSetting.create({ code: 'main' });
    settings = await SystemSetting.findOne({ code: 'main' }).select(
      '+emailOtp.encryptedApiKey +emailOtp.secretCiphertext +emailOtp.secretIv +emailOtp.secretAuthTag'
    );
  }

  const next = payload?.emailOtp || payload || {};
  settings.emailOtp = settings.emailOtp || {};

  if (typeof next.enabled === 'boolean') settings.emailOtp.enabled = next.enabled;
  if (typeof next.provider === 'string') {
    const provider = cleanString(next.provider).toLowerCase();
    settings.emailOtp.provider = provider || 'resend';
  } else if (!settings.emailOtp.provider) {
    settings.emailOtp.provider = 'resend';
  }

  const apiKey = cleanString(next.apiKey || next.secret);
  if (apiKey) {
    settings.emailOtp.encryptedApiKey = JSON.stringify(encryptSecret(apiKey));
    settings.emailOtp.secretCiphertext = '';
    settings.emailOtp.secretIv = '';
    settings.emailOtp.secretAuthTag = '';
    settings.emailOtp.secretHint = 'configured';
  }

  if (next.clearApiKey === true || next.clearSecret === true) {
    settings.emailOtp.encryptedApiKey = '';
    settings.emailOtp.secretCiphertext = '';
    settings.emailOtp.secretIv = '';
    settings.emailOtp.secretAuthTag = '';
    settings.emailOtp.secretHint = '';
  }

  if (settings.emailOtp.enabled && !isEmailProviderConfigured(settings.emailOtp)) {
    throw new ApiError(400, 'Email OTP cannot be enabled until Resend and an API key are configured');
  }

  settings.emailOtp.updatedAt = new Date();
  settings.updatedBy = actor._id;
  await settings.save();

  return serializeEmailOtpSettings(settings.emailOtp);
}

export async function getEmailOtpStatus() {
  const SystemSetting = getSystemSettingModel();
  const settings =
    (await SystemSetting.findOne({ code: 'main' }).select('+emailOtp.encryptedApiKey +emailOtp.secretCiphertext')) ||
    (await ensureMainSettings());
  const emailOtp = settings.emailOtp || {};
  return {
    ...serializeEmailOtpSettings(emailOtp),
    configured: isEmailProviderConfigured(emailOtp),
  };
}

export async function getEmailOtpDeliveryConfig() {
  const SystemSetting = getSystemSettingModel();
  const settings =
    (await SystemSetting.findOne({ code: 'main' }).select(
      '+emailOtp.encryptedApiKey +emailOtp.secretCiphertext +emailOtp.secretIv +emailOtp.secretAuthTag'
    )) || (await ensureMainSettings());
  const emailOtp = settings.emailOtp || {};
  const status = {
    ...serializeEmailOtpSettings(emailOtp),
    configured: isEmailProviderConfigured(emailOtp),
  };

  if (!status.enabled || !status.configured) {
    return status;
  }

  const encrypted = getEncryptedApiKeyPayload(emailOtp);
  if (!encrypted) {
    return { ...status, configured: false };
  }

  return {
    ...status,
    apiKey: decryptSecret(encrypted),
  };
}

export async function updateSystemLocks(payload, actor) {
  if (actor.role !== 'developer') {
    throw new ApiError(403, 'Only the MIS developer can edit technical system locks');
  }

  const settings = await ensureMainSettings();

  settings.locks.anchorLocked =
    payload?.locks?.anchorLocked ?? settings.locks.anchorLocked;
  settings.locks.qrEmailLocked =
    payload?.locks?.qrEmailLocked ?? settings.locks.qrEmailLocked;
  settings.locks.qrGenerationLocked =
    payload?.locks?.qrGenerationLocked ?? settings.locks.qrGenerationLocked;
  settings.locks.contractLocked =
    payload?.locks?.contractLocked ?? settings.locks.contractLocked;
  settings.locks.issuerKeyRotationLocked =
    payload?.locks?.issuerKeyRotationLocked ?? settings.locks.issuerKeyRotationLocked;
  settings.locks.paymentConfirmationLocked =
    payload?.locks?.paymentConfirmationLocked ?? settings.locks.paymentConfirmationLocked;
  settings.updatedBy = actor._id;

  await settings.save();
  return settings;
}

export async function updateAdminPermissions(userId, permissions, actor) {
  if (actor.role !== 'developer') {
    throw new ApiError(403, 'Only the MIS developer can edit admin permission overrides');
  }

  const User = getUserModel();
  const AdminPermission = getAdminPermissionModel();

  const user = await User.findById(
    userId,
    '_id username fullName email role kind isActive'
  ).lean();

  if (!user || user.kind === 'mobile') {
    throw new ApiError(404, 'Target admin user not found');
  }

  let permissionDoc = await AdminPermission.findOne({ user: userId });

  if (!permissionDoc) {
    permissionDoc = new AdminPermission({
      user: userId,
      role: user.role,
      permissions: getDefaultPermissions(user.role),
    });
  }

  permissionDoc.role = user.role;
  permissionDoc.permissions = {
    ...getDefaultPermissions(user.role),
    ...(permissionDoc.permissions?.toObject
      ? permissionDoc.permissions.toObject()
      : permissionDoc.permissions),
    ...permissions,
  };
  permissionDoc.updatedBy = actor._id;

  await permissionDoc.save();

  return {
    _id: user._id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    permissions: permissionDoc.permissions,
  };
}
