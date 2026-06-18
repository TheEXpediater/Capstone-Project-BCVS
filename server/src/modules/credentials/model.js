import mongoose from 'mongoose';
import { getCredentialsConnection } from '../../config/db.js';

const credentialDraftSchema = new mongoose.Schema(
  {
    credentialType: {
      type: String,
      default: 'tor',
      trim: true,
      index: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
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
      required: true,
      trim: true,
    },

    profileSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },

    gradesSnapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    curriculumSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
    },

    remarks: {
      type: String,
      default: '',
      trim: true,
    },

    presetRemark: {
      type: String,
      default: '',
      trim: true,
    },

    anchorPreference: {
      type: String,
      enum: ['none', 'request', 'after_signing'],
      default: 'after_signing',
      index: true,
    },

    livenessPassed: {
      type: Boolean,
      default: false,
    },

    livenessMethod: {
      type: String,
      default: '',
      trim: true,
    },

    livenessPassedAt: {
      type: Date,
      default: null,
    },

    requestSource: {
      type: String,
      enum: ['web', 'mobile'],
      default: 'web',
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
      index: true,
    },

    paymentCode: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      index: true,
    },

    receiptNo: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      index: true,
    },

    amount: {
      type: Number,
      default: 150,
      min: 0,
    },

    baseAmount: {
      type: Number,
      default: 150,
      min: 0,
    },

    anchorNowFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 150,
      min: 0,
    },

    anchorNow: {
      type: Boolean,
      default: false,
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    paymentConfirmedAt: {
      type: Date,
      default: null,
    },

    paymentConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    paymentNotes: {
      type: String,
      default: '',
      trim: true,
    },

    status: {
      type: String,
      enum: [
        'draft',
        'for_signature',
        'signed',
        'claim_ready',
        'claimed',
        'shared',
        'revoked',
        'rejected',
        'queued_for_anchor',
        'anchored',
      ],
      default: 'draft',
      index: true,
    },

    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    signedAt: {
      type: Date,
      default: null,
    },

    claimTokenHash: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    claimToken: {
      type: String,
      default: '',
      trim: true,
    },

    claimTokenExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    claimTokenCreatedAt: {
      type: Date,
      default: null,
    },

    claimTokenCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    claimTokenRegeneratedAt: {
      type: Date,
      default: null,
    },

    claimTokenRegeneratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    claimReadyAt: {
      type: Date,
      default: null,
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    claimedDeviceId: {
      type: String,
      default: '',
      trim: true,
    },

    anchorMode: {
      type: String,
      enum: ['none', 'default', 'anchor_now', 'same_day', 'scheduled'],
      default: 'default',
      index: true,
    },

    anchorScheduleMode: {
      type: String,
      enum: ['', 'same_day', 'scheduled'],
      default: '',
    },

    scheduledAnchorAt: {
      type: Date,
      default: null,
    },

    anchorStatus: {
      type: String,
      enum: [
        'not_requested',
        'queued',
        'merkle_ready',
        'contract_missing',
        'contract_unsupported',
        'anchor_failed',
        'anchored',
      ],
      default: 'not_requested',
    },

    anchoredAt: {
      type: Date,
      default: null,
    },

    anchoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    anchorTxHash: {
      type: String,
      default: '',
      trim: true,
    },

    anchorBatchId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    contractAddress: {
      type: String,
      default: '',
      trim: true,
    },

    anchorContractAddress: {
      type: String,
      default: '',
      trim: true,
    },

    anchorFailureReason: {
      type: String,
      default: '',
      trim: true,
    },

    credentialHash: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    vcHash: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    canonicalVcHash: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    canonicalizationAlgorithm: {
      type: String,
      default: '',
      trim: true,
    },

    hashAlgorithm: {
      type: String,
      default: '',
      trim: true,
    },

    signatureAlgorithm: {
      type: String,
      default: '',
      trim: true,
    },

    verificationMethod: {
      type: String,
      default: '',
      trim: true,
    },

    issuerKeyId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    issuerPublicKey: {
      type: String,
      default: '',
      trim: true,
    },

    issuedAt: {
      type: Date,
      default: null,
    },

    merkleLeaf: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    merkleRoot: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    merkleProof: {
      type: [String],
      default: [],
    },

    merkleTreeSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    merkleLeafIndex: {
      type: Number,
      default: -1,
    },

    merkleAlgorithm: {
      type: String,
      default: '',
      trim: true,
    },

    anchorChainId: {
      type: Number,
      default: null,
    },

    anchorNetwork: {
      type: String,
      default: '',
      trim: true,
    },

    anchorBlockNumber: {
      type: Number,
      default: null,
    },

    anchorExplorerUrl: {
      type: String,
      default: '',
      trim: true,
    },

    anchorEventName: {
      type: String,
      default: '',
      trim: true,
    },

    anchorEventArgs: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    anchoringUnavailableReason: {
      type: String,
      default: '',
      trim: true,
    },

    anchoring: {
      isAnchored: { type: Boolean, default: false, index: true },
      anchorId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
      status: { type: String, default: 'not_requested', trim: true },
      anchoredAt: { type: Date, default: null },
      txHash: { type: String, default: '', trim: true },
      batchId: { type: String, default: '', trim: true },
      blockNumber: { type: Number, default: null },
      contractAddress: { type: String, default: '', trim: true },
      contractId: { type: String, default: '', trim: true },
      chainId: { type: Number, default: null },
      network: { type: String, default: '', trim: true },
      explorerUrl: { type: String, default: '', trim: true },
      merkleRoot: { type: String, default: '', trim: true },
      merkleLeaf: { type: String, default: '', trim: true },
      merkleProof: { type: [String], default: [] },
      merkleTreeSize: { type: Number, default: 0, min: 0 },
      merkleLeafIndex: { type: Number, default: -1 },
      merkleAlgorithm: { type: String, default: '', trim: true },
      proofHash: { type: String, default: '', trim: true },
      canonicalCredentialHash: { type: String, default: '', trim: true },
      eventName: { type: String, default: '', trim: true },
      eventArgs: { type: mongoose.Schema.Types.Mixed, default: null },
      failureReason: { type: String, default: '', trim: true },
    },

    vcPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    signedCredential: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    lastVerificationResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    lastVerifiedAt: {
      type: Date,
      default: null,
    },

    claimOverrideHistory: {
      type: [
        {
          reason: { type: String, default: '', trim: true },
          actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
          actorName: { type: String, default: '', trim: true },
          actorRole: { type: String, default: '', trim: true },
          createdAt: { type: Date, default: Date.now },
          previousClaimedAt: { type: Date, default: null },
          previousClaimedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
          previousDeviceId: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'credential_drafts',
  }
);

credentialDraftSchema.index(
  {
    student: 1,
    credentialType: 1,
    status: 1,
  },
  { name: 'credential_student_status_idx' }
);

export function getCredentialDraftModel() {
  const connection = getCredentialsConnection();
  return (
    connection.models.CredentialDraft ||
    connection.model('CredentialDraft', credentialDraftSchema)
  );
}
