import { Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import { decryptPrivateKey } from '../../shared/utils/keyVault.js';
import {
  buildMerkleLeaf,
  buildMerkleProof,
  buildMerkleTree,
  CANONICALIZATION_ALGORITHM,
  computeVcHash,
  HASH_ALGORITHM,
  MERKLE_ALGORITHM,
  signVcPayload,
} from '../../shared/utils/vcProof.js';
import { getCredentialDraftModel } from './model.js';
import { getStudentModel, getStudentGradeModel } from '../students/model.js';
import { getSystemSettingModel } from '../settings/setting.model.js';
import { getIssuerKeyModel } from '../settings/issuerKey.model.js';
import { getAdminPermissionModel } from '../settings/adminPermission.model.js';
import { getContractModel } from '../contracts/model.js';
import {
  anchorMerkleRoot,
  getActiveContractRecord,
  getExplorerBaseUrl,
} from '../contracts/service.js';
import { notifyStudentByStudentNo, notifyUser } from '../notifications/service.js';

const CLAIM_TOKEN_TTL_MINUTES = 15;
const OPEN_REQUEST_STATUSES = ['draft', 'for_signature', 'signed', 'claim_ready', 'queued_for_anchor', 'anchored'];
const CLAIMABLE_STATUSES = ['signed', 'claim_ready', 'queued_for_anchor', 'anchored'];
const TERMINAL_BLOCKED_STATUSES = ['claimed', 'revoked', 'rejected'];
export const SUPPORTED_CREDENTIAL_TYPES = ['tor', 'diploma'];

const DEFAULT_CREDENTIAL_PERMISSIONS = {
  admin: {
    canConfirmPayments: true,
    canManageVC: true,
    canSignVC: true,
    canGenerateClaimQr: true,
    canAnchorVC: true,
  },
  super_admin: {
    canConfirmPayments: true,
    canManageVC: true,
    canSignVC: true,
    canGenerateClaimQr: true,
    canAnchorVC: true,
  },
  developer: {
    canConfirmPayments: true,
    canManageVC: true,
    canSignVC: true,
    canGenerateClaimQr: true,
    canAnchorVC: true,
  },
  cashier: {
    canConfirmPayments: true,
    canManageVC: false,
    canSignVC: false,
    canGenerateClaimQr: false,
    canAnchorVC: false,
  },
};

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function normalizeCredentialType(value, fallback = 'tor') {
  const normalized = cleanString(value || fallback, fallback)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['tor', 'transcript', 'transcript_of_records', 'student_record', 'student_academic_record'].includes(normalized)) {
    return 'tor';
  }

  if (['diploma', 'degree', 'graduation_diploma'].includes(normalized)) {
    return 'diploma';
  }

  return '';
}

export function isSupportedCredentialType(value) {
  return SUPPORTED_CREDENTIAL_TYPES.includes(normalizeCredentialType(value));
}

function credentialTypeLabel(value) {
  return normalizeCredentialType(value) === 'diploma' ? 'Diploma' : 'Transcript of Records';
}

function credentialVcType(value) {
  return normalizeCredentialType(value) === 'diploma'
    ? 'DiplomaCredential'
    : 'TranscriptOfRecordsCredential';
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function assertObjectId(value, label = 'id') {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
}

function assertRegistrar(actor) {
  if (!actor || !['admin', 'super_admin', 'developer'].includes(actor.role)) {
    throw new ApiError(403, 'Only admin, super admin, or MIS developer can perform this action');
  }
}

function getDefaultCredentialPermissions(role) {
  return {
    ...(DEFAULT_CREDENTIAL_PERMISSIONS[role] || DEFAULT_CREDENTIAL_PERMISSIONS.admin),
  };
}

async function getEffectiveCredentialPermissions(actor) {
  if (!actor?.role) return {};

  const defaults = getDefaultCredentialPermissions(actor.role);

  if (!actor?._id) return defaults;

  const AdminPermission = getAdminPermissionModel();
  const override = await AdminPermission.findOne({ user: actor._id }).lean();

  return {
    ...defaults,
    ...(override?.permissions || {}),
  };
}

async function assertCredentialPermission(actor, permission, message) {
  if (!actor) {
    throw new ApiError(401, 'Authentication required');
  }

  const permissions = await getEffectiveCredentialPermissions(actor);

  if (!permissions?.[permission]) {
    throw new ApiError(403, message || 'You do not have permission to perform this credential action');
  }
}

export function isCredentialPaid(draft) {
  return cleanString(draft?.paymentStatus, 'unpaid').toLowerCase() === 'paid';
}

export function isCredentialClaimed(draft) {
  return draft?.status === 'claimed' || Boolean(draft?.claimedAt);
}

export function isCredentialRejectedOrRevoked(draft) {
  return ['rejected', 'revoked'].includes(cleanString(draft?.status).toLowerCase());
}

export function hasSignedCredential(draft) {
  return Boolean(draft?.signedCredential) || CLAIMABLE_STATUSES.includes(cleanString(draft?.status));
}

export function canGenerateClaimToken(draft, { override = false } = {}) {
  if (!draft) return false;
  if (!isCredentialPaid(draft)) return false;
  if (!draft.signedCredential) return false;
  if (isCredentialRejectedOrRevoked(draft)) return false;

  if (isCredentialClaimed(draft)) {
    return Boolean(override);
  }

  return CLAIMABLE_STATUSES.includes(cleanString(draft.status));
}

export function canClaimCredential(draft) {
  if (!draft) return false;
  if (!isCredentialPaid(draft)) return false;
  if (!draft.signedCredential) return false;
  if (isCredentialClaimed(draft)) return false;
  if (isCredentialRejectedOrRevoked(draft)) return false;
  return CLAIMABLE_STATUSES.includes(cleanString(draft.status));
}

export function canQueueAnchor(draft) {
  if (!draft) return false;
  if (!isCredentialPaid(draft)) return false;
  if (!draft.signedCredential) return false;
  if (isCredentialRejectedOrRevoked(draft)) return false;
  if (['queued', 'anchored'].includes(draft.anchorStatus)) return false;
  return ['signed', 'claim_ready', 'queued_for_anchor', 'anchored', 'claimed'].includes(cleanString(draft.status));
}

export function canProcessAnchor(draft) {
  if (!draft) return false;
  if (!isCredentialPaid(draft)) return false;
  if (!draft.signedCredential) return false;
  if (isCredentialRejectedOrRevoked(draft)) return false;
  return draft.anchorStatus === 'queued';
}

export function canMarkPaid(draft) {
  return Boolean(draft) && !['revoked', 'rejected'].includes(cleanString(draft.status));
}

export function canSubmitForSigning(draft) {
  return Boolean(draft) && draft.status === 'draft';
}

export function canSignCredential(draft) {
  return Boolean(draft) && draft.status === 'for_signature' && isCredentialPaid(draft);
}

export function canOverrideClaimQr(draft) {
  return Boolean(draft) && isCredentialPaid(draft) && draft.signedCredential && isCredentialClaimed(draft) && !isCredentialRejectedOrRevoked(draft);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function addMinutes(date, minutes) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + Number(minutes || 0));
  return next;
}

function generateClaimToken() {
  return randomBytes(32).toString('base64url');
}

function hashClaimToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function randomCode(length = 6) {
  return randomBytes(6).toString('hex').slice(0, length).toUpperCase();
}

function compactDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function generateUniquePaymentCode(CredentialDraft) {
  const stamp = compactDateStamp();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const paymentCode = `PAY-${stamp}-${randomCode(6)}`;
    const exists = await CredentialDraft.exists({ paymentCode });
    if (!exists) return paymentCode;
  }

  throw new ApiError(500, 'Could not generate a payment code');
}

async function generateUniqueReceiptNo(CredentialDraft) {
  const stamp = compactDateStamp();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const receiptNo = `RCPT-${stamp}-${randomCode(6)}`;
    const exists = await CredentialDraft.exists({ receiptNo });
    if (!exists) return receiptNo;
  }

  throw new ApiError(500, 'Could not generate a receipt number');
}

function normalizeAmount(value, fallback = 0) {
  const amount = Number(value ?? fallback);
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  return String(value || '').trim().toLowerCase() === 'true';
}

function normalizeAnchorPreference(value) {
  const normalized = cleanString(value, 'after_signing').toLowerCase();

  if (['none', 'request', 'after_signing'].includes(normalized)) {
    return normalized;
  }

  return 'after_signing';
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function assertCashierActor(actor) {
  if (!actor || !['cashier', 'admin', 'super_admin', 'developer'].includes(actor.role)) {
    throw new ApiError(403, 'Only cashier, admin, super admin, or MIS developer can update payments');
  }
}

function normalizeStudentNo(value) {
  return cleanString(value).toLowerCase();
}

function assertMobileStudent(actor, action = 'claiming') {
  const actionLabel = action === 'requesting' ? 'request' : 'claim';

  if (!actor || actor.kind !== 'mobile' || actor.role !== 'student') {
    throw new ApiError(403, `Only authenticated student mobile users can ${actionLabel} credentials`);
  }

  const verificationStatus = cleanString(actor.verified || actor.verificationStatus, 'unverified').toLowerCase();

  if (!['verified', 'true'].includes(verificationStatus)) {
    throw new ApiError(403, `Your account must be verified before ${actionLabel}ing this credential.`);
  }

  if (!cleanString(actor.studentId)) {
    throw new ApiError(403, `Your account must be verified before ${actionLabel}ing this credential.`);
  }
}

async function ensureMainSettings() {
  const SystemSetting = getSystemSettingModel();

  let settings = await SystemSetting.findOne({ code: 'main' });

  if (!settings) {
    settings = await SystemSetting.create({ code: 'main' });
  }

  return settings;
}

async function getActiveIssuerKeyOrThrow() {
  const IssuerKey = getIssuerKeyModel();

  const keyDoc = await IssuerKey.findOne({
    isActive: true,
    status: 'active',
  })
    .select('+privateKeyCiphertext +privateKeyIv +privateKeyAuthTag')
    .sort({ activatedAt: -1, createdAt: -1 });

  if (!keyDoc) {
    throw new ApiError(
      409,
      'No active issuer key found. Activate one first in System Settings.'
    );
  }

  if (
    !keyDoc.privateKeyCiphertext ||
    !keyDoc.privateKeyIv ||
    !keyDoc.privateKeyAuthTag
  ) {
    throw new ApiError(
      500,
      'Active issuer key is missing encrypted private key fields.'
    );
  }

  return keyDoc;
}

async function resolveActiveContractAddress(settings) {
  const activeContract = await getActiveContractRecord(settings);
  return cleanString(activeContract?.address);
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function buildExplorerLink({ explorerBaseUrl, anchorTxHash, contractAddress }) {
  const base = cleanString(explorerBaseUrl);
  const txHash = cleanString(anchorTxHash);
  const address = cleanString(contractAddress);

  if (!base) return '';
  if (/^https?:\/\//i.test(base) && /\/(tx|address)\//i.test(base)) return base;
  if (txHash) return `${base}/tx/${encodeURIComponent(txHash)}`;
  if (address) return `${base}/address/${encodeURIComponent(address)}`;

  return '';
}

async function findContractForAddress(contractAddress) {
  const normalized = cleanString(contractAddress);
  if (!normalized) return null;

  const Contract = getContractModel();
  const clauses = [{ address: normalized }];

  if (Types.ObjectId.isValid(normalized)) {
    clauses.push({ _id: normalized });
  }

  return Contract.findOne({
    status: 'success',
    $or: clauses,
  })
    .sort({ createdAt: -1 })
    .lean();
}

async function buildBlockchainMetadata(draft) {
  const contractAddress = cleanString(draft?.anchorContractAddress || draft?.contractAddress);
  const anchorTxHash = cleanString(draft?.anchorTxHash);

  if (!contractAddress && !anchorTxHash) {
    return null;
  }

  const contract = contractAddress
    ? await findContractForAddress(contractAddress)
    : null;
  const chainId = draft?.anchorChainId ?? contract?.chainId ?? env.blockchain.chainId ?? null;
  const explorerBaseUrl =
    cleanString(draft?.anchorExplorerUrl) ||
    getUrlOrigin(contract?.explorerUrl) ||
    getExplorerBaseUrl(chainId) ||
    getExplorerBaseUrl(env.blockchain.chainId) ||
    '';
  const anchorUrl = buildExplorerLink({
    explorerBaseUrl,
    anchorTxHash,
    contractAddress,
  });

  return {
    contractAddress,
    anchorContractAddress: contractAddress,
    anchorTxHash,
    anchorMode: draft?.anchorMode || 'none',
    anchorStatus: draft?.anchorStatus || 'not_requested',
    scheduledAnchorAt: draft?.scheduledAnchorAt || null,
    anchoredAt: draft?.anchoredAt || null,
    chainId,
    network: draft?.anchorNetwork || contract?.network || '',
    blockNumber: draft?.anchorBlockNumber ?? null,
    batchId: draft?.anchorBatchId || draft?.anchoring?.batchId || '',
    eventName: draft?.anchorEventName || '',
    eventArgs: draft?.anchorEventArgs || null,
    failureReason: draft?.anchorFailureReason || '',
    merkleRoot: draft?.merkleRoot || '',
    merkleLeaf: draft?.merkleLeaf || '',
    merkleProof: draft?.merkleProof || [],
    merkleTreeSize: draft?.merkleTreeSize || 0,
    merkleLeafIndex: draft?.merkleLeafIndex ?? -1,
    anchoringUnavailableReason: draft?.anchoringUnavailableReason || '',
    explorerBaseUrl,
    anchorUrl,
  };
}

function serializeDraft(doc) {
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  return clonePlain(raw);
}

function sanitizeDraftForNotification(doc) {
  const copy = serializeDraft(doc);
  delete copy.claimToken;
  delete copy.claimTokenHash;
  delete copy.claimTokenExpiresAt;
  delete copy.claimTokenCreatedAt;
  delete copy.claimTokenCreatedBy;
  delete copy.claimTokenRegeneratedAt;
  delete copy.claimTokenRegeneratedBy;
  return copy;
}

async function serializeWalletCredential(doc) {
  const draft = serializeDraft(doc);
  const credential = clonePlain(draft.signedCredential);

  if (!credential) {
    throw new ApiError(409, 'Signed credential payload is missing');
  }

  const blockchain = await buildBlockchainMetadata(draft);

  return {
    ...credential,
    _id: draft._id,
    credentialId: draft._id,
    credentialHash: draft.credentialHash,
    vcPayload: clonePlain(credential),
    vcHash: draft.vcHash || draft.credentialHash || credential.proof?.vcHash || '',
    canonicalVcHash: draft.canonicalVcHash || credential.proof?.canonicalVcHash || '',
    canonicalizationAlgorithm:
      draft.canonicalizationAlgorithm ||
      credential.proof?.canonicalizationAlgorithm ||
      CANONICALIZATION_ALGORITHM,
    hashAlgorithm: draft.hashAlgorithm || credential.proof?.hashAlgorithm || HASH_ALGORITHM,
    signatureAlgorithm: draft.signatureAlgorithm || credential.proof?.signatureAlgorithm || '',
    verificationMethod: draft.verificationMethod || credential.proof?.verificationMethod || '',
    issuerKeyId: draft.issuerKeyId || credential.proof?.issuerKeyId || '',
    issuedAt: draft.issuedAt || draft.signedAt || credential.issuanceDate || null,
    merkleLeaf: draft.merkleLeaf || '',
    merkleRoot: draft.merkleRoot || '',
    merkleProof: draft.merkleProof || [],
    merkleTreeSize: draft.merkleTreeSize || 0,
    merkleLeafIndex: draft.merkleLeafIndex ?? -1,
    merkleAlgorithm: draft.merkleAlgorithm || MERKLE_ALGORITHM,
    status: draft.status,
    ...(blockchain
      ? {
          blockchain: {
            ...(credential.blockchain || {}),
            ...blockchain,
          },
          blockchainUrl: blockchain.anchorUrl,
          contractAddress: blockchain.contractAddress,
          anchorContractAddress: blockchain.anchorContractAddress,
          anchorTxHash: blockchain.anchorTxHash,
          anchorFailureReason: blockchain.failureReason,
        }
      : {}),
    meta: {
      ...(credential.meta || {}),
      fullName: draft.studentName,
      studentNo: draft.studentNo,
      credentialType: normalizeCredentialType(draft.credentialType),
      title: credentialTypeLabel(draft.credentialType),
      issuedAt: draft.signedAt,
      signedAt: draft.signedAt,
      claimedAt: draft.claimedAt,
      credentialHash: draft.credentialHash,
      vcHash: draft.vcHash || draft.credentialHash || '',
      status: draft.status,
      ...(blockchain
        ? {
            blockchainUrl: blockchain.anchorUrl,
            contractAddress: blockchain.contractAddress,
            anchorContractAddress: blockchain.anchorContractAddress,
            anchorTxHash: blockchain.anchorTxHash,
            anchorStatus: blockchain.anchorStatus,
            anchoredAt: blockchain.anchoredAt,
            anchorFailureReason: blockchain.failureReason,
          }
        : {}),
    },
  };
}

async function buildClaimResponse(draft) {
  const credential = await serializeWalletCredential(draft);
  const serialized = serializeDraft(draft);

  return {
    credential,
    metadata: {
      credentialId: serialized._id,
      credentialHash: serialized.credentialHash,
      status: serialized.status,
      studentNo: serialized.studentNo,
      studentName: serialized.studentName,
      signedAt: serialized.signedAt,
      claimReadyAt: serialized.claimReadyAt,
      claimedAt: serialized.claimedAt,
      blockchain: credential.blockchain || null,
      blockchainUrl: credential.blockchainUrl || '',
    },
  };
}

async function getStudentBundle(studentId) {
  assertObjectId(studentId, 'student id');

  const Student = getStudentModel();
  const StudentGrade = getStudentGradeModel();
  const { getCurriculumModel } = await import('../curriculum/model.js');
  const Curriculum = getCurriculumModel();

  const student = await Student.findById(studentId)
    .populate({
      path: 'curriculumId',
      model: Curriculum,
      select: 'program programName curriculumYear structure',
    })
    .lean();

  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const grades = await StudentGrade.find({ student: student._id })
    .sort({
      yearLevel: 1,
      semester: 1,
      subjectCode: 1,
    })
    .lean();

  return {
    student,
    grades,
  };
}

async function getStudentBundleByStudentNo(studentNo) {
  const normalizedStudentNo = cleanString(studentNo);

  if (!normalizedStudentNo) {
    throw new ApiError(403, 'Your account must be verified before requesting this credential.');
  }

  const Student = getStudentModel();
  const student = await Student.findOne({ studentNo: normalizedStudentNo }).lean();

  if (!student) {
    throw new ApiError(404, 'Linked student record was not found');
  }

  return getStudentBundle(student._id);
}

function buildVcPayload(draft, issuerKey) {
  const credentialType = normalizeCredentialType(draft.credentialType);
  if (!credentialType) {
    throw new ApiError(400, 'Only TOR and Diploma credentials are supported');
  }

  const title = credentialTypeLabel(credentialType);
  const profile = clonePlain(draft.profileSnapshot);
  const curriculum = clonePlain(draft.curriculumSnapshot);
  const grades = credentialType === 'tor' ? clonePlain(draft.gradesSnapshot || []) : [];

  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: `urn:bcvs:credential-draft:${draft._id}`,
    type: ['VerifiableCredential', credentialVcType(credentialType)],
    issuer: {
      id: issuerKey.kid,
      name: 'BCVS Registrar',
    },
    issuanceDate: new Date().toISOString(),
    name: title,
    credentialType,
    credentialSubject: {
      id: `urn:bcvs:student:${draft.studentNo}`,
      studentNo: draft.studentNo,
      studentName: draft.studentName,
      documentType: title,
      profile,
      curriculum,
      grades,
    },
  };
}

function signCredentialPayload(vcPayload, issuerKey, privateKeyPem) {
  const proof = signVcPayload(vcPayload, issuerKey, privateKeyPem);
  const merkleLeaf = buildMerkleLeaf(proof.vcHash);
  return {
    credentialHash: proof.vcHash,
    ...proof,
    merkleLeaf,
    merkleAlgorithm: MERKLE_ALGORITHM,
  };
}

export async function listCredentialDrafts(query = {}) {
  const CredentialDraft = getCredentialDraftModel();

  const filter = {};
  const status = cleanString(query?.status);
  const credentialType = cleanString(query?.credentialType);

  if (status) {
    filter.status = status;
  }

  if (credentialType) {
    const normalizedType = normalizeCredentialType(credentialType);
    filter.credentialType = normalizedType || credentialType;
  }

  const drafts = await CredentialDraft.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return drafts.map(serializeDraft);
}

export async function getCredentialDraftById(id) {
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id).lean();

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  return serializeDraft(draft);
}

export async function createCredentialDraftFromStudent(studentId, payload = {}, actor) {
  const CredentialDraft = getCredentialDraftModel();
  const credentialType = normalizeCredentialType(payload?.credentialType);
  if (!credentialType) {
    throw new ApiError(400, 'Only TOR and Diploma credentials are supported');
  }
  const notes = cleanString(payload?.notes);
  const paymentCode = await generateUniquePaymentCode(CredentialDraft);
  const anchorPreference = normalizeAnchorPreference(payload?.anchorPreference);

  const { student, grades } = await getStudentBundle(studentId);

  const existingOpenDraft = await CredentialDraft.findOne({
    student: student._id,
    credentialType,
    status: { $in: OPEN_REQUEST_STATUSES },
  }).lean();

  if (existingOpenDraft) {
    throw new ApiError(
      409,
      'This student already has an open credential draft for this credential type'
    );
  }

  const draft = await CredentialDraft.create({
    credentialType,
    student: student._id,
    studentNo: student.studentNo,
    studentName: student.studentName,
    profileSnapshot: clonePlain(student),
    gradesSnapshot: clonePlain(grades),
    curriculumSnapshot: clonePlain(
  student.curriculumId
    ? {
        _id: student.curriculumId._id,
        program: student.curriculumId.program,
        programName: student.curriculumId.programName,
        curriculumYear: student.curriculumId.curriculumYear,
        structure: student.curriculumId.structure || null,
      }
    : null
),
    notes,
    remarks: notes,
    presetRemark: '',
    anchorPreference,
    requestSource: 'web',
    requestedBy: actor?._id || null,
    paymentStatus: 'unpaid',
    paymentCode,
    amount: normalizeAmount(payload?.amount, 0),
    createdBy: actor?._id || null,
    status: 'draft',
  });

  return serializeDraft(draft);
}

export async function requestMobileCredential(payload = {}, actor) {
  assertMobileStudent(actor, 'requesting');

  const CredentialDraft = getCredentialDraftModel();
  const credentialType = normalizeCredentialType(payload?.credentialType);
  if (!credentialType) {
    throw new ApiError(400, 'Only TOR and Diploma credentials are supported');
  }
  const remarks = cleanString(payload?.remarks || payload?.notes);
  const presetRemark = cleanString(payload?.presetRemark);
  const anchorPreference = normalizeAnchorPreference(payload?.anchorPreference);
  const livenessPassed = normalizeBoolean(payload?.livenessPassed);
  const livenessMethod = cleanString(payload?.livenessMethod, 'faceVerifierLocal');
  const livenessPassedAt = toDateOrNull(payload?.livenessPassedAt) || new Date();

  if (!livenessPassed) {
    throw new ApiError(400, 'FaceVerifier liveness check is required before requesting this credential.');
  }

  const { student, grades } = await getStudentBundleByStudentNo(actor.studentId);

  const existingOpenDraft = await CredentialDraft.findOne({
    studentNo: student.studentNo,
    credentialType,
    status: { $in: OPEN_REQUEST_STATUSES },
  }).lean();

  if (existingOpenDraft) {
    throw new ApiError(
      409,
      'This student already has an open credential request for this credential type'
    );
  }

  const paymentCode = await generateUniquePaymentCode(CredentialDraft);
  const draft = await CredentialDraft.create({
    credentialType,
    student: student._id,
    studentNo: student.studentNo,
    studentName: student.studentName,
    profileSnapshot: clonePlain(student),
    gradesSnapshot: clonePlain(grades),
    curriculumSnapshot: clonePlain(
      student.curriculumId
        ? {
            _id: student.curriculumId._id,
            program: student.curriculumId.program,
            programName: student.curriculumId.programName,
            curriculumYear: student.curriculumId.curriculumYear,
            structure: student.curriculumId.structure || null,
          }
        : null
    ),
    notes: remarks,
    remarks,
    presetRemark,
    anchorPreference,
    livenessPassed,
    livenessMethod,
    livenessPassedAt,
    requestSource: 'mobile',
    requestedBy: actor?._id || null,
    paymentStatus: 'unpaid',
    paymentCode,
    amount: normalizeAmount(payload?.amount, 0),
    createdBy: actor?._id || null,
    status: 'draft',
  });

  const serializedDraft = serializeDraft(draft);

  await notifyUser(actor._id, {
    type: 'credential_requested',
    title: 'Credential request submitted',
    body: `Present payment code ${paymentCode} to the cashier.`,
    data: {
      request: sanitizeDraftForNotification(draft),
      credentialId: draft._id.toString(),
      credentialType: serializedDraft.credentialType,
      requestStatus: serializedDraft.status,
      paymentStatus: serializedDraft.paymentStatus,
      paymentCode,
      receiptNo: serializedDraft.receiptNo,
      paidAt: serializedDraft.paidAt,
      amount: serializedDraft.amount,
      createdAt: serializedDraft.createdAt,
      processingNote: 'Processing may take up to 3 working days after payment.',
      credentialStatus: serializedDraft.status,
      anchorStatus: serializedDraft.anchorStatus,
      anchorMode: serializedDraft.anchorMode,
      scheduledAnchorAt: serializedDraft.scheduledAnchorAt,
      anchoredAt: serializedDraft.anchoredAt,
      anchorPreference,
      remarks,
      presetRemark,
      livenessMethod,
    },
  }).catch(() => null);

  return {
    request: sanitizeDraftForNotification(draft),
    requestId: draft._id,
    paymentCode,
    paymentStatus: draft.paymentStatus,
    processingNote: 'Processing may take up to 3 working days after payment.',
    message: 'Processing may take up to 3 working days after payment.',
  };
}

export async function listMobileCredentialRequests(actor) {
  assertMobileStudent(actor, 'requesting');

  const CredentialDraft = getCredentialDraftModel();
  const requests = await CredentialDraft.find({
    studentNo: cleanString(actor.studentId),
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return requests.map(serializeDraft);
}

export async function submitCredentialDraft(id, actor) {
  await assertCredentialPermission(
    actor,
    'canManageVC',
    'Cashier users cannot submit credentials for signing'
  );
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (!canSubmitForSigning(draft)) {
    throw new ApiError(409, 'Only draft records can be submitted for signature');
  }

  draft.status = 'for_signature';
  draft.submittedBy = actor?._id || null;
  draft.submittedAt = new Date();

  await draft.save();
  return serializeDraft(draft);
}

export async function rejectCredentialDraft(id, payload = {}, actor) {
  assertRegistrar(actor);
  await assertCredentialPermission(
    actor,
    'canManageVC',
    'Cashier users cannot reject credentials'
  );
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (draft.status !== 'for_signature') {
    throw new ApiError(409, 'Only drafts pending signature can be rejected');
  }

  draft.status = 'rejected';
  draft.rejectionReason = cleanString(
    payload?.rejectionReason,
    'Returned for correction'
  );
  draft.claimToken = '';
  draft.claimTokenHash = '';
  draft.claimTokenExpiresAt = null;
  draft.claimReadyAt = null;

  await draft.save();
  return serializeDraft(draft);
}

export async function signCredentialDraft(id, actor) {
  assertRegistrar(actor);
  await assertCredentialPermission(
    actor,
    'canSignVC',
    'Cashier users cannot sign credentials'
  );
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (draft.status !== 'for_signature') {
    throw new ApiError(409, 'Only drafts pending signature can be signed');
  }

  if (!isCredentialPaid(draft)) {
    throw new ApiError(409, 'Payment is required before signing this credential.');
  }

  const issuerKey = await getActiveIssuerKeyOrThrow();

  const privateKeyPem = decryptPrivateKey({
    ciphertext: issuerKey.privateKeyCiphertext,
    iv: issuerKey.privateKeyIv,
    authTag: issuerKey.privateKeyAuthTag,
  });

  const vcPayload = buildVcPayload(draft, issuerKey);
  const proof = signCredentialPayload(
    vcPayload,
    issuerKey,
    privateKeyPem
  );

  draft.credentialType = normalizeCredentialType(draft.credentialType);
  draft.vcPayload = vcPayload;
  draft.signedCredential = proof.signedCredential;
  draft.credentialHash = proof.vcHash;
  draft.vcHash = proof.vcHash;
  draft.canonicalVcHash = proof.canonicalVcHash;
  draft.canonicalizationAlgorithm = proof.canonicalizationAlgorithm;
  draft.hashAlgorithm = proof.hashAlgorithm;
  draft.signatureAlgorithm = proof.signatureAlgorithm;
  draft.verificationMethod = proof.verificationMethod;
  draft.issuerKeyId = proof.issuerKeyId;
  draft.issuerPublicKey = proof.issuerPublicKey;
  draft.issuedAt = proof.issuedAt;
  draft.merkleLeaf = proof.merkleLeaf;
  draft.merkleAlgorithm = proof.merkleAlgorithm;
  draft.signedBy = actor._id;
  draft.signedAt = new Date();
  draft.status = 'signed';
  draft.rejectionReason = '';

  await draft.save();
  return serializeDraft(draft);
}

function hasActiveClaimToken(draft, now = new Date()) {
  return Boolean(
    cleanString(draft?.claimTokenHash) &&
      draft?.claimTokenExpiresAt &&
      draft.claimTokenExpiresAt.getTime() > now.getTime()
  );
}

function actorDisplayName(actor) {
  return cleanString(actor?.fullName || actor?.username || actor?.email || actor?._id);
}

export async function createCredentialClaimToken(id, payload = {}, actor) {
  assertRegistrar(actor);
  await assertCredentialPermission(
    actor,
    'canGenerateClaimQr',
    'Cashier users cannot generate claim QR codes'
  );
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  const settings = await ensureMainSettings();

  if (settings.locks?.qrGenerationLocked) {
    throw new ApiError(423, 'Claim QR generation is currently locked by MIS');
  }

  const regenerate = normalizeBoolean(payload?.regenerate);
  const now = new Date();
  const override = normalizeBoolean(payload?.override);

  if (regenerate && !settings.qrDelivery?.allowRegeneration && !override) {
    throw new ApiError(409, 'Claim QR regeneration is disabled in System Settings');
  }

  if (!canGenerateClaimToken(draft, { override })) {
    throw new ApiError(
      409,
      isCredentialClaimed(draft)
        ? 'Claimed credential cannot use a normal claim QR. Use QR override with a required reason.'
        : 'Only paid, signed, unclaimed credentials can be prepared for claiming'
    );
  }

  if (override) {
    if (!canOverrideClaimQr(draft)) {
      throw new ApiError(409, 'Only claimed, paid, signed credentials can use QR override');
    }

    const reason = cleanString(payload?.reason);
    if (reason.length < 8) {
      throw new ApiError(400, 'Override reason is required and must be specific.');
    }

    draft.claimOverrideHistory.push({
      reason,
      actorId: actor?._id || null,
      actorName: actorDisplayName(actor),
      actorRole: actor?.role || '',
      createdAt: now,
      previousClaimedAt: draft.claimedAt || null,
      previousClaimedBy: draft.claimedBy || null,
      previousDeviceId: draft.claimedDeviceId || '',
    });
  } else if (isCredentialClaimed(draft)) {
    throw new ApiError(409, 'Claimed credential cannot use a normal claim QR');
  }

  if (hasActiveClaimToken(draft, now) && !regenerate && !override) {
    throw new ApiError(
      409,
      'A valid claim QR already exists. Regenerate a fresh claim QR only if the current one cannot be used.'
    );
  }

  const hadClaimToken = Boolean(cleanString(draft.claimTokenHash));
  const token = generateClaimToken();
  const ttlMinutes = Number(settings.qrDelivery?.claimQrExpiryMinutes || CLAIM_TOKEN_TTL_MINUTES);
  const expiresAt = addMinutes(now, ttlMinutes);
  const previousStatus = cleanString(draft.status);

  if (previousStatus === 'signed') {
    draft.status = 'claim_ready';
  }

  draft.claimTokenHash = hashClaimToken(token);
  draft.claimToken = token;
  draft.claimTokenExpiresAt = expiresAt;
  draft.claimTokenCreatedAt = draft.claimTokenCreatedAt || now;
  draft.claimTokenCreatedBy = draft.claimTokenCreatedBy || actor?._id || null;
  draft.claimReadyAt = draft.claimReadyAt || now;

  if (regenerate || hadClaimToken) {
    draft.claimTokenRegeneratedAt = now;
    draft.claimTokenRegeneratedBy = actor?._id || null;
  }

  await draft.save();
  const serializedDraft = serializeDraft(draft);

  await notifyStudentByStudentNo(draft.studentNo, {
    type: 'credential_ready',
    title: 'Credential ready for claim',
    body: 'Your signed academic credential is ready to claim.',
    data: {
      request: sanitizeDraftForNotification(draft),
      credentialId: draft._id.toString(),
      credentialType: serializedDraft.credentialType,
      requestStatus: serializedDraft.status,
      paymentStatus: serializedDraft.paymentStatus,
      paymentCode: serializedDraft.paymentCode,
      receiptNo: serializedDraft.receiptNo,
      paidAt: serializedDraft.paidAt,
      amount: serializedDraft.amount,
      createdAt: serializedDraft.createdAt,
      processingNote: 'Processing may take up to 3 working days after payment.',
      credentialStatus: serializedDraft.status,
      anchorStatus: serializedDraft.anchorStatus,
      anchorMode: serializedDraft.anchorMode,
      scheduledAnchorAt: serializedDraft.scheduledAnchorAt,
      anchoredAt: serializedDraft.anchoredAt,
      override,
    },
  }).catch(() => null);

  return {
    credential: serializeDraft(draft),
    token,
    claimUri: `bcvs://claim?token=${encodeURIComponent(token)}`,
    expiresAt,
    ttlMinutes,
    override,
  };
}

export async function createCredentialClaimOverrideToken(id, payload = {}, actor) {
  return createCredentialClaimToken(id, {
    ...payload,
    override: true,
    regenerate: true,
  }, actor);
}

export async function listCredentialPayments(query = {}, actor) {
  assertCashierActor(actor);

  const CredentialDraft = getCredentialDraftModel();
  const paymentStatus = cleanString(query?.paymentStatus || query?.status).toLowerCase();
  const search = cleanString(query?.search);
  const filter = {};
  const clauses = [];

  if (paymentStatus === 'unpaid') {
    clauses.push({
      $or: [
        { paymentStatus: 'unpaid' },
        { paymentStatus: '' },
        { paymentStatus: null },
        { paymentStatus: { $exists: false } },
      ],
    });
  } else if (paymentStatus === 'paid') {
    filter.paymentStatus = paymentStatus;
  }

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    clauses.push({
      $or: [
        { paymentCode: regex },
        { receiptNo: regex },
        { studentNo: regex },
        { studentName: regex },
        { credentialType: regex },
      ],
    });
  }

  if (clauses.length) {
    filter.$and = clauses;
  }

  const rows = await CredentialDraft.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const normalized = [];

  for (const row of rows) {
    let draft = row;

    if (!cleanString(draft.paymentCode)) {
      const saved = await CredentialDraft.findById(draft._id);
      if (saved) {
        saved.paymentCode = await generateUniquePaymentCode(CredentialDraft);
        await saved.save();
        draft = saved.toObject();
      }
    }

    normalized.push(serializeDraft(draft));
  }

  return normalized;
}

export async function markCredentialPaymentPaid(id, payload = {}, actor) {
  assertCashierActor(actor);
  await assertCredentialPermission(
    actor,
    'canConfirmPayments',
    'You do not have permission to confirm payments'
  );
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);
  const settings = await ensureMainSettings();

  if (!draft) {
    throw new ApiError(404, 'Credential request not found');
  }

  if (settings.locks?.paymentConfirmationLocked) {
    throw new ApiError(423, 'Payment confirmation is currently locked by MIS');
  }

  if (!cleanString(draft.paymentCode)) {
    draft.paymentCode = await generateUniquePaymentCode(CredentialDraft);
  }

  if (!canMarkPaid(draft)) {
    throw new ApiError(409, 'Rejected or revoked credentials cannot be marked paid');
  }

  if (draft.paymentStatus === 'paid') {
    return serializeDraft(draft);
  }

  const now = new Date();
  draft.paymentStatus = 'paid';
  draft.receiptNo = await generateUniqueReceiptNo(CredentialDraft);
  draft.amount = normalizeAmount(payload?.amount, draft.amount || 0);
  draft.paidAt = now;
  draft.paidBy = actor?._id || null;
  draft.paymentConfirmedAt = now;
  draft.paymentConfirmedBy = actor?._id || null;
  draft.paymentNotes = cleanString(payload?.paymentNotes || payload?.notes);

  await draft.save();
  const serializedDraft = serializeDraft(draft);

  await notifyStudentByStudentNo(draft.studentNo, {
    type: 'payment_received',
    title: 'Payment received',
    body: `Your payment has been recorded. Receipt No: ${draft.receiptNo}`,
    data: {
      request: sanitizeDraftForNotification(draft),
      credentialId: draft._id.toString(),
      credentialType: serializedDraft.credentialType,
      requestStatus: serializedDraft.status,
      paymentStatus: serializedDraft.paymentStatus,
      paymentCode: serializedDraft.paymentCode,
      receiptNo: serializedDraft.receiptNo,
      paidAt: serializedDraft.paidAt,
      amount: serializedDraft.amount,
      createdAt: serializedDraft.createdAt,
      processingNote: serializedDraft.paymentNotes || 'Processing may take up to 3 working days after payment.',
      credentialStatus: serializedDraft.status,
      anchorStatus: serializedDraft.anchorStatus,
      anchorMode: serializedDraft.anchorMode,
      scheduledAnchorAt: serializedDraft.scheduledAnchorAt,
      anchoredAt: serializedDraft.anchoredAt,
    },
  }).catch(() => null);

  return serializeDraft(draft);
}

export async function listMobileCredentials(actor) {
  assertMobileStudent(actor);

  const CredentialDraft = getCredentialDraftModel();
  const studentNo = cleanString(actor.studentId);

  const drafts = await CredentialDraft.find({
    studentNo,
    status: { $in: ['claimed', 'shared'] },
    signedCredential: { $ne: null },
  })
    .sort({ claimedAt: -1, signedAt: -1 })
    .lean();

  return Promise.all(drafts.map(serializeWalletCredential));
}

export async function claimMobileCredential(payload = {}, actor) {
  assertMobileStudent(actor);

  const token = cleanString(payload?.token);
  const deviceId = cleanString(payload?.deviceId);
  const requestStudentId = cleanString(payload?.studentId);
  const actorStudentNo = cleanString(actor.studentId);

  if (!token) {
    throw new ApiError(400, 'Claim token is required');
  }

  if (
    requestStudentId &&
    normalizeStudentNo(requestStudentId) !== normalizeStudentNo(actorStudentNo)
  ) {
    throw new ApiError(403, 'Claim request student does not match the authenticated user');
  }

  const CredentialDraft = getCredentialDraftModel();
  const tokenHash = hashClaimToken(token);
  const now = new Date();

  const candidate = await CredentialDraft.findOne({ claimTokenHash: tokenHash });

  if (!candidate) {
    throw new ApiError(404, 'Claim token not found');
  }

  if (normalizeStudentNo(candidate.studentNo) !== normalizeStudentNo(actorStudentNo)) {
    throw new ApiError(403, 'This credential belongs to another student');
  }

  const overrideClaim = Boolean(
    candidate.status === 'claimed' &&
      candidate.claimedAt &&
      Array.isArray(candidate.claimOverrideHistory) &&
      candidate.claimOverrideHistory.length > 0
  );

  if (!overrideClaim && isCredentialClaimed(candidate)) {
    throw new ApiError(409, 'Credential has already been claimed');
  }

  if (overrideClaim && !canOverrideClaimQr(candidate)) {
    throw new ApiError(409, 'Credential override token is no longer valid for claiming');
  }

  if (!overrideClaim && !canClaimCredential(candidate)) {
    throw new ApiError(409, 'Credential is not available for claiming');
  }

  if (!candidate.claimTokenExpiresAt || candidate.claimTokenExpiresAt.getTime() <= now.getTime()) {
    throw new ApiError(410, 'Claim token has expired');
  }

  const normalFilter = {
    _id: candidate._id,
    status: { $in: CLAIMABLE_STATUSES },
    claimedAt: null,
    claimTokenHash: tokenHash,
    claimTokenExpiresAt: { $gt: now },
  };
  const overrideFilter = {
    _id: candidate._id,
    status: 'claimed',
    claimedAt: { $ne: null },
    claimTokenHash: tokenHash,
    claimTokenExpiresAt: { $gt: now },
  };

  const claimed = await CredentialDraft.findOneAndUpdate(
    overrideClaim ? overrideFilter : normalFilter,
    {
      $set: {
        status: 'claimed',
        claimedAt: now,
        claimedBy: actor._id,
        claimedDeviceId: deviceId,
        claimTokenHash: '',
        claimToken: '',
        claimTokenExpiresAt: null,
      },
    },
    { new: true }
  );

  if (!claimed) {
    throw new ApiError(409, 'Credential claim could not be completed. Please refresh and try again.');
  }

  await notifyStudentByStudentNo(claimed.studentNo, {
    type: 'credential_claimed',
    title: 'Credential claimed',
    body: overrideClaim
      ? 'Your credential was re-claimed on this device.'
      : 'Your credential was saved to your mobile wallet.',
    data: {
      request: sanitizeDraftForNotification(claimed),
      credentialId: claimed._id.toString(),
      credentialType: claimed.credentialType,
      requestStatus: claimed.status,
      paymentStatus: claimed.paymentStatus,
      paymentCode: claimed.paymentCode,
      receiptNo: claimed.receiptNo,
      paidAt: claimed.paidAt,
      amount: claimed.amount,
      createdAt: claimed.createdAt,
      processingNote: claimed.paymentNotes || 'Processing may take up to 3 working days after payment.',
      credentialStatus: claimed.status,
      claimedAt: claimed.claimedAt,
      anchorStatus: claimed.anchorStatus,
      anchoredAt: claimed.anchoredAt,
      override: overrideClaim,
    },
  }).catch(() => null);

  return buildClaimResponse(claimed);
}

export async function scheduleCredentialAnchor(id, payload = {}, actor) {
  assertRegistrar(actor);
  await assertCredentialPermission(
    actor,
    'canAnchorVC',
    'Cashier users cannot queue credentials for anchoring'
  );
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (draft.anchorStatus === 'queued') {
    return serializeDraft(draft);
  }

  if (!canQueueAnchor(draft)) {
    throw new ApiError(
      409,
      'Only paid and signed credentials can be queued for anchoring'
    );
  }

  const settings = await ensureMainSettings();

  if (!settings.anchoring?.enabled) {
    throw new ApiError(409, 'Anchoring is disabled in System Settings');
  }

  if (settings.locks?.anchorLocked) {
    throw new ApiError(423, 'Anchoring is currently locked by MIS');
  }

  const requestedMode =
    ['same_day', 'today'].includes(cleanString(payload?.anchorMode)) ? 'same_day' : 'scheduled';

  let scheduledAnchorAt = null;

  if (requestedMode === 'same_day') {
    scheduledAnchorAt = new Date();
  } else {
    const explicitDate = cleanString(payload?.scheduledAnchorAt);

    if (explicitDate) {
      const parsed = new Date(explicitDate);

      if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, 'Invalid scheduled anchor date');
      }

      scheduledAnchorAt = parsed;
    } else {
      scheduledAnchorAt = addDays(
        new Date(),
        Number(settings.anchoring?.intervalDays || 7)
      );
    }
  }

  draft.anchorMode = requestedMode;
  draft.scheduledAnchorAt = scheduledAnchorAt;
  draft.anchorStatus = 'queued';
  if (!isCredentialClaimed(draft) && draft.status !== 'anchored') {
    draft.status = 'queued_for_anchor';
  }
  draft.contractAddress = await resolveActiveContractAddress(settings);

  await draft.save();
  const serializedDraft = serializeDraft(draft);

  await notifyStudentByStudentNo(draft.studentNo, {
    type: 'anchor_scheduled',
    title: requestedMode === 'same_day' ? 'Anchor scheduled today' : 'Anchor scheduled',
    body:
      requestedMode === 'same_day'
        ? 'Your credential is queued for same-day blockchain anchoring.'
        : `Your credential is scheduled for anchoring on ${scheduledAnchorAt.toISOString().slice(0, 10)}.`,
    data: {
      request: sanitizeDraftForNotification(draft),
      credentialId: draft._id.toString(),
      credentialType: serializedDraft.credentialType,
      requestStatus: serializedDraft.status,
      paymentStatus: serializedDraft.paymentStatus,
      paymentCode: serializedDraft.paymentCode,
      receiptNo: serializedDraft.receiptNo,
      paidAt: serializedDraft.paidAt,
      amount: serializedDraft.amount,
      createdAt: serializedDraft.createdAt,
      processingNote: serializedDraft.paymentNotes || 'Processing may take up to 3 working days after payment.',
      credentialStatus: serializedDraft.status,
      anchorStatus: serializedDraft.anchorStatus,
      anchorMode: serializedDraft.anchorMode,
      scheduledAnchorAt: serializedDraft.scheduledAnchorAt,
      anchoredAt: serializedDraft.anchoredAt,
    },
  }).catch(() => null);

  return serializeDraft(draft);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function getCanonicalDraftVcHash(draft) {
  return cleanString(
    draft?.vcHash ||
      draft?.canonicalVcHash ||
      draft?.credentialHash ||
      draft?.signedCredential?.proof?.vcHash ||
      draft?.signedCredential?.proof?.canonicalVcHash
  );
}

async function ensureCanonicalDraftVcHash(draft) {
  const existingHash = getCanonicalDraftVcHash(draft);
  if (existingHash && buildMerkleLeaf(existingHash)) {
    let changed = false;

    if (!draft.credentialHash) {
      draft.credentialHash = existingHash;
      changed = true;
    }

    if (!draft.vcHash) {
      draft.vcHash = existingHash;
      changed = true;
    }

    if (!draft.canonicalVcHash) {
      draft.canonicalVcHash = existingHash;
      changed = true;
    }

    if (!draft.canonicalizationAlgorithm) {
      draft.canonicalizationAlgorithm = CANONICALIZATION_ALGORITHM;
      changed = true;
    }

    if (!draft.hashAlgorithm) {
      draft.hashAlgorithm = HASH_ALGORITHM;
      changed = true;
    }

    if (!draft.merkleLeaf) {
      draft.merkleLeaf = buildMerkleLeaf(existingHash);
      changed = true;
    }

    if (changed) {
      await draft.save();
    }

    return existingHash;
  }

  if (!draft?.signedCredential) {
    throw new ApiError(409, 'Signed credential payload is missing; canonical hash cannot be regenerated.');
  }

  const regeneratedHash = computeVcHash(draft.signedCredential);
  const regeneratedLeaf = buildMerkleLeaf(regeneratedHash);

  if (!regeneratedHash || !regeneratedLeaf) {
    throw new ApiError(409, 'Credential canonical hash could not be regenerated.');
  }

  const existingProof = draft.signedCredential?.proof || {};
  const proof = {
    ...existingProof,
    vcHash: buildMerkleLeaf(existingProof.vcHash) ? existingProof.vcHash : regeneratedHash,
    canonicalVcHash: buildMerkleLeaf(existingProof.canonicalVcHash)
      ? existingProof.canonicalVcHash
      : regeneratedHash,
    canonicalizationAlgorithm:
      existingProof.canonicalizationAlgorithm || CANONICALIZATION_ALGORITHM,
    hashAlgorithm: existingProof.hashAlgorithm || HASH_ALGORITHM,
  };

  draft.credentialHash = draft.credentialHash || regeneratedHash;
  draft.vcHash = draft.vcHash || regeneratedHash;
  draft.canonicalVcHash = draft.canonicalVcHash || regeneratedHash;
  draft.canonicalizationAlgorithm = draft.canonicalizationAlgorithm || CANONICALIZATION_ALGORITHM;
  draft.hashAlgorithm = draft.hashAlgorithm || HASH_ALGORITHM;
  draft.signedCredential = {
    ...(draft.signedCredential?.toObject?.() || draft.signedCredential || {}),
    proof,
  };

  if (!draft.merkleLeaf) {
    draft.merkleLeaf = regeneratedLeaf;
  }

  draft.markModified?.('signedCredential');
  await draft.save();

  return regeneratedHash;
}

function applyMerkleProofFields(draft, proof, tree, activeContract = null) {
  draft.merkleLeaf = proof.leaf;
  draft.merkleRoot = tree.root;
  draft.merkleProof = proof.proof;
  draft.merkleTreeSize = tree.size;
  draft.merkleLeafIndex = proof.index;
  draft.merkleAlgorithm = MERKLE_ALGORITHM;

  if (activeContract?.address) {
    draft.contractAddress = activeContract.address;
    draft.anchorContractAddress = activeContract.address;
    draft.anchorChainId = activeContract.chainId ?? env.blockchain.chainId ?? null;
    draft.anchorNetwork = activeContract.network || '';
    draft.anchorExplorerUrl = getExplorerBaseUrl(activeContract.chainId) || '';
  } else {
    draft.contractAddress = '';
    draft.anchorContractAddress = '';
    draft.anchorChainId = null;
    draft.anchorNetwork = '';
    draft.anchorExplorerUrl = '';
  }
}

function clearAnchorTransactionFields(draft) {
  draft.anchoredAt = null;
  draft.anchoredBy = null;
  draft.anchorTxHash = '';
  draft.anchorBatchId = '';
  draft.anchorBlockNumber = null;
  draft.anchorEventName = '';
  draft.anchorEventArgs = null;
}

function syncAnchoringMetadata(draft, { isAnchored = false, proof = null, reason = '' } = {}) {
  draft.anchoring = {
    ...(draft.anchoring?.toObject?.() || draft.anchoring || {}),
    isAnchored,
    status: draft.anchorStatus || 'not_requested',
    anchoredAt: draft.anchoredAt || null,
    txHash: draft.anchorTxHash || '',
    batchId: draft.anchorBatchId || '',
    blockNumber: draft.anchorBlockNumber ?? null,
    contractAddress: draft.anchorContractAddress || draft.contractAddress || '',
    contractId: draft.anchoring?.contractId || '',
    chainId: draft.anchorChainId ?? null,
    network: draft.anchorNetwork || '',
    explorerUrl: draft.anchorExplorerUrl || '',
    merkleRoot: draft.merkleRoot || '',
    merkleLeaf: draft.merkleLeaf || '',
    merkleProof: Array.isArray(draft.merkleProof) ? draft.merkleProof : [],
    merkleTreeSize: draft.merkleTreeSize || 0,
    merkleLeafIndex: draft.merkleLeafIndex ?? -1,
    merkleAlgorithm: draft.merkleAlgorithm || MERKLE_ALGORITHM,
    proofHash: proof?.leaf || draft.anchoring?.proofHash || '',
    canonicalCredentialHash:
      proof?.vcHash ||
      draft.vcHash ||
      draft.canonicalVcHash ||
      draft.signedCredential?.proof?.vcHash ||
      '',
    eventName: draft.anchorEventName || '',
    eventArgs: draft.anchorEventArgs || null,
    failureReason: reason || draft.anchorFailureReason || draft.anchoringUnavailableReason || '',
  };
  draft.markModified?.('anchoring');
}

function markAnchorUnavailable(draft, { status, reason, proof, tree, activeContract }) {
  applyMerkleProofFields(draft, proof, tree, activeContract);
  clearAnchorTransactionFields(draft);
  draft.anchorStatus = status;
  draft.anchorFailureReason = reason;
  draft.anchoringUnavailableReason = reason;
  syncAnchoringMetadata(draft, { isAnchored: false, proof, reason });
}

function markAnchorSucceeded(draft, anchorResult, proof, tree) {
  applyMerkleProofFields(
    draft,
    proof,
    tree,
    {
      address: anchorResult.anchorContractAddress || anchorResult.contractAddress,
      chainId: anchorResult.anchorChainId,
      network: anchorResult.anchorNetwork,
    }
  );

  draft.anchorStatus = 'anchored';
  draft.anchoredAt = anchorResult.anchoredAt;
  draft.anchoredBy = anchorResult.anchoredBy;
  draft.anchorTxHash = anchorResult.anchorTxHash || '';
  draft.anchorBatchId = anchorResult.anchorBatchId || '';
  draft.anchorBlockNumber = anchorResult.anchorBlockNumber ?? null;
  draft.anchorContractAddress = anchorResult.anchorContractAddress || anchorResult.contractAddress || '';
  draft.contractAddress = anchorResult.contractAddress || anchorResult.anchorContractAddress || '';
  draft.anchorNetwork = anchorResult.anchorNetwork || '';
  draft.anchorChainId = anchorResult.anchorChainId ?? null;
  draft.anchorExplorerUrl = anchorResult.anchorExplorerUrl || '';
  draft.anchorEventName = anchorResult.anchorEventName || '';
  draft.anchorEventArgs = anchorResult.anchorEventArgs || null;
  draft.anchorFailureReason = '';
  draft.anchoringUnavailableReason = '';
  syncAnchoringMetadata(draft, { isAnchored: true, proof });

  if (!isCredentialClaimed(draft) && !isCredentialRejectedOrRevoked(draft)) {
    draft.status = 'anchored';
  }
}

async function notifyProofPrepared(draft, id) {
  return notifyStudentByStudentNo(draft.studentNo, {
    type: 'proof_prepared',
    title: 'Credential proof prepared',
    body: 'Your credential proof was prepared. Blockchain anchoring is pending because the active contract does not support Merkle anchoring yet.',
    data: {
      request: sanitizeDraftForNotification(draft),
      credentialId: id,
      credentialType: draft.credentialType,
      requestStatus: draft.status,
      paymentStatus: draft.paymentStatus,
      credentialStatus: draft.status,
      anchorStatus: draft.anchorStatus,
      anchorFailureReason: draft.anchorFailureReason || '',
      merkleRoot: draft.merkleRoot || '',
      merkleLeaf: draft.merkleLeaf || '',
    },
  }).catch(() => null);
}

async function notifyCredentialAnchored(draft, id) {
  return notifyStudentByStudentNo(draft.studentNo, {
    type: 'credential_anchored',
    title: 'Credential anchored',
    body: 'Your credential proof was anchored on-chain and is ready for full verification.',
    data: {
      request: sanitizeDraftForNotification(draft),
      credentialId: id,
      credentialType: draft.credentialType,
      requestStatus: draft.status,
      paymentStatus: draft.paymentStatus,
      credentialStatus: draft.status,
      anchorStatus: draft.anchorStatus,
      anchoredAt: draft.anchoredAt,
      anchorTxHash: draft.anchorTxHash || '',
      contractAddress: draft.anchorContractAddress || draft.contractAddress || '',
      merkleRoot: draft.merkleRoot || '',
      merkleLeaf: draft.merkleLeaf || '',
    },
  }).catch(() => null);
}

export async function getTodaysAnchorQueueSummary(actor) {
  assertRegistrar(actor);
  await assertCredentialPermission(
    actor,
    'canAnchorVC',
    'You do not have permission to view the anchor queue'
  );

  const CredentialDraft = getCredentialDraftModel();
  const dueAt = endOfToday();
  const pendingCount = await CredentialDraft.countDocuments({
    anchorStatus: 'queued',
    scheduledAnchorAt: { $lte: dueAt },
    paymentStatus: 'paid',
    signedCredential: { $ne: null },
    status: { $nin: ['revoked', 'rejected'] },
  });

  return {
    pendingCount,
    dueAt,
  };
}

export async function processTodaysAnchorQueue(actor) {
  assertRegistrar(actor);
  await assertCredentialPermission(
    actor,
    'canAnchorVC',
    'Cashier users cannot process the anchor queue'
  );

  const settings = await ensureMainSettings();

  if (!settings.anchoring?.enabled) {
    throw new ApiError(409, 'Anchoring is disabled in System Settings');
  }

  if (settings.locks?.anchorLocked) {
    throw new ApiError(423, 'Anchoring is currently locked by MIS');
  }

  const CredentialDraft = getCredentialDraftModel();
  const dueAt = endOfToday();
  const rows = await CredentialDraft.find({
    anchorStatus: 'queued',
    scheduledAnchorAt: { $lte: dueAt },
    paymentStatus: 'paid',
    signedCredential: { $ne: null },
    status: { $nin: ['revoked', 'rejected'] },
  }).sort({ scheduledAnchorAt: 1, createdAt: 1 });

  const summary = {
    processedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failed: [],
    skipped: [],
    processed: [],
  };

  const activeContract = await getActiveContractRecord(settings);
  const eligibleRows = [];
  const proofFailures = new Map();

  for (const draft of rows) {
    const id = draft._id.toString();

    if (!canProcessAnchor(draft)) {
      continue;
    }

    try {
      const vcHash = await ensureCanonicalDraftVcHash(draft);
      const leaf = draft.merkleLeaf || buildMerkleLeaf(vcHash);

      if (!vcHash || !leaf) {
        throw new ApiError(409, 'Credential canonical hash could not be regenerated.');
      }

      eligibleRows.push({
        id,
        vcHash,
        leaf,
      });
    } catch (error) {
      const reason =
        error?.message ||
        'Credential canonical hash is missing; Merkle proof was not created.';

      draft.anchorStatus = 'anchor_failed';
      draft.anchorFailureReason = reason;
      draft.anchoringUnavailableReason = reason;
      clearAnchorTransactionFields(draft);
      syncAnchoringMetadata(draft, { isAnchored: false, reason });
      await draft.save();
      proofFailures.set(id, reason);
    }
  }

  const leafRows = eligibleRows;
  const tree = buildMerkleTree(leafRows.map((row) => row.leaf));
  const proofById = new Map(
    leafRows.map((row, index) => [
      row.id,
      {
        leaf: row.leaf,
        index,
        vcHash: row.vcHash,
        proof: buildMerkleProof(tree.leaves, index),
      },
    ])
  );
  const batchState = {
    status: '',
    reason: '',
    anchorResult: null,
  };

  if (!activeContract) {
    batchState.status = 'contract_missing';
    batchState.reason = 'No active contract selected.';
  } else if (tree.root) {
    try {
      batchState.anchorResult = await anchorMerkleRoot({
        merkleRoot: tree.root,
        contractRecord: activeContract,
        actor,
      });
      batchState.status = 'anchored';
    } catch (error) {
      batchState.status = 'anchor_failed';
      batchState.reason = error.message || 'Anchor transaction failed.';
    }
  }

  for (const draft of rows) {
    const id = draft._id.toString();

    try {
      if (proofFailures.has(id)) {
        const reason = proofFailures.get(id);
        summary.failedCount += 1;
        summary.failed.push({ id, reason });
        continue;
      }

      if (!canProcessAnchor(draft)) {
        summary.skippedCount += 1;
        summary.skipped.push({ id, reason: 'Credential is not eligible for anchoring.' });
        continue;
      }

      const proof = proofById.get(id);
      if (!proof || !tree.root) {
        const reason = 'Credential canonical hash is missing; Merkle proof was not created.';
        draft.anchorStatus = 'anchor_failed';
        draft.anchorFailureReason = reason;
        draft.anchoringUnavailableReason = reason;
        clearAnchorTransactionFields(draft);
        await draft.save();

        summary.failedCount += 1;
        summary.failed.push({ id, reason });
        continue;
      }

      if (batchState.status === 'anchored') {
        markAnchorSucceeded(draft, batchState.anchorResult, proof, tree);
      } else {
        markAnchorUnavailable(draft, {
          status: batchState.status || 'anchor_failed',
          reason: batchState.reason || 'Merkle root anchoring did not complete.',
          proof,
          tree,
          activeContract,
        });
      }

      await draft.save();

      if (draft.anchorStatus === 'anchor_failed') {
        summary.failedCount += 1;
        summary.failed.push({
          id,
          reason: draft.anchorFailureReason || 'Anchor transaction failed.',
        });
      } else {
        summary.processedCount += 1;
        summary.processed.push({
          id,
          status: draft.status,
          anchorStatus: draft.anchorStatus,
          merkleRoot: draft.merkleRoot,
          anchorTxHash: draft.anchorTxHash || '',
          anchorBatchId: draft.anchorBatchId || '',
          reason: draft.anchorFailureReason || draft.anchoringUnavailableReason || '',
        });
      }

      if (draft.anchorStatus === 'contract_unsupported') {
        await notifyProofPrepared(draft, id);
      } else if (draft.anchorStatus === 'anchored') {
        await notifyCredentialAnchored(draft, id);
      }
    } catch (error) {
      summary.failedCount += 1;
      summary.failed.push({
        id,
        reason: error.message || 'Failed to process anchor.',
      });
    }
  }

  return {
    ...summary,
    dueAt,
    startedAt: startOfToday(),
    completedAt: new Date(),
  };
}
