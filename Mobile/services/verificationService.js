import { API_ORIGIN, ENDPOINTS, WEB_BASE_URL } from '@/constants/config';
import { api, apiErrorMessage } from '@/services/apiClient';
import { getCredentialRecordId } from '@/utils/credentialUtils';

function appendImage(formData, name, asset, fallbackName) {
  if (!asset?.uri) return;

  formData.append(name, {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || 'image/jpeg'
  });
}

function resolveWebBase() {
  if (WEB_BASE_URL) return WEB_BASE_URL;

  try {
    const url = new URL(API_ORIGIN);
    return `${url.protocol}//${url.hostname}:5173`;
  } catch {
    return 'http://localhost:5173';
  }
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
    appendImage(formData, 'selfie', selfie, 'selfie.jpg');
    formData.append('answers', JSON.stringify(answers || {}));
    formData.append('submittedStudentNo', answers?.studentNo || '');
    formData.append('fullName', answers?.fullName || '');
    formData.append('livenessPassed', livenessPassed || answers?.livenessPassed ? 'true' : 'false');
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

  try {
    const response = await api.post(ENDPOINTS.verification.createSession, {
      ttlHours,
      credential_id: credentialId,
      verifyBaseUrl: `${resolveWebBase()}/verify`
    });
    const data = response.data?.data || response.data;
    const sessionId = data?.session_id || data?.sessionId || data?.id || data?._id;
    const nonce = data?.nonce || '';
    const base = resolveWebBase();
    const fallbackVerifyUrl =
      base && sessionId
        ? `${base}/verify/${encodeURIComponent(sessionId)}${nonce ? `?nonce=${encodeURIComponent(nonce)}` : ''}`
        : sessionId
          ? `bcvs://verification/session/${encodeURIComponent(sessionId)}${nonce ? `?nonce=${encodeURIComponent(nonce)}` : ''}`
          : '';
    const verifyUrl =
      data?.verifyUrl ||
      data?.url ||
      fallbackVerifyUrl;

    return {
      ...data,
      sessionId,
      nonce,
      verifyUrl
    };
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to create sharing session'));
  }
}

export function buildVerifierShareUrl(credential) {
  const credentialId = getCredentialRecordId(credential);
  if (!credentialId) throw new Error('Credential is missing an id');

  const credentialType =
    credential?.credentialType ||
    credential?.meta?.credentialType ||
    credential?.vcPayload?.credentialType ||
    '';
  const base = `${resolveWebBase()}/verify`;
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
