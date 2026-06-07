import api from '../../services/api';

export async function listVerificationSubmissions(params = {}) {
  const response = await api.get('/verification/admin/submissions', { params });
  return response.data.data?.submissions || [];
}

export async function getVerificationSubmission(id) {
  const response = await api.get(`/verification/admin/submissions/${id}`);
  return response.data.data;
}

export async function approveVerificationSubmission(id, payload) {
  const response = await api.post(`/verification/admin/submissions/${id}/approve`, payload);
  return response.data.data;
}

export async function rejectVerificationSubmission(id, reason) {
  const response = await api.post(`/verification/admin/submissions/${id}/reject`, { reason });
  return response.data.data;
}
