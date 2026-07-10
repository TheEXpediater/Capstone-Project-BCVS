import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import { buildCredentialPricing } from './pricing.js';

export const DEFAULT_TOR_REMARKS = 'General Purposes';
export const SUPPORTED_CREDENTIAL_TYPES = ['tor', 'diploma'];

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value).trim();
  return cleaned || fallback;
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

export function normalizeCredentialRemarks(credentialType, payload = {}) {
  const normalizedType = normalizeCredentialType(credentialType);

  if (normalizedType === 'diploma') {
    return '';
  }

  return cleanString(payload?.remarks ?? payload?.notes, DEFAULT_TOR_REMARKS);
}

export function buildCredentialDraftCreationFields(payload = {}) {
  const credentialType = normalizeCredentialType(payload?.credentialType);

  if (!credentialType) {
    throw new ApiError(400, 'Only TOR and Diploma credentials are supported');
  }

  const remarks = normalizeCredentialRemarks(credentialType, payload);
  const pricing = buildCredentialPricing({
    anchorMode: payload?.anchorMode,
    anchorNow: payload?.anchorNow,
  });

  return {
    credentialType,
    notes: remarks,
    remarks,
    pricing,
  };
}

export function normalizeBulkStudentIdEntries(payload = {}) {
  const rawIds = payload?.studentIds ?? payload?.students ?? payload?.ids ?? [];

  if (!Array.isArray(rawIds)) {
    throw new ApiError(400, 'Student ids must be an array.');
  }

  const ids = [
    ...new Set(
      rawIds
        .map((value) => cleanString(value))
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    throw new ApiError(400, 'At least one student id is required.');
  }

  if (ids.length > 100) {
    throw new ApiError(400, 'Bulk VC creation is limited to 100 students.');
  }

  return ids.map((studentId) => ({
    studentId,
    valid: Types.ObjectId.isValid(studentId),
    reason: Types.ObjectId.isValid(studentId) ? '' : 'Invalid student id',
  }));
}
