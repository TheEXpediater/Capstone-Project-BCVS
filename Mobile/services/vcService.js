import { ENDPOINTS } from '@/constants/config';
import { api, apiErrorMessage } from '@/services/apiClient';
import { getDeviceId } from '@/utils/device';
import { normalizeCredential } from '@/utils/credentialUtils';
import { loadSession, readJson, STORAGE_KEYS, writeJson } from '@/utils/storage';

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
    const { data } = await api.get(ENDPOINTS.credentials.list);
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
  const token =
    typeof scanResult === 'string'
      ? String(scanResult).trim()
      : String(
          scanResult?.token ||
            scanResult?.claimToken ||
            scanResult?.claim_token ||
            ''
        ).trim();

  if (!token) {
    throw new Error('QR code does not contain a claim token');
  }

  try {
    const { user } = await loadSession();
    const deviceId = await getDeviceId();
    const { data } = await api.post(ENDPOINTS.credentials.claim, {
      token,
      studentId: user?.studentId || '',
      deviceId
    });
    const credential =
      data?.credential ||
      data?.data?.credential ||
      data?.vc ||
      data?.data?.vc ||
      null;

    if (!credential) {
      throw new Error('Claim response did not include a signed credential');
    }

    return saveCredential(credential);
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to claim credential'));
  }
}
