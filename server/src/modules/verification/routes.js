import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  createVerificationSession,
  getVerificationSession,
  presentVerificationSession,
} from './controller.js';

const router = express.Router();

router.post(
  '/session',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  createVerificationSession
);

router.get(
  '/session/:sessionId',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  getVerificationSession
);

router.post(
  '/session/:sessionId/present',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  presentVerificationSession
);

export default router;
