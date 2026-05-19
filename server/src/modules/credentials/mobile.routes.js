import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  claimMobileCredential,
  listMobileCredentials,
} from './controller.js';

const router = express.Router();

router.get(
  '/credentials',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  listMobileCredentials
);

router.post(
  '/credentials/claim',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  claimMobileCredential
);

export default router;
