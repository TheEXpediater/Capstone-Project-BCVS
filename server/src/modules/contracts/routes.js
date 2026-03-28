import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import { getDashboard, estimate, deploy } from './controller.js';

const router = express.Router();

router.get('/dashboard', protect({ kind: 'web' }), allowRoles('developer', 'super_admin'), getDashboard);
router.post('/estimate', protect({ kind: 'web' }), allowRoles('developer'), estimate);
router.post('/deploy', protect({ kind: 'web' }), allowRoles('developer'), deploy);

export default router;
