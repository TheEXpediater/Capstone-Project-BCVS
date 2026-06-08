import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getUserModel } from '../auth/user.model.js';
import { getCredentialDraftModel } from '../credentials/model.js';
import { getStudentModel } from '../students/model.js';
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

function buildRequestShape(session) {
  const request = clonePlain(session?.request || {});
  const organization = cleanString(
    request.organization || request.orgName || request.employer?.org || session?.organization
  );
  const contact = cleanString(request.contact || request.employer?.contact || session?.contact);
  const purpose = cleanString(request.purpose || session?.purpose, 'Credential verification');
  const sessionId = cleanString(session?._id?.toString?.() || session?.sessionId);
  const nonce = cleanString(session?.nonce);

  return {
    sessionId,
    nonce,
    credentialId: cleanString(session?.credentialId),
    organization,
    orgName: organization,
    contact,
    purpose,
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
    studentNo: cleanString(raw?.studentNo),
    studentName: cleanString(raw?.studentName),
    organization: request.organization,
    orgName: request.orgName,
    contact: request.contact,
    purpose: request.purpose,
    employer: request.employer,
    request,
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

  if (session.status === 'pending' && session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
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

export async function createVerificationSession(payload = {}, actor) {
  assertMobileStudent(actor);

  const credentialId = cleanString(payload?.credential_id || payload?.credentialId);
  const ttlHours = Number(payload?.ttlHours || payload?.ttl_hours || 24);

  if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
    throw new ApiError(400, 'TTL hours must be a positive number');
  }

  const credential = credentialId ? await getCredentialForHolder(credentialId, actor) : null;
  const request = {
    organization: cleanString(
      payload?.organization || payload?.request?.organization,
      'BCVS Verifier'
    ),
    contact: cleanString(payload?.contact || payload?.request?.contact),
    purpose: cleanString(
      payload?.purpose || payload?.request?.purpose,
      'Credential verification'
    ),
  };

  const now = new Date();
  const nonce = cleanString(payload?.nonce) || generateNonce();
  const verifyBaseUrl = resolveVerifyBaseUrl(payload);
  const expiresAt = addHours(now, ttlHours);
  const VerificationSession = getVerificationSessionModel();

  const session = await VerificationSession.create({
    credentialId: credential ? String(credential._id) : credentialId,
    studentNo: cleanString(actor.studentId),
    studentName: cleanString(actor.fullName),
    nonce,
    request,
    verifyBaseUrl,
    status: 'pending',
    decision: '',
    createdBy: actor._id,
    expiresAt,
  });

  return serializeVerificationSession(session);
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

  if (session.status !== 'pending') {
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
    await session.save();
    return serializeVerificationSession(session);
  }

  const payloadCredentialId = cleanString(
    payload?.credential_id || payload?.credentialId || payload?.credential?._id || payload?.credential?.id
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

  session.status = 'presented';
  session.decision = 'approve';
  session.presentedAt = now;
  session.presentedBy = actor._id;
  session.presentedCredentialId = credentialId;
  session.presentedCredential = clonePlain(
    payload?.credential || {
      ...credential.signedCredential,
      _id: credential._id,
      credentialId: credential._id,
      status: credential.status,
    }
  );

  await session.save();
  return serializeVerificationSession(session);
}
