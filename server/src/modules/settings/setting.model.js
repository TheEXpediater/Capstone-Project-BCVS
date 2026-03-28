import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const ROLE_VALUES = ['admin', 'super_admin', 'developer', 'cashier'];

const settingSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      default: 'main',
      trim: true,
    },
    anchoring: {
      enabled: { type: Boolean, default: true },
      intervalDays: { type: Number, default: 7, min: 1, max: 365 },
      autoAnchor: { type: Boolean, default: false },
    },
    qrDelivery: {
      allowEmail: { type: Boolean, default: true },
      allowedRoles: {
        type: [{ type: String, enum: ROLE_VALUES }],
        default: ['admin', 'super_admin'],
      },
    },
    blockchain: {
      selectedContractId: { type: String, default: '' },
      selectedContractName: { type: String, default: '' },
      walletAddress: { type: String, default: '' },
      networkLabel: { type: String, default: 'Local Chain' },
      walletBalance: { type: String, default: '0.0000' },
    },
    locks: {
      anchorLocked: { type: Boolean, default: false },
      qrEmailLocked: { type: Boolean, default: false },
      contractLocked: { type: Boolean, default: false },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'system_settings',
  }
);

export function getSystemSettingModel() {
  const connection = getPlatformConnection();
  return connection.models.SystemSetting || connection.model('SystemSetting', settingSchema);
}
