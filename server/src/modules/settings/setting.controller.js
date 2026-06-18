import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { writeAuditLog } from '../audit/service.js';
import * as settingService from './setting.service.js';

async function logSettingsAction(req, { module = 'settings', action, description, target, metadata }) {
  await writeAuditLog({
    req,
    user: req.user,
    module,
    action,
    label: description,
    description,
    target: target || {
      id: 'main',
      type: module === 'network' ? 'network_settings' : 'system_settings',
      label: module === 'network' ? 'Network settings' : 'System settings',
    },
    metadata: metadata || {},
  });
}

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await settingService.getDashboard(req.user);
  res.status(200).json({ success: true, data });
});

export const getIssuerKeys = asyncHandler(async (req, res) => {
  const data = await settingService.listIssuerKeys(req.user);
  res.status(200).json({ success: true, data });
});

export const createIssuerKey = asyncHandler(async (req, res) => {
  const data = await settingService.createIssuerKey(req.body, req.user);
  res.status(201).json({ success: true, data, message: 'Issuer key created successfully.' });
});

export const rotateIssuerKey = asyncHandler(async (req, res) => {
  const data = await settingService.rotateIssuerKey(req.body, req.user);
  res.status(201).json({ success: true, data, message: 'Issuer key rotated successfully.' });
});

export const activateIssuerKey = asyncHandler(async (req, res) => {
  const data = await settingService.activateIssuerKey(req.params.keyId, req.user);
  res.status(200).json({ success: true, data, message: 'Issuer key activated successfully.' });
});

export const updateIssuerKey = asyncHandler(async (req, res) => {
  const data = await settingService.updateIssuerKey(req.params.keyId, req.body, req.user);
  res.status(200).json({ success: true, data, message: 'Issuer key updated successfully.' });
});

export const deleteIssuerKey = asyncHandler(async (req, res) => {
  const data = await settingService.deleteIssuerKey(req.params.keyId, req.user);
  res.status(200).json({ success: true, data, message: 'Issuer key retired successfully.' });
});

export const updateActiveContract = asyncHandler(async (req, res) => {
  const data = await settingService.updateActiveContract(req.body.contractId, req.user);
  await logSettingsAction(req, {
    module: 'settings',
    action: 'UPDATE_SYSTEM_SETTINGS',
    description: 'Updated active anchor contract',
    target: {
      id: data?.activeAnchorContractId || data?.selectedContractId || '',
      type: 'anchor_contract',
      label: data?.activeAnchorContractName || data?.selectedContractName || 'Anchor contract',
    },
    metadata: {
      selectedContractAddress: data?.selectedContractAddress || '',
      activeAnchorContractAddress: data?.activeAnchorContractAddress || '',
      warning: data?.warning || '',
    },
  });
  res.status(200).json({ success: true, data, message: 'Active contract updated successfully.' });
});

export const updateBusinessSettings = asyncHandler(async (req, res) => {
  const data = await settingService.updateBusinessSettings(req.body, req.user);
  await logSettingsAction(req, {
    action: 'UPDATE_SYSTEM_SETTINGS',
    description: 'Updated business/system settings',
    metadata: {
      anchoringEnabled: data?.anchoring?.enabled,
      autoAnchor: data?.anchoring?.autoAnchor,
      claimQrExpiryMinutes: data?.qrDelivery?.claimQrExpiryMinutes,
      allowRegeneration: data?.qrDelivery?.allowRegeneration,
    },
  });
  res.status(200).json({
    success: true,
    data,
    message: 'Business settings updated successfully.',
  });
});

export const updateNetworkSettings = asyncHandler(async (req, res) => {
  const data = await settingService.updateNetworkSettings(req.body, req.user);
  await logSettingsAction(req, {
    module: 'network',
    action: 'UPDATE_NETWORK_SETTINGS',
    description: 'Updated network and mobile connection settings',
    metadata: {
      preferredMode: data?.preferredMode || '',
      manualApiBaseUrl: data?.manualApiBaseUrl || '',
      manualWebBaseUrl: data?.manualWebBaseUrl || '',
      domainApiBaseUrl: data?.domainApiBaseUrl || '',
      domainWebBaseUrl: data?.domainWebBaseUrl || '',
      discoveryEnabled: data?.discoveryEnabled,
      qrPairingEnabled: data?.qrPairingEnabled,
    },
  });
  res.status(200).json({
    success: true,
    data,
    message: 'Network settings updated successfully.',
  });
});

export const updateEmailSettings = asyncHandler(async (req, res) => {
  const data = await settingService.updateEmailOtpSettings(req.body, req.user);
  await logSettingsAction(req, {
    action: data?.enabled ? 'EMAIL_SETTINGS_UPDATED' : 'EMAIL_DISABLED',
    description: data?.enabled ? 'Updated email OTP settings' : 'Disabled email OTP sending',
    metadata: {
      emailEnabled: Boolean(data?.enabled),
      provider: data?.provider || '',
      senderEmail: data?.senderEmail || '',
      smtpHost: data?.smtpHost || '',
      smtpPort: data?.smtpPort || null,
      secretConfigured: Boolean(data?.secretConfigured),
    },
  });
  res.status(200).json({
    success: true,
    data,
    message: 'Email OTP settings updated successfully.',
  });
});

export const updateSystemLocks = asyncHandler(async (req, res) => {
  const data = await settingService.updateSystemLocks(req.body, req.user);
  await logSettingsAction(req, {
    action: 'UPDATE_SYSTEM_SETTINGS',
    description: 'Updated MIS technical locks',
    metadata: {
      locks: data?.locks || {},
    },
  });
  res.status(200).json({
    success: true,
    data,
    message: 'System locks updated successfully.',
  });
});

export const updateAdminPermissions = asyncHandler(async (req, res) => {
  const data = await settingService.updateAdminPermissions(
    req.params.userId,
    req.body.permissions || {},
    req.user
  );
  await logSettingsAction(req, {
    module: 'users',
    action: 'UPDATE_USER',
    description: 'Updated admin permission overrides',
    target: {
      id: String(data?._id || req.params.userId || ''),
      type: 'web_user',
      label: data?.fullName || data?.email || '',
    },
    metadata: {
      role: data?.role || '',
      permissions: data?.permissions || {},
    },
  });
  res.status(200).json({
    success: true,
    data,
    message: 'Admin permissions updated successfully.',
  });
});
