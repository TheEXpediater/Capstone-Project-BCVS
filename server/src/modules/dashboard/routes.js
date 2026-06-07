import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import { getDashboardSummary } from './controller.js';

const router = express.Router();

router.get(
  '/summary',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer', 'cashier'),
  getDashboardSummary
);

export default router;
