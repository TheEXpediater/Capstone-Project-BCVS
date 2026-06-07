import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import { listAllUsers } from '../modules/auth/controller.js';
import contractRoutes from '../modules/contracts/routes.js';
import dashboardRoutes from '../modules/dashboard/routes.js';
import mobileCredentialRoutes from '../modules/credentials/mobile.routes.js';
import credentialRoutes from '../modules/credentials/routes.js';
import curriculumRoutes from '../modules/curriculum/routes.js';
import notificationRoutes from '../modules/notifications/routes.js';
import uploadRoutes from '../modules/uploads/routes.js';
import verificationRoutes from '../modules/verification/routes.js';
import settingRoutes from '../modules/settings/setting.routes.js';
import studentRoutes from '../modules/students/routes.js';
import { allowRoles, protect } from '../shared/middleware/auth.middleware.js';

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Backend reachable',
  });
});

router.get(
  '/users',
  protect({ kind: 'web' }),
  allowRoles('super_admin', 'developer'),
  listAllUsers
);

router.use('/auth', authRoutes);
router.use('/contracts', contractRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/credentials', credentialRoutes);
router.use('/curricula', curriculumRoutes);
router.use('/mobile', mobileCredentialRoutes);
router.use('/', notificationRoutes);
router.use('/verification', verificationRoutes);
router.use('/settings', settingRoutes);
router.use('/students', studentRoutes);
router.use('/uploads', uploadRoutes);

export default router;
