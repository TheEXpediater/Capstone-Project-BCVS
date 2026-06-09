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
      claimQrExpiryMinutes: { type: Number, default: 15, min: 1, max: 1440 },
      allowRegeneration: { type: Boolean, default: true },
      allowedRoles: {
        type: [{ type: String, enum: ROLE_VALUES }],
        default: ['admin', 'super_admin'],
      },
    },
    blockchain: {
      selectedContractId: { type: String, default: '' },
      selectedContractName: { type: String, default: '' },
      selectedContractType: { type: String, default: '' },
      selectedContractAddress: { type: String, default: '' },
      selectedContractChainId: { type: Number, default: null },
      selectedContractNetwork: { type: String, default: '' },
      selectedContractExplorerUrl: { type: String, default: '' },
      selectedContractCapabilities: {
        canAnchorMerkleRoot: { type: Boolean, default: false },
        canVerifyMerkleRoot: { type: Boolean, default: false },
        anchorFunctionName: { type: String, default: '' },
        verifyFunctionName: { type: String, default: '' },
        rootAnchoredEventName: { type: String, default: '' },
      },
      activeAnchorContractId: { type: String, default: '' },
      activeAnchorContractAddress: { type: String, default: '' },
      activeAnchorContractName: { type: String, default: '' },
      activeAnchorContractChainId: { type: Number, default: null },
      activeAnchorContractNetwork: { type: String, default: '' },
      activeAnchorContractExplorerUrl: { type: String, default: '' },
      activeAnchorContractCapabilities: {
        canAnchorMerkleRoot: { type: Boolean, default: false },
        canVerifyMerkleRoot: { type: Boolean, default: false },
        anchorFunctionName: { type: String, default: '' },
        verifyFunctionName: { type: String, default: '' },
        rootAnchoredEventName: { type: String, default: '' },
      },
      walletAddress: { type: String, default: '' },
      networkLabel: { type: String, default: 'Local Chain' },
      walletBalance: { type: String, default: '0.0000' },
    },
    locks: {
      anchorLocked: { type: Boolean, default: false },
      qrEmailLocked: { type: Boolean, default: false },
      qrGenerationLocked: { type: Boolean, default: false },
      contractLocked: { type: Boolean, default: false },
      issuerKeyRotationLocked: { type: Boolean, default: false },
      paymentConfirmationLocked: { type: Boolean, default: false },
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
