import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getCredentialDraftModel } from '../credentials/model.js';
import { getVerificationSessionModel } from './model.js';

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

function assertMobileStudent(actor) {
  if (!actor || actor.kind !== 'mobile' || actor.role !== 'student') {
    throw new ApiError(403, 'Only authenticated student mobile users can use verification sessions');
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

  if (!['claimed', 'shared', 'anchored'].includes(draft.status)) {
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
