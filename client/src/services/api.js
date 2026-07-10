import axios from 'axios';
import {
  clearStoredAuth,
  readStoredAuth,
} from '../features/auth/authStorage';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'
).replace(/\/+$/, '');

export { API_BASE_URL };

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/i, '');

export function resolveAssetUrl(value) {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  return `${API_ORIGIN}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const stored = readStoredAuth();

  if (stored?.token) {
    config.headers.Authorization = `Bearer ${stored.token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message || error.message || '';

    const normalized = String(message).toLowerCase();

    const shouldForceLogout =
      !error.config?.skipAuthRedirect &&
      (status === 401 ||
        normalized.includes('jwt expired') ||
        normalized.includes('session expired') ||
        normalized.includes('session has expired'));

    if (shouldForceLogout) {
      clearStoredAuth();

      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login'
      ) {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
