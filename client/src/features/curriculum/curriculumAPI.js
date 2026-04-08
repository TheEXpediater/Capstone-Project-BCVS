import api from '../../services/api';

export async function listCurricula() {
  const response = await api.get('/curricula');
  return response.data.data;
}

export async function getCurriculumById(id) {
  const response = await api.get(`/curricula/${id}`);
  return response.data.data;
}

export async function saveCurriculum(payload) {
  const response = await api.post('/curricula', payload);
  return response.data.data;
}

export async function deleteCurriculum(id) {
  const response = await api.delete(`/curricula/${id}`);
  return response.data.data;
}