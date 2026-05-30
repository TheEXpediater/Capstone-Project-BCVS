import { Types } from 'mongoose';
import { createHash, createSign, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import { decryptPrivateKey } from '../../shared/utils/keyVault.js';
import { getCredentialDraftModel } from './model.js';
import { getStudentModel, getStudentGradeModel } from '../students/model.js';
import { getSystemSettingModel } from '../settings/setting.model.js';
import { getIssuerKeyModel } from '../settings/issuerKey.model.js';
import { getContractModel } from '../contracts/model.js';
import { getExplorerBaseUrl } from '../contracts/service.js';
import { notifyStudentByStudentNo } from '../notifications/service.js';

const CLAIM_TOKEN_TTL_MINUTES = 15;

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
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
  if (!actor || actor.role !== 'super_admin') {
    throw new ApiError(403, 'Only the registrar can perform this action');
  }
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

function normalizeStudentNo(value) {
  return cleanString(value).toLowerCase();
}

function assertMobileStudent(actor) {
  if (!actor || actor.kind !== 'mobile' || actor.role !== 'student') {
    throw new ApiError(403, 'Only authenticated student mobile users can claim credentials');
  }

  if (!cleanString(actor.studentId)) {
    throw new ApiError(403, 'Mobile user is not linked to a student number');
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
  const configured = cleanString(settings?.blockchain?.selectedContractId);

  if (configured) {
    return configured;
  }

  const Contract = getContractModel();
  const latest = await Contract.findOne({
    status: 'success',
    address: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .lean();

  return cleanString(latest?.address);
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
  const contractAddress = cleanString(draft?.contractAddress);
  const anchorTxHash = cleanString(draft?.anchorTxHash);

  if (!contractAddress && !anchorTxHash) {
    return null;
  }

  const contract = contractAddress
    ? await findContractForAddress(contractAddress)
    : null;
  const chainId = contract?.chainId ?? env.blockchain.chainId ?? null;
  const explorerBaseUrl =
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
    anchorTxHash,
    anchorMode: draft?.anchorMode || 'none',
    anchorStatus: draft?.anchorStatus || 'not_requested',
    scheduledAnchorAt: draft?.scheduledAnchorAt || null,
    anchoredAt: draft?.anchoredAt || null,
    chainId,
    network: contract?.network || '',
    explorerBaseUrl,
    anchorUrl,
  };
}

function serializeDraft(doc) {
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  return clonePlain(raw);
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
    status: draft.status,
    ...(blockchain
      ? {
          blockchain: {
            ...(credential.blockchain || {}),
            ...blockchain,
          },
          blockchainUrl: blockchain.anchorUrl,
          contractAddress: blockchain.contractAddress,
          anchorTxHash: blockchain.anchorTxHash,
        }
      : {}),
    meta: {
      ...(credential.meta || {}),
      title: 'Student Academic Record Credential',
      fullName: draft.studentName,
      studentNo: draft.studentNo,
      issuedAt: draft.signedAt,
      signedAt: draft.signedAt,
      claimedAt: draft.claimedAt,
      credentialHash: draft.credentialHash,
      status: draft.status,
      ...(blockchain
        ? {
            blockchainUrl: blockchain.anchorUrl,
            contractAddress: blockchain.contractAddress,
            anchorTxHash: blockchain.anchorTxHash,
            anchorStatus: blockchain.anchorStatus,
            anchoredAt: blockchain.anchoredAt,
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

function buildVcPayload(draft, issuerKey) {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: `urn:bcvs:credential-draft:${draft._id}`,
    type: ['VerifiableCredential', 'StudentAcademicRecordCredential'],
    issuer: {
      id: issuerKey.kid,
      name: 'BCVS Registrar',
    },
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `urn:bcvs:student:${draft.studentNo}`,
      studentNo: draft.studentNo,
      studentName: draft.studentName,
      profile: clonePlain(draft.profileSnapshot),
      curriculum: clonePlain(draft.curriculumSnapshot),
      grades: clonePlain(draft.gradesSnapshot || []),
    },
  };
}

function signCredentialPayload(vcPayload, issuerKey, privateKeyPem) {
  const payloadString = JSON.stringify(vcPayload);
  const signer = createSign('SHA256');
  signer.update(payloadString);
  signer.end();

  const proofValue = signer.sign(privateKeyPem, 'base64');
  const credentialHash = createHash('sha256')
    .update(payloadString)
    .digest('hex');

  const signedCredential = {
    ...vcPayload,
    proof: {
      type: 'EcdsaSecp256r1Signature2019',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: issuerKey.kid,
      proofValue,
    },
  };

  return {
    credentialHash,
    signedCredential,
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
    filter.credentialType = credentialType;
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
  const credentialType = cleanString(payload?.credentialType, 'student_record');
  const notes = cleanString(payload?.notes);

  const { student, grades } = await getStudentBundle(studentId);

  const existingOpenDraft = await CredentialDraft.findOne({
    student: student._id,
    credentialType,
    status: {
      $in: ['draft', 'for_signature', 'signed', 'claim_ready', 'queued_for_anchor'],
    },
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
    createdBy: actor?._id || null,
    status: 'draft',
  });

  return serializeDraft(draft);
}

export async function submitCredentialDraft(id, actor) {
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (draft.status !== 'draft') {
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

  await draft.save();
  return serializeDraft(draft);
}

export async function signCredentialDraft(id, actor) {
  assertRegistrar(actor);
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (draft.status !== 'for_signature') {
    throw new ApiError(409, 'Only drafts pending signature can be signed');
  }

    const issuerKey = await getActiveIssuerKeyOrThrow();

    const privateKeyPem = decryptPrivateKey({
    ciphertext: issuerKey.privateKeyCiphertext,
    iv: issuerKey.privateKeyIv,
    authTag: issuerKey.privateKeyAuthTag,
    });

  const vcPayload = buildVcPayload(draft, issuerKey);
  const { credentialHash, signedCredential } = signCredentialPayload(
    vcPayload,
    issuerKey,
    privateKeyPem
  );

  draft.vcPayload = vcPayload;
  draft.signedCredential = signedCredential;
  draft.credentialHash = credentialHash;
  draft.signedBy = actor._id;
  draft.signedAt = new Date();
  draft.status = 'signed';
  draft.rejectionReason = '';

  await draft.save();
  return serializeDraft(draft);
}

export async function createCredentialClaimToken(id, actor) {
  assertRegistrar(actor);
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (!['signed', 'claim_ready', 'anchored'].includes(draft.status)) {
    throw new ApiError(
      409,
      'Only signed, anchored, or claim-ready credentials can be prepared for claiming'
    );
  }

  if (!draft.signedCredential) {
    throw new ApiError(409, 'Signed credential payload is missing');
  }

  const now = new Date();
  const token = generateClaimToken();
  const expiresAt = addMinutes(now, CLAIM_TOKEN_TTL_MINUTES);

  draft.status = 'claim_ready';
  draft.claimTokenHash = hashClaimToken(token);
  draft.claimTokenExpiresAt = expiresAt;
  draft.claimReadyAt = now;
  draft.claimedAt = null;
  draft.claimedBy = null;
  draft.claimedDeviceId = '';

  await draft.save();

  await notifyStudentByStudentNo(draft.studentNo, {
    type: 'credential_ready',
    title: 'Credential ready for claim',
    body: 'Your signed academic credential is ready to claim.',
    data: {
      credentialId: draft._id.toString(),
      status: 'claim_ready',
    },
  }).catch(() => null);

  return {
    credential: serializeDraft(draft),
    token,
    claimUri: `bcvs://claim?token=${encodeURIComponent(token)}`,
    expiresAt,
    ttlMinutes: CLAIM_TOKEN_TTL_MINUTES,
  };
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

  if (candidate.status === 'claimed') {
    throw new ApiError(409, 'Credential has already been claimed');
  }

  if (candidate.claimedAt) {
    throw new ApiError(409, 'Credential has already been claimed');
  }

  if (!['signed', 'claim_ready'].includes(candidate.status)) {
    throw new ApiError(409, 'Credential is not available for claiming');
  }

  if (candidate.status !== 'claim_ready') {
    throw new ApiError(409, 'Credential QR has not been prepared for claiming');
  }

  if (!candidate.signedCredential) {
    throw new ApiError(409, 'Signed credential payload is missing');
  }

  if (!candidate.claimTokenExpiresAt || candidate.claimTokenExpiresAt.getTime() <= now.getTime()) {
    throw new ApiError(410, 'Claim token has expired');
  }

  const claimed = await CredentialDraft.findOneAndUpdate(
    {
      _id: candidate._id,
      status: 'claim_ready',
      claimedAt: null,
      claimTokenHash: tokenHash,
      claimTokenExpiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'claimed',
        claimedAt: now,
        claimedBy: actor._id,
        claimedDeviceId: deviceId,
        claimTokenHash: '',
        claimTokenExpiresAt: null,
      },
    },
    { new: true }
  );

  if (!claimed) {
    throw new ApiError(409, 'Credential claim could not be completed. Please refresh and try again.');
  }

  return buildClaimResponse(claimed);
}

export async function scheduleCredentialAnchor(id, payload = {}, actor) {
  assertRegistrar(actor);
  assertObjectId(id, 'credential draft id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential draft not found');
  }

  if (!['signed', 'queued_for_anchor'].includes(draft.status)) {
    throw new ApiError(
      409,
      'Only signed drafts can be queued for anchoring'
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
    cleanString(payload?.anchorMode) === 'same_day' ? 'same_day' : 'scheduled';

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
  draft.status = 'queued_for_anchor';
  draft.contractAddress = await resolveActiveContractAddress(settings);

  await draft.save();
  return serializeDraft(draft);
}
