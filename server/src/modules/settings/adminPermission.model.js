const mongoose = require('mongoose');

const PERMISSION_KEYS = {
  canIssueVC: { type: Boolean, default: true },
  canSendQrEmail: { type: Boolean, default: true },
  canApproveAnchoring: { type: Boolean, default: false },
  canManageSystemSettings: { type: Boolean, default: false },
  canManageContracts: { type: Boolean, default: false },
  canViewWallet: { type: Boolean, default: false },
};

const adminPermissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['admin', 'super_admin', 'developer'],
      required: true,
    },
    permissions: PERMISSION_KEYS,
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

module.exports = mongoose.model('AdminPermission', adminPermissionSchema);
