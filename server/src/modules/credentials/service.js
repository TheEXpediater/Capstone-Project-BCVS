import { Types } from 'mongoose';
import { createHash, createSign } from 'node:crypto';
import { ApiError } from '../../shared/utils/ApiError.js';
import { decryptPrivateKey } from '../../shared/utils/keyVault.js';
import { getCredentialDraftModel } from './model.js';
import { getStudentModel, getStudentGradeModel } from '../students/model.js';
import { getSystemSettingModel } from '../settings/setting.model.js';
import { getIssuerKeyModel } from '../settings/issuerKey.model.js';
import { getContractModel } from '../contracts/model.js';

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

function serializeDraft(doc) {
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  return clonePlain(raw);
}

async function getStudentBundle(studentId) {
  assertObjectId(studentId, 'student id');

  const Student = getStudentModel();
  const StudentGrade = getStudentGradeModel();

  const student = await Student.findById(studentId).lean();

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
      $in: ['draft', 'for_signature', 'signed', 'queued_for_anchor'],
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
    curriculumSnapshot: clonePlain(student.curriculum || null),
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