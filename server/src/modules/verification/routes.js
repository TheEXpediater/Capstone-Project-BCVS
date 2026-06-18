import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import {
  approveVerificationSession,
  approveVerificationSubmission,
  cancelVerificationSession,
  createVerificationSession,
  denyVerificationSession,
  downloadPresentedCredential,
  downloadPresentedCredentialPdf,
  downloadVerificationReport,
  getMyVerification,
  getPublicVerificationSession,
  getVerificationResult,
  getVerificationSubmission,
  getVerificationSession,
  listVerificationSubmissions,
  presentVerificationSession,
  requestVerificationSession,
  rejectVerificationSubmission,
  submitAccountVerification,
} from './controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../../uploads/verification');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const userId = req.user?._id?.toString?.() || 'mobile';
    callback(null, `${Date.now()}-${userId}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype?.startsWith('image/')) {
      return callback(new ApiError(400, 'Only image files are allowed.'));
    }
    callback(null, true);
  },
});

const router = express.Router();

function handleVerificationUpload(req, res, next) {
  upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'validIdFront', maxCount: 1 },
    { name: 'validIdBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'liveness', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return next(new ApiError(400, error.message));
    }

    return next(error);
  });
}

router.get(
  '/me',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  getMyVerification
);

router.post(
  '/submit',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  handleVerificationUpload,
  submitAccountVerification
);

router.get(
  '/admin/submissions',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  listVerificationSubmissions
);

router.get(
  '/admin/submissions/:id',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  getVerificationSubmission
);

router.post(
  '/admin/submissions/:id/approve',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  approveVerificationSubmission
);

router.post(
  '/admin/submissions/:id/reject',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  rejectVerificationSubmission
);

router.post(
  '/session',
  createVerificationSession
);

router.post(
  '/session/:sessionId/request',
  requestVerificationSession
);

router.get(
  '/session/:sessionId/public',
  getPublicVerificationSession
);

router.get(
  '/session/:sessionId/result',
  getVerificationResult
);

router.post(
  '/session/:sessionId/cancel',
  cancelVerificationSession
);

router.get(
  '/session/:sessionId/download/vc',
  downloadPresentedCredential
);

router.get(
  '/session/:sessionId/download/report',
  downloadVerificationReport
);

router.get(
  '/session/:sessionId/download/pdf',
  downloadPresentedCredentialPdf
);

router.get(
  '/session/:sessionId',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  getVerificationSession
);

router.post(
  '/session/:sessionId/present',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  presentVerificationSession
);

router.post(
  '/session/:sessionId/approve',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  approveVerificationSession
);

router.post(
  '/session/:sessionId/deny',
  protect({ kind: 'mobile' }),
  allowRoles('student'),
  denyVerificationSession
);

export default router;
