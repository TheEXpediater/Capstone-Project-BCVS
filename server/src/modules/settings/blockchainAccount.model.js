import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const blockchainAccountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    encryptedPrivateKey: {
      type: String,
      required: true,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'blockchain_accounts',
  }
);

blockchainAccountSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'only_one_active_blockchain_account',
  }
);

export function getBlockchainAccountModel() {
  const connection = getPlatformConnection();
  return (
    connection.models.BlockchainAccount ||
    connection.model('BlockchainAccount', blockchainAccountSchema)
  );
}
