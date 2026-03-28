import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const adminPermissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'super_admin', 'developer', 'cashier'],
      required: true,
    }, 
    permissions: {
      canIssueVC: { type: Boolean, default: true },
      canSendQrEmail: { type: Boolean, default: true },
      canApproveAnchoring: { type: Boolean, default: false },
      canManageSystemSettings: { type: Boolean, default: false },
      canManageContracts: { type: Boolean, default: false },
      canViewWallet: { type: Boolean, default: false },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'admin_permissions',
  }
);

export function getAdminPermissionModel() {
  const connection = getPlatformConnection();
  return connection.models.AdminPermission || connection.model('AdminPermission', adminPermissionSchema);
}
