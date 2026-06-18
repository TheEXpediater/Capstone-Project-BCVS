import {
  API_ORIGIN,
  CONFIGURED_WEB_BASE_URL,
  DOMAIN_WEB_BASE_URL,
  ENDPOINTS,
  VERIFICATION_WEB_BASE_URL,
  WEB_BASE_URL
} from '@/constants/config';
import { api, apiErrorMessage, getApiBaseUrl } from '@/services/apiClient';
import { getSavedServerConfig } from '@/services/serverConfigService';
import { getCredentialRecordId } from '@/utils/credentialUtils';

function appendImage(formData, name, asset, fallbackName) {
  if (!asset?.uri) return;

  formData.append(name, {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || 'image/jpeg'
  });
}

function stripLegacyVerifierPath(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/verification-portal\/verify\/?$/i, '')
    .replace(/\/verification-portal\/?$/i, '')
    .replace(/\/verify\/?$/i, '');
}

function deriveWebBaseFromApi(apiBaseUrl) {
  try {
    const url = new URL(apiBaseUrl || API_ORIGIN);
    url.pathname = '';
    url.search = '';
    url.hash = '';

    if (url.protocol === 'http:' && (!url.port || url.port === '5000')) {
      url.port = '5173';
    }

    return stripLegacyVerifierPath(url.toString());
  } catch {
    return '';
  }
}

function firstWebBase(...values) {
  return values.map(stripLegacyVerifierPath).find(Boolean) || '';
}

function resolveWebBaseFromConfig(config = null) {
  return firstWebBase(
    VERIFICATION_WEB_BASE_URL,
    config?.domainWebBaseUrl,
    DOMAIN_WEB_BASE_URL,
    CONFIGURED_WEB_BASE_URL,
    config?.manualWebBaseUrl,
    config?.lanWebBaseUrl,
    deriveWebBaseFromApi(config?.apiBaseUrl || getApiBaseUrl()),
    WEB_BASE_URL
  );
}

async function resolveWebBase() {
  const config = await getSavedServerConfig().catch(() => null);
  const configured = resolveWebBaseFromConfig(config);

  if (configured) return configured;

  try {
    const url = new URL(API_ORIGIN);
    url.port = '5173';
    return stripLegacyVerifierPath(url.toString());
  } catch {
    return 'http://localhost:5173';
  }
}

function buildVerifierPortalUrl(sessionId, nonce = '', webBase = '') {
  if (!sessionId) return '';

  const suffix = nonce ? `?nonce=${encodeURIComponent(nonce)}` : '';
  return `${stripLegacyVerifierPath(webBase)}/verify/${encodeURIComponent(sessionId)}${suffix}`;
}

function normalizeReturnedVerifierUrl(value, sessionId, nonce = '', webBase = '') {
  const cleanValue = String(value || '').trim();
  const expected = buildVerifierPortalUrl(sessionId, nonce, webBase);

  if (!cleanValue) return expected;

  try {
    const parsed = new URL(cleanValue);
    const hasLegacyPath = /\/verification-portal\/verify\//i.test(parsed.pathname);
    const hitsApiServer = parsed.port === '5000';

    if (hasLegacyPath || hitsApiServer) {
      return expected;
    }

    if (/\/verify\//i.test(parsed.pathname)) {
      return cleanValue;
    }
  } catch {
    if (/^\/verification-portal\/verify\//i.test(cleanValue) || /^\/verify\//i.test(cleanValue)) {
      return expected;
    }
  }

  return expected || cleanValue;
}

function normalizeCredentialType(value) {
  const text = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['tor', 'transcript', 'transcript_of_records', 'student_record'].includes(text)) {
    return 'tor';
  }
  if (text.includes('diploma')) return 'diploma';
  return text || 'tor';
}

function getCredentialType(credential) {
  const raw =
    credential?.credentialType ||
    credential?.meta?.credentialType ||
    credential?.vcPayload?.credentialType ||
    credential?.signedCredential?.credentialType ||
    credential?.type;

  if (Array.isArray(raw)) {
    const diplomaType = raw.find((item) => /diploma/i.test(String(item)));
    const torType = raw.find((item) => /transcript|tor|record/i.test(String(item)));
    return normalizeCredentialType(diplomaType || torType || raw[0]);
  }

  return normalizeCredentialType(raw);
}

export async function getAccountVerification() {
  try {
    const { data } = await api.get(ENDPOINTS.verification.account);
    return data?.data || data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to load verification status'));
  }
}

export async function submitAccountVerification({
  idFront,
  idBack,
  selfie,
  answers,
  livenessPassed,
  livenessPassedAt,
  livenessMethod
}) {
  try {
    const formData = new FormData();
    appendImage(formData, 'idFront', idFront, 'id-front.jpg');
    appendImage(formData, 'idBack', idBack, 'id-back.jpg');
    appendImage(formData, 'validIdFront', idFront, 'valid-id-front.jpg');
    appendImage(formData, 'validIdBack', idBack, 'valid-id-back.jpg');
    appendImage(formData, 'selfie', selfie, 'selfie.jpg');
    appendImage(formData, 'liveness', selfie, 'liveness.jpg');
    formData.append('answers', JSON.stringify(answers || {}));
    formData.append('submittedStudentNo', answers?.studentNo || '');
    formData.append('fullName', answers?.fullName || '');
    formData.append('address', answers?.address || '');
    formData.append('program', answers?.program || '');
    formData.append('yearGraduated', answers?.yearGraduated || '');
    formData.append('graduationStatus', answers?.graduationStatus || '');
    formData.append('contactNo', answers?.contactNo || '');
    formData.append('validIdType', answers?.validIdType || '');
    formData.append('livenessPassed', (livenessPassed || answers?.livenessPassed) ? 'true' : 'false');
    formData.append('livenessPassedAt', livenessPassedAt || answers?.livenessPassedAt || '');
    formData.append('livenessMethod', livenessMethod || answers?.livenessMethod || '');

    const { data } = await api.post(ENDPOINTS.verification.submitAccount, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return data?.data || data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to submit verification'));
  }
}

export async function createShareSession({ credential, ttlHours = 168 }) {
  const credentialId = getCredentialRecordId(credential);
  if (!credentialId) throw new Error('Credential is missing an id');

  const credentialType = getCredentialType(credential);
  const webBase = await resolveWebBase();
  const verifyBaseUrl = `${webBase}/verify`;

  try {
    const response = await api.post(ENDPOINTS.verification.createSession, {
      ttlHours,
      credential_id: credentialId,
      credentialId,
      credentialType,
      verifyBaseUrl,
      request: {
        credentialType,
        purpose: 'Credential verification'
      }
    });

    const data = response.data?.data || response.data;
    const sessionId = data?.session_id || data?.sessionId || data?.id || data?._id;
    const nonce = data?.nonce || '';
    const verifyUrl = normalizeReturnedVerifierUrl(
      data?.verifyUrl || data?.verificationUrl || data?.url,
      sessionId,
      nonce,
      webBase
    );

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('VERIFIER QR URL:', verifyUrl);
    }

    return {
      ...data,
      sessionId,
      session_id: data?.session_id || sessionId,
      nonce,
      credentialId,
      credentialType,
      verifyUrl
    };
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to create sharing session'));
  }
}

export function buildVerifierShareUrl(credential) {
  const credentialId = getCredentialRecordId(credential);
  if (!credentialId) throw new Error('Credential is missing an id');

  const credentialType = getCredentialType(credential);
  const base = `${resolveWebBaseFromConfig()}/verify`;
  if (!base) {
    throw new Error('Verifier web portal URL is not configured');
  }

  const params = new URLSearchParams({
    credentialId,
    credentialType
  });

  return `${base}?${params.toString()}`;
}

export async function getVerificationRequest(sessionId, nonce = '') {
  try {
    const { data } = await api.get(ENDPOINTS.verification.session(sessionId), {
      headers: { 'Cache-Control': 'no-store' },
      params: nonce ? { nonce } : undefined
    });
    return data?.data || data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to load verification request'));
  }
}

export async function approveVerificationRequest({
  sessionId,
  nonce = '',
  credential,
  allowPdfDownload = false
}) {
  if (!sessionId) throw new Error('Missing verification session');
  if (!credential) throw new Error('Choose a credential to share');

  const credentialId = getCredentialRecordId(credential);
  const presentedCredential =
    credential?.vcPayload ||
    credential?.signedCredential ||
    credential?.verifiableCredential ||
    credential;
  const body = {
    decision: 'approve',
    credential_id: credentialId,
    credential: presentedCredential,
    nonce,
    allowPdfDownload: Boolean(allowPdfDownload)
  };

  try {
    const { data } = await api.post(ENDPOINTS.verification.present(sessionId), body);
    return data?.data || data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to share credential'));
  }
}

export async function denyVerificationRequest(sessionId, nonce = '') {
  if (!sessionId) throw new Error('Missing verification session');

  try {
    const { data } = await api.post(ENDPOINTS.verification.present(sessionId), {
      decision: 'deny',
      nonce
    });
    return data?.data || data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to deny request'));
  }
}

