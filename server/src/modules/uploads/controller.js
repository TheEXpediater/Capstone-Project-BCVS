import { ApiError } from '../../shared/utils/ApiError.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { getUploadModel } from './model.js';

export const saveTestImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Image file is required.');
  }

  const Upload = getUploadModel();
  const image = await Upload.create({
    originalName: req.file.originalname,
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });

  res.status(201).json({
    success: true,
    image,
  });
});
