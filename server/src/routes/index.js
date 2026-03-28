import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import settingRoutes from '../modules/settings/setting.routes.js';
import contractRoutes from '../modules/contracts/routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/settings', settingRoutes);
router.use('/contracts', contractRoutes);

export default router;
