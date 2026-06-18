import express from 'express';
import {
  bootstrapSuperAdmin,
  createWebUser,
  createMobileUser,
  getMobileMe,
  getWebMe,
  listWebUsers,
  loginMobile,
  loginWeb,
  logout,
  registerMobile,
  requestMobileEmailOtp,
  requestMobilePasswordResetOtp,
  resetMobilePassword,
  verifyMobileEmailOtp,
  verifyMobilePasswordResetOtp,
} from './controller.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  bootstrapSuperAdminSchema,
  createWebUserSchema,
  createMobileUserSchema,
  webLoginSchema,
  mobileRegisterSchema,
  mobileLoginSchema,
} from './validator.js';

const router = express.Router();

router.post('/bootstrap/super-admin', validate(bootstrapSuperAdminSchema), bootstrapSuperAdmin);

router.post('/web/login', validate(webLoginSchema), loginWeb);
router.get('/web/me', protect({ kind: 'web' }), getWebMe);
router.get('/web/users', protect({ kind: 'web' }), allowRoles('super_admin', 'developer'), listWebUsers);
router.post('/web/users', protect({ kind: 'web' }), allowRoles('super_admin', 'developer'), validate(createWebUserSchema), createWebUser);
router.post('/mobile/users', protect({ kind: 'web' }), allowRoles('super_admin', 'developer'), validate(createMobileUserSchema), createMobileUser);

router.post('/mobile/register', validate(mobileRegisterSchema), registerMobile);
router.post('/mobile/login', validate(mobileLoginSchema), loginMobile);
router.post('/mobile/otp/request', requestMobileEmailOtp);
router.post('/mobile/otp/verify', verifyMobileEmailOtp);
router.post('/mobile/password/forgot', requestMobilePasswordResetOtp);
router.post('/mobile/password/verify', verifyMobilePasswordResetOtp);
router.post('/mobile/password/reset', resetMobilePassword);
router.get('/mobile/me', protect({ kind: 'mobile' }), getMobileMe);

router.post('/logout', protect(), logout);

export default router;
