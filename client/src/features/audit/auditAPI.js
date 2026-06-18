import api from '../../services/api';

export async function getAuditLogs(params = {}) {
  const response = await api.get('/audit-logs', { params });
  return response.data.data;
}

export async function getAuditLog(id) {
  const response = await api.get(`/audit-logs/${encodeURIComponent(id)}`);
  return response.data.data;
}

export async function deleteAuditLog(id) {
  const response = await api.delete(`/audit-logs/${encodeURIComponent(id)}`);
  return response.data.data;
}

export async function bulkDeleteAuditLogs(ids = []) {
  const response = await api.post('/audit-logs/bulk-delete', { ids });
  return response.data.data;
}