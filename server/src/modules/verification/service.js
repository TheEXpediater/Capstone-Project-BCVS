import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import {
  buildMerkleLeaf,
  computeVcHash,
  MERKLE_ALGORITHM,
  normalizeHex,
  safeCompareHex,
  verifyMerkleProof,
  verifyVcSignature,
  computeLegacyVcHash,
} from '../../shared/utils/vcProof.js';
import { getUserModel } from '../auth/user.model.js';
import { normalizeCredentialType, isSupportedCredentialType } from '../credentials/service.js';
import { getCredentialDraftModel } from '../credentials/model.js';
import { getExplorerBaseUrl } from '../contracts/service.js';
import { getIssuerKeyModel } from '../settings/issuerKey.model.js';
import { getStudentModel } from '../students/model.js';
import { notifyStudentByStudentNo } from '../notifications/service.js';
import { getVerificationSessionModel, getVerificationSubmissionModel } from './model.js';

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeStudentNo(value) {
  return cleanString(value).toLowerCase();
}

function getAccountVerificationStatus(user) {
  const status = cleanString(user?.verified || user?.verificationStatus, 'unverified').toLowerCase();
  if (['pending', 'verified', 'rejected'].includes(status)) return status;
  return 'unverified';
}

function isVerifiedMobileStudent(user) {
  return getAccountVerificationStatus(user) === 'verified' && Boolean(cleanString(user?.studentId));
}

function assertMobileAccount(actor) {
  if (!actor || actor.kind !== 'mobile' || actor.role !== 'student') {
    throw new ApiError(403, 'Only authenticated student mobile users can submit verification');
  }
}

function assertMobileStudent(actor) {
  if (!actor || actor.kind !== 'mobile' || actor.role !== 'student') {
    throw new ApiError(403, 'Only authenticated student mobile users can use verification sessions');
  }

  if (!isVerifiedMobileStudent(actor)) {
    throw new ApiError(403, 'Your account must be verified before claiming this credential.');
  }

  if (!cleanString(actor.studentId)) {
    throw new ApiError(403, 'Mobile user is not linked to a student number');
  }
}

function assertObjectId(value, label = 'id') {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
}

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAnswers(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeVerificationSubmission(doc, extras = {}) {
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  const serialized = clonePlain(raw);

  return {
    ...serialized,
    id: cleanString(serialized?._id),
    selfieUrl: cleanString(serialized?.selfieUrl || serialized?.livenessImageUrl),
    livenessImageUrl: cleanString(serialized?.livenessImageUrl || serialized?.selfieUrl),
    ...extras,
  };
}

async function findSubmissionOrThrow(submissionId) {
  assertObjectId(submissionId, 'verification submission id');

  const VerificationSubmission = getVerificationSubmissionModel();
  const submission = await VerificationSubmission.findById(submissionId);

  if (!submission) {
    throw new ApiError(404, 'Verification submission not found');
  }

  return submission;
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setHours(next.getHours() + Number(hours || 0));
  return next;
}

function isPendingSessionStatus(status) {
  return ['draft', 'pending', 'pending_consent'].includes(cleanString(status));
}

function isTerminalSessionStatus(status) {
  return ['presented', 'denied', 'expired'].includes(cleanString(status));
}

function generateNonce() {
  return randomBytes(18).toString('base64url');
}

function resolveVerifyBaseUrl(payload = {}) {
  return cleanString(
    payload?.verifyBaseUrl ||
      payload?.verifyUrl ||
      process.env.VERIFICATION_WEB_BASE_URL ||
      process.env.WEB_BASE_URL ||
      ''
  );
}

function buildVerifyUrl(baseUrl, sessionId, nonce) {
  if (!baseUrl) return '';

  const trimmed = cleanString(baseUrl).replace(/\/+$/, '');
  const suffix = nonce ? `?nonce=${encodeURIComponent(nonce)}` : '';
  return `${trimmed}/${encodeURIComponent(sessionId)}${suffix}`;
}

function resolveCredentialTypeFromPayload(payload = {}, credential = null) {
  return normalizeCredentialType(
    payload?.credentialType ||
      payload?.credential_type ||
      payload?.type ||
      payload?.request?.credentialType ||
      credential?.credentialType ||
      credential?.signedCredential?.credentialType ||
      credential?.signedCredential?.type?.find?.((item) => /diploma/i.test(item)) ||
      ''
  );
}

function buildCredentialHint(credential = null) {
  if (!credential) return null;
  return {
    credentialId: String(credential._id),
    credentialType: normalizeCredentialType(credential.credentialType),
    status: credential.status,
  };
}

function resolvePublicNonce(payload = {}) {
  return cleanString(payload?.nonce || payload?.verificationNonce || payload?.verification_nonce);
}

function buildRequestShape(session) {
  const request = clonePlain(session?.request || {});
  const organization = cleanString(
    request.organization ||
      request.orgName ||
      request.verifierName ||
      request.employer?.org ||
      session?.organization
  );
  const contact = cleanString(
    request.contact ||
      request.verifierEmail ||
      request.email ||
      request.employer?.contact ||
      session?.contact
  );
  const purpose = cleanString(request.purpose || session?.purpose, 'Credential verification');
  const sessionId = cleanString(session?._id?.toString?.() || session?.sessionId);
  const nonce = cleanString(session?.nonce);
  const credentialType = normalizeCredentialType(request.credentialType || session?.credentialType);

  return {
    sessionId,
    nonce,
    credentialId: cleanString(session?.credentialId),
    credentialType,
    organization,
    orgName: organization,
    contact,
    purpose,
    requestedPdf: Boolean(session?.requestedPdf || request.requestedPdf || request.requiresPdf),
    employer: {
      org: organization,
      contact,
    },
  };
}

function serializeVerificationSession(doc) {
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  const sessionId = cleanString(raw?._id?.toString?.() || raw?.sessionId);
  const nonce = cleanString(raw?.nonce);
  const verifyUrl = buildVerifyUrl(raw?.verifyBaseUrl, sessionId, nonce);
  const request = buildRequestShape(raw);

  return {
    ...clonePlain(raw),
    sessionId,
    session_id: sessionId,
    nonce,
    verifyUrl,
    url: verifyUrl,
    credentialId: cleanString(raw?.credentialId),
    credentialType: normalizeCredentialType(raw?.credentialType || request.credentialType),
    studentNo: cleanString(raw?.studentNo),
    studentName: cleanString(raw?.studentName),
    organization: request.organization,
    orgName: request.orgName,
    contact: request.contact,
    purpose: request.purpose,
    employer: request.employer,
    request,
    requestedPdf: Boolean(raw?.requestedPdf),
    allowPdfDownload: Boolean(raw?.allowPdfDownload),
    verificationResult: raw?.verificationResult || null,
    downloads: buildDownloadFlags(raw),
  };
}

function buildDownloadFlags(session) {
  const approved = session?.status === 'presented' && session?.decision === 'approve';
  return {
    vc: Boolean(approved),
    report: Boolean(approved),
    pdf: Boolean(approved && session?.allowPdfDownload),
  };
}

function serializePublicSession(doc) {
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  const sessionId = cleanString(raw?._id?.toString?.() || raw?.sessionId);
  const request = buildRequestShape(raw);
  return {
    sessionId,
    session_id: sessionId,
    status: raw?.status || 'draft',
    decision: raw?.decision || '',
    credentialId: cleanString(raw?.credentialId),
    credentialType: normalizeCredentialType(raw?.credentialType || request.credentialType),
    request,
    createdAt: raw?.createdAt || null,
    requestedAt: raw?.requestedAt || null,
    presentedAt: raw?.presentedAt || null,
    expiresAt: raw?.expiresAt || null,
    requestedPdf: Boolean(raw?.requestedPdf),
    allowPdfDownload: Boolean(raw?.allowPdfDownload),
    downloads: buildDownloadFlags(raw),
    verificationResult: raw?.status === 'presented' ? raw?.verificationResult || null : null,
  };
}

async function getCredentialForHolder(credentialId, actor) {
  if (!credentialId) return null;

  assertObjectId(credentialId, 'credential id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(credentialId).lean();

  if (!draft) {
    throw new ApiError(404, 'Credential not found');
  }

  if (normalizeStudentNo(draft.studentNo) !== normalizeStudentNo(actor.studentId)) {
    throw new ApiError(403, 'This credential belongs to another student');
  }

  if (!draft.signedCredential) {
    throw new ApiError(409, 'Signed credential payload is missing');
  }

  if (!['claimed', 'shared'].includes(draft.status) || !draft.claimedAt) {
    throw new ApiError(409, 'Only claimed credentials can be shared in a verification session');
  }

  return draft;
}

async function findSessionOrThrow(sessionId) {
  assertObjectId(sessionId, 'verification session id');

  const VerificationSession = getVerificationSessionModel();
  const session = await VerificationSession.findById(sessionId);

  if (!session) {
    throw new ApiError(404, 'Verification session not found');
  }

  if (isPendingSessionStatus(session.status) && session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    session.status = 'expired';
    await session.save();
    throw new ApiError(410, 'Verification session has expired');
  }

  return session;
}

function assertNonce(session, nonce) {
  const expected = cleanString(session?.nonce);
  const provided = cleanString(nonce);

  if (provided && expected && provided !== expected) {
    throw new ApiError(403, 'Verification nonce does not match');
  }
}

function assertNonceRequired(session, nonce) {
  const expected = cleanString(session?.nonce);
  const provided = cleanString(nonce);

  if (!expected || !provided || expected !== provided) {
    throw new ApiError(403, 'Verification nonce does not match');
  }
}

export async function getMyVerification(actor) {
  assertMobileAccount(actor);

  const VerificationSubmission = getVerificationSubmissionModel();
  const submission = await VerificationSubmission.findOne({ userId: actor._id })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const status = getAccountVerificationStatus(actor);

  return {
    user: {
      id: actor._id,
      fullName: actor.fullName || '',
      email: actor.email || '',
      studentId: actor.studentId || '',
      verified: status,
      verifiedAt: actor.verifiedAt || null,
    },
    linked: Boolean(cleanString(actor.studentId)),
    verified: status === 'verified',
    status,
    submission: submission ? serializeVerificationSubmission(submission) : null,
  };
}

export async function submitAccountVerification(payload = {}, actor) {
  assertMobileAccount(actor);

  if (getAccountVerificationStatus(actor) === 'verified') {
    throw new ApiError(409, 'This account is already verified');
  }

  const answers = parseAnswers(payload.answers);
  const submittedStudentNo = cleanString(
    payload.submittedStudentNo ||
      payload.studentNo ||
      answers.studentNo ||
      answers.studentNumber
  );

  const idFrontUrl = cleanString(payload.idFrontUrl);
  const idBackUrl = cleanString(payload.idBackUrl);
  const livenessImageUrl = cleanString(payload.livenessImageUrl || payload.selfieUrl);
  const livenessPassed =
    payload.livenessPassed === true ||
    payload.livenessPassed === 'true' ||
    answers.livenessPassed === true ||
    answers.livenessPassed === 'true';

  if (!idFrontUrl) {
    throw new ApiError(400, 'Valid ID front image is required');
  }

  if (!idBackUrl) {
    throw new ApiError(400, 'Valid ID back image is required');
  }

  if (!livenessImageUrl) {
    throw new ApiError(400, 'Selfie/liveness image is required');
  }

  if (answers.confirmed !== true && answers.confirmed !== 'true') {
    throw new ApiError(400, 'Confirmation is required');
  }

  const VerificationSubmission = getVerificationSubmissionModel();
  const existingApproved = await VerificationSubmission.findOne({
    userId: actor._id,
    status: 'approved',
  }).lean();

  if (existingApproved) {
    throw new ApiError(409, 'This account already has an approved verification submission');
  }

  const now = new Date();
  const submission = await VerificationSubmission.findOneAndUpdate(
    {
      userId: actor._id,
      status: { $in: ['draft', 'pending', 'rejected'] },
    },
    {
      $set: {
        userId: actor._id,
        fullName: cleanString(payload.fullName || answers.fullName || actor.fullName),
        email: cleanString(actor.email),
        submittedStudentNo,
        idFrontUrl,
        idBackUrl,
        selfieUrl: livenessImageUrl,
        livenessImageUrl,
        livenessPassed,
        livenessMethod: cleanString(payload.livenessMethod || answers.livenessMethod),
        livenessPassedAt: toDateOrNull(payload.livenessPassedAt || answers.livenessPassedAt),
        answers,
        status: 'pending',
        linkedStudentId: null,
        linkedStudentNo: '',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: '',
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      sort: { updatedAt: -1, createdAt: -1 },
    }
  );

  actor.verified = 'pending';
  await actor.save();

  return serializeVerificationSubmission(submission);
}

export async function listVerificationSubmissions(query = {}) {
  const VerificationSubmission = getVerificationSubmissionModel();

  const status = cleanString(query.status || 'pending').toLowerCase();
  const search = cleanString(query.search);
  const filter = {};

  if (['pending', 'approved', 'rejected', 'draft'].includes(status)) {
    filter.status = status;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { fullName: regex },
      { email: regex },
      { submittedStudentNo: regex },
      { linkedStudentNo: regex },
    ];
  }

  const submissions = await VerificationSubmission.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return {
    submissions: submissions.map((item) => serializeVerificationSubmission(item)),
  };
}

export async function getVerificationSubmission(submissionId) {
  const submission = await findSubmissionOrThrow(submissionId);
  const User = getUserModel();
  const user = await User.findById(submission.userId).lean();

  return serializeVerificationSubmission(submission, {
    mobileAccount: user
      ? {
          id: user._id,
          fullName: user.fullName || '',
          email: user.email || '',
          studentId: user.studentId || '',
          verified: getAccountVerificationStatus(user),
        }
      : null,
  });
}

export async function approveVerificationSubmission(submissionId, payload = {}, actor) {
  const submission = await findSubmissionOrThrow(submissionId);

  if (submission.status === 'approved') {
    throw new ApiError(409, 'Verification submission is already approved');
  }

  if (submission.status !== 'pending') {
    throw new ApiError(409, 'Only pending verification submissions can be approved');
  }

  const User = getUserModel();
  const Student = getStudentModel();
  const studentId = cleanString(payload.studentId);
  const studentNo = cleanString(payload.studentNo);

  let student = null;
  if (studentId) {
    assertObjectId(studentId, 'student id');
    student = await Student.findById(studentId).lean();
  } else if (studentNo) {
    student = await Student.findOne({ studentNo }).lean();
  }

  if (!student) {
    throw new ApiError(404, 'Selected student record was not found');
  }

  const user = await User.findById(submission.userId);
  if (!user || user.kind !== 'mobile' || user.role !== 'student') {
    throw new ApiError(404, 'Mobile account was not found');
  }

  const duplicate = await User.findOne({
    _id: { $ne: user._id },
    kind: 'mobile',
    studentId: student.studentNo,
  }).lean();

  if (duplicate) {
    throw new ApiError(409, 'This student number is already linked to another mobile account');
  }

  const now = new Date();
  user.studentId = student.studentNo;
  user.verified = 'verified';
  user.verifiedAt = now;
  user.verifiedBy = actor?._id || null;
  await user.save();

  submission.status = 'approved';
  submission.linkedStudentId = student._id;
  submission.linkedStudentNo = student.studentNo;
  submission.reviewedBy = actor?._id || null;
  submission.reviewedAt = now;
  submission.rejectionReason = '';
  await submission.save();

  return {
    submission: serializeVerificationSubmission(submission),
    user: {
      id: user._id,
      fullName: user.fullName || '',
      email: user.email || '',
      studentId: user.studentId || '',
      verified: getAccountVerificationStatus(user),
      verifiedAt: user.verifiedAt || null,
    },
  };
}

export async function rejectVerificationSubmission(submissionId, payload = {}, actor) {
  const submission = await findSubmissionOrThrow(submissionId);
  const reason = cleanString(payload.reason || payload.rejectionReason);

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  if (submission.status === 'approved') {
    throw new ApiError(409, 'Approved submissions cannot be rejected');
  }

  const User = getUserModel();
  const now = new Date();

  submission.status = 'rejected';
  submission.reviewedBy = actor?._id || null;
  submission.reviewedAt = now;
  submission.rejectionReason = reason;
  await submission.save();

  await User.findByIdAndUpdate(submission.userId, {
    $set: {
      verified: 'rejected',
    },
  });

  return serializeVerificationSubmission(submission);
}

function coerceBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return ['true', '1', 'yes', 'y'].includes(cleanString(value).toLowerCase());
}

function buildRequestFromPayload(payload = {}, existing = {}) {
  const source = {
    ...(existing || {}),
    ...(payload?.request && typeof payload.request === 'object' ? payload.request : {}),
    ...payload,
  };

  const organization = cleanString(
    source.organization ||
      source.orgName ||
      source.verifierName ||
      source.company ||
      source.employer?.org,
    'BCVS Verifier'
  );
  const contact = cleanString(
    source.contact ||
      source.email ||
      source.verifierEmail ||
      source.phone ||
      source.employer?.contact
  );
  const purpose = cleanString(source.purpose || source.reason, 'Credential verification');
  const credentialType = normalizeCredentialType(source.credentialType || source.credential_type);
  const requestedPdf = coerceBoolean(source.requestedPdf || source.requiresPdf || source.includePdf);

  return {
    organization,
    orgName: organization,
    contact,
    purpose,
    credentialType,
    requestedPdf,
    employer: {
      org: organization,
      contact,
    },
  };
}

async function getCredentialHintOrThrow(credentialId, actor = null) {
  const normalizedId = cleanString(credentialId);
  if (!normalizedId) {
    throw new ApiError(400, 'Credential ID is required to start a verification session');
  }

  if (actor?.kind === 'mobile' && actor?.role === 'student') {
    return getCredentialForHolder(normalizedId, actor);
  }

  assertObjectId(normalizedId, 'credential id');

  const CredentialDraft = getCredentialDraftModel();
  const credential = await CredentialDraft.findById(normalizedId).lean();

  if (!credential) {
    throw new ApiError(404, 'Credential not found');
  }

  if (!credential.signedCredential) {
    throw new ApiError(409, 'Signed credential payload is missing');
  }

  if (!['claimed', 'shared'].includes(credential.status) || !credential.claimedAt) {
    throw new ApiError(409, 'Only claimed credentials can be verified by a third party');
  }

  if (!isSupportedCredentialType(credential.credentialType)) {
    throw new ApiError(400, 'Only TOR and Diploma credentials are supported');
  }

  return credential;
}

function extractPresentedCredential(input) {
  const source =
    input?.vcPayload ||
    input?.verifiableCredential ||
    input?.signedCredential ||
    input?.credential ||
    input?.payload ||
    input;

  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  return clonePlain(source);
}

function inferCredentialTypeFromVc(vc = {}) {
  const direct = normalizeCredentialType(vc.credentialType || vc.credential_type);
  if (direct) return direct;

  const types = Array.isArray(vc.type) ? vc.type : [vc.type].filter(Boolean);
  if (types.some((item) => /diploma/i.test(String(item)))) return 'diploma';
  if (types.some((item) => /transcript|academic|student/i.test(String(item)))) return 'tor';

  return normalizeCredentialType(vc.credentialSubject?.documentType);
}

async function resolveIssuerPublicKey(vc = {}, credential = null) {
  const proof = vc?.proof || {};
  const embeddedPublicKey =
    cleanString(proof.issuerPublicKey) ||
    cleanString(credential?.issuerPublicKey) ||
    cleanString(credential?.signedCredential?.proof?.issuerPublicKey);

  if (embeddedPublicKey) {
    return {
      publicKeyPem: embeddedPublicKey,
      source: 'credential_proof',
      issuerKeyId: cleanString(proof.issuerKeyId || credential?.issuerKeyId),
      verificationMethod: cleanString(proof.verificationMethod || credential?.verificationMethod),
    };
  }

  const lookup = cleanString(
    proof.issuerKeyId ||
      credential?.issuerKeyId ||
      proof.verificationMethod ||
      credential?.verificationMethod ||
      vc?.issuer?.id
  );

  if (!lookup) {
    return {
      publicKeyPem: '',
      source: '',
      issuerKeyId: '',
      verificationMethod: cleanString(proof.verificationMethod),
    };
  }

  const IssuerKey = getIssuerKeyModel();
  const clauses = [{ kid: lookup }, { name: lookup }];
  if (Types.ObjectId.isValid(lookup)) clauses.push({ _id: lookup });

  const issuerKey = await IssuerKey.findOne({ $or: clauses }).lean();
  return {
    publicKeyPem: cleanString(issuerKey?.publicKeyPem),
    source: issuerKey ? 'issuer_key_store' : '',
    issuerKeyId: cleanString(issuerKey?._id || proof.issuerKeyId || lookup),
    verificationMethod: cleanString(issuerKey?.kid || proof.verificationMethod || lookup),
  };
}

function buildAnchorCheck(credential = {}, merkleValid = false) {
  const merkleRoot = normalizeHex(credential?.merkleRoot);
  const txHash = cleanString(credential?.anchorTxHash);
  const contractAddress = cleanString(credential?.contractAddress);
  const chainId = credential?.anchorChainId || null;
  const explorerBaseUrl =
    cleanString(credential?.anchorExplorerUrl) ||
    getExplorerBaseUrl(chainId) ||
    '';

  let reason = '';
  if (!merkleValid) reason = 'merkle_proof_not_valid';
  else if (!merkleRoot) reason = 'merkle_root_missing';
  else if (!txHash) reason = 'on_chain_anchor_tx_missing';
  else if (!contractAddress) reason = 'anchor_contract_missing';
  else reason = 'active_contract_does_not_expose_merkle_root_verification';

  return {
    verified: false,
    reason,
    chainId,
    network: cleanString(credential?.anchorNetwork),
    contractAddress,
    txHash,
    blockNumber: credential?.anchorBlockNumber ?? null,
    explorerUrl: txHash && explorerBaseUrl ? `${explorerBaseUrl}/tx/${encodeURIComponent(txHash)}` : '',
    eventName: cleanString(credential?.anchorEventName),
    eventArgs: credential?.anchorEventArgs || null,
  };
}

async function verifyPresentedCredentialPayload({
  presentedCredential,
  credential,
  actor,
  session,
}) {
  const vc = extractPresentedCredential(presentedCredential);
  if (!vc) {
    throw new ApiError(400, 'Presented credential payload is required');
  }

  const proof = vc.proof || {};
  const vcHash = computeVcHash(vc);
  const legacyVcHash = computeLegacyVcHash(vc);
  const proofHash = normalizeHex(proof.vcHash || proof.canonicalVcHash);
  const storedHash = normalizeHex(
    credential?.vcHash ||
      credential?.canonicalVcHash ||
      credential?.credentialHash ||
      credential?.signedCredential?.proof?.vcHash
  );
  const storedLegacyHash = normalizeHex(credential?.credentialHash || '');
  const merkleLeaf = buildMerkleLeaf(vcHash);
  const storedMerkleLeaf = normalizeHex(credential?.merkleLeaf);
  const merkleRoot = normalizeHex(credential?.merkleRoot);
  const merkleProof = Array.isArray(credential?.merkleProof) ? credential.merkleProof : [];
  const merkleLeafMatches =
    Boolean(storedMerkleLeaf && merkleLeaf) && safeCompareHex(merkleLeaf, storedMerkleLeaf);
  const merkleValid =
    Boolean(merkleRoot && merkleLeafMatches) &&
    verifyMerkleProof({
      leaf: merkleLeaf,
      proof: merkleProof,
      root: merkleRoot,
    });
  const issuerKey = await resolveIssuerPublicKey(vc, credential);
  const signature = verifyVcSignature(vc, issuerKey.publicKeyPem);
  const credentialType = inferCredentialTypeFromVc(vc);
  const requestedType = normalizeCredentialType(session?.credentialType || session?.request?.credentialType);
  const subjectStudentNo = cleanString(vc.credentialSubject?.studentNo);
  const subjectMatches =
    normalizeStudentNo(subjectStudentNo) === normalizeStudentNo(credential?.studentNo || actor?.studentId);
  const credentialTypeSupported = isSupportedCredentialType(credentialType);
  const credentialTypeMatches = !requestedType || credentialType === requestedType;
  const hashMatchesProof = proofHash ? safeCompareHex(vcHash, proofHash) : true;
  const hashMatchesRecord =
    (Boolean(storedHash) && safeCompareHex(vcHash, storedHash)) ||
    (Boolean(storedLegacyHash) && safeCompareHex(legacyVcHash, storedLegacyHash));
  const blockchain = buildAnchorCheck(credential, merkleValid);
  const payloadVerified =
    signature.valid &&
    hashMatchesProof &&
    hashMatchesRecord &&
    subjectMatches &&
    credentialTypeSupported &&
    credentialTypeMatches;
  const fullyVerified = payloadVerified && merkleValid && blockchain.verified;
  const failed =
    !signature.valid ||
    !hashMatchesProof ||
    !hashMatchesRecord ||
    !subjectMatches ||
    !credentialTypeSupported ||
    !credentialTypeMatches;

  return {
    verified: fullyVerified,
    payloadVerified,
    status: fullyVerified ? 'verified' : failed ? 'failed' : 'partial',
    generatedAt: new Date().toISOString(),
    credentialId: String(credential?._id || ''),
    credentialType,
    requestedCredentialType: requestedType,
    vcHash,
    merkleLeaf,
    merkleRoot,
    merkleProof,
    merkleAlgorithm: credential?.merkleAlgorithm || MERKLE_ALGORITHM,
    checks: {
      credentialType: {
        valid: credentialTypeSupported && credentialTypeMatches,
        supported: credentialTypeSupported,
        matchesRequest: credentialTypeMatches,
        expected: requestedType,
        actual: credentialType,
      },
      subject: {
        valid: subjectMatches,
        studentNo: subjectStudentNo,
      },
      hash: {
        valid: hashMatchesProof && hashMatchesRecord,
        vcHash,
        legacyVcHash,
        proofHash: proofHash || '',
        storedHash: storedHash || '',
        storedLegacyHash: storedLegacyHash || '',
        proofHashPresent: Boolean(proofHash),
        matchesProof: hashMatchesProof,
        matchesRecord: hashMatchesRecord,
      },
      signature: {
        valid: Boolean(signature.valid),
        reason: signature.reason || '',
        verificationMethod: issuerKey.verificationMethod,
        issuerKeyId: issuerKey.issuerKeyId,
        publicKeySource: issuerKey.source,
      },
      merkle: {
        valid: merkleValid,
        reason: merkleValid
          ? ''
          : !merkleRoot
            ? 'merkle_root_missing'
            : !storedMerkleLeaf
              ? 'merkle_leaf_missing'
              : !merkleLeafMatches
                ? 'merkle_leaf_mismatch'
                : 'merkle_proof_invalid',
        leaf: merkleLeaf,
        storedLeaf: storedMerkleLeaf || '',
        root: merkleRoot || '',
        proof: merkleProof,
        treeSize: credential?.merkleTreeSize || 0,
        leafIndex: credential?.merkleLeafIndex ?? -1,
      },
      blockchain,
    },
    note: blockchain.verified
      ? ''
      : 'The current active contract does not provide a verifiable Merkle-root anchor, so blockchain verification is reported as unavailable rather than passed.',
  };
}

function assertApprovedSessionForDownload(session, { pdf = false } = {}) {
  if (session.status !== 'presented' || session.decision !== 'approve') {
    throw new ApiError(409, 'Credential downloads are available only after holder approval');
  }

  if (!session.presentedCredential) {
    throw new ApiError(409, 'Presented credential payload is missing');
  }

  if (pdf && !session.allowPdfDownload) {
    throw new ApiError(403, 'The holder did not approve PDF download for this session');
  }

  if (pdf && !session.verificationResult?.payloadVerified) {
    throw new ApiError(409, 'PDF download requires a verified VC payload');
  }
}

function pdfEscape(value) {
  return cleanString(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(lines = []) {
  const textOps = lines
    .slice(0, 42)
    .map((line, index) => `BT /F1 10 Tf 50 ${760 - index * 16} Td (${pdfEscape(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(textOps, 'utf8')} >> stream\n${textOps}\nendstream endobj`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'utf8');
}

function buildPdfPayload(session) {
  const vc = extractPresentedCredential(session.presentedCredential);
  const subject = vc?.credentialSubject || {};
  const result = session.verificationResult || {};
  const lines = [
    'BCVS Verified Credential',
    `Document: ${vc?.name || subject.documentType || result.credentialType || 'Credential'}`,
    `Student: ${subject.studentName || ''}`,
    `Student No: ${subject.studentNo || ''}`,
    `Issuer: ${vc?.issuer?.name || vc?.issuer?.id || ''}`,
    `Issued: ${vc?.issuanceDate || ''}`,
    `Verification status: ${result.status || 'unknown'}`,
    `VC hash: ${result.vcHash || ''}`,
    `Merkle root: ${result.merkleRoot || ''}`,
    `Blockchain status: ${result.checks?.blockchain?.verified ? 'verified' : result.checks?.blockchain?.reason || 'unavailable'}`,
    '',
    'Credential payload summary:',
    JSON.stringify(
      {
        credentialSubject: subject,
        credentialType: vc?.credentialType || result.credentialType,
      },
      null,
      2
    ),
  ].join('\n').split('\n');

  return buildSimplePdf(lines);
}

export async function createVerificationSession(payload = {}, actor = null) {
  const credentialId = cleanString(payload?.credential_id || payload?.credentialId);
  const ttlHours = Number(payload?.ttlHours || payload?.ttl_hours || 24);

  if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
    throw new ApiError(400, 'TTL hours must be a positive number');
  }

  const credential = await getCredentialHintOrThrow(credentialId, actor);
  const credentialType = resolveCredentialTypeFromPayload(payload, credential);

  if (!credentialType) {
    throw new ApiError(400, 'Only TOR and Diploma credentials are supported');
  }

  const request = {
    ...buildRequestFromPayload(payload),
    credentialType,
  };
  const now = new Date();
  const nonce = cleanString(payload?.nonce) || generateNonce();
  const verifyBaseUrl = resolveVerifyBaseUrl(payload);
  const expiresAt = addHours(now, ttlHours);
  const VerificationSession = getVerificationSessionModel();

  const session = await VerificationSession.create({
    credentialId: String(credential._id),
    credentialType,
    studentNo: cleanString(credential.studentNo),
    studentName: cleanString(credential.studentName),
    nonce,
    request,
    verifyBaseUrl,
    status: 'draft',
    decision: '',
    createdBy: actor?._id || null,
    holderUserId: actor?.kind === 'mobile' ? actor._id : null,
    requestedPdf: Boolean(request.requestedPdf),
    expiresAt,
  });

  return {
    ...serializePublicSession(session),
    nonce,
    verifyUrl: buildVerifyUrl(verifyBaseUrl, session._id.toString(), nonce),
    credential: buildCredentialHint(credential),
  };
}

export async function requestVerificationSession(sessionId, payload = {}) {
  const session = await findSessionOrThrow(sessionId);
  assertNonceRequired(session, resolvePublicNonce(payload));

  if (isTerminalSessionStatus(session.status)) {
    throw new ApiError(409, 'Verification session has already been processed');
  }

  const request = buildRequestFromPayload(payload, session.request || {});
  if (request.credentialType && normalizeCredentialType(session.credentialType) !== request.credentialType) {
    throw new ApiError(409, 'Requested credential type does not match the shared credential');
  }

  session.request = {
    ...(session.request || {}),
    ...request,
    credentialType: normalizeCredentialType(session.credentialType || request.credentialType),
  };
  session.requestedPdf = Boolean(request.requestedPdf);
  session.status = 'pending_consent';
  session.requestedAt = new Date();
  await session.save();

  await notifyStudentByStudentNo(session.studentNo, {
    type: 'verification_request',
    title: 'Credential verification request',
    body: `${session.request.organization || 'A verifier'} is requesting holder consent.`,
    data: {
      sessionId: session._id.toString(),
      session_id: session._id.toString(),
      credentialId: session.credentialId,
      credentialType: normalizeCredentialType(session.credentialType),
      requestedPdf: session.requestedPdf,
      request: buildRequestShape(session),
    },
  }).catch(() => null);

  return serializePublicSession(session);
}

export async function getPublicVerificationSession(sessionId, nonce = '') {
  const session = await findSessionOrThrow(sessionId);
  assertNonceRequired(session, nonce);
  return serializePublicSession(session);
}

export async function getVerificationResult(sessionId, nonce = '') {
  const session = await findSessionOrThrow(sessionId);
  assertNonceRequired(session, nonce);

  if (session.status !== 'presented') {
    return serializePublicSession(session);
  }

  return {
    ...serializePublicSession(session),
    verificationResult: session.verificationResult || null,
  };
}

export async function getVerificationSession(sessionId, nonce = '', actor = null) {
  assertMobileStudent(actor);

  const session = await findSessionOrThrow(sessionId);
  assertNonce(session, nonce);

  if (normalizeStudentNo(session.studentNo) !== normalizeStudentNo(actor.studentId)) {
    throw new ApiError(403, 'Verification session does not belong to this student');
  }

  return serializeVerificationSession(session);
}

export async function presentVerificationSession(sessionId, payload = {}, actor = null) {
  assertMobileStudent(actor);

  const session = await findSessionOrThrow(sessionId);
  assertNonce(session, payload?.nonce);

  if (normalizeStudentNo(session.studentNo) !== normalizeStudentNo(actor.studentId)) {
    throw new ApiError(403, 'Verification session does not belong to this student');
  }

  if (isTerminalSessionStatus(session.status)) {
    throw new ApiError(409, 'Verification session has already been processed');
  }

  const decision = cleanString(payload?.decision).toLowerCase();
  if (!['approve', 'deny'].includes(decision)) {
    throw new ApiError(400, 'Decision must be approve or deny');
  }

  const now = new Date();

  if (decision === 'deny') {
    session.status = 'denied';
    session.decision = 'deny';
    session.presentedAt = now;
    session.presentedBy = actor._id;
    session.presentedCredentialId = '';
    session.presentedCredential = null;
    session.allowPdfDownload = false;
    session.verificationResult = null;
    await session.save();
    return serializeVerificationSession(session);
  }

  const payloadCredentialId = cleanString(
    payload?.credential_id ||
      payload?.credentialId ||
      payload?.credential?._id ||
      payload?.credential?.credentialId ||
      payload?.credential?.id
  );
  const credentialId = payloadCredentialId || cleanString(session.credentialId);

  if (!credentialId) {
    throw new ApiError(400, 'Credential is required to approve the verification session');
  }

  assertObjectId(credentialId, 'credential id');

  const CredentialDraft = getCredentialDraftModel();
  const credential = await CredentialDraft.findById(credentialId).lean();

  if (!credential) {
    throw new ApiError(404, 'Credential not found');
  }

  if (normalizeStudentNo(credential.studentNo) !== normalizeStudentNo(actor.studentId)) {
    throw new ApiError(403, 'This credential belongs to another student');
  }

  if (cleanString(session.credentialId) && cleanString(session.credentialId) !== credentialId) {
    throw new ApiError(409, 'The selected credential does not match the verification session');
  }

  if (!credential.signedCredential) {
    throw new ApiError(409, 'Signed credential payload is missing');
  }

  const presentedCredential = extractPresentedCredential(
    payload?.credential ||
      payload?.vcPayload ||
      payload?.verifiableCredential ||
      credential.signedCredential
  );
  const verificationResult = await verifyPresentedCredentialPayload({
    presentedCredential,
    credential,
    actor,
    session,
  });

  session.status = 'presented';
  session.decision = 'approve';
  session.presentedAt = now;
  session.presentedBy = actor._id;
  session.presentedCredentialId = credentialId;
  session.presentedCredential = presentedCredential;
  session.allowPdfDownload = coerceBoolean(
    payload?.allowPdfDownload || payload?.allowPDF || payload?.allowPdf
  );
  session.vcHash = verificationResult.vcHash;
  session.merkleLeaf = verificationResult.merkleLeaf;
  session.merkleRoot = verificationResult.merkleRoot;
  session.merkleProof = verificationResult.merkleProof;
  session.anchorTxHash = credential.anchorTxHash || '';
  session.contractAddress = credential.contractAddress || '';
  session.verificationResult = verificationResult;

  await session.save();
  await CredentialDraft.updateOne(
    { _id: credential._id },
    {
      $set: {
        lastVerificationResult: verificationResult,
        lastVerifiedAt: now,
      },
    }
  );

  return serializeVerificationSession(session);
}

export async function denyVerificationSession(sessionId, payload = {}, actor = null) {
  return presentVerificationSession(sessionId, { ...payload, decision: 'deny' }, actor);
}

export async function downloadPresentedCredential(sessionId, nonce = '') {
  const session = await findSessionOrThrow(sessionId);
  assertNonceRequired(session, nonce);
  assertApprovedSessionForDownload(session);

  return {
    filename: `bcvs-vc-${session._id}.json`,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(session.presentedCredential, null, 2),
  };
}

export async function downloadVerificationReport(sessionId, nonce = '') {
  const session = await findSessionOrThrow(sessionId);
  assertNonceRequired(session, nonce);
  assertApprovedSessionForDownload(session);

  return {
    filename: `bcvs-verification-report-${session._id}.json`,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(
      {
        session: serializePublicSession(session),
        verificationResult: session.verificationResult || null,
      },
      null,
      2
    ),
  };
}

export async function downloadPresentedCredentialPdf(sessionId, nonce = '') {
  const session = await findSessionOrThrow(sessionId);
  assertNonceRequired(session, nonce);
  assertApprovedSessionForDownload(session, { pdf: true });

  return {
    filename: `bcvs-credential-${session._id}.pdf`,
    contentType: 'application/pdf',
    body: buildPdfPayload(session),
  };
}
