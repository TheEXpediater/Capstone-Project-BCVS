import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as settingService from './setting.service.js';

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
  res.status(200).json({ success: true, data, message: 'Active contract updated successfully.' });
});

export const updateBusinessSettings = asyncHandler(async (req, res) => {
  const data = await settingService.updateBusinessSettings(req.body, req.user);
  res.status(200).json({
    success: true,
    data,
    message: 'Business settings updated successfully.',
  });
});

export const updateSystemLocks = asyncHandler(async (req, res) => {
  const data = await settingService.updateSystemLocks(req.body, req.user);
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
  res.status(200).json({
    success: true,
    data,
    message: 'Admin permissions updated successfully.',
  });
});