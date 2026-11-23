import axios from 'axios';

const api = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_URL || 'https://hostapi.soft7.in/v1')
    .replace(/([^:]\/)\/+/g, "$1")
    .replace(/\/v1\/?$/, ''),
});

// Add interceptor
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('console_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
