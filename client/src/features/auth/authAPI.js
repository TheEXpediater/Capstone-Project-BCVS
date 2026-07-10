import api from '../../services/api';
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
} from './authStorage';

export { clearStoredAuth, readStoredAuth } from './authStorage';

export async function loginWeb(credentials) {
  const { data } = await api.post('/auth/web/login', credentials);

  const authPayload = {
    token: data.token,
    sessionId: data.sessionId,
    user: data.user,
  };

  writeStoredAuth(authPayload);
  return authPayload;
}

export async function getWebMe() {
  const { data } = await api.get('/auth/web/me');
  const stored = readStoredAuth();

  if (stored) {
    const nextAuth = {
      ...stored,
      user: data.user,
    };

    writeStoredAuth(nextAuth);
    return nextAuth;
  }

  return {
    token: null,
    sessionId: null,
    user: data.user,
  };
}

export async function updateWebProfile(payload) {
  const { data } = await api.patch('/auth/web/me', payload);
  const stored = readStoredAuth();

  if (stored) {
    writeStoredAuth({
      ...stored,
      user: data.user,
    });
  }

  return data.user;
}

export async function uploadWebProfileImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const { data } = await api.post('/auth/web/me/profile-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const stored = readStoredAuth();

  if (stored) {
    writeStoredAuth({
      ...stored,
      user: data.user,
    });
  }

  return data.user;
}

export async function updateWebPassword(payload) {
  const { data } = await api.post('/auth/web/me/password', payload);
  return data;
}

export async function logout() {
  try {
    await api.post('/auth/logout', null, { skipAuthRedirect: true });
  } finally {
    clearStoredAuth();
  }
}
