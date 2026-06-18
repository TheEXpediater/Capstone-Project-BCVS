import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const verificationSessionSchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    credentialType: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    studentNo: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      default: '',
      trim: true,
    },
    nonce: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    request: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    verifyBaseUrl: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'pending_consent', 'presented', 'denied', 'cancelled', 'expired', 'failed'],
      default: 'draft',
      index: true,
    },
    decision: {
      type: String,
      enum: ['approve', 'deny', 'cancel', ''],
      default: '',
    },
    presentedAt: {
      type: Date,
      default: null,
    },
    presentedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    presentedCredentialId: {
      type: String,
      default: '',
      trim: true,
    },
    presentedCredential: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    requestedAt: {
      type: Date,
      default: null,
    },
    holderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    allowPdfDownload: {
      type: Boolean,
      default: false,
    },
    requestedPdf: {
      type: Boolean,
      default: false,
    },
    vcHash: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    merkleLeaf: {
      type: String,
      default: '',
      trim: true,
    },
    merkleRoot: {
      type: String,
      default: '',
      trim: true,
    },
    merkleProof: {
      type: [String],
      default: [],
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
    verificationResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    collection: 'verification_sessions',
  }
);

verificationSessionSchema.index(
  {
    studentNo: 1,
    status: 1,
  },
  { name: 'verification_session_student_status_idx' }
);

export function getVerificationSessionModel() {
  const connection = getPlatformConnection();
  return (
    connection.models.VerificationSession ||
    connection.model('VerificationSession', verificationSessionSchema)
  );
}

const verificationSubmissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    submittedStudentNo: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    program: {
      type: String,
      default: '',
      trim: true,
    },
    yearGraduated: {
      type: String,
      default: '',
      trim: true,
    },
    graduationStatus: {
      type: String,
      enum: ['graduated', 'not_graduated_yet', ''],
      default: '',
      index: true,
    },
    contactNo: {
      type: String,
      default: '',
      trim: true,
    },
    validIdType: {
      type: String,
      default: '',
      trim: true,
    },
    idFrontUrl: {
      type: String,
      default: '',
      trim: true,
    },
    idBackUrl: {
      type: String,
      default: '',
      trim: true,
    },
    validIdFrontUrl: {
      type: String,
      default: '',
      trim: true,
    },
    validIdBackUrl: {
      type: String,
      default: '',
      trim: true,
    },
    selfieUrl: {
      type: String,
      default: '',
      trim: true,
    },
    livenessImageUrl: {
      type: String,
      default: '',
      trim: true,
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
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },
    linkedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    linkedStudentNo: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'verification_submissions',
  }
);

verificationSubmissionSchema.index(
  { userId: 1, status: 1 },
  { name: 'verification_submission_user_status_idx' }
);

export function getVerificationSubmissionModel() {
  const connection = getPlatformConnection();
  return (
    connection.models.VerificationSubmission ||
    connection.model('VerificationSubmission', verificationSubmissionSchema)
  );
}
