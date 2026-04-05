import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const issuerKeySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    kid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    algorithm: {
      type: String,
      default: 'ES256',
    },
    curve: {
      type: String,
      default: 'P-256',
    },
    publicKeyPem: {
      type: String,
      required: true,
    },
    privateKeyCiphertext: {
      type: String,
      required: true,
      select: false,
    },
    privateKeyIv: {
      type: String,
      required: true,
      select: false,
    },
    privateKeyAuthTag: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'retired'],
      default: 'inactive',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    rotationReason: {
      type: String,
      default: '',
      trim: true,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    retiredAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'issuer_keys',
  }
);

export function getIssuerKeyModel() {
  const connection = getPlatformConnection();
  return connection.models.IssuerKey || connection.model('IssuerKey', issuerKeySchema);
}