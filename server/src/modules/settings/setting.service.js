import { Types } from 'mongoose';
import { generateKeyPairSync } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import {
  buildIssuerKid,
  buildPublicKeyFingerprint,
  encryptPrivateKey,
} from '../../shared/utils/keyVault.js';
import { getUserModel } from '../auth/user.model.js';
import { getContractModel } from '../contracts/model.js';
import { getContractsDashboard } from '../contracts/service.js';
import { getAdminPermissionModel } from './adminPermission.model.js';
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
  },
  super_admin: {
    canIssueVC: true,
    canSendQrEmail: true,
    canApproveAnchoring: true,
    canManageSystemSettings: true,
    canManageContracts: false,
    canViewWallet: true,
  },
  developer: {
    canIssueVC: false,
    canSendQrEmail: false,
    canApproveAnchoring: false,
    canManageSystemSettings: true,
    canManageContracts: true,
    canViewWallet: true,
  },
  cashier: {
    canIssueVC: false,
    canSendQrEmail: false,
    canApproveAnchoring: false,
    canManageSystemSettings: false,
    canManageContracts: false,
    canViewWallet: false,
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
  if (!actor || !['super_admin', 'developer'].includes(actor.role)) {
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
    canViewPage: ['super_admin', 'developer'].includes(actor.role),
    canEditBusinessSettings: actor.role === 'super_admin',
    canEditSystemLocks: actor.role === 'developer',
    canEditPermissions: actor.role === 'developer',
    canViewBlockchain: ['super_admin', 'developer'].includes(actor.role),
    canViewIssuerKeys: ['super_admin', 'developer'].includes(actor.role),
    canManageIssuerKeys: actor.role === 'developer',
    canManageActiveContract: actor.role === 'developer',
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
      error: error.message || 'Blockchain runtime is unavailable.',
    };
  }
}

function buildWalletResponse(settings, contractsDashboard) {
  return {
    ok: Boolean(contractsDashboard?.health?.ok),
    walletAddress:
      contractsDashboard?.account?.address ||
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
    selectedContractId: settings.blockchain.selectedContractId || '',
    selectedContractName: settings.blockchain.selectedContractName || '',
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

  const [settings, admins, keyDocs, contractsDashboard] = await Promise.all([
    ensureMainSettings(),
    buildWebUsersWithPermissions(),
    getIssuerKeyModel().find().sort({ createdAt: -1 }).lean(),
    getSafeContractsDashboard(),
  ]);

  const issuerKeys = keyDocs.map(serializeIssuerKey);
  const activeIssuerKey = issuerKeys.find((item) => item.isActive) || null;

  return {
    settings,
    admins,
    wallet: buildWalletResponse(settings, contractsDashboard),
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
  }).lean();

  if (!contract) {
    throw new ApiError(404, 'Selected contract was not found');
  }

  const settings = await ensureMainSettings();

  settings.blockchain.selectedContractId = contract.address || String(contract._id);
  settings.blockchain.selectedContractName = contract.contractName || 'AdminContract';
  settings.updatedBy = actor._id;

  await settings.save();

  return {
    selectedContractId: settings.blockchain.selectedContractId,
    selectedContractName: settings.blockchain.selectedContractName,
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
  settings.qrDelivery.allowedRoles =
    payload?.qrDelivery?.allowedRoles ?? settings.qrDelivery.allowedRoles;

  settings.updatedBy = actor._id;

  await settings.save();
  return settings;
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
  settings.locks.contractLocked =
    payload?.locks?.contractLocked ?? settings.locks.contractLocked;
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