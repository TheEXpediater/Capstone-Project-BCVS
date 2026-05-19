import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as notificationService from './service.js';

export const registerPushToken = asyncHandler(async (req, res) => {
  const data = await notificationService.registerPushToken(req.body || {}, req.user);

  res.status(200).json({
    success: true,
    data,
    message: 'Push token registered successfully.',
  });
});

export const listMobileNotifications = asyncHandler(async (req, res) => {
  const items = await notificationService.listMobileNotifications(req.user);

  res.status(200).json({
    success: true,
    items,
    data: items,
  });
});
