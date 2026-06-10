import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  getDashboard,
  estimate,
  deploy,
  getCapabilities,
  registerExisting,
  selectActiveAnchor,
  checkReadiness,
} from './controller.js';

const router = express.Router();

const contractRoles = ['developer', 'super_admin', 'admin'];

router.get('/dashboard', protect({ kind: 'web' }), allowRoles(...contractRoles), getDashboard);
router.get('/capabilities/:address', protect({ kind: 'web' }), allowRoles(...contractRoles), getCapabilities);
router.get('/:id/health', protect({ kind: 'web' }), allowRoles(...contractRoles), checkReadiness);
router.post('/anchor/select', protect({ kind: 'web' }), allowRoles(...contractRoles), selectActiveAnchor);
router.post('/estimate', protect({ kind: 'web' }), allowRoles(...contractRoles), estimate);
router.post('/deploy', protect({ kind: 'web' }), allowRoles(...contractRoles), deploy);
router.post('/register-existing', protect({ kind: 'web' }), allowRoles(...contractRoles), registerExisting);

export default router;
