import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { ApiError } from '../../shared/utils/ApiError.js';
import { saveTestImage } from './controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../../uploads');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    callback(null, `${Date.now()}-${safeName}`);
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

function handleImageUpload(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return next(new ApiError(400, error.message));
    }

    return next(error);
  });
}

router.post('/test-image', handleImageUpload, saveTestImage);

export default router;
