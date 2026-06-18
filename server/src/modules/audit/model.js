import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
      },
      kind: {
        type: String,
        enum: ['web', 'mobile', 'system'],
        default: 'system',
        index: true,
      },
      role: {
        type: String,
        default: '',
        trim: true,
        index: true,
      },
      username: {
        type: String,
        default: '',
        trim: true,
      },
      fullName: {
        type: String,
        default: '',
        trim: true,
      },
      email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        index: true,
      },
    },

    module: {
      type: String,
      enum: [
        'auth',
        'users',
        'roles',
        'credentials',
        'verification',
        'students',
        'curriculum',
        'contracts',
        'settings',
        'network',
        'mobile',
        'system',
      ],
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    label: {
      type: String,
      default: '',
      trim: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
    },

    target: {
      id: {
        type: String,
        default: '',
        trim: true,
        index: true,
      },
      type: {
        type: String,
        default: '',
        trim: true,
      },
      label: {
        type: String,
        default: '',
        trim: true,
      },
    },

    status: {
      type: String,
      enum: ['success', 'failed', 'info'],
      default: 'success',
      index: true,
    },

    request: {
      method: {
        type: String,
        default: '',
        trim: true,
      },
      path: {
        type: String,
        default: '',
        trim: true,
      },
      ipAddress: {
        type: String,
        default: '',
        trim: true,
      },
      userAgent: {
        type: String,
        default: '',
        trim: true,
      },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'audit_logs',
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ 'actor.kind': 1, 'actor.role': 1, createdAt: -1 });

export function getAuditLogModel() {
  const connection = getPlatformConnection();
  return connection.models.AuditLog || connection.model('AuditLog', auditLogSchema);
}