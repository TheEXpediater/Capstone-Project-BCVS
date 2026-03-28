import express from 'express';
import {
  bootstrapSuperAdmin,
  createWebUser,
  getMobileMe,
  getWebMe,
  listWebUsers,
  loginMobile,
  loginWeb,
  logout,
  registerMobile,
} from './controller.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  bootstrapSuperAdminSchema,
  createWebUserSchema,
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

router.post('/mobile/register', validate(mobileRegisterSchema), registerMobile);
router.post('/mobile/login', validate(mobileLoginSchema), loginMobile);
router.get('/mobile/me', protect({ kind: 'mobile' }), getMobileMe);

router.post('/logout', protect(), logout);

export default router;
