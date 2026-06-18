import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { writeAuditLog } from '../audit/service.js';
import * as verificationService from './service.js';

function verificationTarget(data = {}, fallbackId = '') {
  const sessionId = data?.sessionId || data?.session_id || fallbackId || '';

  return {
    id: String(sessionId || ''),
    type: 'verification_session',
    label: String(data?.studentName || data?.credentialType || sessionId || ''),
  };
}

async function logVerificationAction(req, action, data, description, metadata = {}) {
  await writeAuditLog({
    req,
    user: req.user,
    module: 'verification',
    action,
    label: description,
    description,
    target: verificationTarget(data, req.params?.sessionId),
    metadata: {
      sessionId: data?.sessionId || data?.session_id || req.params?.sessionId || '',
      credentialId: data?.credentialId || '',
      credentialType: data?.credentialType || data?.request?.credentialType || '',
      studentNo: data?.studentNo || '',
      decision: data?.decision || '',
      sessionStatus: data?.status || '',
      ...metadata,
    },
  });
}

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
  await logVerificationAction(
    req,
    'CREATE_VERIFICATION_SESSION',
    data,
    'Created verification session'
  );

  res.status(201).json({
    success: true,
    data,
    message: 'Verification session created successfully.',
  });
});

export const requestVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.requestVerificationSession(
    req.params.sessionId,
    req.body || {}
  );
  await logVerificationAction(
    req,
    'REQUEST_VERIFICATION',
    data,
    'Verifier requested credential holder consent',
    {
      organization: data?.request?.organization || '',
      requestedPdf: Boolean(data?.requestedPdf),
    }
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification request sent to the credential holder.',
  });
});

export const getPublicVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.getPublicVerificationSession(
    req.params.sessionId,
    req.query?.nonce || req.headers['x-verification-nonce'] || ''
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const getVerificationResult = asyncHandler(async (req, res) => {
  const data = await verificationService.getVerificationResult(
    req.params.sessionId,
    req.query?.nonce || req.headers['x-verification-nonce'] || ''
  );
  await logVerificationAction(
    req,
    'CHECK_VERIFICATION_SESSION',
    data,
    'Verifier checked verification session result',
    {
      verificationStatus: data?.verificationResult?.verificationStatus || '',
      payloadVerified: Boolean(data?.verificationResult?.payloadVerified),
      anchoredOnChain: Boolean(data?.verificationResult?.anchoredOnChain),
    }
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const cancelVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.cancelVerificationSession(
    req.params.sessionId,
    req.body?.nonce || req.query?.nonce || req.headers['x-verification-nonce'] || ''
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification session cancelled.',
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
  await logVerificationAction(
    req,
    data?.decision === 'deny' ? 'DENY_VERIFICATION' : 'APPROVE_VERIFICATION',
    data,
    data?.decision === 'deny'
      ? 'Mobile holder denied verification request'
      : 'Mobile holder approved verification request',
    {
      actorKind: req.user?.kind || 'mobile',
      allowPdfDownload: Boolean(data?.allowPdfDownload),
      verificationStatus: data?.verificationResult?.verificationStatus || '',
    }
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification session updated successfully.',
  });
});

export const approveVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.presentVerificationSession(
    req.params.sessionId,
    {
      ...(req.body || {}),
      decision: 'approve',
    },
    req.user
  );
  await logVerificationAction(
    req,
    'APPROVE_VERIFICATION',
    data,
    'Mobile holder approved verification request',
    {
      actorKind: req.user?.kind || 'mobile',
      allowPdfDownload: Boolean(data?.allowPdfDownload),
      verificationStatus: data?.verificationResult?.verificationStatus || '',
    }
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification session approved.',
  });
});

export const denyVerificationSession = asyncHandler(async (req, res) => {
  const data = await verificationService.denyVerificationSession(
    req.params.sessionId,
    req.body || {},
    req.user
  );
  await logVerificationAction(
    req,
    'DENY_VERIFICATION',
    data,
    'Mobile holder denied verification request',
    {
      actorKind: req.user?.kind || 'mobile',
    }
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Verification session denied.',
  });
});

function sendDownload(res, file) {
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.status(200).send(file.body);
}

export const downloadPresentedCredential = asyncHandler(async (req, res) => {
  const file = await verificationService.downloadPresentedCredential(
    req.params.sessionId,
    req.query?.nonce || req.headers['x-verification-nonce'] || ''
  );

  sendDownload(res, file);
});

export const downloadVerificationReport = asyncHandler(async (req, res) => {
  const file = await verificationService.downloadVerificationReport(
    req.params.sessionId,
    req.query?.nonce || req.headers['x-verification-nonce'] || ''
  );

  sendDownload(res, file);
});

export const downloadPresentedCredentialPdf = asyncHandler(async (req, res) => {
  const file = await verificationService.downloadPresentedCredentialPdf(
    req.params.sessionId,
    req.query?.nonce || req.headers['x-verification-nonce'] || ''
  );

  sendDownload(res, file);
});
