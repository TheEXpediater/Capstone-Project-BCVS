import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
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
  updateWebPassword,
  updateWebProfile,
  updateWebProfilePicture,
  verifyMobileEmailOtp,
  verifyMobilePasswordResetOtp,
} from './controller.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import {
  bootstrapSuperAdminSchema,
  createWebUserSchema,
  createMobileUserSchema,
  webLoginSchema,
  mobileRegisterSchema,
  mobileLoginSchema,
  updateWebPasswordSchema,
  updateWebProfileSchema,
} from './validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const profileImageDir = path.resolve(__dirname, '../../../uploads/profile-images');

fs.mkdirSync(profileImageDir, { recursive: true });

const profileImageStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, profileImageDir);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeUserId = String(req.user?._id || 'profile').replace(/[^a-zA-Z0-9_-]/g, '');
    callback(null, `${safeUserId}-${Date.now()}${extension}`);
  },
});

const profileImageUpload = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new ApiError(400, 'Profile image must be a JPG, PNG, or WEBP file.'));
    }

    callback(null, true);
  },
});

const router = express.Router();

function handleProfileImageUpload(req, res, next) {
  profileImageUpload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return next(new ApiError(400, error.message));
    }

    return next(error);
  });
}

router.post('/bootstrap/super-admin', validate(bootstrapSuperAdminSchema), bootstrapSuperAdmin);

router.post('/web/login', validate(webLoginSchema), loginWeb);
router.get('/web/me', protect({ kind: 'web' }), getWebMe);
router.patch('/web/me', protect({ kind: 'web' }), validate(updateWebProfileSchema), updateWebProfile);
router.post('/web/me/password', protect({ kind: 'web' }), validate(updateWebPasswordSchema), updateWebPassword);
router.post('/web/me/profile-image', protect({ kind: 'web' }), handleProfileImageUpload, updateWebProfilePicture);
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
