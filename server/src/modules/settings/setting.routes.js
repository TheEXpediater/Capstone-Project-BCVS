import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  getDashboard,
  updateAdminPermissions,
  updateBusinessSettings,
  updateSystemLocks,
} from './setting.controller.js';

const router = express.Router();

router.get('/dashboard', protect({ kind: 'web' }), allowRoles('super_admin', 'developer'), getDashboard);
router.put('/business', protect({ kind: 'web' }), allowRoles('super_admin'), updateBusinessSettings);
router.put('/locks', protect({ kind: 'web' }), allowRoles('developer'), updateSystemLocks);
router.put('/admin-permissions/:userId', protect({ kind: 'web' }), allowRoles('developer'), updateAdminPermissions);

export default router;
