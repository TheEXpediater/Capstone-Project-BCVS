import api from '../../services/api';

export async function listWebUsers() {
  const response = await api.get('/auth/web/users');
  return response.data.users;
}

export async function createWebUser(payload) {
  const response = await api.post('/auth/web/users', payload);
  return response.data.user;
}
