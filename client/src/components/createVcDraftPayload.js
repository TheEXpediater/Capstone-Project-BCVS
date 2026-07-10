<<<<<<< HEAD
export const DEFAULT_TOR_REMARKS = 'General Purposes';
export const BASE_CREDENTIAL_AMOUNT = 150;
export const ANCHOR_NOW_FEE = 20;

function cleanString(value, fallback = '') {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

export function normalizeCreateVcCredentialType(value = 'tor') {
  const normalized = cleanString(value, 'tor')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['tor', 'transcript', 'transcript_of_records', 'student_record'].includes(normalized)) {
    return 'tor';
  }

  if (['diploma', 'degree', 'graduation_diploma'].includes(normalized)) {
    return 'diploma';
  }

  return 'tor';
}

export function normalizeCreateVcAnchorMode(value = 'default', anchorNow = false) {
  const normalized = cleanString(value, 'default').toLowerCase();
  if (anchorNow || ['anchor_now', 'anchor-now', 'now', 'priority', 'same_day', 'today'].includes(normalized)) {
    return 'anchor_now';
  }

  return 'default';
}

export function normalizeCreateVcRemarks(credentialType, value) {
  if (normalizeCreateVcCredentialType(credentialType) !== 'tor') {
    return '';
  }

  return cleanString(value, DEFAULT_TOR_REMARKS);
}

export function buildCreateVcDraftPayload({
  credentialType = 'tor',
  remarks = DEFAULT_TOR_REMARKS,
  anchorMode = 'default',
  anchorNow = false,
} = {}) {
  const normalizedCredentialType = normalizeCreateVcCredentialType(credentialType);
  const normalizedAnchorMode = normalizeCreateVcAnchorMode(anchorMode, anchorNow);
  const payload = {
    credentialType: normalizedCredentialType,
    anchorMode: normalizedAnchorMode,
    anchorNow: normalizedAnchorMode === 'anchor_now',
  };

  if (normalizedCredentialType === 'tor') {
    payload.remarks = normalizeCreateVcRemarks(normalizedCredentialType, remarks);
  }

  return payload;
}

export function getCreateVcPricingSummary(anchorMode = 'default', count = 1) {
  const normalizedAnchorMode = normalizeCreateVcAnchorMode(anchorMode);
  const anchorNowFee = normalizedAnchorMode === 'anchor_now' ? ANCHOR_NOW_FEE : 0;
  const totalPerCredential = BASE_CREDENTIAL_AMOUNT + anchorNowFee;
  const itemCount = Math.max(1, Number(count) || 1);

  return {
    baseAmount: BASE_CREDENTIAL_AMOUNT,
    anchorNowFee,
    totalPerCredential,
    totalAmount: totalPerCredential * itemCount,
    anchorMode: normalizedAnchorMode,
    anchorNow: normalizedAnchorMode === 'anchor_now',
=======
export function buildCreateVcDraftPayload({ credentialType, notes = '', anchorNow = false, anchorCost = 20 }) {
  const normalizedCredentialType = String(credentialType || 'tor').toLowerCase();
  const numericAnchorCost = Number(anchorCost || 0);

  return {
    credentialType: normalizedCredentialType,
    notes: String(notes || ''),
    anchorMode: anchorNow ? 'same_day' : 'scheduled',
    anchorNow: Boolean(anchorNow),
    anchorNowFee: anchorNow ? numericAnchorCost : 0,
>>>>>>> debc39457aea2953515c4ff15d60179d9938d485
  };
}
