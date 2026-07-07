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

export async function bulkCreateCredentialDraftsFromStudents(studentIds = [], payload = {}) {
  const response = await api.post('/credentials/bulk/from-students', {
    studentIds,
    ...payload,
  });
  return response.data.data;
}

export async function updateCredentialDraft(id, payload = {}) {
  const response = await api.put(`/credentials/${id}`, payload);
  return response.data.data;
}

export async function deleteCredentialDraft(id) {
  const response = await api.delete(`/credentials/${id}`);
  return response.data.data;
}

export async function listCredentialPayments(params = {}) {
  const response = await api.get('/credentials/payments', { params });
  return response.data.data;
}

export async function markCredentialPaymentPaid(id, payload = {}) {
  const response = await api.put(`/credentials/payments/${id}/paid`, payload);
  return response.data.data;
}

export async function submitCredentialDraft(id) {
  const response = await api.put(`/credentials/${id}/submit`);
  return response.data.data;
}

export async function bulkSubmitCredentialDrafts(ids = []) {
  const response = await api.post('/credentials/bulk/submit', { ids });
  return response.data.data;
}

export async function bulkDeleteCredentialDrafts(ids = []) {
  const response = await api.post('/credentials/bulk/delete', { ids });
  return response.data.data;
}

export async function rejectCredentialDraft(id, payload = {}) {
  const response = await api.put(`/credentials/${id}/reject`, payload);
  return response.data.data;
}

export async function signCredentialDraft(id, payload = {}) {
  const response = await api.put(`/credentials/${id}/sign`, payload);
  return response.data.data;
}

export async function bulkSignCredentialDrafts(ids = []) {
  const response = await api.post('/credentials/bulk/sign', { ids });
  return response.data.data;
}

export async function createCredentialClaimToken(id, payload = {}) {
  const response = await api.post(`/credentials/${id}/claim-token`, payload);
  return response.data.data;
}

export async function bulkCreateCredentialClaimTokens(ids = []) {
  const response = await api.post('/credentials/bulk/claim-token', { ids });
  return response.data.data;
}

export async function createCredentialClaimOverrideToken(id, payload = {}) {
  const response = await api.post(`/credentials/${id}/claim-token/override`, payload);
  return response.data.data;
}

export async function scheduleCredentialAnchor(id, payload = {}) {
  const response = await api.put(`/credentials/${id}/schedule-anchor`, payload);
  return response.data.data;
}

export async function bulkScheduleCredentialAnchors(ids = [], payload = {}) {
  const response = await api.post('/credentials/bulk/schedule-anchor', { ids, ...payload });
  return response.data.data;
}

export async function anchorCredential(id, payload = {}) {
  const response = await api.post(`/anchors/credential/${id}`, payload);
  return response.data.data;
}

export async function batchAnchorCredentials(credentialIds = []) {
  const response = await api.post('/anchors/batch', { credentialIds });
  return response.data.data;
}

export async function verifyCredentialAnchor(id) {
  const response = await api.get(`/anchors/verify/${id}`);
  return response.data.data;
}

export async function getTodaysAnchorQueueSummary() {
  const response = await api.get('/credentials/anchor-queue/today');
  return response.data.data;
}

export async function processTodaysAnchorQueue() {
  const response = await api.post('/credentials/anchor-queue/today/process');
  return response.data.data;
}
