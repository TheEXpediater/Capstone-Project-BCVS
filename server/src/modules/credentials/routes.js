import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  createCredentialDraftFromStudent,
  getCredentialDraftById,
  listCredentialDrafts,
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

router.put(
  '/:id/submit',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
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

router.put(
  '/:id/schedule-anchor',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  scheduleCredentialAnchor
);

router.get(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  getCredentialDraftById
);

export default router;