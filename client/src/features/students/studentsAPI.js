import api from '../../services/api';

export async function listStudents(params = {}) {
  const response = await api.get('/students', { params });
  return response.data.data;
}

export async function searchStudents(query) {
  const response = await api.get('/students/search', { params: { query } });
  return response.data.data;
}

export async function createStudentProfile(payload) {
  const response = await api.post('/students', payload);
  return response.data.data;
}

export async function getStudentProfile(id) {
  const response = await api.get(`/students/${id}`);
  return response.data.data;
}

export async function updateStudentProfile(id, payload) {
  const response = await api.put(`/students/${id}`, payload);
  return response.data.data;
}

export async function deleteStudentProfile(id) {
  const response = await api.delete(`/students/${id}`);
  return response.data.data;
}

export async function getStudentGrades(id) {
  const response = await api.get(`/students/${id}/grades`);
  return response.data.data;
}

export async function bulkImportStudents(rows) {
  const response = await api.post('/students/import', { rows });
  return response.data.data;
}

export async function bulkImportStudentGrades(rows) {
  const response = await api.post('/students/import-grades', { rows });
  return response.data.data;
}

export async function bulkDeleteStudents(ids = []) {
  const response = await api.post('/students/bulk-delete', { ids });
  return response.data.data;
}
