import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const contractSchema = new mongoose.Schema(
  {
    contractName: {
      type: String,
      required: true,
      default: 'AdminContract',
    },
    address: {
      type: String,
      default: null,
    },
    deployerAddress: {
      type: String,
      required: true,
    },
    txHash: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    chainId: {
      type: Number,
      required: true,
    },
    network: {
      type: String,
      required: true,
    },
    gasToken: {
      type: String,
      default: 'POL',
    },
    estimatedCostNative: {
      type: String,
      default: null,
    },
    estimatedCostWei: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    explorerUrl: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'contracts',
  }
);

export function getContractModel() {
  const connection = getPlatformConnection();
  return connection.models.Contract || connection.model('Contract', contractSchema);
}