import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  createCredentialClaimToken,
  createCredentialClaimOverrideToken,
  createCredentialDraftFromStudent,
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
} from './controller.js';

const router = express.Router();

router.get(
  '/',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  listCredentialDrafts
);

router.post(
  '/from-student/:studentId',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  createCredentialDraftFromStudent
);

router.get(
  '/payments',
  protect({ kind: 'web' }),
  allowRoles('cashier', 'admin', 'super_admin', 'developer'),
  listCredentialPayments
);

router.put(
  '/payments/:id/paid',
  protect({ kind: 'web' }),
  allowRoles('cashier', 'admin', 'super_admin', 'developer'),
  markCredentialPaymentPaid
);

router.put(
  '/:id/submit',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  submitCredentialDraft
);

router.put(
  '/:id/reject',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  rejectCredentialDraft
);

router.put(
  '/:id/sign',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  signCredentialDraft
);

router.post(
  '/anchor-queue/today/process',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  processTodaysAnchorQueue
);

router.get(
  '/anchor-queue/today',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  getTodaysAnchorQueueSummary
);

router.post(
  '/:id/claim-token',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  createCredentialClaimToken
);

router.post(
  '/:id/claim-token/override',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  createCredentialClaimOverrideToken
);

router.put(
  '/:id/schedule-anchor',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  scheduleCredentialAnchor
);

router.get(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  getCredentialDraftById
);

export default router;
