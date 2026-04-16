import mongoose from 'mongoose';
import { getCredentialsConnection } from '../../config/db.js';

const credentialDraftSchema = new mongoose.Schema(
  {
    credentialType: {
      type: String,
      default: 'student_record',
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

    status: {
      type: String,
      enum: [
        'draft',
        'for_signature',
        'signed',
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

    anchorMode: {
      type: String,
      enum: ['none', 'same_day', 'scheduled'],
      default: 'none',
    },

    scheduledAnchorAt: {
      type: Date,
      default: null,
    },

    anchorStatus: {
      type: String,
      enum: ['not_requested', 'queued', 'anchored'],
      default: 'not_requested',
    },

    anchoredAt: {
      type: Date,
      default: null,
    },

    anchorTxHash: {
      type: String,
      default: '',
      trim: true,
    },

    contractAddress: {
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

    vcPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    signedCredential: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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