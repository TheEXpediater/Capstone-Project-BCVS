import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const uploadSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    mimetype: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'uploads',
    versionKey: false,
  }
);

export function getUploadModel() {
  const connection = getPlatformConnection();
  return connection.models.Upload || connection.model('Upload', uploadSchema);
}
