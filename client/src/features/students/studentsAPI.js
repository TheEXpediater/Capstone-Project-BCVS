import api from '../../services/api';

export async function listStudents() {
  const response = await api.get('/students');
  return response.data.data;
}

export async function getStudentProfile(id) {
  const response = await api.get(`/students/${id}`);
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