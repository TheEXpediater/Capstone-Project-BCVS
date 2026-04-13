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

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    clearStoredAuth();
  }
}