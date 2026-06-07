import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  claimMobileCredential,
  listMobileCredentials,
  listMobileCredentialRequests,
  requestMobileCredential,
} from './controller.js';

const router = express.Router();

router.get(
  '/credentials',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  listMobileCredentials
);

router.get(
  '/credentials/requests',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  listMobileCredentialRequests
);

router.post(
  '/credentials/request',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  requestMobileCredential
);

router.post(
  '/credentials/claim',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  claimMobileCredential
);

export default router;
