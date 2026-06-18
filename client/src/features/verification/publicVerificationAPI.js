import axios from 'axios';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'
).replace(/\/+$/, '');

const publicApi = axios.create({
  baseURL: API_BASE_URL,
});

function unwrap(response) {
  return response.data?.data || response.data;
}

export async function createPublicVerificationSession(payload) {
  const response = await publicApi.post('/verification/session', payload);
  return unwrap(response);
}

export async function requestHolderConsent(sessionId, payload) {
  const response = await publicApi.post(
    `/verification/session/${encodeURIComponent(sessionId)}/request`,
    payload
  );
  return unwrap(response);
}

export async function getPublicVerificationSession(sessionId, nonce) {
  const response = await publicApi.get(
    `/verification/session/${encodeURIComponent(sessionId)}/public`,
    {
      params: { nonce },
      headers: { 'Cache-Control': 'no-store' },
    }
  );
  return unwrap(response);
}

export async function getPublicVerificationResult(sessionId, nonce) {
  const response = await publicApi.get(
    `/verification/session/${encodeURIComponent(sessionId)}/result`,
    {
      params: { nonce },
      headers: { 'Cache-Control': 'no-store' },
    }
  );
  return unwrap(response);
}

export async function cancelPublicVerificationSession(sessionId, nonce) {
  const response = await publicApi.post(
    `/verification/session/${encodeURIComponent(sessionId)}/cancel`,
    { nonce }
  );
  return unwrap(response);
}

export function buildDownloadUrl(sessionId, nonce, kind) {
  const params = new URLSearchParams({ nonce });
  return `${API_BASE_URL}/verification/session/${encodeURIComponent(sessionId)}/download/${kind}?${params.toString()}`;
}
