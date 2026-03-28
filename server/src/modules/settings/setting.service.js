import { ApiError } from '../../shared/utils/ApiError.js';
import { getUserModel } from '../auth/user.model.js';
import { getAdminPermissionModel } from './adminPermission.model.js';
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
    '_id username fullName email role isActive createdAt updatedAt'
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

function buildAccess(actor) {
  return {
    canViewPage: ['super_admin', 'developer'].includes(actor.role),
    canEditBusinessSettings: actor.role === 'super_admin',
    canEditSystemLocks: actor.role === 'developer',
    canEditPermissions: actor.role === 'developer',
    canViewBlockchain: ['super_admin', 'developer'].includes(actor.role),
  };
}

export async function getDashboard(actor) {
  const settings = await ensureMainSettings();
  const admins = await buildWebUsersWithPermissions();

  return {
    settings,
    admins,
    wallet: {
      selectedContractId: settings.blockchain.selectedContractId,
      selectedContractName: settings.blockchain.selectedContractName,
      walletAddress: settings.blockchain.walletAddress,
      networkLabel: settings.blockchain.networkLabel,
      walletBalance: settings.blockchain.walletBalance || '0.0000',
    },
    access: buildAccess(actor),
  };
}

export async function updateBusinessSettings(payload, actor) {
  if (actor.role !== 'super_admin') {
    throw new ApiError(403, 'Only the super admin can edit business settings');
  }

  const settings = await ensureMainSettings();

  settings.anchoring.enabled = payload?.anchoring?.enabled ?? settings.anchoring.enabled;
  settings.anchoring.intervalDays = payload?.anchoring?.intervalDays ?? settings.anchoring.intervalDays;
  settings.anchoring.autoAnchor = payload?.anchoring?.autoAnchor ?? settings.anchoring.autoAnchor;
  settings.qrDelivery.allowEmail = payload?.qrDelivery?.allowEmail ?? settings.qrDelivery.allowEmail;
  settings.qrDelivery.allowedRoles = payload?.qrDelivery?.allowedRoles ?? settings.qrDelivery.allowedRoles;
  settings.blockchain.selectedContractId =
    payload?.blockchain?.selectedContractId ?? settings.blockchain.selectedContractId;
  settings.blockchain.selectedContractName =
    payload?.blockchain?.selectedContractName ?? settings.blockchain.selectedContractName;
  settings.blockchain.walletAddress =
    payload?.blockchain?.walletAddress ?? settings.blockchain.walletAddress;
  settings.blockchain.networkLabel =
    payload?.blockchain?.networkLabel ?? settings.blockchain.networkLabel;
  settings.blockchain.walletBalance =
    payload?.blockchain?.walletBalance ?? settings.blockchain.walletBalance;
  settings.updatedBy = actor._id;

  await settings.save();
  return settings;
}

export async function updateSystemLocks(payload, actor) {
  if (actor.role !== 'developer') {
    throw new ApiError(403, 'Only the MIS developer can edit technical system locks');
  }

  const settings = await ensureMainSettings();

  settings.locks.anchorLocked = payload?.locks?.anchorLocked ?? settings.locks.anchorLocked;
  settings.locks.qrEmailLocked = payload?.locks?.qrEmailLocked ?? settings.locks.qrEmailLocked;
  settings.locks.contractLocked = payload?.locks?.contractLocked ?? settings.locks.contractLocked;
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

  const user = await User.findById(userId, '_id username fullName email role isActive').lean();

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
    ...(permissionDoc.permissions?.toObject ? permissionDoc.permissions.toObject() : permissionDoc.permissions),
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
