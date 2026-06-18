import mongoose from 'mongoose';
import { getIdentityConnection } from '../../config/db.js';

const pushTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    deviceId: {
      type: String,
      default: '',
      trim: true,
    },
    studentId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastRegisteredAt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'push_tokens',
  }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'credential_ready',
        'credential_requested',
        'verification_request',
        'credential_shared',
        'payment_received',
        'credential_claimed',
        'credential_anchored',
        'anchor_scheduled',
        'anchor_now_requested',
        'verification_submitted',
        'proof_prepared',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      default: '',
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

export function getPushTokenModel() {
  const connection = getIdentityConnection();
  return connection.models.PushToken || connection.model('PushToken', pushTokenSchema);
}

export function getNotificationModel() {
  const connection = getIdentityConnection();
  return (
    connection.models.Notification ||
    connection.model('Notification', notificationSchema)
  );
}
