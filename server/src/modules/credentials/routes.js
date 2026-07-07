import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  bulkCreateCredentialClaimTokens,
  bulkCreateCredentialDraftsFromStudents,
  bulkDeleteCredentialDrafts,
  bulkScheduleCredentialAnchors,
  bulkSignCredentialDrafts,
  bulkSubmitCredentialDrafts,
  createCredentialClaimToken,
  createCredentialClaimOverrideToken,
  createCredentialDraftFromStudent,
  deleteCredentialDraft,
  getCredentialDraftById,
  getTodaysAnchorQueueSummary,
  listCredentialPayments,
  listCredentialDrafts,
  markCredentialPaymentPaid,
  processTodaysAnchorQueue,
  rejectCredentialDraft,
  scheduleCredentialAnchor,
  signCredentialDraft,
  submitCredentialDraft,
  updateCredentialDraft,
} from './controller.js';

const router = express.Router();

router.get(
  '/',
  protect({ kind: 'web' }),
  allowRoles('developer', 'admin', 'super_admin'),
  listCredentialDrafts
);

router.post(
  '/from-student/:studentId',
  protect({ kind: 'web' }),
  allowRoles('admin'),
  createCredentialDraftFromStudent
);

router.post(
  '/bulk/from-students',
  protect({ kind: 'web' }),
  allowRoles('admin'),
  bulkCreateCredentialDraftsFromStudents
);

router.get(
  '/payments',
  protect({ kind: 'web' }),
  allowRoles('cashier'),
  listCredentialPayments
);

router.put(
  '/payments/:id/paid',
  protect({ kind: 'web' }),
  allowRoles('cashier'),
  markCredentialPaymentPaid
);

router.post(
  '/bulk/submit',
  protect({ kind: 'web' }),
  allowRoles('admin'),
  bulkSubmitCredentialDrafts
);

router.post(
  '/bulk/delete',
  protect({ kind: 'web' }),
  allowRoles('admin'),
  bulkDeleteCredentialDrafts
);

router.post(
  '/bulk/sign',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  bulkSignCredentialDrafts
);

router.post(
  '/bulk/schedule-anchor',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  bulkScheduleCredentialAnchors
);

router.post(
  '/bulk/claim-token',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  bulkCreateCredentialClaimTokens
);

router.put(
  '/:id/submit',
  protect({ kind: 'web' }),
  allowRoles('admin'),
  submitCredentialDraft
);

router.put(
  '/:id/reject',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  rejectCredentialDraft
);

router.put(
  '/:id/sign',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  signCredentialDraft
);

router.post(
  '/anchor-queue/today/process',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  processTodaysAnchorQueue
);

router.get(
  '/anchor-queue/today',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  getTodaysAnchorQueueSummary
);

router.post(
  '/:id/claim-token',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  createCredentialClaimToken
);

router.post(
  '/:id/claim-token/override',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  createCredentialClaimOverrideToken
);

router.put(
  '/:id/schedule-anchor',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  scheduleCredentialAnchor
);

router.put(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin'),
  updateCredentialDraft
);

router.delete(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin'),
  deleteCredentialDraft
);

router.get(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer', 'cashier'),
  getCredentialDraftById
);

export default router;
