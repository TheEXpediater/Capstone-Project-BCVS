import mongoose from 'mongoose';
import { getIdentityConnection } from '../../config/db.js';

const roleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    clientType: {
      type: String,
      enum: ['web', 'mobile', 'both'],
      required: true,
      default: 'web',
    },
    permissions: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: '',
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'roles',
  }
);

export function getRoleModel() {
  const connection = getIdentityConnection();
  return connection.models.Role || connection.model('Role', roleSchema);
}
