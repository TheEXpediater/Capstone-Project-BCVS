import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  anchorBatch,
  anchorCredential,
  getAnchorDetails,
  verifyAnchoredCredential,
} from './controller.js';

const router = express.Router();

router.post(
  '/credential/:credentialId',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  anchorCredential
);

router.post(
  '/batch',
  protect({ kind: 'web' }),
  allowRoles('super_admin'),
  anchorBatch
);

router.get(
  '/verify/:credentialId',
  protect({ kind: 'web' }),
  allowRoles('developer', 'admin', 'super_admin'),
  verifyAnchoredCredential
);

router.get(
  '/:anchorId',
  protect({ kind: 'web' }),
  allowRoles('developer', 'admin', 'super_admin'),
  getAnchorDetails
);

export default router;
