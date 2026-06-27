import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  activateIssuerKey,
  activateBlockchainAccount,
  createBlockchainAccount,
  createIssuerKey,
  deleteBlockchainAccount,
  deleteIssuerKey,
  getBlockchainAccountCredentials,
  getBlockchainAccounts,
  getDashboard,
  getIssuerKeys,
  rotateIssuerKey,
  updateActiveContract,
  updateAdminPermissions,
  updateBusinessSettings,
  updateEmailSettings,
  updateBlockchainAccount,
  updateIssuerKey,
  updateNetworkSettings,
  updateSystemLocks,
} from './setting.controller.js';

const router = express.Router();

router.get('/dashboard', protect({ kind: 'web' }), allowRoles('developer'), getDashboard);

router.get('/issuer-keys', protect({ kind: 'web' }), allowRoles('developer'), getIssuerKeys);
router.post('/issuer-keys', protect({ kind: 'web' }), allowRoles('developer'), createIssuerKey);
router.post('/issuer-keys/rotate', protect({ kind: 'web' }), allowRoles('developer'), rotateIssuerKey);
router.put('/issuer-keys/:keyId/activate', protect({ kind: 'web' }), allowRoles('developer'), activateIssuerKey);
router.put('/issuer-keys/:keyId', protect({ kind: 'web' }), allowRoles('developer'), updateIssuerKey);
router.delete('/issuer-keys/:keyId', protect({ kind: 'web' }), allowRoles('developer'), deleteIssuerKey);

router.get('/blockchain/accounts', protect({ kind: 'web' }), allowRoles('developer'), getBlockchainAccounts);
router.post('/blockchain/accounts', protect({ kind: 'web' }), allowRoles('developer'), createBlockchainAccount);
router.put('/blockchain/accounts/:accountId', protect({ kind: 'web' }), allowRoles('developer'), updateBlockchainAccount);
router.put('/blockchain/accounts/:accountId/activate', protect({ kind: 'web' }), allowRoles('developer'), activateBlockchainAccount);
router.delete('/blockchain/accounts/:accountId', protect({ kind: 'web' }), allowRoles('developer'), deleteBlockchainAccount);
router.get('/blockchain/accounts/:accountId/credentials', protect({ kind: 'web' }), allowRoles('developer'), getBlockchainAccountCredentials);

router.put('/blockchain/active-contract', protect({ kind: 'web' }), allowRoles('developer'), updateActiveContract);

router.put('/business', protect({ kind: 'web' }), allowRoles('developer'), updateBusinessSettings);
router.put('/network', protect({ kind: 'web' }), allowRoles('developer'), updateNetworkSettings);
router.put('/email', protect({ kind: 'web' }), allowRoles('developer'), updateEmailSettings);
router.put('/locks', protect({ kind: 'web' }), allowRoles('developer'), updateSystemLocks);
router.put('/admin-permissions/:userId', protect({ kind: 'web' }), allowRoles('developer'), updateAdminPermissions);

export default router;
