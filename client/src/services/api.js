import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth');

  if (raw) {
    try {
      const parsed = JSON.parse(raw);

      if (parsed?.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    } catch (_error) {
      localStorage.removeItem('auth');
    }
  }

  return config;
});

export default api;