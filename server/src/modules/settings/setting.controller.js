import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as settingService from './setting.service.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await settingService.getDashboard(req.user);
  res.status(200).json({ success: true, data });
});

export const updateBusinessSettings = asyncHandler(async (req, res) => {
  const data = await settingService.updateBusinessSettings(req.body, req.user);
  res.status(200).json({ success: true, data, message: 'Business settings updated successfully.' });
});

export const updateSystemLocks = asyncHandler(async (req, res) => {
  const data = await settingService.updateSystemLocks(req.body, req.user);
  res.status(200).json({ success: true, data, message: 'System locks updated successfully.' });
});

export const updateAdminPermissions = asyncHandler(async (req, res) => {
  const data = await settingService.updateAdminPermissions(req.params.userId, req.body.permissions || {}, req.user);
  res.status(200).json({ success: true, data, message: 'Admin permissions updated successfully.' });
});
