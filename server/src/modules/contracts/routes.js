import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  getDashboard,
  estimate,
  deploy,
  getCapabilities,
  registerExisting,
  selectActiveAnchor,
} from './controller.js';

const router = express.Router();

router.get('/dashboard', protect({ kind: 'web' }), allowRoles('developer'), getDashboard);
router.get('/capabilities/:address', protect({ kind: 'web' }), allowRoles('developer'), getCapabilities);
router.post('/anchor/select', protect({ kind: 'web' }), allowRoles('developer'), selectActiveAnchor);
router.post('/estimate', protect({ kind: 'web' }), allowRoles('developer'), estimate);
router.post('/deploy', protect({ kind: 'web' }), allowRoles('developer'), deploy);
router.post('/register-existing', protect({ kind: 'web' }), allowRoles('developer'), registerExisting);

export default router;
