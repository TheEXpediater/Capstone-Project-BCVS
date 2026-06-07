import api from '../../services/api';

export async function listUsers(params = {}) {
  const response = await api.get('/users', { params });
  return response.data.users;
}

export async function createWebUser(payload) {
  const response = await api.post('/auth/web/users', payload);
  return response.data.user;
}
