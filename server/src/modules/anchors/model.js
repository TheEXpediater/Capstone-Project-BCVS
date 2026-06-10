import mongoose from 'mongoose';
import { getCredentialsConnection } from '../../config/db.js';

const anchorCredentialSchema = new mongoose.Schema(
  {
    credential: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    credentialId: {
      type: String,
      required: true,
      trim: true,
    },
    vcHash: {
      type: String,
      default: '',
      trim: true,
    },
    merkleLeaf: {
      type: String,
      required: true,
      trim: true,
    },
    merkleProof: {
      type: [String],
      default: [],
    },
    merkleLeafIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    proofHash: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const anchorSchema = new mongoose.Schema(
  {
    anchorType: {
      type: String,
      enum: ['single', 'batch'],
      required: true,
      index: true,
    },
    batchId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    merkleRoot: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    merkleAlgorithm: {
      type: String,
      required: true,
      trim: true,
    },
    merkleTreeSize: {
      type: Number,
      required: true,
      min: 1,
    },
    contractId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    contractAddress: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    chainId: {
      type: Number,
      default: null,
      index: true,
    },
    network: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'anchored', 'failed'],
      default: 'pending',
      index: true,
    },
    txHash: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    explorerUrl: {
      type: String,
      default: '',
      trim: true,
    },
    eventName: {
      type: String,
      default: '',
      trim: true,
    },
    eventArgs: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    anchoredAt: {
      type: Date,
      default: null,
    },
    anchoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
      trim: true,
    },
    credentials: {
      type: [anchorCredentialSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'merkle_anchors',
  }
);

anchorSchema.index({ contractAddress: 1, merkleRoot: 1 }, { unique: true });

export function getMerkleAnchorModel() {
  const connection = getCredentialsConnection();
  return connection.models.MerkleAnchor || connection.model('MerkleAnchor', anchorSchema);
}
