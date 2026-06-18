import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { writeAuditLog } from '../audit/service.js';
import * as credentialService from './service.js';

function getTarget(data, fallbackId = '') {
  const id =
    data?._id ||
    data?.id ||
    data?.requestId ||
    data?.credential?._id ||
    data?.credential?.id ||
    data?.draft?._id ||
    data?.draft?.id ||
    fallbackId ||
    '';

  const label =
    data?.studentName ||
    data?.credentialSubject?.name ||
    data?.credential?.studentName ||
    data?.credential?.studentNo ||
    data?.request?.studentName ||
    data?.request?.studentNo ||
    data?.draft?.studentName ||
    data?.draft?.credentialSubject?.name ||
    data?.studentNo ||
    data?.draft?.studentNo ||
    '';

  return {
    id: String(id || ''),
    type: 'credential_draft',
    label: String(label || ''),
  };
}

async function logCredentialAction(req, action, data, description, metadata = {}) {
  await writeAuditLog({
    req,
    user: req.user,
    module: 'credentials',
    action,
    label: description,
    description,
    target: getTarget(data, req.params?.id),
    metadata: {
      credentialDraftId: req.params?.id || '',
      studentId: req.params?.studentId || '',
      studentNo:
        data?.studentNo ||
        data?.credential?.studentNo ||
        data?.request?.studentNo ||
        data?.draft?.studentNo ||
        '',
      studentName:
        data?.studentName ||
        data?.credential?.studentName ||
        data?.request?.studentName ||
        data?.draft?.studentName ||
        '',
      credentialStatus:
        data?.status ||
        data?.credential?.status ||
        data?.request?.status ||
        data?.draft?.status ||
        '',
      actorKind: req.user?.kind || '',
      ...metadata,
    },
  });
}

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

  await logCredentialAction(
    req,
    'UPDATE_DRAFT',
    data,
    'Updated credential draft',
    {
      fieldsUpdated: Object.keys(req.body || {}),
    }
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

  await logCredentialAction(
    req,
    'DELETE_DRAFT',
    data,
    'Deleted credential draft'
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

  await logCredentialAction(
    req,
    'CREATE_DRAFT',
    data,
    'Created credential draft from student record',
    {
      studentId: req.params.studentId,
    }
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

  await writeAuditLog({
    req,
    user: req.user,
    module: 'mobile',
    action: 'MOBILE_REQUEST_CREDENTIAL',
    label: 'Mobile user requested credential',
    description: 'Mobile user submitted a credential request',
    target: {
      id: String(data?.requestId || data?._id || data?.id || ''),
      type: 'mobile_credential_request',
      label: String(data?.request?.studentNo || data?.studentNo || req.user?.studentId || req.user?.email || ''),
    },
    metadata: {
      actorKind: req.user?.kind || 'mobile',
      studentId: req.user?.studentId || '',
      studentNo: data?.request?.studentNo || req.user?.studentId || '',
      credentialStatus: data?.request?.status || '',
      credentialType: data?.request?.credentialType || '',
    },
  });

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

  await logCredentialAction(
    req,
    'SUBMIT_DRAFT',
    data,
    'Submitted credential draft for review'
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

  await logCredentialAction(
    req,
    'REJECT_DRAFT',
    data,
    'Rejected credential draft',
    {
      reason: req.body?.reason || req.body?.rejectionReason || '',
    }
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

  await logCredentialAction(
    req,
    'SIGN_DRAFT',
    data,
    'Signed credential draft'
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

  await logCredentialAction(
    req,
    'GENERATE_CLAIM_QR',
    data,
    'Generated credential claim QR'
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

  await logCredentialAction(
    req,
    'GENERATE_CLAIM_OVERRIDE_QR',
    data,
    'Generated credential claim override QR'
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential claim override QR generated successfully.',
  });
});

export const listCredentialPayments = asyncHandler(async (req, res) => {
  const data = await credentialService.listCredentialPayments(req.query || {}, req.user);
  res.status(200).json({ success: true, data });
});

export const markCredentialPaymentPaid = asyncHandler(async (req, res) => {
  const data = await credentialService.markCredentialPaymentPaid(
    req.params.id,
    req.body || {},
    req.user
  );

  await logCredentialAction(
    req,
    'MARK_PAYMENT_PAID',
    data,
    'Marked credential payment as paid',
    {
      amount: data?.amount || 0,
      receiptNo: data?.receiptNo || '',
      paymentStatus: data?.paymentStatus || '',
    }
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential payment marked paid successfully.',
  });
});

export const scheduleCredentialAnchor = asyncHandler(async (req, res) => {
  const data = await credentialService.scheduleCredentialAnchor(
    req.params.id,
    req.body || {},
    req.user
  );

  await logCredentialAction(
    req,
    'SCHEDULE_ANCHOR',
    data,
    'Scheduled credential anchoring',
    {
      anchorStatus: data?.anchorStatus || '',
      anchorMode: data?.anchorMode || '',
      scheduledAnchorAt: data?.scheduledAnchorAt || null,
    }
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Credential anchoring scheduled successfully.',
  });
});

export const getTodaysAnchorQueueSummary = asyncHandler(async (req, res) => {
  const data = await credentialService.getTodaysAnchorQueueSummary(req.user);
  res.status(200).json({ success: true, data });
});

export const processTodaysAnchorQueue = asyncHandler(async (req, res) => {
  const data = await credentialService.processTodaysAnchorQueue(req.user);

  await writeAuditLog({
    req,
    user: req.user,
    module: 'credentials',
    action: 'PROCESS_ANCHOR_QUEUE',
    label: 'Processed credential anchor queue',
    description: 'Processed credentials due for blockchain anchoring',
    target: {
      id: 'today',
      type: 'anchor_queue',
      label: 'Today anchor queue',
    },
    metadata: {
      processedCount: data?.processedCount || 0,
      failedCount: data?.failedCount || 0,
      skippedCount: data?.skippedCount || 0,
      completedAt: data?.completedAt || null,
    },
  });

  res.status(200).json({
    success: true,
    data,
    message: 'Anchor queue processed successfully.',
  });
});

export const listMobileCredentials = asyncHandler(async (req, res) => {
  const data = await credentialService.listMobileCredentials(req.user);
  res.status(200).json({ success: true, data });
});

export const listMobileCredentialRequests = asyncHandler(async (req, res) => {
  const data = await credentialService.listMobileCredentialRequests(req.user);
  res.status(200).json({ success: true, data });
});

export const claimMobileCredential = asyncHandler(async (req, res) => {
  const data = await credentialService.claimMobileCredential(req.body || {}, req.user);

  await writeAuditLog({
    req,
    user: req.user,
    module: 'mobile',
    action: 'CLAIM_CREDENTIAL',
    label: 'Mobile user claimed credential',
    description: 'Mobile user claimed a signed credential into the wallet',
    target: {
      id: String(data?.credentialId || data?._id || data?.id || ''),
      type: 'credential',
      label: String(data?.meta?.fullName || data?.studentName || req.user?.studentId || ''),
    },
    metadata: {
      actorKind: req.user?.kind || 'mobile',
      studentId: req.user?.studentId || '',
      credentialId: data?.credentialId || data?._id || '',
      credentialType: data?.meta?.credentialType || data?.credentialType || '',
      credentialStatus: data?.status || '',
      claimedAt: data?.meta?.claimedAt || data?.claimedAt || null,
    },
  });

  res.status(200).json({
    success: true,
    data,
    message: 'Credential claimed successfully.',
  });
});
