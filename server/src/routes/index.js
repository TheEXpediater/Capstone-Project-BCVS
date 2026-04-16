import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import contractRoutes from '../modules/contracts/routes.js';
import credentialRoutes from '../modules/credentials/routes.js';
import curriculumRoutes from '../modules/curriculum/routes.js';
import settingRoutes from '../modules/settings/setting.routes.js';
import studentRoutes from '../modules/students/routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/contracts', contractRoutes);
router.use('/credentials', credentialRoutes);
router.use('/curricula', curriculumRoutes);
router.use('/settings', settingRoutes);
router.use('/students', studentRoutes);

export default router;