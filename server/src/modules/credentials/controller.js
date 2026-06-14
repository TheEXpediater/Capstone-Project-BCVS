import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as credentialService from './service.js';

export const listCredentialDrafts = asyncHandler(async (req, res) => {
  const data = await credentialService.listCredentialDrafts(req.query || {});
  res.status(200).json({ success: true, data });
});

export const getCredentialDraftById = asyncHandler(async (req, res) => {
  const data = await credentialService.getCredentialDraftById(req.params.id);
  res.status(200).json({ success: true, data });
});

export const updateCredentialDraft = asyncHandler(async (req, res) => {
  const data = await credentialService.updateCredentialDraft(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential draft updated successfully.',
  });
});

export const deleteCredentialDraft = asyncHandler(async (req, res) => {
  const data = await credentialService.deleteCredentialDraft(
    req.params.id,
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential draft deleted successfully.',
  });
});

export const createCredentialDraftFromStudent = asyncHandler(async (req, res) => {
  const data = await credentialService.createCredentialDraftFromStudent(
    req.params.studentId,
    req.body || {},
    req.user
  );

  res.status(201).json({
    success: true,
    data,
    message: 'Credential draft created successfully.',
  });
});

export const requestMobileCredential = asyncHandler(async (req, res) => {
  const data = await credentialService.requestMobileCredential(
    req.body || {},
    req.user
  );

  res.status(201).json({
    success: true,
    data,
    message: 'Credential request submitted successfully.',
  });
});

export const submitCredentialDraft = asyncHandler(async (req, res) => {
  const data = await credentialService.submitCredentialDraft(
    req.params.id,
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential draft submitted to registrar successfully.',
  });
});

export const rejectCredentialDraft = asyncHandler(async (req, res) => {
  const data = await credentialService.rejectCredentialDraft(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential draft rejected successfully.',
  });
});

export const signCredentialDraft = asyncHandler(async (req, res) => {
  const data = await credentialService.signCredentialDraft(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential draft signed successfully.',
  });
});

export const createCredentialClaimToken = asyncHandler(async (req, res) => {
  const data = await credentialService.createCredentialClaimToken(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential claim QR generated successfully.',
  });
});

export const createCredentialClaimOverrideToken = asyncHandler(async (req, res) => {
  const data = await credentialService.createCredentialClaimOverrideToken(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential claim override QR generated successfully.',
  });
});

export const listCredentialPayments = asyncHandler(async (req, res) => {
  const items = await credentialService.listCredentialPayments(req.query || {}, req.user);

  res.status(200).json({
    success: true,
    items,
    data: items,
  });
});

export const markCredentialPaymentPaid = asyncHandler(async (req, res) => {
  const data = await credentialService.markCredentialPaymentPaid(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Payment marked as paid.',
  });
});

export const listMobileCredentials = asyncHandler(async (req, res) => {
  const items = await credentialService.listMobileCredentials(req.user);

  res.status(200).json({
    success: true,
    items,
    data: items,
  });
});

export const listMobileCredentialRequests = asyncHandler(async (req, res) => {
  const items = await credentialService.listMobileCredentialRequests(req.user);

  res.status(200).json({
    success: true,
    items,
    data: items,
  });
});

export const claimMobileCredential = asyncHandler(async (req, res) => {
  const data = await credentialService.claimMobileCredential(
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    credential: data.credential,
    metadata: data.metadata,
    data,
    message: 'Credential claimed successfully.',
  });
});

export const scheduleCredentialAnchor = asyncHandler(async (req, res) => {
  const data = await credentialService.scheduleCredentialAnchor(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential draft queued for anchoring successfully.',
  });
});

export const getTodaysAnchorQueueSummary = asyncHandler(async (req, res) => {
  const data = await credentialService.getTodaysAnchorQueueSummary(req.user);

  res.status(200).json({
    success: true,
    data,
  });
});

export const processTodaysAnchorQueue = asyncHandler(async (req, res) => {
  const data = await credentialService.processTodaysAnchorQueue(req.user);

  res.status(200).json({
    success: true,
    data,
    message: "Today's anchor queue processed.",
  });
});
