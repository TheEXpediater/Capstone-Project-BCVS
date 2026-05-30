import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as verificationService from './service.js';

export const createVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.createVerificationSession(req.body || {}, req.user);

  res.status(201).json({
    success: true,
    data,
    message: 'Verification session created successfully.',
  });
});

export const getVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.getVerificationSession(
    req.params.sessionId,
    req.query?.nonce || '',
    req.user
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const presentVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.presentVerificationSession(
    req.params.sessionId,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification session updated successfully.',
  });
});
