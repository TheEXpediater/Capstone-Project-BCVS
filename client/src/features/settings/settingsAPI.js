import api from '../../services/api';

export async function getSettingsDashboard() {
  const response = await api.get('/settings/dashboard');
  return response.data.data;
}

export async function updateSystemSettings(payload) {
  const response = await api.put('/settings', payload);
  return response.data.data;
}

export async function updateAdminPermissions(userId, permissions) {
  const response = await api.put(`/settings/admin-permissions/${userId}`, { permissions });
  return response.data.data;
}