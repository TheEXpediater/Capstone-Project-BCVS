import { ENDPOINTS } from '@/constants/config';
import { api, apiErrorMessage } from '@/services/apiClient';
import { normalizeCredential } from '@/utils/credentialUtils';
import { readJson, STORAGE_KEYS, writeJson } from '@/utils/storage';

async function readLocalCredentials() {
  return readJson(STORAGE_KEYS.CREDENTIALS, []);
}

async function writeLocalCredentials(credentials) {
  await writeJson(STORAGE_KEYS.CREDENTIALS, credentials || []);
}

export async function listCredentials() {
  return readLocalCredentials();
}

export async function saveCredential(credential) {
  const normalized = normalizeCredential(credential);
  const current = await readLocalCredentials();
  const next = [
    normalized,
    ...current.filter((item) => String(item.id) !== String(normalized.id))
  ];
  await writeLocalCredentials(next);
  return normalized;
}

export async function deleteCredential(id) {
  const current = await readLocalCredentials();
  const next = current.filter((item) => String(item.id) !== String(id));
  await writeLocalCredentials(next);
  return next;
}

export async function getCredential(id) {
  const current = await readLocalCredentials();
  return current.find((item) => String(item.id) === String(id)) || null;
}

export async function syncFromBackend() {
  try {
    const { data } = await api.get(ENDPOINTS.credentials.wallet);
    const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const normalized = rows.map((item) => normalizeCredential(item));
    await writeLocalCredentials(normalized);
    return normalized;
  } catch (error) {
    if (error?.response?.status === 404) return readLocalCredentials();
    throw new Error(apiErrorMessage(error, 'Failed to sync credentials'));
  }
}

export async function claimCredential(scanResult) {
  if (scanResult?.kind === 'credential' && scanResult.credential) {
    return saveCredential(scanResult.credential);
  }

  if (scanResult?.kind === 'claim_url' && scanResult.url) {
    try {
      const response = await fetch(scanResult.url, { cache: 'no-store' });
      const payload = await response.json();
      return saveCredential(payload.credential || payload.vc || payload);
    } catch (error) {
      throw new Error(error?.message || 'Failed to claim credential from QR');
    }
  }

  if (scanResult?.token) {
    try {
      const { data } = await api.post(ENDPOINTS.credentials.claim, {
        token: scanResult.token
      });
      return saveCredential(data.credential || data.vc || data);
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Failed to claim credential'));
    }
  }

  throw new Error('QR code does not contain a claimable credential');
}

