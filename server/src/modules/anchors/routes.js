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
  allowRoles('admin', 'super_admin', 'developer'),
  anchorCredential
);

router.post(
  '/batch',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  anchorBatch
);

router.get(
  '/verify/:credentialId',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  verifyAnchoredCredential
);

router.get(
  '/:anchorId',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  getAnchorDetails
);

export default router;
