const mongoose = require('mongoose');

const ROLE_VALUES = ['admin', 'super_admin', 'developer'];

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
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemSetting', settingSchema);
