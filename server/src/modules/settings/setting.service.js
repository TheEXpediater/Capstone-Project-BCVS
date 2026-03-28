const SystemSetting = require('./setting.model');
const AdminPermission = require('./adminPermission.model');

// Adjust this import path to your real User model file.
const User = require('../auth/auth.model');

let blockchainService = null;
try {
  // Adjust this import path if your blockchain service lives somewhere else.
  blockchainService = require('../contracts/blockchain.service');
} catch (_error) {
  blockchainService = null;
}

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
    canManageSystemSettings: false,
    canManageContracts: true,
    canViewWallet: true,
  },
};

function getDefaultPermissions(role) {
  return { ...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.admin) };
}

async function ensureMainSettings() {
  let settings = await SystemSetting.findOne({ code: 'main' });

  if (!settings) {
    settings = await SystemSetting.create({ code: 'main' });
  }

  return settings;
}

async function getWalletOverview(settings) {
  const fallback = {
    walletAddress: settings.blockchain.walletAddress,
    walletBalance: '0.0000',
    networkLabel: settings.blockchain.networkLabel,
    selectedContractId: settings.blockchain.selectedContractId,
    selectedContractName: settings.blockchain.selectedContractName,
  };

  if (!blockchainService || typeof blockchainService.getWalletOverview !== 'function') {
    return fallback;
  }

  try {
    const live = await blockchainService.getWalletOverview({
      walletAddress: settings.blockchain.walletAddress,
      selectedContractId: settings.blockchain.selectedContractId,
    });

    return {
      ...fallback,
      ...live,
    };
  } catch (_error) {
    return fallback;
  }
}

async function buildAdminRows() {
  const users = await User.find(
    { role: { $in: ['admin', 'super_admin', 'developer'] } },
    '_id name email role status'
  ).lean();

  const userIds = users.map((item) => item._id);
  const savedPermissions = await AdminPermission.find({ user: { $in: userIds } }).lean();
  const savedMap = new Map(savedPermissions.map((item) => [String(item.user), item]));

  return users.map((user) => {
    const saved = savedMap.get(String(user._id));
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || 'active',
      permissions: {
        ...getDefaultPermissions(user.role),
        ...(saved?.permissions || {}),
      },
    };
  });
}

async function getDashboard(actor) {
  const settings = await ensureMainSettings();
  const admins = await buildAdminRows();
  const wallet = await getWalletOverview(settings);

  return {
    settings,
    admins,
    wallet,
    access: {
      canEditSettings: actor.role === 'super_admin',
      canEditPermissions: actor.role === 'super_admin',
      canViewBlockchain: ['super_admin', 'developer'].includes(actor.role),
    },
  };
}

async function updateSettings(payload, actor) {
  if (actor.role !== 'super_admin') {
    throw new Error('Only the super admin can update global system settings.');
  }

  const settings = await ensureMainSettings();

  settings.anchoring.enabled = payload?.anchoring?.enabled ?? settings.anchoring.enabled;
  settings.anchoring.intervalDays = payload?.anchoring?.intervalDays ?? settings.anchoring.intervalDays;
  settings.anchoring.autoAnchor = payload?.anchoring?.autoAnchor ?? settings.anchoring.autoAnchor;

  settings.qrDelivery.allowEmail = payload?.qrDelivery?.allowEmail ?? settings.qrDelivery.allowEmail;
  settings.qrDelivery.allowedRoles = payload?.qrDelivery?.allowedRoles ?? settings.qrDelivery.allowedRoles;

  settings.blockchain.selectedContractId = payload?.blockchain?.selectedContractId ?? settings.blockchain.selectedContractId;
  settings.blockchain.selectedContractName = payload?.blockchain?.selectedContractName ?? settings.blockchain.selectedContractName;
  settings.blockchain.walletAddress = payload?.blockchain?.walletAddress ?? settings.blockchain.walletAddress;
  settings.blockchain.networkLabel = payload?.blockchain?.networkLabel ?? settings.blockchain.networkLabel;

  settings.updatedBy = actor._id || actor.id || null;

  await settings.save();
  return settings;
}

async function updateAdminPermissions(userId, permissions, actor) {
  if (actor.role !== 'super_admin') {
    throw new Error('Only the super admin can update admin permissions.');
  }

  const user = await User.findById(userId, '_id name email role').lean();

  if (!user) {
    throw new Error('Target admin user not found.');
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
  permissionDoc.updatedBy = actor._id || actor.id || null;

  await permissionDoc.save();

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: permissionDoc.permissions,
  };
}

module.exports = {
  getDashboard,
  updateSettings,
  updateAdminPermissions,
};
