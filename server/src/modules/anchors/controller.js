import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as anchorService from './service.js';

export const anchorCredential = asyncHandler(async (req, res) => {
  const data = await anchorService.anchorCredential(
    req.params.credentialId,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: data.alreadyAnchored
      ? 'Credential is already anchored.'
      : 'Credential anchored successfully.',
  });
});

export const anchorBatch = asyncHandler(async (req, res) => {
  const data = await anchorService.anchorBatch(req.body || {}, req.user);

  res.status(200).json({
    success: true,
    data,
    message: 'Batch anchoring completed.',
  });
});

export const getAnchorDetails = asyncHandler(async (req, res) => {
  const data = await anchorService.getAnchorDetails(req.params.anchorId);
  res.status(200).json({ success: true, data });
});

export const verifyAnchoredCredential = asyncHandler(async (req, res) => {
  const data = await anchorService.verifyAnchoredCredential(req.params.credentialId);
  res.status(200).json({ success: true, data });
});
