import api from '../../services/api';

export async function listCredentialDrafts(params = {}) {
  const response = await api.get('/credentials', { params });
  return response.data.data;
}

export async function getCredentialDraftById(id) {
  const response = await api.get(`/credentials/${id}`);
  return response.data.data;
}

export async function createCredentialDraftFromStudent(studentId, payload = {}) {
  const response = await api.post(`/credentials/from-student/${studentId}`, payload);
  return response.data.data;
}

export async function submitCredentialDraft(id) {
  const response = await api.put(`/credentials/${id}/submit`);
  return response.data.data;
}

export async function rejectCredentialDraft(id, payload = {}) {
  const response = await api.put(`/credentials/${id}/reject`, payload);
  return response.data.data;
}

export async function signCredentialDraft(id) {
  const response = await api.put(`/credentials/${id}/sign`);
  return response.data.data;
}

export async function scheduleCredentialAnchor(id, payload = {}) {
  const response = await api.put(`/credentials/${id}/schedule-anchor`, payload);
  return response.data.data;
}