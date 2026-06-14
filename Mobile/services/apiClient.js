import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { getSessionToken } from '@/utils/storage';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000
});

api.interceptors.request.use(async (config) => {
  const token = await getSessionToken();
  const headers = {
    Accept: 'application/json',
    ...(config.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  config.headers = headers;

  if (__DEV__) {
    console.log('[BCVS API]', {
      baseURL: API_BASE_URL,
      method: String(config.method || 'GET').toUpperCase(),
      url: config.url
    });
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__ && !error?.response) {
      console.log('[BCVS API network error]', {
        baseURL: API_BASE_URL,
        method: String(error?.config?.method || 'GET').toUpperCase(),
        url: error?.config?.url,
        code: error?.code,
        message: error?.message
      });
    }

    return Promise.reject(error);
  }
);

export function isNetworkError(error) {
  return Boolean(!error?.response && (error?.request || error?.message === 'Network Error' || error?.code));
}

export function apiErrorMessage(error, fallback = 'Request failed') {
  if (isNetworkError(error)) {
    return `Cannot reach the BCVS server at ${API_BASE_URL}. Check that the server is running and this device is on the same network.`;
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.reason ||
    error?.message ||
    fallback
  );
}

