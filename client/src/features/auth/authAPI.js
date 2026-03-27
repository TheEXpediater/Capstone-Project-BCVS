import api from '../../services/api';

const STORAGE_KEY = 'auth';

export function readStoredAuth() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function writeStoredAuth(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function loginWeb(credentials) {
  const { data } = await api.post('/api/auth/web/login', credentials);

  const authPayload = {
    token: data.token,
    sessionId: data.sessionId,
    user: data.user,
  };

  writeStoredAuth(authPayload);
  return authPayload;
}

export async function getWebMe() {
  const { data } = await api.get('/api/auth/web/me');
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
    await api.post('/api/auth/logout');
  } finally {
    clearStoredAuth();
  }
}
