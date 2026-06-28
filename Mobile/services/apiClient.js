import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { getActiveApiBaseUrl as readActiveApiBaseUrl } from '@/services/serverConfigService';
import { getSessionToken } from '@/utils/storage';

let activeApiBaseUrl = API_BASE_URL;

export const api = axios.create({
  baseURL: activeApiBaseUrl,
  timeout: 25000
});

export function setApiBaseUrl(url) {
  activeApiBaseUrl = String(url || API_BASE_URL).trim().replace(/\/+$/, '') || API_BASE_URL;
  api.defaults.baseURL = activeApiBaseUrl;
  return activeApiBaseUrl;
}

export function getApiBaseUrl() {
  return activeApiBaseUrl;
}

export async function refreshApiBaseUrl() {
  const nextUrl = await readActiveApiBaseUrl();
  return setApiBaseUrl(nextUrl || API_BASE_URL);
}

api.interceptors.request.use(async (config) => {
  const baseURL = await refreshApiBaseUrl();
  const token = await getSessionToken();
  const headers = {
    Accept: 'application/json',
    ...(config.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  config.headers = headers;
  config.baseURL = baseURL;

  if (__DEV__) {
    console.log('[BCVS API]', {
      baseURL,
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
        baseURL: error?.config?.baseURL || activeApiBaseUrl,
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

export function clearApiAuthState() {
  delete api.defaults.headers.common.Authorization;
  delete api.defaults.headers.Authorization;
}

export function apiErrorMessage(error, fallback = 'Request failed') {
  const responseMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.reason ||
    '';

  if (
    error?.response?.status === 503 ||
    String(responseMessage).toLowerCase().includes('maintenance')
  ) {
    return responseMessage || 'CredPocket is currently under maintenance.';
  }

  if (isNetworkError(error)) {
    if (__DEV__) {
      return `Cannot reach the BCVS server. Active API URL: ${activeApiBaseUrl}. Check that the server is running and this device is on the same network.`;
    }

    return 'Cannot reach the BCVS server. Check your connection and try again.';
  }

  return (
    responseMessage ||
    error?.message ||
    fallback
  );
}

