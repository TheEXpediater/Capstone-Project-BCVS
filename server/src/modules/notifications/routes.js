import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  listMobileNotifications,
  registerPushToken,
} from './controller.js';

const router = express.Router();

router.post(
  '/push/register',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  registerPushToken
);

router.get(
  '/mobile/notifications',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  listMobileNotifications
);

export default router;
