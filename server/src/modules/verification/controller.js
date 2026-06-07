import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as verificationService from './service.js';

function firstFileUrl(files, key) {
  const file = Array.isArray(files?.[key]) ? files[key][0] : null;
  return file ? `/uploads/verification/${file.filename}` : '';
}

function buildSubmissionPayload(req) {
  return {
    ...req.body,
    idFrontUrl: firstFileUrl(req.files, 'idFront') || req.body?.idFrontUrl,
    idBackUrl: firstFileUrl(req.files, 'idBack') || req.body?.idBackUrl,
    livenessImageUrl:
      firstFileUrl(req.files, 'selfie') ||
      firstFileUrl(req.files, 'liveness') ||
      req.body?.livenessImageUrl ||
      req.body?.selfieUrl,
  };
}

export const getMyVerification = asyncHandler(async (req, res) => {
  const data = await verificationService.getMyVerification(req.user);

  res.status(200).json({
    success: true,
    data,
  });
});

export const submitAccountVerification = asyncHandler(async (req, res) => {
  const data = await verificationService.submitAccountVerification(
    buildSubmissionPayload(req),
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification submitted successfully.',
  });
});

export const listVerificationSubmissions = asyncHandler(async (req, res) => {
  const data = await verificationService.listVerificationSubmissions(req.query || {});

  res.status(200).json({
    success: true,
    data,
  });
});

export const getVerificationSubmission = asyncHandler(async (req, res) => {
  const data = await verificationService.getVerificationSubmission(req.params.id);

  res.status(200).json({
    success: true,
    data,
  });
});

export const approveVerificationSubmission = asyncHandler(async (req, res) => {
  const data = await verificationService.approveVerificationSubmission(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Account linked successfully.',
  });
});

export const rejectVerificationSubmission = asyncHandler(async (req, res) => {
  const data = await verificationService.rejectVerificationSubmission(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification submission rejected.',
  });
});

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
