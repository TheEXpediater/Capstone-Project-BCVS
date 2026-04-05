import api from '../../services/api';

export async function getSettingsDashboard() {
  const response = await api.get('/settings/dashboard');
  return response.data.data;
}

export async function updateBusinessSettings(payload) {
  const response = await api.put('/settings/business', payload);
  return response.data.data;
}

export async function updateSystemLocks(payload) {
  const response = await api.put('/settings/locks', payload);
  return response.data.data;
}

export async function updateAdminPermissions(userId, permissions) {
  const response = await api.put(`/settings/admin-permissions/${userId}`, { permissions });
  return response.data.data;
}

export async function createIssuerKey(payload) {
  const response = await api.post('/settings/issuer-keys', payload);
  return response.data.data;
}

export async function rotateIssuerKey(payload) {
  const response = await api.post('/settings/issuer-keys/rotate', payload);
  return response.data.data;
}

export async function activateIssuerKey(keyId) {
  const response = await api.put(`/settings/issuer-keys/${keyId}/activate`);
  return response.data.data;
}

export async function updateIssuerKey(keyId, payload) {
  const response = await api.put(`/settings/issuer-keys/${keyId}`, payload);
  return response.data.data;
}

export async function deleteIssuerKey(keyId) {
  const response = await api.delete(`/settings/issuer-keys/${keyId}`);
  return response.data.data;
}

export async function updateActiveContract(payload) {
  const response = await api.put('/settings/blockchain/active-contract', payload);
  return response.data.data;
}