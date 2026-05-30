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
  return config;
});

export function apiErrorMessage(error, fallback = 'Request failed') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.reason ||
    error?.message ||
    fallback
  );
}

