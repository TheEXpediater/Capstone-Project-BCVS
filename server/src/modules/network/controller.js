import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as networkService from './service.js';

export const getHealth = asyncHandler(async (_req, res) => {
  const payload = await networkService.getHealthPayload();
  res.status(200).json(payload);
});

export const getNetworkInfo = asyncHandler(async (_req, res) => {
  const payload = await networkService.getNetworkInfoPayload();
  res.status(200).json(payload);
});

export const getNetworkQr = asyncHandler(async (_req, res) => {
  const data = await networkService.getNetworkQrPayload();
  res.status(200).json({
    success: true,
    data,
  });
});
