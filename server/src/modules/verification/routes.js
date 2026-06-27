import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
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
const idUploadDir = path.join(uploadDir, 'IDs');
const selfieUploadDir = path.join(uploadDir, 'Selfies');

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(idUploadDir, { recursive: true });
fs.mkdirSync(selfieUploadDir, { recursive: true });

const storage = multer.memoryStorage();

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

function uploadCategory(file) {
  const fieldName = String(file?.fieldname || '').toLowerCase();
  return fieldName.includes('selfie') || fieldName.includes('liveness')
    ? { folder: 'Selfies', dir: selfieUploadDir }
    : { folder: 'IDs', dir: idUploadDir };
}

function safeFileBaseName(value) {
  return path
    .basename(String(value || 'verification-image'))
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
}

async function compressVerificationFile(req, file) {
  const category = uploadCategory(file);
  const userId = req.user?._id?.toString?.() || 'mobile';
  const filename = `${Date.now()}-${userId}-${file.fieldname}-${safeFileBaseName(file.originalname)}.jpg`;
  const outputPath = path.join(category.dir, filename);

  let buffer;
  try {
    buffer = await sharp(file.buffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new ApiError(400, 'Unable to process uploaded verification image.');
  }

  await fs.promises.writeFile(outputPath, buffer);

  return {
    ...file,
    buffer: undefined,
    filename,
    path: outputPath,
    destination: category.dir,
    relativePath: `${category.folder}/${filename}`,
    mimetype: 'image/jpeg',
    size: buffer.length,
  };
}

async function compressVerificationUploads(req) {
  const entries = Object.entries(req.files || {});

  for (const [fieldName, files] of entries) {
    req.files[fieldName] = await Promise.all(
      (files || []).map((file) => compressVerificationFile(req, file))
    );
  }
}

const router = express.Router();

function handleVerificationUpload(req, res, next) {
  upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'validIdFront', maxCount: 1 },
    { name: 'validIdBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'selfieProof', maxCount: 1 },
  ])(req, res, async (error) => {
    try {
      if (error instanceof multer.MulterError) {
        throw new ApiError(400, error.message);
      }
      if (error) throw error;

      await compressVerificationUploads(req);
      next();
    } catch (uploadError) {
      next(uploadError);
    }
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
