import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const verificationSessionSchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    studentNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      default: '',
      trim: true,
    },
    nonce: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    request: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    verifyBaseUrl: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'presented', 'denied', 'expired'],
      default: 'pending',
      index: true,
    },
    decision: {
      type: String,
      enum: ['approve', 'deny', ''],
      default: '',
    },
    presentedAt: {
      type: Date,
      default: null,
    },
    presentedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    presentedCredentialId: {
      type: String,
      default: '',
      trim: true,
    },
    presentedCredential: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    collection: 'verification_sessions',
  }
);

verificationSessionSchema.index(
  {
    studentNo: 1,
    status: 1,
  },
  { name: 'verification_session_student_status_idx' }
);

export function getVerificationSessionModel() {
  const connection = getPlatformConnection();
  return (
    connection.models.VerificationSession ||
    connection.model('VerificationSession', verificationSessionSchema)
  );
}
