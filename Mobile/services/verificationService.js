import { ENDPOINTS, WEB_BASE_URL } from '@/constants/config';
import { api, apiErrorMessage } from '@/services/apiClient';
import { getCredentialId } from '@/utils/credentialUtils';

export async function createShareSession({ credential, ttlHours = 168 }) {
  const credentialId = getCredentialId(credential);
  if (!credentialId) throw new Error('Credential is missing an id');

  try {
    const { data } = await api.post(ENDPOINTS.verification.createSession, {
      ttlHours,
      credential_id: credentialId
    });
    const sessionId = data?.session_id || data?.sessionId || data?.id || data?._id;
    const nonce = data?.nonce || data?.data?.nonce || '';
    const fallbackVerifyUrl =
      WEB_BASE_URL && sessionId
        ? `${WEB_BASE_URL}/${encodeURIComponent(sessionId)}${nonce ? `?nonce=${encodeURIComponent(nonce)}` : ''}`
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

export async function getVerificationRequest(sessionId, nonce = '') {
  try {
    const { data } = await api.get(ENDPOINTS.verification.session(sessionId), {
      headers: { 'Cache-Control': 'no-store' },
      params: nonce ? { nonce } : undefined
    });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to load verification request'));
  }
}

export async function approveVerificationRequest({ sessionId, nonce = '', credential }) {
  if (!sessionId) throw new Error('Missing verification session');
  if (!credential) throw new Error('Choose a credential to share');

  const credentialId = getCredentialId(credential);
  const body = {
    decision: 'approve',
    credential_id: credentialId,
    credential,
    nonce
  };

  try {
    const { data } = await api.post(ENDPOINTS.verification.present(sessionId), body);
    return data;
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
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to deny request'));
  }
}
