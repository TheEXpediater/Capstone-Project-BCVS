import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  activateIssuerKey,
  createIssuerKey,
  deleteIssuerKey,
  getDashboard,
  getIssuerKeys,
  rotateIssuerKey,
  updateActiveContract,
  updateAdminPermissions,
  updateBusinessSettings,
  updateIssuerKey,
  updateSystemLocks,
} from './setting.controller.js';

const router = express.Router();

router.get('/dashboard', protect({ kind: 'web' }), allowRoles('super_admin', 'developer'), getDashboard);

router.get('/issuer-keys', protect({ kind: 'web' }), allowRoles('super_admin', 'developer'), getIssuerKeys);
router.post('/issuer-keys', protect({ kind: 'web' }), allowRoles('developer'), createIssuerKey);
router.post('/issuer-keys/rotate', protect({ kind: 'web' }), allowRoles('developer'), rotateIssuerKey);
router.put('/issuer-keys/:keyId/activate', protect({ kind: 'web' }), allowRoles('developer'), activateIssuerKey);
router.put('/issuer-keys/:keyId', protect({ kind: 'web' }), allowRoles('developer'), updateIssuerKey);
router.delete('/issuer-keys/:keyId', protect({ kind: 'web' }), allowRoles('developer'), deleteIssuerKey);

router.put('/blockchain/active-contract', protect({ kind: 'web' }), allowRoles('developer'), updateActiveContract);

router.put('/business', protect({ kind: 'web' }), allowRoles('super_admin'), updateBusinessSettings);
router.put('/locks', protect({ kind: 'web' }), allowRoles('developer'), updateSystemLocks);
router.put('/admin-permissions/:userId', protect({ kind: 'web' }), allowRoles('developer'), updateAdminPermissions);

export default router;